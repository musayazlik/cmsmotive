import { randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_AGENT_MODELS, DEFAULT_IMAGE_MODELS, DEFAULT_TEXT_MODELS, pickModel } from "@/lib/ai-settings-shared";
import {
  chatWithTools,
  listTextAndImageModels,
  type AgentMessage,
  type ToolCall,
  type ToolDefinition,
} from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { activityStep, cancelActivity, currentActivityId, trackActivity, waitingActivityStep } from "@/lib/assistant-activity";
import { getAiSettings } from "@/lib/settings";
import { mcpStoreId, resolveMcpActor, runWithModelOverrides } from "@/mcp/context";
import { readStoreValues, upsertStoreValue } from "@/lib/settings-store";
import { createCmsMcpServer } from "@/mcp/create-server";
import type { AiLanguage } from "@/app/panel/blog/_ai";
import { editText, sendPhoto, sendText, sendTyping } from "./api";
import { sendPostCard } from "./drafts";
import { DEFAULT_MODE, isToolMode, TOOL_MODES, toolInMode, type ToolMode } from "./modes";

/**
 * The Telegram agent: an OpenRouter tool-calling model (the chat model)
 * driving the same MCP server the stdio and HTTP transports expose, connected
 * in-process. Long-form writing is delegated to the ai_write_post /
 * ai_rewrite_post tools, which use the content model from Settings → AI.
 *
 * Approval rules: reading, AI drafts, images and draft posts run directly;
 * every other change (edits, publishing, deletions, taxonomy, settings) waits
 * for the user's Confirm tap. The in-flight conversation is stored so the
 * run resumes where it stopped. Every post the run touched ends up as a card
 * with a preview link and Publish / Discard buttons (telegram/drafts.ts).
 */

const MAX_STEPS = 16;
const HISTORY_TURNS = 30;
const TOOL_RESULT_LIMIT = 12_000;
const PENDING_TTL_MS = 15 * 60 * 1000;

export type AgentContext = {
  token: string;
  chatId: number;
  /** Public site origin for links in replies. */
  origin: string;
  /** Settings → Telegram chat model; "" picks one automatically. */
  model: string;
  /** Settings → Telegram content and image models; "" = Settings → AI. */
  contentModel: string;
  imageModel: string;
};

/** A run in progress: the conversation so far and tool calls still to execute. */
type RunState = {
  activityId?: string;
  userText: string;
  /** The tool mode the run started in; a confirmed call resumes with the same tools. */
  mode: ToolMode;
  messages: AgentMessage[];
  queue: ToolCall[];
  /** Tool call ids the user confirmed. */
  approved: string[];
  /** Posts created or changed in this run; each gets a review card at the end. */
  touchedPosts: string[];
  /** ai_write_post calls whose language and image count the user picked. */
  postOptionsSet: string[];
  steps: number;
};

type Pending = RunState & { nonce: string; expiresAt: number };

const historyKey = (chatId: number) => `telegram.history.${chatId}`;
const pendingKey = (chatId: number) => `telegram.pending.${chatId}`;
const modeKey = (chatId: number) => `telegram.mode.${chatId}`;

/* ------------------------------------------------------------- persistence */

// Conversations are kept per store: a Telegram user has the same chat id with
// every bot, and each store runs its own bot (telegram/handler.ts runInStore).

async function loadJson<T>(key: string, fallback: T): Promise<T> {
  const raw = (await readStoreValues(mcpStoreId(), [key])).get(key);
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(key: string, value: unknown) {
  await upsertStoreValue(mcpStoreId(), key, JSON.stringify(value));
}

export async function clearConversation(chatId: number) {
  await dropPending(chatId);
  await prisma.storeSetting.deleteMany({ where: { storeId: mcpStoreId(), key: { in: [historyKey(chatId), pendingKey(chatId)] } } });
}

/** Drops a waiting confirmation; returns whether there was one. */
export async function dropPending(chatId: number, cancel = true): Promise<boolean> {
  if (cancel) {
    const pending = await loadJson<Pending | null>(pendingKey(chatId), null);
    await cancelActivity(mcpStoreId(), pending?.activityId);
  }
  const { count } = await prisma.storeSetting.deleteMany({ where: { storeId: mcpStoreId(), key: pendingKey(chatId) } });
  return count > 0;
}

/** The chat's tool mode; it survives /new and stays until the user switches. */
export async function getChatMode(chatId: number): Promise<ToolMode> {
  const mode = await loadJson<unknown>(modeKey(chatId), DEFAULT_MODE);
  return isToolMode(mode) ? mode : DEFAULT_MODE;
}

export async function setChatMode(chatId: number, mode: ToolMode) {
  await saveJson(modeKey(chatId), mode);
}

/** Adds a line to the chat history, e.g. a decision taken with a card button. */
export async function appendHistory(chatId: number, entries: AgentMessage[]) {
  const history = await loadJson<AgentMessage[]>(historyKey(chatId), []);
  await saveJson(historyKey(chatId), [...history, ...entries].slice(-HISTORY_TURNS));
}

/* ------------------------------------------------------------------- tools */

type McpToolInfo = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean };
};

/** The bot's own tool, next to the MCP ones: show an image in the chat. */
const SEND_PHOTO_TOOL: ToolDefinition = {
  name: "telegram_send_photo",
  description:
    "Show an image to the user in this Telegram chat, e.g. a generated cover, so they can judge it before it is used.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Public image URL (a media asset url)." },
      caption: { type: "string", description: "Short caption." },
    },
    required: ["url"],
  },
};

/** Changes that only add drafts or media, which the user reviews afterwards. */
const RUNS_WITHOUT_APPROVAL = new Set(["ai_write_post", "ai_generate_image", "media_upload", SEND_PHOTO_TOOL.name]);

/** Whether this call waits for the user's Confirm tap. */
function needsApproval(tool: McpToolInfo | undefined, args: Record<string, unknown>): boolean {
  if (!tool) return false;
  if (tool.annotations?.readOnlyHint || RUNS_WITHOUT_APPROVAL.has(tool.name)) return false;
  if (tool.name === "blog_posts_create") return (args.status ?? "draft") !== "draft";
  return true;
}

function parseArgs(call: ToolCall): Record<string, unknown> | null {
  try {
    return call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return null;
  }
}

async function connectTools(mode: ToolMode) {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  const server = createCmsMcpServer();
  const client = new Client({ name: "cmsmotive-telegram", version: "0.1.0" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  const tools = (await client.listTools()).tools.filter((tool) => toolInMode(mode, tool.name));
  const byName = new Map((tools as McpToolInfo[]).map((tool) => [tool.name, tool]));
  const definitions: ToolDefinition[] = [
    ...(tools as McpToolInfo[]).map((tool) => {
      const { $schema: _schema, ...parameters } = tool.inputSchema;
      const approval =
        tool.name === "blog_posts_create"
          ? " (Drafts run directly; any other status asks the user to confirm.)"
          : needsApproval(tool, {})
            ? " (Asks the user to confirm in Telegram.)"
            : "";
      return { name: tool.name, description: `${tool.description ?? tool.name}${approval}`, parameters };
    }),
    SEND_PHOTO_TOOL,
  ];
  return { client, byName, definitions, close: () => client.close() };
}

type Tools = Awaited<ReturnType<typeof connectTools>>;

function resultText(result: CallToolResult): string {
  const text = result.content
    .map((part) => (part.type === "text" ? part.text : `[${part.type} content]`))
    .join("\n");
  const clipped = text.length > TOOL_RESULT_LIMIT ? `${text.slice(0, TOOL_RESULT_LIMIT)}\n…(truncated)` : text;
  return result.isError ? `Error: ${clipped}` : clipped;
}

const POST_WRITES = new Set(["ai_write_post", "ai_rewrite_post", "blog_posts_create", "blog_posts_update", "blog_posts_set_status"]);

/** The post id a successful post write reports ({ id } or { post: { id } }). */
function touchedPostId(name: string, content: string): string | null {
  if (!POST_WRITES.has(name) || content.startsWith("Error:")) return null;
  try {
    const data = JSON.parse(content) as { id?: unknown; post?: { id?: unknown } };
    const id = data.post?.id ?? data.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

async function executeCall(ctx: AgentContext, tools: Tools, call: ToolCall, state: RunState): Promise<string> {
  const args = parseArgs(call);
  if (!args) return "Error: the tool arguments were not valid JSON.";

  if (call.function.name === SEND_PHOTO_TOOL.name) {
    if (typeof args.url !== "string") return "Error: url is required.";
    await activityStep("Sending the image to Telegram…");
    await sendPhoto(ctx.token, ctx.chatId, args.url, typeof args.caption === "string" ? args.caption : undefined);
    return "The image was shown to the user.";
  }
  if (!tools.byName.has(call.function.name)) return `Error: there is no tool named ${call.function.name}.`;

  if (call.function.name === "ai_generate_image") await sendTyping(ctx.token, ctx.chatId, "upload_photo");
  let content: string;
  try {
    const result = (await tools.client.callTool(
      { name: call.function.name, arguments: args },
      undefined,
      // Deep research plus writing can take several minutes.
      { timeout: 900_000 },
    )) as CallToolResult;
    content = resultText(result);
  } catch (error) {
    content = `Error: ${error instanceof Error ? error.message : String(error)}`;
    await activityStep("The tool call could not be completed.", { failed: true });
  }
  const postId = touchedPostId(call.function.name, content);
  if (postId && !state.touchedPosts.includes(postId)) state.touchedPosts.push(postId);
  return content;
}

/* -------------------------------------------------------------------- run */

/** The three models of a run: chat (tool calling), content (post texts) and image. */
async function resolveModels(ctx: AgentContext) {
  const [{ text, image }, ai] = await Promise.all([listTextAndImageModels(), getAiSettings(mcpStoreId())]);
  const prefer = (choice: string, fallbacks: string[]) => (choice ? [choice, ...fallbacks] : fallbacks);
  const chat = pickModel(
    text.filter((model) => model.tools),
    prefer(ctx.model, DEFAULT_AGENT_MODELS),
  );
  if (!chat) throw new Error("OpenRouter lists no model with tool support right now.");
  return {
    chat,
    content: pickModel(text, prefer(ctx.contentModel || ai.textModel, DEFAULT_TEXT_MODELS)),
    image: pickModel(image, prefer(ctx.imageModel || ai.imageModel, DEFAULT_IMAGE_MODELS)),
  };
}

type Models = Awaited<ReturnType<typeof resolveModels>>;

async function systemPrompt(ctx: AgentContext, models: Models, mode: ToolMode): Promise<string> {
  const actor = await resolveMcpActor();
  const otherModes = Object.entries(TOOL_MODES)
    .filter(([name]) => name !== mode)
    .map(([name, info]) => `/${name} (${info.summary})`)
    .join(", ");
  return [
    "You are the CMSMotive panel assistant, talking to a site administrator in Telegram.",
    `You act as the panel account ${actor.name} <${actor.email}>. Today is ${new Date().toISOString().slice(0, 10)}. The site is ${ctx.origin}.`,
    `You run on the OpenRouter model ${models.chat}; post texts are written by ${models.content} and images are made by ${models.image}. If asked which model you are, say exactly this — never guess.`,
    "Use the tools to do what is asked. Discover ids with list/get tools first; never invent ids.",
    `Tool mode: ${TOOL_MODES[mode].title} — your tools cover ${TOOL_MODES[mode].summary}. The user switches modes with a command: ${otherModes}. If a request needs tools this mode does not have, do not work around it; tell the user which command to send.`,
    "Research: posts must rest on real sources. ai_write_post / ai_rewrite_post research the web and add a numbered bibliography when webSearch is true — pass webSearch: true whenever the topic involves facts, news, recent events, products, versions or numbers, or the user asks for research. Never claim you researched when the tool result says research: none.",
    "Writing: to write a post call ai_write_post — it uses the content model and saves a DRAFT. To change an existing post's text call ai_rewrite_post. Do not write post bodies yourself. Never publish on your own initiative.",
    "Publishing needs a category and at least one tag. When ai_write_post returns newCategory/newTags, create them (blog_categories_create, blog_tags_create — together in one step) and attach them with blog_posts_update, so the draft is ready to publish once the user approves.",
    "Review: after you finish, the user automatically gets a card for every post you created or changed, with a preview link and Publish / Discard buttons. Do not repeat links in your reply; just say what you did and what is missing.",
    "Approval: edits, publishing, deletions and new categories/tags wait for the user's Confirm tap in Telegram. Call those tools directly — do not ask for permission in text first. If the user explicitly asks to publish, call blog_posts_set_status.",
    "New posts: call ai_write_post as soon as the topic is clear. Before it runs, the bot asks the user with buttons for the content language and the number of images inside the post, and always adds a cover — do not ask about these in text, and never add images to a new post afterwards. For \"deep research\" requests pass deepResearch: true.",
    "Changing images later: call ai_generate_image (purpose \"cover\"), then blog_posts_update with the returned media id as coverId, and show it with telegram_send_photo. To edit a cover, pass the post's current coverId as sourceMediaId with an edit instruction. When the user sends a photo, its media id is in the message.",
    "Reply in the language the user writes in. Keep replies short; Markdown bold, lists and links are fine.",
  ].join("\n");
}

async function finish(ctx: AgentContext, state: RunState, reply: string) {
  await sendText(ctx.token, ctx.chatId, reply);
  for (const postId of state.touchedPosts) {
    await sendPostCard(ctx, postId).catch((error) => console.error("[telegram] post card failed", error));
  }
  await appendHistory(ctx.chatId, [
    { role: "user", content: state.userText },
    { role: "assistant", content: reply },
  ]);
}

/**
 * Drives the conversation until the model answers or approval is needed. The
 * AI tools called inside use the Telegram content and image models.
 */
function drive(ctx: AgentContext, state: RunState) {
  return trackActivity({ storeId: mcpStoreId(), source: "telegram", title: "Telegram assistant", resumeId: state.activityId }, async () => {
    state.activityId = currentActivityId();
    return runWithModelOverrides({ text: ctx.contentModel, image: ctx.imageModel }, () => driveSteps(ctx, state));
  });
}

async function driveSteps(ctx: AgentContext, state: RunState) {
  const tools = await connectTools(state.mode);
  const models = await resolveModels(ctx);
  const typing = setInterval(() => void sendTyping(ctx.token, ctx.chatId), 4500);
  await sendTyping(ctx.token, ctx.chatId);
  try {
    while (state.steps < MAX_STEPS) {
      if (state.queue.length > 0) {
        const waiting = state.queue.filter(
          (call) => !state.approved.includes(call.id) && needsApproval(tools.byName.get(call.function.name), parseArgs(call) ?? {}),
        );
        if (waiting.length > 0) {
          await askApproval(ctx, state, tools, waiting);
          return;
        }
        const call = state.queue[0];
        if (call.function.name === "ai_write_post" && !state.postOptionsSet.includes(call.id)) {
          await askPostLanguage(ctx, state, call);
          return;
        }
        state.queue.shift();
        const content = await executeCall(ctx, tools, call, state);
        state.messages.push({ role: "tool", tool_call_id: call.id, content });
        continue;
      }

      state.steps += 1;
      await activityStep("Preparing the next assistant response…");
      const step = await chatWithTools({
        model: models.chat,
        messages: state.messages,
        tools: tools.definitions,
        sessionId: `telegram-${ctx.chatId}`,
      });
      if (step.usage) {
        const { input, cached, output, cost } = step.usage;
        console.error(
          `[telegram] step ${state.steps} ${models.chat}: in ${input} (cached ${cached}) out ${output}${cost !== null ? ` $${cost.toFixed(4)}` : ""}`,
        );
      }
      if (step.toolCalls.length === 0) {
        await finish(ctx, state, step.content ?? "Done.");
        return;
      }
      state.messages.push({ role: "assistant", content: step.content, tool_calls: step.toolCalls });
      state.queue = [...step.toolCalls];
    }
    await activityStep("The assistant reached its step limit before finishing.", { status: "failed", failed: true });
    await finish(ctx, state, "I stopped after many steps without finishing. Tell me how to continue, or send /new to start over.");
  } finally {
    clearInterval(typing);
    await tools.close().catch(() => undefined);
  }
}

/** One readable line per call: the tool's title and its key arguments. */
function describeCall(tools: Tools, call: ToolCall): string {
  const tool = tools.byName.get(call.function.name);
  const title = tool?.title ?? tool?.annotations?.title ?? call.function.name;
  const args = parseArgs(call) ?? {};
  const details = Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      return `${key}: ${text.length > 120 ? `${text.slice(0, 117)}…` : text}`;
    })
    .join("\n");
  return `**${title}**${details ? `\n\`\`\`\n${details}\n\`\`\`` : ""}`;
}

/** Stores the run until the user taps a button; returns the nonce the buttons carry. */
async function savePending(chatId: number, state: RunState): Promise<string> {
  const nonce = randomBytes(6).toString("hex");
  const pending: Pending = { ...state, nonce, expiresAt: Date.now() + PENDING_TTL_MS };
  await saveJson(pendingKey(chatId), pending);
  return nonce;
}

/** The waiting run the buttons with this nonce belong to, or null when they are stale. */
async function openPending(chatId: number, nonce: string): Promise<RunState | null> {
  const pending = await loadJson<Pending | null>(pendingKey(chatId), null);
  if (!pending || pending.nonce !== nonce || pending.expiresAt < Date.now()) return null;
  const { nonce: _nonce, expiresAt: _expires, ...state } = pending;
  // A run saved before these fields existed carries none.
  if (!isToolMode(state.mode)) state.mode = DEFAULT_MODE;
  state.postOptionsSet ??= [];
  return state;
}

async function askApproval(ctx: AgentContext, state: RunState, tools: Tools, calls: ToolCall[]) {
  const nonce = await savePending(ctx.chatId, state);
  const header = calls.length === 1 ? "Approve this change?" : `Approve these ${calls.length} changes?`;
  await sendText(ctx.token, ctx.chatId, [header, ...calls.map((call) => describeCall(tools, call))].join("\n\n"), {
    inline_keyboard: [
      [
        { text: "✅ Confirm", callback_data: `confirm:${nonce}` },
        { text: "✖️ Cancel", callback_data: `cancel:${nonce}` },
      ],
    ],
  });
  await activityStep("Waiting for confirmation in Telegram.", { status: "waiting" });
}

/* ------------------------------------------------------ new post questions */

/**
 * Before ai_write_post runs, the bot asks the user with buttons: first the
 * content language, then how many illustrations go inside the post. A cover
 * is always generated. The choices travel in the callback data
 * (post:<nonce>:<language>[:<count>]), so only the run itself is stored.
 */

const POST_LANGUAGES: Record<AiLanguage, string> = { tr: "Türkçe", en: "English", de: "Deutsch" };

export function isPostLanguage(value: string): value is AiLanguage {
  return Object.hasOwn(POST_LANGUAGES, value);
}

function postQuestionHeader(call: ToolCall): string {
  const brief = parseArgs(call)?.brief;
  const text = typeof brief === "string" ? brief : "";
  return `**New post**${text ? `: ${text.length > 200 ? `${text.slice(0, 197)}…` : text}` : ""}`;
}

async function askPostLanguage(ctx: AgentContext, state: RunState, call: ToolCall) {
  const nonce = await savePending(ctx.chatId, state);
  await sendText(ctx.token, ctx.chatId, `${postQuestionHeader(call)}\n\nWhich language should it be written in?`, {
    inline_keyboard: [
      Object.entries(POST_LANGUAGES).map(([code, label]) => ({ text: label, callback_data: `post:${nonce}:${code}` })),
      [{ text: "✖️ Cancel", callback_data: `cancel:${nonce}` }],
    ],
  });
  await activityStep("Waiting for the content language in Telegram.", { status: "waiting" });
}

/** The user picked the language; the same message turns into the image question. */
export async function askPostImages(ctx: AgentContext, nonce: string, language: AiLanguage, messageId: number): Promise<boolean> {
  const state = await openPending(ctx.chatId, nonce);
  const call = state?.queue[0];
  if (!call) return false;
  await editText(
    ctx.token,
    ctx.chatId,
    messageId,
    `${postQuestionHeader(call)}\n\nLanguage: **${POST_LANGUAGES[language]}**\nHow many images inside the post? A cover is always generated.`,
    {
      inline_keyboard: [
        [0, 1, 2].map((count) => ({ text: count === 0 ? "None" : String(count), callback_data: `post:${nonce}:${language}:${count}` })),
        [{ text: "✖️ Cancel", callback_data: `cancel:${nonce}` }],
      ],
    },
  );
  await waitingActivityStep(mcpStoreId(), state?.activityId, "Waiting for the number of illustrations in Telegram.");
  return true;
}

/** Both answers are in: the write runs with them and a cover. */
export async function resumeWithPostOptions(
  ctx: AgentContext,
  nonce: string,
  language: AiLanguage,
  inlineImages: number,
  messageId: number,
): Promise<boolean> {
  const state = await openPending(ctx.chatId, nonce);
  const call = state?.queue[0];
  if (!state || call?.function.name !== "ai_write_post") return false;
  await dropPending(ctx.chatId, false);

  await editText(
    ctx.token,
    ctx.chatId,
    messageId,
    `${postQuestionHeader(call)}\n\n${POST_LANGUAGES[language]} · ${inlineImages === 0 ? "no images inside" : `${inlineImages} image${inlineImages > 1 ? "s" : ""} inside`} · cover`,
  ).catch(() => undefined);
  call.function.arguments = JSON.stringify({ ...parseArgs(call), language, inlineImages, cover: true });
  state.postOptionsSet = [...state.postOptionsSet, call.id];
  await drive(ctx, state);
  return true;
}

/** A new message from the user. */
export async function runAgent(ctx: AgentContext, userText: string) {
  return trackActivity({ storeId: mcpStoreId(), source: "telegram", title: "Telegram assistant" }, async () => {
    const history = await loadJson<AgentMessage[]>(historyKey(ctx.chatId), []);
    const models = await resolveModels(ctx);
    const mode = await getChatMode(ctx.chatId);
    const state: RunState = {
      userText,
      mode,
      messages: [
        { role: "system", content: await systemPrompt(ctx, models, mode) },
        ...history,
        { role: "user", content: userText },
      ],
      queue: [],
      approved: [],
      touchedPosts: [],
      postOptionsSet: [],
      steps: 0,
    };
    await drive(ctx, state);
  });
}

/** The user tapped Confirm or Cancel; returns false when the buttons are stale. */
export async function resumeAgent(ctx: AgentContext, nonce: string, confirmed: boolean): Promise<boolean> {
  const state = await openPending(ctx.chatId, nonce);
  if (!state) return false;
  await dropPending(ctx.chatId, !confirmed);

  if (confirmed) {
    state.approved = [...state.approved, ...state.queue.map((call) => call.id)];
  } else {
    state.activityId = undefined;
    // Every call left from this step is answered as declined so the model can re-plan.
    for (const call of state.queue) {
      if (!state.approved.includes(call.id)) {
        state.messages.push({ role: "tool", tool_call_id: call.id, content: "The user declined this change. Do not retry unless asked." });
      }
    }
    state.queue = [];
  }
  await drive(ctx, state);
  return true;
}
