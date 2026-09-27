import { htmlResponse, readLegacyPage } from "@/lib/legacy";
import { trackPageView } from "@/lib/analytics";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ legacy?: string[] }> }) {
  const segments = (await context.params).legacy ?? [];
  if (segments.length > 1 || segments.some((segment) => !/^[a-z0-9-]+$/.test(segment))) {
    return new Response("Not found", { status: 404 });
  }
  const slug = segments[0] ?? "index";
  try {
    const html = await readLegacyPage(`${slug}.html`);
    trackPageView(slug);
    return htmlResponse(html);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("Not found", { status: 404 });
    }
    throw error;
  }
}
