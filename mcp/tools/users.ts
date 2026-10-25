import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addStoreUser, getStoreUser, listStoreUsers, removeStoreUser, updateStoreUser, StoreUserError } from "@/lib/store-users";
import { mcpStoreId, resolveMcpActor } from "../context";
import { runTool, ToolError } from "../lib/result";

function userTool(action: (storeId: string, actorId: string) => Promise<unknown>) {
  return runTool(async () => {
    const actor = await resolveMcpActor();
    try { return await action(mcpStoreId(), actor.id); }
    catch (error) { if (error instanceof StoreUserError) throw new ToolError(error.message); throw error; }
  });
}

export function registerUserTools(server: McpServer) {
  server.registerTool("users_list", {
    title: "List store users", description: "List members of the current store and their store-local roles. The installation superadmin is hidden.",
    inputSchema: { q: z.string().optional(), role: z.enum(["admin", "user"]).optional(), joinedFrom: z.string().optional(), page: z.number().int().min(1).default(1), pageSize: z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20) },
    annotations: { readOnlyHint: true },
  }, (args) => userTool((storeId, actorId) => listStoreUsers(storeId, actorId, args)));
  server.registerTool("users_get", {
    title: "Get a store user", description: "Get a member of the current store. Accounts belonging only to other stores cannot be read.",
    inputSchema: { id: z.string() }, annotations: { readOnlyHint: true },
  }, (args) => userTool((storeId, actorId) => getStoreUser(storeId, actorId, args.id)));
  server.registerTool("users_create", {
    title: "Add a store user", description: "Create an account or add an existing e-mail to this store. Existing accounts keep their identity and credentials; leave password empty for those accounts.",
    inputSchema: { name: z.string().min(2).max(80), email: z.string().max(254), role: z.enum(["admin", "user"]), password: z.string().optional(), emailVerified: z.boolean().default(true) },
    annotations: { destructiveHint: false },
  }, (args) => userTool((storeId, actorId) => addStoreUser(storeId, actorId, args)));
  server.registerTool("users_update", {
    title: "Update a store user", description: "Change a membership role in this store. Shared account identity and passwords can only be edited by the account owner or installation superadmin.",
    inputSchema: { id: z.string(), name: z.string().min(2).max(80).optional(), email: z.string().max(254).optional(), role: z.enum(["admin", "user"]).optional(), emailVerified: z.boolean().optional(), password: z.string().optional() },
    annotations: { destructiveHint: false },
  }, ({ id, ...args }) => userTool((storeId, actorId) => updateStoreUser(storeId, actorId, id, args)));
  server.registerTool("users_delete", {
    title: "Remove store access", description: "Remove a user's membership in this store. Their account, credentials, sessions and other store memberships are kept. You cannot remove your own access or the last store admin.",
    inputSchema: { id: z.string() }, annotations: { destructiveHint: true, idempotentHint: true },
  }, (args) => userTool((storeId, actorId) => removeStoreUser(storeId, actorId, args.id)));
}
