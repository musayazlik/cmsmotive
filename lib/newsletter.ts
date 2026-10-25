import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { prisma } from "./prisma";
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const newNewsletterToken = () => randomBytes(32).toString("hex");
export function unsubscribeToken(id: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("A stable authentication secret is required.");
  return `${id}.${createHmac("sha256", secret).update(`newsletter-unsubscribe:${id}`).digest("hex")}`;
}
export function readUnsubscribeToken(token: string): string | null {
  if (!/^[a-z0-9]+\.[a-f0-9]{64}$/.test(token)) return null;
  const id = token.split(".")[0];
  try {
    return timingSafeEqual(
      Buffer.from(unsubscribeToken(id)),
      Buffer.from(token),
    )
      ? id
      : null;
  } catch {
    return null;
  }
}
/** A store's confirmed list. Legacy, unconfirmed and withdrawn addresses must never be sent campaigns. */
export function confirmedSubscribers(storeId: string, source: "footer" | "maintenance") {
  return prisma.newsletterSubscriber.findMany({
    where: { storeId, source, confirmedAt: { not: null }, unsubscribedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      locale: true,
    },
  });
}
