import { createHash, randomUUID } from "node:crypto";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { getStoreRole, isStoreAdmin } from "./store-access";
import { getAdminAccessSettings } from "./admin-access";
import { isAccountHost, requestOrigin, resolveRequestStore } from "./stores";

const identifier = (token: string) => `store-switch:${createHash("sha256").update(token).digest("hex")}`;
type Binding = { sessionId: string; userId: string; storeId: string; sourceOrigin: string; targetOrigin: string; rememberCookie?: string };

/** Better Auth supplies the single-use credential; this binding limits its audience. */
export async function issueStoreSessionTransfer(source: Headers, storeId: string, panelHref: string): Promise<{ href: string; token: string } | null> {
  const session = await auth.api.getSession({ headers: source });
  if (!session || !await getStoreRole(session.user.id, storeId)) return null;
  const sourceOrigin = requestOrigin(source);
  if (source.get("origin") && source.get("origin") !== sourceOrigin) return null;
  if (!isAccountHost(await resolveRequestStore(source), source)) return null;
  const { token } = await auth.api.generateOneTimeToken({ headers: source });
  const targetOrigin = new URL(panelHref).origin;
  const cookieName = (await auth.$context).authCookies.dontRememberToken.name;
  const rememberCookie = source.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const binding: Binding = { sessionId: session.session.id, userId: session.user.id, storeId, sourceOrigin, targetOrigin, rememberCookie };
  await prisma.verification.deleteMany({ where: { identifier: { startsWith: "store-switch:" }, expiresAt: { lte: new Date() } } });
  await prisma.verification.create({ data: {
    id: randomUUID(), identifier: identifier(token), value: JSON.stringify(binding),
    expiresAt: new Date(Math.min(Date.now() + 60_000, session.session.expiresAt.getTime())),
  } });
  return { href: `${targetOrigin}/api/admin/store-session`, token };
}

/** POST-only browser handoff: no reusable session token is exposed in a URL or response body. */
export async function completeStoreSessionTransfer(request: Request, token: string): Promise<Response> {
  const responseHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
  const rejected = () => new Response("This store switch is invalid or has expired. Return to the original store and try again.", { status: 403, headers: responseHeaders });
  if (request.method !== "POST") return rejected();
  if (!/^[a-zA-Z0-9_-]{32}$/.test(token)) return rejected();
  const match = await resolveRequestStore(request);
  if (!isAccountHost(match, request) || match.via === "fallback") return rejected();
  const origin = requestOrigin(request);
  const grant = await prisma.$transaction(async (tx) => {
    const row = await tx.verification.findFirst({ where: { identifier: identifier(token), expiresAt: { gt: new Date() } } });
    if (!row) return null;
    const binding = JSON.parse(row.value) as Binding;
    if (binding.targetOrigin !== origin || binding.storeId !== match.store.id || request.headers.get("origin") !== binding.sourceOrigin) return null;
    const consumed = await tx.verification.deleteMany({ where: { id: row.id, expiresAt: { gt: new Date() } } });
    return consumed.count === 1 ? binding : null;
  });
  if (!grant) return rejected();
  const [session, role] = await Promise.all([
    prisma.session.findUnique({ where: { id: grant.sessionId } }), getStoreRole(grant.userId, grant.storeId),
  ]);
  if (!session || session.userId !== grant.userId || session.expiresAt <= new Date() || !role) return rejected();

  // Invoke the library handler internally so cookie signing and secure-prefix rules
  // use the destination request. Its public OTT endpoints remain inaccessible.
  const headers = new Headers({ "content-type": "application/json", origin });
  if (grant.rememberCookie) headers.set("cookie", grant.rememberCookie);
  const verified = await auth.handler(new Request(`${origin}/api/auth/one-time-token/verify`, {
    method: "POST", headers, body: JSON.stringify({ token }),
  }));
  if (!verified.ok) {
    console.error("[store-session] Session verification failed.", verified.status);
    return rejected();
  }
  const destination = isStoreAdmin(role) ? (await getAdminAccessSettings()).panelPath : "/account";
  const result = new Headers({ ...responseHeaders, Location: new URL(destination, origin).href });
  for (const cookie of verified.headers.getSetCookie()) result.append("Set-Cookie", cookie);
  // Clear the stale store selection on the destination host.
  result.append("Set-Cookie", `panel-store=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${origin.startsWith("https:") ? "; Secure" : ""}`);
  return new Response(null, { status: 303, headers: result });
}
