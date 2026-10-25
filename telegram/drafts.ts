import { postPreviewPath } from "@/lib/post-preview";
import { prisma } from "@/lib/prisma";
import { activityStep } from "@/lib/assistant-activity";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { deletePostRecord, setPostStatusRecord } from "@/mcp/lib/posts";
import { sendText, type InlineKeyboard } from "./api";
import { mcpStoreId } from "@/mcp/context";

/**
 * The review step for blog posts in Telegram. Whenever the agent creates or
 * changes a post, the chat receives a card with a signed preview link and
 * Publish / Discard buttons; a tap on Publish is the user's approval. These
 * buttons act directly, without the model, so publishing is always the
 * user's own decision.
 */

type Chat = { token: string; chatId: number; origin: string };

const PUBLISH = "publish";
const DISCARD = "discard";
const DISCARD_CONFIRMED = "discard!";

export const isDraftAction = (data: string) => /^(publish|discard!?|keep):[\w-]+$/.test(data);

/** Sends the review card for a post; published posts get a short "live" note instead. */
export async function sendPostCard(chat: Chat, postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, storeId: mcpStoreId() },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      status: true,
      readingTime: true,
      coverId: true,
      category: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  if (!post) return;

  const panel = `${chat.origin}${(await getAdminAccessSettings()).panelPath}/blog/${post.id}`;
  if (post.status === "published") {
    await sendText(chat.token, chat.chatId, `🟢 **Live:** [${post.title}](${chat.origin}/blog/${post.slug}) · [Panel](${panel})`);
    return;
  }

  const tags = post.tags.map((entry) => entry.tag.name);
  const missing = [
    post.category ? null : "a category",
    tags.length ? null : "at least one tag",
  ].filter(Boolean);
  const lines = [
    `📝 **Draft:** ${post.title}`,
    post.excerpt,
    `Category: ${post.category?.name ?? "—"} · Tags: ${tags.join(", ") || "—"} · Cover: ${post.coverId ? "yes" : "no"} · ${post.readingTime} min read`,
    `[Preview](${chat.origin}${postPreviewPath(post.id, post.slug)}) · [Edit in panel](${panel})`,
    missing.length ? `Publishing needs ${missing.join(" and ")} — tell me which to use.` : "Tap Publish when it is ready, or tell me what to change.",
  ].filter(Boolean);
  const keyboard: InlineKeyboard = {
    inline_keyboard: [
      [
        { text: "🚀 Publish", callback_data: `${PUBLISH}:${post.id}` },
        { text: "🗑 Discard", callback_data: `${DISCARD}:${post.id}` },
      ],
    ],
  };
  await sendText(chat.token, chat.chatId, lines.join("\n"), keyboard);
}

/**
 * A tap on a card button. Returns a line for the chat history, so the model
 * knows what the user decided.
 */
export async function handleDraftAction(chat: Chat, data: string): Promise<string | null> {
  const [action, postId] = data.split(":");
  const post = await prisma.post.findFirst({ where: { id: postId, storeId: mcpStoreId() }, select: { id: true, title: true, slug: true } });
  if (!post) {
    await sendText(chat.token, chat.chatId, "This post no longer exists.");
    await activityStep("The post no longer exists.", { status: "failed", failed: true });
    return null;
  }

  if (action === PUBLISH) {
    await activityStep("Publishing the post…");
    try {
      await setPostStatusRecord(post.id, "published");
    } catch (error) {
      await activityStep("The post could not be published. Check the Telegram response.", { status: "failed", failed: true });
      await sendText(chat.token, chat.chatId, `Not published: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
    await sendText(chat.token, chat.chatId, `✅ **Published:** [${post.title}](${chat.origin}/blog/${post.slug})`);
    return `The user published the post "${post.title}" (id ${post.id}).`;
  }

  if (action === DISCARD) {
    await sendText(chat.token, chat.chatId, `Delete the draft “${post.title}” permanently?`, {
      inline_keyboard: [
        [
          { text: "🗑 Yes, delete", callback_data: `${DISCARD_CONFIRMED}:${post.id}` },
          { text: "Keep it", callback_data: `keep:${post.id}` },
        ],
      ],
    });
    return null;
  }

  if (action === DISCARD_CONFIRMED) {
    await activityStep("Deleting the draft…");
    await deletePostRecord(post.id);
    await sendText(chat.token, chat.chatId, `Deleted the draft “${post.title}”.`);
    return `The user deleted the draft "${post.title}" (id ${post.id}).`;
  }
  return null;
}
