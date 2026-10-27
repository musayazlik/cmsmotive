import { prisma } from "@/lib/prisma";
import { prepareDocument } from "./document";
import type { PageBuilderData } from "./data";
import type { AdminResult } from "./pages";

/**
 * Saved sections and page templates (plan 5.2, Faz 4): a section is one block
 * subtree the editor re-inserts with fresh ids (scoped CSS would otherwise
 * collide); a template replaces the whole draft content. Storage is store
 * scoped; the editor applies everything client-side through the normal draft
 * door, so these rows only need to round-trip valid documents.
 */

export const SNIPPET_KINDS = ["section", "template"] as const;
export type SnippetKind = (typeof SNIPPET_KINDS)[number];

const MAX_SNIPPET_BYTES = 200_000;
const NAME_LIMIT = { min: 1, max: 80 } as const;

export type PageSnippetRow = {
  id: string;
  name: string;
  kind: string;
  category: string | null;
  data: PageBuilderData;
  createdAt: Date;
};

export async function saveSnippet(
  storeId: string,
  input: { name: unknown; kind: unknown; category?: unknown; data: unknown },
): Promise<AdminResult<{ id: string }>> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < NAME_LIMIT.min || name.length > NAME_LIMIT.max) {
    return { error: "The name must be 1–80 characters long." };
  }
  if (!(SNIPPET_KINDS as readonly string[]).includes(String(input.kind))) {
    return { error: "Snippet kind must be section or template." };
  }
  const category = typeof input.category === "string" && input.category.trim() ? input.category.trim().slice(0, 40) : null;
  const prepared = prepareDocument(input.data);
  if (!prepared.ok) return { error: prepared.error };
  const json = JSON.stringify(prepared.data);
  if (Buffer.byteLength(json, "utf8") > MAX_SNIPPET_BYTES) {
    return { error: "The snippet is too large (max 200 KB)." };
  }
  const row = await prisma.pageSnippet.create({
    data: {
      storeId,
      name,
      kind: String(input.kind),
      category,
      data: prepared.data as unknown as object,
    },
    select: { id: true },
  });
  return { data: { id: row.id } };
}

export async function listSnippets(storeId: string, kind?: SnippetKind): Promise<PageSnippetRow[]> {
  const rows = await prisma.pageSnippet.findMany({
    where: { storeId, ...(kind ? { kind } : {}) },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return rows.map((row) => ({ ...row, data: row.data as PageBuilderData }));
}

export async function deleteSnippet(storeId: string, id: string): Promise<AdminResult<{ ok: true }>> {
  const result = await prisma.pageSnippet.deleteMany({ where: { id, storeId } });
  if (result.count === 0) return { error: "Snippet not found.", status: 404 };
  return { data: { ok: true } };
}
