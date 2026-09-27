import { htmlResponse, readLegacyPage } from "@/lib/legacy";

export const runtime = "nodejs";
const modes = new Set(["login", "register", "forgot-password", "reset-password", "verify-email"]);

export async function GET(_request: Request, context: { params: Promise<{ mode: string }> }) {
  const { mode } = await context.params;
  if (!modes.has(mode)) return new Response("Not found", { status: 404 });

  let html = await readLegacyPage(`auth/${mode}.html`);
  html = html
    .replace(/<a class="auth-preview-link"[\s\S]*?<\/a>/g, "")
    .replace(/<div class="auth-preview-note">[\s\S]*?<\/div>/g, "")
    .replace(/<script src="\/assets\/js\/auth\.js" defer><\/script>/g, "")
    .replace("</body>", '<script src="/auth-live.js" defer></script></body>');
  if (mode === "verify-email") {
    html = html.replace(
      /(<div class="auth-verify-copy">[\s\S]*?<p>)[\s\S]*?(<\/p>)/,
      "$1A verification link has been sent to your email address. Open it to activate your workspace.$2",
    );
  }
  return htmlResponse(html);
}
