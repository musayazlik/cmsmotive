import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { isAccountHost, resolveRequestStore } from "@/lib/stores";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";

/** The self-service registration calls; blocked while Settings → General → Accounts is off. */
const SIGN_UP_PATH = /^\/api\/auth\/sign-up(?:\/|$)/i;

const betterAuth = toNextJsHandler(auth);

/** Better Auth builds links from the request host, so only store domains may reach it (lib/auth.ts). */
async function unknownHost(request: Request) {
  // Store-switch tokens can only be redeemed through the audience-checked POST handoff.
  let pathname: string;
  try { pathname = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response(null, { status: 404 }); }
  if (/^\/api\/auth\/one-time-token(?:\/|$)/i.test(pathname)) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (isAccountHost(await resolveRequestStore(request), request)) return null;
  return Response.json({ message: "Not found." }, { status: 404, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const rejected = await unknownHost(request);
  if (rejected) return rejected;
  if (SIGN_UP_PATH.test(new URL(request.url).pathname)) {
    const settings = await getSiteSettings((await resolveRequestStore(request)).store.id);
    if (!settings.allowSignup) {
      return Response.json(
        { message: "Account creation is currently closed." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
  }
  return auth.handler(request);
}

export async function GET(request: Request) {
  return (await unknownHost(request)) ?? betterAuth.GET(request);
}
