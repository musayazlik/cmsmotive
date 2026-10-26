"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { prototypeEnabled, writePrototypeDocument } from "@/lib/page-builder/prototype-store";

/**
 * Prototype save action. Server actions are reachable endpoints, so the admin
 * role is re-checked on every call (matching app/panel/blog/_actions.ts).
 * Validation, cleaning and the size cap happen in the store's single write
 * path (lib/page-builder/document.ts, plan 5.13).
 */

export type SaveDocumentResult = { ok: true } | { ok: false; error: string };

export async function savePrototypeDocument(input: unknown): Promise<SaveDocumentResult> {
  if (!prototypeEnabled()) return { ok: false, error: "The prototype is disabled in production." };

  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  try {
    const saved = await writePrototypeDocument(input);
    if (!saved.ok) return saved;
  } catch (error) {
    console.error("savePrototypeDocument failed", error);
    return { ok: false, error: "The document could not be saved." };
  }

  revalidatePath("/pb");
  return { ok: true };
}
