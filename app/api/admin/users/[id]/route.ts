import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES, EMAIL_PATTERN, USER_ROLES, isAdminRole, isUserRole, requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/users/:id */
export async function PATCH(request: Request, context: RouteContext) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });

  const data: { name?: string; email?: string; role?: string; emailVerified?: boolean } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 80) {
      return Response.json({ error: "Name must be between 2 and 80 characters." }, { status: 400 });
    }
    data.name = name;
  }

  if (body.email !== undefined) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return Response.json({ error: "Please provide a valid e-mail address." }, { status: 400 });
    }
    const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (clash && clash.id !== id) {
      return Response.json({ error: "A user with this e-mail address already exists." }, { status: 409 });
    }
    data.email = email;
  }

  if (body.role !== undefined) {
    if (!isUserRole(body.role)) {
      return Response.json({ error: `Role must be one of: ${USER_ROLES.join(", ")}.` }, { status: 400 });
    }
    // An admin must not be able to strip their own admin access and lock the
    // panel, because no other admin may exist.
    if (id === session.user.id && !isAdminRole(body.role)) {
      return Response.json({ error: "You cannot remove your own admin access." }, { status: 409 });
    }
    data.role = body.role;
  }

  if (body.emailVerified !== undefined) {
    if (typeof body.emailVerified !== "boolean") {
      return Response.json({ error: "emailVerified must be true or false." }, { status: 400 });
    }
    data.emailVerified = body.emailVerified;
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length > 0) {
    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    const account = await prisma.account.findFirst({
      where: { userId: id, providerId: "credential" },
      select: { id: true },
    });
    const hashed = await hashPassword(password);
    if (account) {
      await prisma.account.update({ where: { id: account.id }, data: { password: hashed } });
    } else {
      await prisma.account.create({
        data: { id: crypto.randomUUID(), accountId: id, providerId: "credential", userId: id, password: hashed },
      });
    }
  }

  if (Object.keys(data).length === 0 && password.length === 0) {
    return Response.json({ error: "Nothing to update." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, emailVerified: true, createdAt: true, updatedAt: true },
  });

  return Response.json({ user: { ...user, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() } });
}

/** DELETE /api/admin/users/:id */
export async function DELETE(_request: Request, context: RouteContext) {
  const { session, failure } = await requireAdmin();
  if (failure) return failure;

  const { id } = await context.params;

  if (id === session.user.id) {
    return Response.json({ error: "You cannot delete your own account." }, { status: 409 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return Response.json({ error: "User not found." }, { status: 404 });

  // Refuse to remove the last remaining admin so the panel cannot be orphaned.
  if (isAdminRole(target.role)) {
    const admins = await prisma.user.count({ where: { role: { in: [...ADMIN_ROLES] } } });
    if (admins <= 1) {
      return Response.json({ error: "This is the last admin account and cannot be deleted." }, { status: 409 });
    }
  }

  await prisma.user.delete({ where: { id } });
  return Response.json({ ok: true });
}
