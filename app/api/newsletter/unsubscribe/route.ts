import { prisma } from "@/lib/prisma";
import { readUnsubscribeToken } from "@/lib/newsletter";
import { billingOrigin } from "@/lib/creem";
import { isLocale } from "@/lib/i18n/config";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== (await billingOrigin(request)))
    return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const id = readUnsubscribeToken(String(form.get("token") ?? ""));
  const lang = form.get("lang");
  const l = isLocale(typeof lang === "string" ? lang : undefined) ? lang : "en";
  if (id)
    await prisma.newsletterSubscriber.updateMany({
      where: { id },
      data: {
        unsubscribedAt: new Date(),
        confirmationTokenHash: null,
        confirmationExpiresAt: null,
      },
    });
  return Response.redirect(
    `${await billingOrigin(request)}/newsletter/unsubscribe?done=${id ? "ok" : "invalid"}&lang=${l}`,
    303,
  );
}
