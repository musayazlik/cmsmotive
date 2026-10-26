import { headers } from "next/headers";
import AccountForm from "@/app/panel/account/_components/account-form";
import { googleAuthConfigured } from "@/lib/account-registration";
import { auth } from "@/lib/auth";
import { requireCustomer } from "@/lib/customer-auth";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { prisma } from "@/lib/prisma";
import { describeUserAgent } from "@/lib/user-agent";
import { AccountHeading, AccountIcon, AccountTabs } from "../account-ui";
import { ChangeEmailForm, GoogleConnection, SessionList, SetPasswordForm } from "./_components/security-forms";

/** Password, email address, signed-in devices and connected sign-in methods. */
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ email?: string; google?: string }> }) {
  const [user, l, query] = await Promise.all([requireCustomer(), getRequestLocale(), searchParams]);
  const session = await auth.api.getSession({ headers: await headers() });
  const [accounts, sessions] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id }, select: { providerId: true, password: true } }),
    prisma.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, userAgent: true, ipAddress: true, updatedAt: true },
    }),
  ]);
  const hasPassword = accounts.some((account) => account.providerId === "credential" && account.password);
  const googleLinked = accounts.some((account) => account.providerId === "google");
  const when = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium", timeStyle: "short" });
  const unknown = copy(l, "Unknown device", "Unbekanntes Gerät", "Bilinmeyen cihaz");
  const rows = sessions.map((row) => {
    const { browser, system } = describeUserAgent(row.userAgent);
    return {
      id: row.id,
      device: [browser, system].filter(Boolean).join(" · ") || unknown,
      ip: row.ipAddress,
      lastActive: when.format(row.updatedAt),
      current: row.id === session?.session.id,
    };
  });

  return (
    <>
      <AccountHeading
        title={copy(l, "Sign-in & security", "Anmeldung & Sicherheit", "Giriş ve güvenlik")}
        description={copy(
          l,
          "Your password, email address, signed-in devices and sign-in methods.",
          "Ihr Passwort, Ihre E-Mail-Adresse, angemeldete Geräte und Anmeldemethoden.",
          "Şifreniz, e-posta adresiniz, oturum açık cihazlarınız ve giriş yöntemleriniz.",
        )}
      />
      <AccountTabs current="security" locale={l} />
      {query.email === "changed" && (
        <p className="customer-banner" role="status">
          {copy(l, "Your email address was changed.", "Ihre E-Mail-Adresse wurde geändert.", "E-posta adresiniz değiştirildi.")}
        </p>
      )}
      {query.google === "linked" && (
        <p className="customer-banner" role="status">
          {copy(l, "Google is now connected to your account.", "Google ist jetzt mit Ihrem Konto verbunden.", "Google artık hesabınıza bağlı.")}
        </p>
      )}
      {query.google === "failed" && (
        <p className="customer-banner" data-tone="error" role="alert">
          {copy(
            l,
            "Google could not be connected. Use a Google account with the same email address as this account.",
            "Google konnte nicht verbunden werden. Verwenden Sie ein Google-Konto mit derselben E-Mail-Adresse.",
            "Google bağlanamadı. Bu hesapla aynı e-posta adresine sahip bir Google hesabı kullanın.",
          )}
        </p>
      )}

      <div className="customer-columns">
        <div className="customer-stack">
          <section className="customer-card" aria-labelledby="password-title">
            <header className="customer-card-head">
              <h2 id="password-title">
                {hasPassword ? copy(l, "Change password", "Passwort ändern", "Şifre değiştir") : copy(l, "Set a password", "Passwort festlegen", "Şifre belirle")}
              </h2>
              <AccountIcon name="lock" className="customer-heading-icon" />
            </header>
            <div className="customer-card-body">
              {hasPassword ? (
                <AccountForm locale={l} />
              ) : (
                <>
                  <p className="customer-card-lead">
                    {copy(
                      l,
                      "You sign in with Google. Add a password to also sign in with your email address.",
                      "Sie melden sich mit Google an. Mit einem Passwort können Sie sich auch per E-Mail anmelden.",
                      "Google ile giriş yapıyorsunuz. E-posta adresinizle de giriş yapmak için bir şifre ekleyin.",
                    )}
                  </p>
                  <SetPasswordForm locale={l} />
                </>
              )}
            </div>
          </section>

          <section className="customer-card" aria-labelledby="email-title">
            <header className="customer-card-head">
              <h2 id="email-title">{copy(l, "Email address", "E-Mail-Adresse", "E-posta adresi")}</h2>
              <AccountIcon name="mail" className="customer-heading-icon" />
            </header>
            <div className="customer-card-body">
              <p className="customer-card-lead">
                {copy(l, "Current address:", "Aktuelle Adresse:", "Mevcut adres:")} <strong>{user.email}</strong>.{" "}
                {copy(
                  l,
                  "We send a link to the new address; it replaces this one once you open it. Invoices from earlier purchases keep the address used at checkout.",
                  "Wir senden einen Link an die neue Adresse; sie ersetzt die bisherige, sobald Sie ihn öffnen. Rechnungen früherer Käufe behalten die Adresse aus dem Kauf.",
                  "Yeni adrese bir bağlantı göndeririz; bağlantıyı açtığınızda mevcut adresin yerini alır. Önceki satın alımların faturaları ödeme sırasındaki adresi korur.",
                )}
              </p>
              <ChangeEmailForm locale={l} needsPassword={hasPassword} />
            </div>
          </section>

          <section className="customer-card" aria-labelledby="sessions-title">
            <header className="customer-card-head">
              <h2 id="sessions-title">{copy(l, "Signed-in devices", "Angemeldete Geräte", "Oturum açık cihazlar")}</h2>
              <span className="customer-count">{rows.length}</span>
            </header>
            <SessionList sessions={rows} locale={l} />
          </section>
        </div>

        <aside className="customer-stack" aria-label={copy(l, "Sign-in methods", "Anmeldemethoden", "Giriş yöntemleri")}>
          <section className="customer-card customer-aside">
            <AccountIcon name="shield" />
            <h2>{copy(l, "Sign-in methods", "Anmeldemethoden", "Giriş yöntemleri")}</h2>
            <div className="customer-connection">
              <div>
                <strong>{copy(l, "Email and password", "E-Mail und Passwort", "E-posta ve şifre")}</strong>
                <p>{hasPassword ? copy(l, "Active", "Aktiv", "Etkin") : copy(l, "No password set yet", "Noch kein Passwort festgelegt", "Henüz şifre belirlenmedi")}</p>
              </div>
            </div>
            {(googleAuthConfigured() || googleLinked) && <GoogleConnection linked={googleLinked} locale={l} />}
          </section>
        </aside>
      </div>
    </>
  );
}
