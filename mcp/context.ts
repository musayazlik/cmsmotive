import { AsyncLocalStorage } from "node:async_hooks";
import { getMcpActorUserId } from "@/lib/mcp-settings";
import { prisma } from "@/lib/prisma";
import { getStoreRole, storeAdminWhere } from "@/lib/store-access";

/**
 * The panel identity MCP writes are attributed to. The panel itself reads the
 * signed-in user from the better-auth session; an MCP client has no cookie,
 * so the actor is the account picked under Settings → MCP (or the oldest
 * admin account) and every tool is refused unless it still has an admin role.
 */
export type McpActor = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export const USER_ROLES = ["superadmin", "admin", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ADMIN_ROLES = ["superadmin", "admin"] as const;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function isAdminRole(value: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

const ACTOR_SELECT = { id: true, name: true, email: true, role: true } as const;

/**
 * In-process callers that know who is asking (the Telegram bot, acting for
 * the linked panel account) pin the actor for everything awaited inside fn.
 */
const actorOverride = new AsyncLocalStorage<string>();

export function runAsActor<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return actorOverride.run(userId, fn);
}

/**
 * The store every tool reads and writes. The HTTP endpoint scopes each
 * request to the store its token belongs to and the Telegram bot to its own
 * store (runInStore); the stdio server picks one store at startup
 * (setProcessStore).
 */
const storeScope = new AsyncLocalStorage<string>();
let processStore: string | null = null;

export function runInStore<T>(storeId: string, fn: () => Promise<T>): Promise<T> {
  return storeScope.run(storeId, fn);
}

export function setProcessStore(storeId: string) {
  processStore = storeId;
}

export function mcpStoreId(): string {
  const storeId = storeScope.getStore() ?? processStore;
  if (!storeId) throw new Error("No store is selected for this MCP session.");
  return storeId;
}

/**
 * Model choices that replace the Settings → AI ones for the AI tools awaited
 * inside fn — the Telegram bot passes its own content and image models.
 * Empty values fall through to Settings → AI.
 */
export type ModelOverrides = { text?: string; image?: string };
const modelOverrides = new AsyncLocalStorage<ModelOverrides>();

export function runWithModelOverrides<T>(models: ModelOverrides, fn: () => Promise<T>): Promise<T> {
  return modelOverrides.run(models, fn);
}

export function getModelOverrides(): ModelOverrides {
  return modelOverrides.getStore() ?? {};
}

/**
 * Read fresh on every call (two small queries) so a change under Settings →
 * MCP, or a demoted account, takes effect without restarting `pnpm mcp`.
 */
export async function resolveMcpActor(): Promise<McpActor> {
  const pinned = actorOverride.getStore();
  if (pinned) {
    const user = await prisma.user.findUnique({ where: { id: pinned }, select: ACTOR_SELECT });
    if (!user) throw new Error("The linked panel account no longer exists.");
    const role = await getStoreRole(user.id, mcpStoreId());
    if (!role || !isAdminRole(role)) throw new Error(`${user.email} is not an admin of this store.`);
    return { ...user, role };
  }

  const configured = await getMcpActorUserId(mcpStoreId());
  let user = configured
    ? await prisma.user.findUnique({ where: { id: configured }, select: ACTOR_SELECT })
    : null;

  if (configured && !user) {
    throw new Error(
      "The MCP account selected under Settings → MCP no longer exists. Pick another admin account there.",
    );
  }

  if (!user) {
    user = await prisma.user.findFirst({
      where: storeAdminWhere(mcpStoreId()),
      orderBy: { createdAt: "asc" },
      select: ACTOR_SELECT,
    });
  }

  if (!user) {
    throw new Error(
      "No admin account was found. Create an admin user and select it under Settings → MCP.",
    );
  }

  const role = await getStoreRole(user.id, mcpStoreId());
  if (!role || !isAdminRole(role)) {
    throw new Error(
      `The MCP user ${user.email} has the "${user.role}" role. MCP tools require an admin or superadmin account.`,
    );
  }

  return { ...user, role };
}
