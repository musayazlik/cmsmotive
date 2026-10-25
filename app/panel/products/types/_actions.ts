"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { deleteProductType, saveProductType } from "@/lib/product-admin";

/**
 * Product-type mutations for the panel. Server actions are reachable
 * endpoints, so every action re-checks the admin role, and the writes go
 * through lib/product-admin, so the validation matches the products API.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateTypes() {
  revalidatePath("/panel/products/types");
  revalidatePath("/panel/products");
}

export async function saveProductTypeAction(input: Record<string, unknown>): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  const result = await saveProductType(typeof input.id === "string" && input.id ? input.id : null, input);
  if ("error" in result) return { ok: false, error: result.error };
  revalidateTypes();
  return { ok: true };
}

export async function deleteProductTypeAction(id: string): Promise<ActionResult> {
  const { failure } = await requireAdmin();
  if (failure) return { ok: false, error: "You are not allowed to perform this action." };

  const result = await deleteProductType(id);
  if ("error" in result) return { ok: false, error: result.error };
  revalidateTypes();
  return { ok: true };
}
