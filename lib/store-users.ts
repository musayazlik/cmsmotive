import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

export class StoreUserError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const identity = {
  name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "user"]), password: z.string().max(128).refine((value) => !value || value.length >= 8, "Password must be at least 8 characters."),
  emailVerified: z.boolean(),
};
const createInput = z.object({ ...identity, password: identity.password.default(""), emailVerified: identity.emailVerified.default(true) });
const updateInput = z.object(identity).partial();
const include = { user: { include: { _count: { select: { storeMemberships: true } } } } } as const;
type Member = Prisma.StoreMemberGetPayload<{ include: typeof include }>;

async function manager(db: Prisma.TransactionClient, storeId: string, actorId: string) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { role: true, storeMemberships: { where: { storeId }, select: { role: true } } } });
  if (!actor || (actor.role !== "superadmin" && actor.storeMemberships[0]?.role !== "admin")) throw new StoreUserError("You cannot manage this store's users.", 403);
  return { id: actorId, owner: actor.role === "superadmin" };
}
function canEditIdentity(member: Member, actor: { id: string; owner: boolean }) {
  return actor.owner || member.userId === actor.id || member.user._count.storeMemberships === 1;
}
function mapMember(member: Member, actor: { id: string; owner: boolean }) {
  return {
    id: member.userId, name: member.user.name, email: member.user.email, role: member.role,
    emailVerified: member.user.emailVerified, image: member.user.image,
    createdAt: member.createdAt.toISOString(), updatedAt: member.updatedAt.toISOString(),
    canEditIdentity: canEditIdentity(member, actor),
  };
}
async function findMember(db: Prisma.TransactionClient, storeId: string, userId: string) {
  const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId, userId } }, include });
  if (!member || member.user.role === "superadmin") throw new StoreUserError("User not found in this store.", 404);
  return member;
}
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new StoreUserError(parsed.error.issues[0]?.message ?? "Invalid user.");
  return parsed.data;
}
async function protectLastAdmin(db: Prisma.TransactionClient, storeId: string) {
  const [admins, owners] = await Promise.all([
    db.storeMember.count({ where: { storeId, role: "admin" } }), db.user.count({ where: { role: "superadmin" } }),
  ]);
  if (admins <= 1 && owners === 0) throw new StoreUserError("This is the last store admin and cannot be removed.", 409);
}

export async function listStoreUsers(storeId: string, actorId: string, input: { q?: string; role?: string; joinedFrom?: string; page?: number; pageSize?: number } = {}) {
  const actor = await manager(prisma, storeId, actorId);
  const page = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page || 1)) : 1;
  const pageSize = [20, 50, 100].includes(input.pageSize ?? 0) ? input.pageSize! : 20;
  const q = input.q?.trim();
  const date = input.joinedFrom && /^\d{4}-\d{2}-\d{2}$/.test(input.joinedFrom) ? new Date(`${input.joinedFrom}T00:00:00Z`) : null;
  const where: Prisma.StoreMemberWhereInput = {
    storeId, ...(input.role === "admin" || input.role === "user" ? { role: input.role } : {}),
    user: { role: { not: "superadmin" }, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}) },
    ...(date && !Number.isNaN(date.getTime()) ? { createdAt: { gte: date } } : {}),
  };
  const [total, members] = await Promise.all([
    prisma.storeMember.count({ where }),
    prisma.storeMember.findMany({ where, include, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { users: members.map((member) => mapMember(member, actor)), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getStoreUser(storeId: string, actorId: string, userId: string) {
  const actor = await manager(prisma, storeId, actorId);
  return mapMember(await findMember(prisma, storeId, userId), actor);
}

export async function addStoreUser(storeId: string, actorId: string, input: unknown) {
  const data = validate(createInput, input);
  await manager(prisma, storeId, actorId);
  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true, role: true } });
  if (existing?.role === "superadmin") throw new StoreUserError("The superadmin account is protected.", 403);
  if (existing && data.password) throw new StoreUserError("This account already exists. Leave the password empty to add it to this store without changing its credentials.", 409);
  const password = !existing && data.password ? await hashPassword(data.password) : null;
  return prisma.$transaction(async (tx) => {
    const actor = await manager(tx, storeId, actorId);
    const user = existing ?? await tx.user.create({ data: { id: randomUUID(), name: data.name, email: data.email, emailVerified: data.emailVerified, role: "user" } });
    if (await tx.storeMember.findUnique({ where: { storeId_userId: { storeId, userId: user.id } } })) throw new StoreUserError("This user already belongs to this store.", 409);
    if (password) await tx.account.create({ data: { id: randomUUID(), accountId: user.id, providerId: "credential", userId: user.id, password } });
    return mapMember(await tx.storeMember.create({ data: { storeId, userId: user.id, role: data.role }, include }), actor);
  });
}

export async function updateStoreUser(storeId: string, actorId: string, userId: string, input: unknown) {
  const data = validate(updateInput, input);
  await manager(prisma, storeId, actorId);
  const password = data.password ? await hashPassword(data.password) : null;
  return prisma.$transaction(async (tx) => {
    const actor = await manager(tx, storeId, actorId);
    const member = await findMember(tx, storeId, userId);
    const identityChanged = (data.name !== undefined && data.name !== member.user.name)
      || (data.email !== undefined && data.email !== member.user.email)
      || (data.emailVerified !== undefined && data.emailVerified !== member.user.emailVerified) || Boolean(password);
    if (identityChanged && !canEditIdentity(member, actor)) throw new StoreUserError("This account belongs to multiple stores. You can change its store role; only the account owner or superadmin can change its identity or password.", 403);
    if (data.role === "user" && member.role === "admin") {
      if (userId === actorId) throw new StoreUserError("You cannot remove your own admin access.", 409);
      await protectLastAdmin(tx, storeId);
    }
    if (identityChanged) {
      if (data.email && await tx.user.findFirst({ where: { email: data.email, id: { not: userId } } })) throw new StoreUserError("A user with this e-mail address already exists.", 409);
      await tx.user.update({ where: { id: userId }, data: { name: data.name, email: data.email, emailVerified: data.emailVerified } });
      if (password) {
        const account = await tx.account.findFirst({ where: { userId, providerId: "credential" } });
        if (account) await tx.account.update({ where: { id: account.id }, data: { password } });
        else await tx.account.create({ data: { id: randomUUID(), userId, accountId: userId, providerId: "credential", password } });
        await tx.session.deleteMany({ where: { userId } });
      }
    }
    return mapMember(await tx.storeMember.update({ where: { storeId_userId: { storeId, userId } }, data: { role: data.role }, include }), actor);
  }, { isolationLevel: "Serializable" });
}

export async function removeStoreUser(storeId: string, actorId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await manager(tx, storeId, actorId);
    const member = await findMember(tx, storeId, userId);
    if (actorId === userId) throw new StoreUserError("You cannot remove your own store access.", 409);
    if (member.role === "admin") await protectLastAdmin(tx, storeId);
    await tx.storeMember.delete({ where: { storeId_userId: { storeId, userId } } });
    return { id: userId, deleted: true };
  }, { isolationLevel: "Serializable" });
}

export function storeUserErrorResponse(error: unknown): Response {
  if (error instanceof StoreUserError) return Response.json({ error: error.message }, { status: error.status });
  if (typeof error === "object" && error && "code" in error && error.code === "P2002") return Response.json({ error: "This account or store membership already exists." }, { status: 409 });
  if (typeof error === "object" && error && "code" in error && error.code === "P2034") return Response.json({ error: "The user was changed by another request. Please try again." }, { status: 409 });
  console.error("[store-users] User operation failed.");
  return Response.json({ error: "The user operation could not be completed." }, { status: 500 });
}
