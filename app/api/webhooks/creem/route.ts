import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyCreemSignature } from "@/lib/billing-access";
import {
  creemMode,
  creemRequest,
  objectId,
  subscriptionSchema,
} from "@/lib/creem";
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
  const subscriptionId = event.eventType.startsWith("subscription.")
    ? id(event.object)
    : id(event.object.subscription);
  if (!subscriptionId?.startsWith("sub_"))
    return Response.json({ received: true, ignored: true });
  try {
    // Reconcile with the authoritative API, not arrival order or the success-page URL.
    const s = subscriptionSchema.parse(
      await creemRequest(
        `/v1/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`,
      ),
    );
    if (s.mode !== creemMode())
      return new Response("Wrong payment environment", { status: 400 });
    const previous = await prisma.productSubscription.findUnique({
      where: { creemSubscriptionId: s.id },
    });
    const attemptId = s.metadata?.checkoutAttemptId;
    const attempt =
      typeof attemptId === "string"
        ? await prisma.checkoutAttempt.findUnique({ where: { id: attemptId } })
        : null;
    if (!previous && !attempt)
      return Response.json({ received: true, ignored: true });
    if (
      attempt &&
      (attempt.creemProductId !== objectId(s.product) ||
        attempt.mode !== s.mode)
    )
      return new Response("Product mismatch", { status: 400 });
    const userId = previous?.userId ?? attempt!.userId;
    if (
      !(await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }))
    )
      return Response.json({ received: true, ignored: true });
    const transaction = event.object.transaction;
    const reversed =
      transaction &&
      typeof transaction === "object" &&
      "id" in transaction &&
      transaction.id === s.last_transaction_id;
    const status =
      reversed &&
      event.eventType === "refund.created" &&
      "status" in transaction &&
      transaction.status === "refunded"
        ? "refunded"
        : reversed && event.eventType === "dispute.created"
          ? "disputed"
          : s.status;
    const data = {
      userId,
      planId: previous?.planId ?? attempt!.planId,
      creemCustomerId: objectId(s.customer),
      mode: s.mode,
      status,
      currentPeriodStart: new Date(s.current_period_start_date),
      currentPeriodEnd: new Date(s.current_period_end_date),
      providerUpdatedAt: new Date(s.updated_at),
    };
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${s.id}))`;
      if (await tx.paymentEvent.findUnique({ where: { id: event.id } })) return;
      const current = await tx.productSubscription.findUnique({
        where: { creemSubscriptionId: s.id },
      });
      if (
        !current ||
        current.providerUpdatedAt < data.providerUpdatedAt ||
        (current.providerUpdatedAt.getTime() ===
          data.providerUpdatedAt.getTime() &&
          !["refunded", "disputed"].includes(current.status))
      )
        await tx.productSubscription.upsert({
          where: { creemSubscriptionId: s.id },
          create: { ...data, creemSubscriptionId: s.id },
          update: data,
        });
      await tx.paymentEvent.create({
        data: { id: event.id, type: event.eventType, mode: s.mode },
      });
    });
    return Response.json({ received: true });
  } catch {
    return new Response("Payment reconciliation failed; retry required", {
      status: 500,
    });
  }
}
