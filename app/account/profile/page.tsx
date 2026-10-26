import { requireCustomer } from "@/lib/customer-auth";
import { copy } from "@/lib/legal-copy";
import { getRequestLocale } from "@/lib/i18n/request";
import AccountForm from "@/app/panel/account/_components/account-form";
import { AccountHeading, AccountIcon } from "../account-ui";

export default async function ProfilePage() {
  const [user, l] = await Promise.all([requireCustomer(), getRequestLocale()]);
  return (
    <>
      <AccountHeading
        title={copy(l, "My account", "Mein Konto", "Hesabım")}
        description={copy(
          l,
          "Your personal details and sign-in security, all in one place.",
          "Ihre persönlichen Daten und die Sicherheit Ihres Kontos an einem Ort.",
          "Kişisel bilgilerinizi görüntüleyin ve hesap güvenliğinizi yönetin.",
        )}
      />
      <div className="customer-columns">
        <div className="customer-stack">
          <section className="customer-card" aria-labelledby="identity-title">
            <header className="customer-card-head">
              <h2 id="identity-title">
                {copy(
                  l,
                  "Personal details",
                  "Persönliche Daten",
                  "Kişisel bilgiler",
                )}
              </h2>
              <AccountIcon name="profile" className="customer-heading-icon" />
            </header>
            <div className="customer-profile-identity">
              <span className="customer-profile-avatar">
                {user.name.trim()[0]?.toUpperCase() || "?"}
              </span>
              <div>
                <strong>{user.name}</strong>
                <p>{user.email}</p>
              </div>
            </div>
          </section>
          <section className="customer-card" aria-labelledby="security-title">
            <header className="customer-card-head">
              <h2 id="security-title">
                {copy(
                  l,
                  "Change password",
                  "Passwort ändern",
                  "Şifre değiştir",
                )}
              </h2>
              <AccountIcon name="shield" className="customer-heading-icon" />
            </header>
            <div className="customer-profile-form">
              <AccountForm locale={l} />
            </div>
          </section>
        </div>
        <aside className="customer-card customer-aside">
          <AccountIcon name="shield" />
          <h2>
            {copy(
              l,
              "Your data, your control",
              "Ihre Daten, Ihre Kontrolle",
              "Verileriniz sizin kontrolünüzde",
            )}
          </h2>
          <p>
            {copy(
              l,
              "For personal-data access, correction, export or account deletion, contact us by email.",
              "Für Auskunft, Berichtigung, Datenexport oder Kontolöschung kontaktieren Sie uns per E-Mail.",
              "Kişisel verilerinize erişim, düzeltme, dışa aktarım veya hesap silme talepleriniz için e-postayla iletişime geçin.",
            )}
          </p>
          <a className="customer-text-link" href="mailto:info@cmsmotive.de">
            info@cmsmotive.de
            <AccountIcon name="external" />
          </a>
        </aside>
      </div>
    </>
  );
}
