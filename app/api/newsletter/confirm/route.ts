import { prisma } from "@/lib/prisma";
import { tokenHash, unsubscribeToken } from "@/lib/newsletter";
import { billingOrigin } from "@/lib/creem";
import { isLocale } from "@/lib/i18n/config";
import { sendAccountEmail } from "@/lib/plunk";
import { copy } from "@/lib/legal-copy";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== billingOrigin())
    return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  const raw = String(form.get("token") ?? "");
  const lang = form.get("lang");
  const l = isLocale(typeof lang === "string" ? lang : undefined)
    ? (lang as "de" | "en" | "tr")
    : "en";
  if (!/^[a-f0-9]{64}$/.test(raw))
    return Response.redirect(
      `${billingOrigin()}/newsletter/confirm?done=invalid&lang=${l}`,
      303,
    );
  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { confirmationTokenHash: tokenHash(raw) },
  });
  if (
    !subscriber ||
    !subscriber.confirmationExpiresAt ||
    subscriber.confirmationExpiresAt < new Date()
  )
    return Response.redirect(
      `${billingOrigin()}/newsletter/confirm?done=invalid&lang=${l}`,
      303,
    );
  const updated = await prisma.newsletterSubscriber.updateMany({
    where: {
      id: subscriber.id,
      confirmationTokenHash: tokenHash(raw),
      confirmationExpiresAt: { gt: new Date() },
    },
    data: {
      confirmedAt: new Date(),
      unsubscribedAt: null,
      confirmationTokenHash: null,
      confirmationExpiresAt: null,
    },
  });
  if (updated.count)
    await sendAccountEmail({
      to: subscriber.email,
      subject: copy(
        l,
        "Your CMSMotive subscription is confirmed",
        "Ihre CMSMotive-Anmeldung ist bestätigt",
        "CMSMotive aboneliğiniz doğrulandı",
      ),
      actionUrl: `${billingOrigin()}/newsletter/unsubscribe?token=${unsubscribeToken(subscriber.id)}&lang=${l}`,
      actionText: copy(l, "Unsubscribe", "Abmelden", "Abonelikten ayrıl"),
    }).catch(() => undefined);
  return Response.redirect(
    `${billingOrigin()}/newsletter/confirm?done=${updated.count ? "ok" : "invalid"}&lang=${l}`,
    303,
  );
}
