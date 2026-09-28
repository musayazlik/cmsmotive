import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const USER_ROLES = ["superadmin", "admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles that grant panel administration; "superadmin" outranks "admin". */
export const ADMIN_ROLES = ["superadmin", "admin"] as const;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function isAdminRole(value: unknown): boolean {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

/**
 * Guards admin-only API routes. Returns either the session or a ready-to-return
 * Response. The role is read from the database rather than the session because
 * better-auth does not expose custom user fields by default.
 */
export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { session: null, failure: Response.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!isAdminRole(user?.role)) {
    return { session: null, failure: Response.json({ error: "Forbidden." }, { status: 403 }) };
  }

  return { session, failure: null };
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
