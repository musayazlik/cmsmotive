import { deletionBlockers } from "@/lib/account-data";
import { requireCustomer } from "@/lib/customer-auth";
import { currentStoreId } from "@/lib/current-store";
import { getRequestLocale } from "@/lib/i18n/request";
import { getLegalSettings } from "@/lib/legal";
import { copy } from "@/lib/legal-copy";
import { prisma } from "@/lib/prisma";
import { AccountHeading, AccountIcon, AccountTabs } from "../account-ui";
import DeleteAccountForm from "./_components/delete-account-form";

/** The customer's data rights: a copy of their data, and deleting the account. */
export default async function PrivacyPage() {
  const [user, l, storeId] = await Promise.all([requireCustomer(), getRequestLocale(), currentStoreId()]);
  const [blockers, credential, legal] = await Promise.all([
    deletionBlockers(user.id),
    prisma.account.findFirst({ where: { userId: user.id, providerId: "credential", password: { not: null } }, select: { id: true } }),
    getLegalSettings(storeId),
  ]);

  return (
    <>
      <AccountHeading
        title={copy(l, "Data & privacy", "Daten & Datenschutz", "Veri ve gizlilik")}
        description={copy(
          l,
          "See what we store about you, take a copy with you, or delete your account.",
          "Sehen Sie, was wir über Sie speichern, nehmen Sie eine Kopie mit oder löschen Sie Ihr Konto.",
          "Hakkınızda neleri sakladığımızı görün, bir kopyasını alın veya hesabınızı silin.",
        )}
      />
      <AccountTabs current="privacy" locale={l} />

      <div className="customer-columns">
        <div className="customer-stack">
          <section className="customer-card" aria-labelledby="export-title">
            <header className="customer-card-head">
              <h2 id="export-title">{copy(l, "Download your data", "Ihre Daten herunterladen", "Verilerinizi indirin")}</h2>
              <AccountIcon name="download" className="customer-heading-icon" />
            </header>
            <div className="customer-card-body">
              <p className="customer-card-lead">
                {copy(
                  l,
                  "One JSON file with your profile, sign-in methods and devices, purchases, subscriptions, licence keys, payments, consent records, notifications, newsletter sign-ups, reviews, comments and support requests. Passwords and security tokens are never included.",
                  "Eine JSON-Datei mit Profil, Anmeldemethoden und Geräten, Käufen, Abonnements, Lizenzschlüsseln, Zahlungen, Einwilligungen, Benachrichtigungen, Newsletter-Anmeldungen, Bewertungen, Kommentaren und Supportanfragen. Passwörter und Sicherheitstoken sind nie enthalten.",
                  "Profiliniz, giriş yöntemleriniz ve cihazlarınız, satın alımlarınız, abonelikleriniz, lisans anahtarlarınız, ödemeleriniz, onay kayıtlarınız, bildirimleriniz, bülten kayıtlarınız, yorumlarınız ve destek talepleriniz tek bir JSON dosyasında. Şifreler ve güvenlik anahtarları asla dahil edilmez.",
                )}
              </p>
              <a className="wbtn wbtn-primary" href="/api/account/export" download>
                <AccountIcon name="download" />
                {copy(l, "Download my data", "Meine Daten herunterladen", "Verilerimi indir")}
              </a>
            </div>
          </section>

          <section className="customer-card customer-danger" aria-labelledby="delete-title">
            <header className="customer-card-head">
              <h2 id="delete-title">{copy(l, "Delete account", "Konto löschen", "Hesabı sil")}</h2>
            </header>
            <div className="customer-card-body">
              <p className="customer-card-lead">
                {copy(
                  l,
                  "Deleting removes your profile, sign-in, downloads, licence access, notifications, support requests and newsletter sign-ups. Orders and payments stay in our books without your name or email, as accounting law requires; Creem keeps its own invoices as merchant of record.",
                  "Beim Löschen entfernen wir Profil, Anmeldung, Downloads, Lizenzzugang, Benachrichtigungen, Supportanfragen und Newsletter-Anmeldungen. Bestellungen und Zahlungen bleiben ohne Namen und E-Mail in unserer Buchhaltung, wie es das Gesetz verlangt; Creem bewahrt als Händler eigene Rechnungen auf.",
                  "Silme işlemi profilinizi, giriş bilgilerinizi, indirmelerinizi, lisans erişiminizi, bildirimlerinizi, destek taleplerinizi ve bülten kayıtlarınızı kaldırır. Siparişler ve ödemeler muhasebe mevzuatı gereği adınız ve e-postanız olmadan kayıtlarımızda kalır; Creem satıcı olarak kendi faturalarını saklar.",
                )}
              </p>
              {blockers.length ? (
                <ul className="customer-blockers">
                  {blockers.includes("active-subscription") && (
                    <li>
                      {copy(
                        l,
                        "You have a subscription that can still be charged. Cancel it in the billing portal first; you can delete the account right after.",
                        "Sie haben ein Abonnement, das noch belastet werden kann. Kündigen Sie es zuerst im Abrechnungsportal; danach können Sie das Konto löschen.",
                        "Hâlâ ücretlendirilebilecek bir aboneliğiniz var. Önce fatura portalından iptal edin; ardından hesabı silebilirsiniz.",
                      )}{" "}
                      <a href={`/account/billing?lang=${l}`}>{copy(l, "Open billing", "Abrechnung öffnen", "Faturalara git")}</a>
                    </li>
                  )}
                  {blockers.includes("admin") && (
                    <li>
                      {copy(
                        l,
                        "This is a staff account. Another administrator removes staff accounts in the panel.",
                        "Dies ist ein Mitarbeiterkonto. Mitarbeiterkonten entfernt ein anderer Administrator im Panel.",
                        "Bu bir yönetici hesabı. Yönetici hesaplarını panelden başka bir yönetici kaldırır.",
                      )}
                    </li>
                  )}
                </ul>
              ) : (
                <DeleteAccountForm locale={l} hasPassword={Boolean(credential)} email={user.email} />
              )}
            </div>
          </section>
        </div>

        <aside className="customer-stack" aria-label={copy(l, "Your rights", "Ihre Rechte", "Haklarınız")}>
          <section className="customer-card customer-aside">
            <AccountIcon name="shield" />
            <h2>{copy(l, "Your rights", "Ihre Rechte", "Haklarınız")}</h2>
            <p>
              {copy(
                l,
                "You can also ask us to correct or restrict your data, or object to its use. Correct your details yourself under Profile.",
                "Sie können uns auch bitten, Ihre Daten zu berichtigen oder einzuschränken, oder der Nutzung widersprechen. Ihre Angaben korrigieren Sie selbst unter „Profil“.",
                "Verilerinizin düzeltilmesini veya kısıtlanmasını da isteyebilir, kullanımına itiraz edebilirsiniz. Bilgilerinizi “Profil” bölümünden kendiniz düzeltebilirsiniz.",
              )}
            </p>
            {legal.contactEmail && (
              <a className="customer-text-link" href={`mailto:${legal.contactEmail}`}>
                {legal.contactEmail}
                <AccountIcon name="external" />
              </a>
            )}
            <a className="customer-text-link" href={l === "de" ? "/privacy" : `/${l}/privacy`}>
              {copy(l, "Privacy policy", "Datenschutzerklärung", "Gizlilik politikası")}
              <AccountIcon name="arrow" />
            </a>
          </section>
        </aside>
      </div>
    </>
  );
}
