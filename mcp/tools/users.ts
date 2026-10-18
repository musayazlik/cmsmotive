import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_ROLES,
  isAdminRole,
  isUserRole,
  resolveMcpActor,
  USER_ROLES,
} from "../context";
import { runTool, ToolError } from "../lib/result";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CREDENTIAL_PROVIDER = "credential";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerified: true,
  image: true,
  createdAt: true,
  updatedAt: true,
} as const;

function mapUser(user: Prisma.UserGetPayload<{ select: typeof userSelect }>) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function registerUserTools(server: McpServer) {
  server.registerTool(
    "users_list",
    {
      title: "List users",
      description:
        "List panel users. The seeded superadmin account is hidden, exactly like the panel user manager.",
      inputSchema: {
        q: z.string().optional().describe("Search in name and e-mail."),
        role: z.enum(["admin", "user"]).optional(),
        joinedFrom: z.string().optional().describe("YYYY-MM-DD lower bound on the join date."),
        page: z.number().int().min(1).default(1),
        pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        let joinedAfter: Date | null = null;
        if (args.joinedFrom && /^\d{4}-\d{2}-\d{2}$/.test(args.joinedFrom)) {
          const date = new Date(`${args.joinedFrom}T00:00:00`);
          if (!Number.isNaN(date.getTime())) joinedAfter = date;
        }

        const where: Prisma.UserWhereInput = {
          role: args.role ?? { not: "superadmin" },
          ...(args.q
            ? {
                OR: [
                  { name: { contains: args.q, mode: "insensitive" } },
                  { email: { contains: args.q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(joinedAfter ? { createdAt: { gte: joinedAfter } } : {}),
        };

        const [total, users] = await Promise.all([
          prisma.user.count({ where }),
          prisma.user.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (args.page - 1) * args.pageSize,
            take: args.pageSize,
            select: userSelect,
          }),
        ]);

        return {
          users: users.map(mapUser),
          total,
          page: args.page,
          pageSize: args.pageSize,
          totalPages: Math.max(1, Math.ceil(total / args.pageSize)),
        };
      }),
  );

  server.registerTool(
    "users_get",
    {
      title: "Get a user",
      description: "Return one panel user by id. The superadmin account is protected.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const user = await prisma.user.findUnique({ where: { id: args.id }, select: userSelect });
        if (!user) throw new ToolError("User not found.");
        if (user.role === "superadmin") {
          throw new ToolError("The superadmin account is protected.");
        }
        return mapUser(user);
      }),
  );

  server.registerTool(
    "users_create",
    {
      title: "Create a user",
      description:
        "Create a panel user. The superadmin role cannot be assigned. Leave password empty to create an account without credentials.",
      inputSchema: {
        name: z.string().min(2).max(80),
        email: z.string().max(254),
        role: z.enum(["admin", "user"]),
        password: z.string().optional().describe("At least 8 characters, or empty for none."),
        emailVerified: z.boolean().default(true),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const name = args.name.trim();
        const email = args.email.trim().toLowerCase();
        const password = args.password ?? "";

        if (name.length < 2 || name.length > 80) {
          throw new ToolError("Name must be between 2 and 80 characters.");
        }
        if (!EMAIL_PATTERN.test(email) || email.length > 254) {
          throw new ToolError("Please provide a valid e-mail address.");
        }
        if (!isUserRole(args.role)) {
          throw new ToolError(`Role must be one of: ${USER_ROLES.join(", ")}.`);
        }
        if (password.length > 0 && password.length < 8) {
          throw new ToolError("Password must be at least 8 characters, or left empty.");
        }

        const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (existing) throw new ToolError("A user with this e-mail address already exists.");

        const user = await prisma.user.create({
          data: {
            id: crypto.randomUUID(),
            name,
            email,
            role: args.role,
            emailVerified: args.emailVerified,
          },
          select: userSelect,
        });

        if (password.length > 0) {
          await prisma.account.create({
            data: {
              id: crypto.randomUUID(),
              accountId: user.id,
              providerId: CREDENTIAL_PROVIDER,
              userId: user.id,
              password: await hashPassword(password),
            },
          });
        }

        return mapUser(user);
      }),
  );

  server.registerTool(
    "users_update",
    {
      title: "Update a user",
      description:
        "Update a user's name, e-mail, role, verification state or password. The superadmin account is protected and an admin cannot remove their own admin access.",
      inputSchema: {
        id: z.string(),
        name: z.string().min(2).max(80).optional(),
        email: z.string().max(254).optional(),
        role: z.enum(["admin", "user"]).optional(),
        emailVerified: z.boolean().optional(),
        password: z.string().optional().describe("At least 8 characters; omit to keep the current password."),
      },
      annotations: { destructiveHint: false },
    },
    async (args) =>
      runTool(async () => {
        const actor = await resolveMcpActor();
        const target = await prisma.user.findUnique({
          where: { id: args.id },
          select: { id: true, role: true },
        });
        if (!target) throw new ToolError("User not found.");
        if (target.role === "superadmin") {
          throw new ToolError("The superadmin account is protected.");
        }

        const data: { name?: string; email?: string; role?: string; emailVerified?: boolean } = {};

        if (args.name !== undefined) {
          const name = args.name.trim();
          if (name.length < 2 || name.length > 80) {
            throw new ToolError("Name must be between 2 and 80 characters.");
          }
          data.name = name;
        }

        if (args.email !== undefined) {
          const email = args.email.trim().toLowerCase();
          if (!EMAIL_PATTERN.test(email) || email.length > 254) {
            throw new ToolError("Please provide a valid e-mail address.");
          }
          const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
          if (clash && clash.id !== args.id) {
            throw new ToolError("A user with this e-mail address already exists.");
          }
          data.email = email;
        }

        if (args.role !== undefined) {
          if (!isUserRole(args.role)) {
            throw new ToolError(`Role must be one of: ${USER_ROLES.join(", ")}.`);
          }
          if (args.id === actor.id && !isAdminRole(args.role)) {
            throw new ToolError("You cannot remove your own admin access.");
          }
          data.role = args.role;
        }

        if (args.emailVerified !== undefined) data.emailVerified = args.emailVerified;

        const password = args.password ?? "";
        if (password.length > 0) {
          if (password.length < 8) throw new ToolError("Password must be at least 8 characters.");
          const account = await prisma.account.findFirst({
            where: { userId: args.id, providerId: CREDENTIAL_PROVIDER },
            select: { id: true },
          });
          const hashed = await hashPassword(password);
          if (account) {
            await prisma.account.update({
              where: { id: account.id },
              data: { password: hashed },
            });
          } else {
            await prisma.account.create({
              data: {
                id: crypto.randomUUID(),
                accountId: args.id,
                providerId: CREDENTIAL_PROVIDER,
                userId: args.id,
                password: hashed,
              },
            });
          }
        }

        if (Object.keys(data).length === 0 && password.length === 0) {
          throw new ToolError("Nothing to update.");
        }

        const user = await prisma.user.update({
          where: { id: args.id },
          data,
          select: userSelect,
        });
        return mapUser(user);
      }),
  );

  server.registerTool(
    "users_delete",
    {
      title: "Delete a user",
      description:
        "Permanently delete a user. You cannot delete yourself, the superadmin, or the last remaining admin.",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) =>
      runTool(async () => {
        const actor = await resolveMcpActor();
        if (args.id === actor.id) {
          throw new ToolError("You cannot delete your own account.");
        }

        const target = await prisma.user.findUnique({
          where: { id: args.id },
          select: { id: true, role: true },
        });
        if (!target) throw new ToolError("User not found.");
        if (target.role === "superadmin") {
          throw new ToolError("The superadmin account is protected.");
        }

        if (isAdminRole(target.role)) {
          const admins = await prisma.user.count({
            where: { role: { in: [...ADMIN_ROLES] } },
          });
          if (admins <= 1) {
            throw new ToolError("This is the last admin account and cannot be deleted.");
          }
        }

        await prisma.user.delete({ where: { id: args.id } });
        return { id: args.id, deleted: true };
      }),
  );
}
