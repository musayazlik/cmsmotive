import { auth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";

/** The self-service registration calls; blocked while Settings → General → Accounts is off. */
const SIGN_UP_PATH = /^\/api\/auth\/sign-up(?:\/|$)/i;

export async function POST(request: Request) {
  if (SIGN_UP_PATH.test(new URL(request.url).pathname)) {
    const settings = await getSiteSettings();
    if (!settings.allowSignup) {
      return Response.json(
        { message: "Account creation is currently closed." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
  }
  return auth.handler(request);
}

export const { GET } = toNextJsHandler(auth);
