import { z } from "zod";
import { createNotifications } from "./notifications";
import { sendNotificationEmail } from "./plunk";
import { prisma } from "./prisma";

/**
 * Customer support requests. A customer opens a request in their account
 * (optionally about a product they own) and both sides reply in one thread.
 * Status follows whose turn it is: open = the team, answered = the customer,
 * closed = done (a new customer message reopens it). The team is mailed on
 * new customer messages; the customer gets an account notification (always
 * mailed) when the team replies.
 */

export const SUPPORT_STATUSES = ["open", "answered", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUBJECT_MAX = 120;
export const BODY_MAX = 5000;
/** New requests one customer may open per day, against accidental floods. */
const DAILY_TICKETS = 5;

export const ticketInput = z.object({
  subject: z.string().trim().min(3).max(SUBJECT_MAX),
  body: z.string().trim().min(10).max(BODY_MAX),
  productId: z.string().trim().max(64).optional().transform((value) => value || undefined),
});
export const replyInput = z.string().trim().min(1).max(BODY_MAX);

export type SupportResult<T = { id: string }> = { ok: true; data: T } | { ok: false; reason: "invalid" | "not-found" | "rate-limit" };

/** Products the customer can ask about: everything they own in the store, refunded purchases excluded. */
export async function supportProducts(userId: string, storeId: string) {
  const entitlements = await prisma.entitlement.findMany({
    where: { storeId, revokedAt: null, customer: { userId } },
    select: { product: { select: { id: true, name: true } } },
  });
  return [...new Map(entitlements.map(({ product }) => [product.id, product])).values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function mailTeam(storeId: string, ticket: { id: string; subject: string }, from: { name: string; email: string }, body: string, first: boolean) {
  await sendNotificationEmail(storeId, {
    subject: `${first ? "New support request" : "Customer reply"}: ${ticket.subject}`,
    heading: first ? "New support request" : "New reply on a support request",
    rows: [["Customer", `${from.name} <${from.email}>`], ["Subject", ticket.subject], ["Message", body]],
    replyTo: from.email,
    actionPath: `/panel/support/${ticket.id}`,
    actionText: "Open the request",
  }).catch((error) => console.error("support: team email failed", error instanceof Error ? error.message : error));
}

export async function createTicket(user: { id: string; name: string; email: string }, storeId: string, input: unknown): Promise<SupportResult> {
  const parsed = ticketInput.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { subject, body, productId } = parsed.data;
  if (productId && !(await supportProducts(user.id, storeId)).some((product) => product.id === productId)) return { ok: false, reason: "invalid" };
  const recent = await prisma.supportTicket.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (recent >= DAILY_TICKETS) return { ok: false, reason: "rate-limit" };
  const ticket = await prisma.supportTicket.create({
    data: { storeId, userId: user.id, productId: productId ?? null, subject, messages: { create: { authorId: user.id, body } } },
  });
  await mailTeam(storeId, ticket, user, body, true);
  return { ok: true, data: { id: ticket.id } };
}

export function listCustomerTickets(userId: string, storeId: string) {
  return prisma.supportTicket.findMany({
    where: { userId, storeId },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    select: { id: true, subject: true, status: true, lastMessageAt: true, createdAt: true, product: { select: { name: true } }, _count: { select: { messages: true } } },
  });
}

const threadSelect = {
  id: true,
  subject: true,
  status: true,
  createdAt: true,
  lastMessageAt: true,
  storeId: true,
  product: { select: { name: true } },
  user: { select: { id: true, name: true, email: true } },
  messages: { orderBy: { createdAt: "asc" }, select: { id: true, body: true, fromStaff: true, createdAt: true, author: { select: { name: true } } } },
} as const;

export function loadCustomerTicket(userId: string, storeId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({ where: { id: ticketId, userId, storeId }, select: threadSelect });
}

export async function replyAsCustomer(user: { id: string; name: string; email: string }, storeId: string, ticketId: string, input: unknown): Promise<SupportResult> {
  const body = replyInput.safeParse(input);
  if (!body.success) return { ok: false, reason: "invalid" };
  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, userId: user.id, storeId }, select: { id: true, subject: true } });
  if (!ticket) return { ok: false, reason: "not-found" };
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "open", lastMessageAt: new Date(), messages: { create: { authorId: user.id, body: body.data } } },
  });
  await mailTeam(storeId, ticket, user, body.data, false);
  return { ok: true, data: { id: ticket.id } };
}

/* ------------------------------------------------------------------ panel */

export function listStoreTickets(storeId: string, status?: SupportStatus) {
  return prisma.supportTicket.findMany({
    where: { storeId, ...(status ? { status } : {}) },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    select: {
      id: true, subject: true, status: true, lastMessageAt: true, createdAt: true,
      product: { select: { name: true } }, user: { select: { name: true, email: true } }, _count: { select: { messages: true } },
    },
  });
}

export function loadStoreTicket(storeId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({ where: { id: ticketId, storeId }, select: threadSelect });
}

/** A team reply: the customer's turn next, and they hear about it in their account and by mail. */
export async function replyAsStaff(staffId: string, storeId: string, ticketId: string, input: unknown, close = false): Promise<SupportResult> {
  const body = replyInput.safeParse(input);
  if (!body.success) return { ok: false, reason: "invalid" };
  const ticket = await prisma.supportTicket.findFirst({ where: { id: ticketId, storeId }, select: { id: true, subject: true, userId: true } });
  if (!ticket) return { ok: false, reason: "not-found" };
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.supportMessage.create({ data: { ticketId: ticket.id, authorId: staffId, fromStaff: true, body: body.data } });
    await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: close ? "closed" : "answered", lastMessageAt: created.createdAt } });
    await createNotifications(tx, [{
      storeId,
      userId: ticket.userId,
      type: "support.replied",
      dedupeKey: `support.replied:${created.id}`,
      href: `/account/support/${ticket.id}`,
      data: { product: ticket.subject, subject: ticket.subject },
    }]);
    return created;
  });
  return { ok: true, data: { id: message.id } };
}

export async function setTicketStatus(storeId: string, ticketId: string, status: "open" | "closed"): Promise<boolean> {
  const { count } = await prisma.supportTicket.updateMany({ where: { id: ticketId, storeId }, data: { status } });
  return count > 0;
}

export function openTicketCount(storeId: string) {
  return prisma.supportTicket.count({ where: { storeId, status: "open" } });
}
