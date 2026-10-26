"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import {
  copyPageLocale,
  createPage,
  deletePage,
  ensurePageLocale,
  publishPage,
  renamePage,
  unpublishPage,
  updatePageSeo,
  type PageSeoInput,
} from "@/lib/page-builder/pages";
import { panelStore } from "@/lib/panel-store";

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
