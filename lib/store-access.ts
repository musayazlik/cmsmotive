import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { listStores } from "./stores";

export type StoreRole = "superadmin" | "admin" | "user";
export function isStoreAdmin(role: unknown): role is "admin" | "superadmin" {
  return role === "admin" || role === "superadmin";
}

/** Fresh on every authorization check so revoking a membership takes effect immediately. */
export async function getStoreRole(userId: string, storeId: string): Promise<StoreRole | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: {
    role: true, storeMemberships: { where: { storeId }, select: { role: true } },
  } });
  if (user?.role === "superadmin") return "superadmin";
  const role = user?.storeMemberships[0]?.role;
  return role === "admin" || role === "user" ? role : null;
}

export function storeAdminWhere(storeId: string): Prisma.UserWhereInput {
  return { OR: [{ role: "superadmin" }, { storeMemberships: { some: { storeId, role: "admin" } } }] };
}

export async function accessibleStores(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: {
    role: true, storeMemberships: { select: { storeId: true } },
  } });
  if (!user) return [];
  const stores = await listStores();
  if (user.role === "superadmin") return stores;
  const ids = new Set(user.storeMemberships.map((membership) => membership.storeId));
  return stores.filter((store) => ids.has(store.id));
}
