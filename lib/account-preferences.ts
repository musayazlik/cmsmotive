import type { Locale } from "./i18n/config";
import { prisma } from "./prisma";

/**
 * Preferences a signed-in customer sets in their account: the language of the
 * mails we send them and the store newsletter.
 *
 * The newsletter here skips the double opt-in mail the public form sends: the
 * account's email address is already verified, and the consent (checkbox plus
 * the privacy notice version shown next to it) is recorded the same way.
 */

const SOURCE = "footer";

export async function newsletterSubscribed(storeId: string, email: string) {
  const row = await prisma.newsletterSubscriber.findUnique({ where: { storeId_email_source: { storeId, email, source: SOURCE } } });
  return Boolean(row?.confirmedAt && !row.unsubscribedAt);
}

export async function setNewsletter(
  storeId: string,
  user: { email: string; name: string },
  subscribe: boolean,
  consent: { locale: Locale; privacyVersion: string },
) {
  const key = { storeId_email_source: { storeId, email: user.email, source: SOURCE } };
  if (!subscribe) {
    await prisma.newsletterSubscriber.updateMany({
      where: { storeId, email: user.email, source: SOURCE, unsubscribedAt: null },
      data: { unsubscribedAt: new Date(), confirmationTokenHash: null, confirmationExpiresAt: null },
    });
    return;
  }
  if (await newsletterSubscribed(storeId, user.email)) return;
  const [firstName, ...rest] = user.name.trim().split(/\s+/);
  const proof = {
    firstName: (firstName ?? "").slice(0, 60),
    lastName: rest.join(" ").slice(0, 60),
    locale: consent.locale,
    consentVersion: consent.privacyVersion,
    confirmedAt: new Date(),
    unsubscribedAt: null,
    confirmationTokenHash: null,
    confirmationExpiresAt: null,
  };
  await prisma.newsletterSubscriber.upsert({ where: key, create: { storeId, email: user.email, source: SOURCE, ...proof }, update: proof });
}

export async function setAccountLocale(userId: string, locale: Locale) {
  await prisma.user.update({ where: { id: userId }, data: { accountLocale: locale } });
}
