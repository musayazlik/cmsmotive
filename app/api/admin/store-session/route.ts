import { completeStoreSessionTransfer } from "@/lib/store-session-transfer";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return new Response(null, { status: 415 });
  const body = await request.text();
  if (body.length > 256) return new Response(null, { status: 413 });
  return completeStoreSessionTransfer(request, new URLSearchParams(body).get("token") ?? "");
}
