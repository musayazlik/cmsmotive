"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { DEFAULT_TEXT_MODELS, pickModel } from "@/lib/ai-settings-shared";
import { translateDocument } from "@/lib/page-builder/ai";
import { prepareDocument } from "@/lib/page-builder/document";
import type { PageBuilderData } from "@/lib/page-builder/data";
import {
  copyPageLocale,
  createPage,
  deletePage,
  ensurePageLocale,
  publishPage,
  renamePage,
  saveDraft,
  schedulePage,
  unpublishPage,
  updatePageSeo,
  type PageSeoInput,
} from "@/lib/page-builder/pages";
import { deleteSnippet, saveSnippet } from "@/lib/page-builder/snippets";
import { isOpenRouterConfigured, chatCompletion, listTextAndImageModels } from "@/lib/openrouter";
import { getAiSettings } from "@/lib/settings";
import { panelStore } from "@/lib/panel-store";
import { prisma } from "@/lib/prisma";

/**
 * Panel mutations for builder pages (plan 5.6). Server actions are reachable
 * endpoints, so the admin role is re-checked on every call (matching
 * app/panel/blog/_actions.ts); the store scope comes from panelStore() and is
 * enforced inside every lib/page-builder/pages function.
 */

export type PageActionResult = { ok: true } | { ok: false; error: string };

export type PublishActionResult =
  | { ok: true; warnings: string[]; version: number }
  | { ok: false; error: string; blockers?: string[] };

function revalidatePages() {
  revalidatePath("/panel/pages");
}

async function actor() {
  const { session, failure } = await requireAdmin();
  return { userId: session?.user.id, denied: Boolean(failure) };
}

export async function createPageAction(input: {
  kind: string;
  slug?: string;
  locale: string;
  title: string;
}): Promise<PageActionResult & { pageId?: string }> {
  const { userId, denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await createPage((await panelStore()).id, { ...input, userId });
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePages();
  return { ok: true, pageId: result.data.pageId };
}

export async function renamePageAction(pageId: string, slug: string): Promise<PageActionResult & { slug?: string }> {
  const { denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await renamePage((await panelStore()).id, pageId, slug);
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePages();
  return { ok: true, slug: result.data.slug };
}

export async function deletePageAction(pageId: string): Promise<PageActionResult> {
  const { denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await deletePage((await panelStore()).id, pageId);
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePages();
  return { ok: true };
}

export async function addLanguageAction(pageId: string, locale: string, title: string): Promise<PageActionResult> {
  const { userId, denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await ensurePageLocale((await panelStore()).id, pageId, locale, title, userId);
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePages();
  return { ok: true };
}

export async function copyLanguageAction(
  pageId: string,
  sourceLocale: string,
  targetLocale: string,
  targetTitle: string,
): Promise<PageActionResult> {
  const { userId, denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await copyPageLocale((await panelStore()).id, pageId, sourceLocale, targetLocale, targetTitle, userId);
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePages();
  return { ok: true };
}

/**
 * Publishing flushes nothing here on purpose: the editor saves the draft
 * first and then calls this action, which reads the saved draft from the
 * database — the single write path stays in lib/page-builder/pages.ts.
 */
export async function publishPageAction(
  pageId: string,
  locale: string,
  note?: string,
  expectedVersion?: number,
): Promise<PublishActionResult> {
  const { userId, denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await publishPage((await panelStore()).id, pageId, locale, { userId, note }, expectedVersion);
  if (!result.ok) return { ok: false, error: result.error, blockers: result.blockers };
  revalidatePages();
  return { ok: true, warnings: result.warnings, version: result.version };
}

export async function unpublishPageAction(pageId: string, locale: string): Promise<PageActionResult> {
  const { userId, denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await unpublishPage((await panelStore()).id, pageId, locale, userId);
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePages();
  return { ok: true };
}

export async function saveSeoAction(
  pageId: string,
  locale: string,
  input: Omit<PageSeoInput, "userId">,
): Promise<PageActionResult & { version?: number }> {
  const { userId, denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await updatePageSeo((await panelStore()).id, pageId, locale, { ...input, userId });
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePages();
  return { ok: true, version: result.data.version };
}

/* ------------------------------------------------------------------ Faz 4 */

export async function saveSnippetAction(input: {
  name: string;
  kind: string;
  category?: string;
  data: unknown;
}): Promise<PageActionResult> {
  const { denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await saveSnippet((await panelStore()).id, input);
  if ("error" in result) return { ok: false, error: result.error };
  return { ok: true };
}

export async function deleteSnippetAction(id: string): Promise<PageActionResult> {
  const { denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await deleteSnippet((await panelStore()).id, id);
  if ("error" in result) return { ok: false, error: result.error };
  return { ok: true };
}

export async function schedulePageAction(
  pageId: string,
  locale: string,
  publishAt: string | null,
  expectedVersion: number,
): Promise<PageActionResult & { status?: string; publishAt?: string | null }> {
  const { userId, denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const result = await schedulePage((await panelStore()).id, pageId, locale, publishAt, expectedVersion, userId);
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePages();
  return { ok: true, status: result.data.status, publishAt: result.data.publishAt?.toISOString() ?? null };
}

/**
 * AI translation into another store language: reads the SOURCE draft, has the
 * model translate the display strings (lib/page-builder/ai.ts) and writes the
 * result through the normal draft door of the target language. An existing
 * target draft is overwritten — translating is the point.
 */
export async function translatePageAction(
  pageId: string,
  sourceLocale: string,
  targetLocale: string,
): Promise<PageActionResult> {
  const { userId, denied } = await actor();
  if (denied) return { ok: false, error: "You are not allowed to perform this action." };
  const storeId = (await panelStore()).id;
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { locales: true } });
  if (!store?.locales.includes(targetLocale)) return { ok: false, error: `The store has no "${targetLocale}" language.` };
  if (sourceLocale === targetLocale) return { ok: false, error: "Pick a different target language." };

  const page = await prisma.page.findFirst({
    where: { id: pageId, storeId },
    select: { locales: { where: { locale: { in: [sourceLocale, targetLocale] } } } },
  });
  if (!page) return { ok: false, error: "Page not found." };
  const source = page.locales.find((row) => row.locale === sourceLocale);
  if (!source) return { ok: false, error: `The page has no "${sourceLocale}" version.` };

  if (!isOpenRouterConfigured()) return { ok: false, error: "OpenRouter is not configured." };
  const settings = await getAiSettings(storeId);
  const catalogue = await listTextAndImageModels().catch(() => null);
  const model = settings.textModel || pickModel(catalogue?.text ?? [], DEFAULT_TEXT_MODELS);
  if (!model) return { ok: false, error: "No text model is available. Pick one under Settings → AI." };

  let translated: unknown;
  try {
    translated = await translateDocument(source.draft as PageBuilderData, targetLocale, async (values, language) => {
      const { content } = await chatCompletion({
        model,
        system: [
          `You are a translator for a website page builder. Translate every string in the JSON array into the language with the code "${language}".`,
          "Keep HTML tags and attributes exactly as they are, translating only the text between them.",
          "Never translate brand names, URLs, email addresses or values that look like file paths.",
          "Return ONLY a JSON array of translated strings — same order, same length, no markdown fence, no commentary.",
        ].join(" "),
        user: JSON.stringify(values),
        maxTokens: 8000,
        timeoutMs: 240_000,
      });
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
        throw new Error("The model did not return a JSON string array.");
      }
      return parsed as string[];
    });
  } catch (error) {
    console.error("page translate failed", error);
    return { ok: false, error: error instanceof Error ? error.message : "Translation failed." };
  }

  const prepared = prepareDocument(translated);
  if (!prepared.ok) return { ok: false, error: `The translation does not validate: ${prepared.error}` };

  await ensurePageLocale(storeId, pageId, targetLocale, source.title, userId);
  const target = await prisma.pageLocale.findUnique({
    where: { pageId_locale: { pageId, locale: targetLocale } },
    select: { version: true },
  });
  if (!target) return { ok: false, error: "The target language could not be created." };
  const saved = await saveDraft(storeId, pageId, targetLocale, prepared.data, target.version, userId);
  if (!saved.ok) return { ok: false, error: saved.conflict ? "The target language changed during translation — try again." : saved.error };
  revalidatePages();
  return { ok: true };
}
