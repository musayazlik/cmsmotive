import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyCreemSignature } from "@/lib/billing-access";
import { syncCheckout, syncReversal, syncSubscription, type SyncResult } from "@/lib/commerce";
const eventSchema = z.object({
  id: z.string().min(1),
  eventType: z.string(),
  created_at: z.number(),
  object: z.record(z.string(), z.unknown()),
});
const id = (value: unknown) =>
  typeof value === "string"
    ? value
    : value && typeof value === "object" && "id" in value
      ? String(value.id)
      : null;

/**
 * Creem webhook: verified on the exact raw bytes, then handed to lib/commerce,
 * which reconciles each event with the Creem API. A 4xx/5xx answer makes
 * Creem retry; recorded and foreign events answer 200.
 */
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  if (Number(request.headers.get("content-length")) > 262144)
    return new Response("Payload too large", { status: 413 });
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader)
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262144) {
        await reader.cancel();
        return new Response("Payload too large", { status: 413 });
      }
      chunks.push(value);
    }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (
    !verifyCreemSignature(raw, request.headers.get("creem-signature"), secret)
  )
    return new Response("Invalid signature", { status: 401 });
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return new Response("Invalid event", { status: 400 });
  const event = parsed.data;
  if (await prisma.paymentEvent.findUnique({ where: { id: event.id } }))
    return Response.json({ received: true });
  const ref = { id: event.id, type: event.eventType };
  try {
    let result: SyncResult;
    if (event.eventType === "checkout.completed") {
      result = await syncCheckout(ref, event.object);
    } else if (event.eventType.startsWith("subscription.")) {
      const subscriptionId = id(event.object);
      result = subscriptionId?.startsWith("sub_") ? await syncSubscription(ref, subscriptionId) : { status: "ignored" };
    } else if (event.eventType === "refund.created" || event.eventType === "dispute.created") {
      result = await syncReversal(ref, event.object);
    } else {
      result = { status: "ignored" };
    }
    if (result.status === "rejected") return new Response(result.message, { status: result.code });
    return Response.json(result.status === "ignored" ? { received: true, ignored: true } : { received: true });
  } catch (error) {
    console.error("creem webhook: reconciliation failed", event.eventType, error instanceof Error ? error.message : error);
    return new Response("Payment reconciliation failed; retry required", { status: 500 });
  }
}
