import { sendNotificationEmail } from "@/lib/plunk";
import { prisma } from "@/lib/prisma";
import { getEmailSettings } from "@/lib/settings";

export const runtime = "nodejs";

/**
 * Footer newsletter and email-only maintenance signups share the same list.
 * Maintenance signups preserve the names of existing subscribers.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const input: unknown = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    body = input as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const email = text("email").toLowerCase();
  const firstName = text("firstName");
  const lastName = text("lastName");
  const source = body.source === "maintenance" ? "maintenance" : "footer";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return Response.json({ error: "Please provide your first name, last name and a valid email address.", code: "invalid_email" }, { status: 400 });
  }
  if (firstName.length > 60 || lastName.length > 60 || (source === "footer" && (!firstName || !lastName))) {
    return Response.json({ error: "Please provide your first name, last name and a valid email address." }, { status: 400 });
  }

  try {
    const existing = await prisma.newsletterSubscriber.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { email: true },
    });
    await prisma.newsletterSubscriber.upsert({
      where: { email: existing?.email ?? email },
      update: source === "maintenance" ? {} : { firstName, lastName },
      create: { email, firstName, lastName, source },
    });
    if (!existing && (await getEmailSettings()).notifySubscribers) {
      await sendNotificationEmail({
        subject: `New newsletter subscriber: ${[firstName, lastName].filter(Boolean).join(" ") || email}`,
        heading: "New newsletter subscriber",
        rows: [["Name", [firstName, lastName].filter(Boolean).join(" ") || "Not provided"], ["Email", email], ["Source", source]],
      }).catch((error) => console.error("newsletter: notification email failed", error));
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("newsletter signup failed", error);
    return Response.json({ error: "The subscription could not be saved. Please try again later." }, { status: 500 });
  }
}
