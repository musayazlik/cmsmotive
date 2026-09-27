import { prisma } from "@/lib/prisma";
import { sendContactEmail } from "@/lib/plunk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = (key: string) => typeof body[key] === "string" ? (body[key] as string).trim() : "";
  const data = {
    name: text("name"), email: text("email"), agency: text("agency"),
    typo3Version: text("typo3Version"), license: text("license"), message: text("message"),
  };
  if (data.name.length < 2 || data.name.length > 80 || data.agency.length < 2 || data.agency.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254 ||
      data.message.length < 10 || data.message.length > 2000 ||
      !["TYPO3 13 LTS", "TYPO3 14 LTS", "Not on TYPO3 yet", "Not sure yet"].includes(data.typo3Version) ||
      !["Single site", "Agency", "Enterprise"].includes(data.license)) {
    return Response.json({ error: "Please check the form fields." }, { status: 400 });
  }

  const inquiry = await prisma.contactInquiry.create({ data });
  try {
    await sendContactEmail(data);
    await prisma.contactInquiry.update({ where: { id: inquiry.id }, data: { emailSent: true } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Your message was saved, but email delivery failed. Please email hello@cmsmotive.de directly." }, { status: 502 });
  }
}
