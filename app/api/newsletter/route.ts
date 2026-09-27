import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Footer newsletter signup. Idempotent: an existing subscriber only has
 * the stored name refreshed, so double submissions never duplicate rows.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const email = text("email");
  const firstName = text("firstName");
  const lastName = text("lastName");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      firstName.length < 1 || firstName.length > 60 ||
      lastName.length < 1 || lastName.length > 60) {
    return Response.json({ error: "Please provide your first name, last name and a valid email address." }, { status: 400 });
  }

  try {
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { firstName, lastName },
      create: { email, firstName, lastName },
    });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("newsletter signup failed", error);
    return Response.json({ error: "The subscription could not be saved. Please try again later." }, { status: 500 });
  }
}
