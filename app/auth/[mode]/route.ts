import { htmlResponse, readLegacyPage } from "@/lib/legacy";
import { getAdminAccessSettings } from "@/lib/admin-access";
import { getSiteSettings } from "@/lib/settings";

export const runtime = "nodejs";
const modes = new Set(["login", "register", "forgot-password", "reset-password", "verify-email"]);

export async function GET(_request: Request, context: { params: Promise<{ mode: string }> }) {
  const { mode } = await context.params;
  if (!modes.has(mode)) return new Response("Not found", { status: 404 });
  const { panelPath } = await getAdminAccessSettings();
  const privateEntry = panelPath !== "/panel" && _request.headers.get("x-admin-gateway") === panelPath;
  const authRoot = privateEntry ? panelPath : "/auth";
  const target = privateEntry || panelPath === "/panel" ? panelPath : "/";
  const allowSignup = (await getSiteSettings()).allowSignup;

  // Settings → General → Accounts: with sign-ups off the register page sends
  // people to sign-in, and the sign-in page drops its create-account link.
  if (mode === "register" && !allowSignup) {
    return new Response(null, { status: 303, headers: { Location: `${authRoot}/login`, "Cache-Control": "no-store" } });
  }

  let html = await readLegacyPage(`auth/${mode}.html`);
  html = html
    .replace(/<a class="auth-preview-link"[\s\S]*?<\/a>/g, "")
    .replace(/<div class="auth-preview-note">[\s\S]*?<\/div>/g, "")
    .replace(/<script src="\/assets\/js\/auth\.js" defer><\/script>/g, "")
    .replace("</body>", '<script src="/auth-live.js" defer></script></body>');
  html = html.replace(/<body\b/, `<body data-auth-root="${authRoot}" data-auth-target="${target}" data-auth-mode="${mode}"`);
  if (privateEntry || (mode === "login" && !allowSignup)) {
    html = html.replace(/<p class="auth-switch">[\s\S]*?<\/p>/g, "");
  }
  if (privateEntry) {
    html = html.replace(/(href=["'])\/auth\/(login|forgot-password|reset-password|verify-email)(?=[?"'])/g, `$1${authRoot}/$2`);
  }
  if (mode === "verify-email") {
    html = html.replace(
      /(<div class="auth-verify-copy">[\s\S]*?<p>)[\s\S]*?(<\/p>)/,
      "$1A verification link has been sent to your email address. Open it to activate your workspace.$2",
    );
  }
  const response = htmlResponse(html);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
