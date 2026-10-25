import { requireCustomer } from "@/lib/customer-auth";
import { copy } from "@/lib/legal-copy";
import { getRequestLocale } from "@/lib/i18n/request";
import AccountForm from "@/app/panel/account/_components/account-form";
export default async function ProfilePage() {
  const user = await requireCustomer();
  const l = await getRequestLocale();
  return (
    <>
      <div className="workspace-title-row">
        <div>
          <h1>{copy(l, "My account", "Mein Konto", "Hesabım")}</h1>
          <p>
            {user.name} · {user.email}
          </p>
        </div>
      </div>
      <div className="wtable-card wsettings-section">
        <AccountForm locale={l} />
      </div>
      <p>
        {copy(
          l,
          "For personal-data access, correction, export or account deletion, contact",
          "Für Auskunft, Berichtigung, Datenexport oder Kontolöschung kontaktieren Sie",
          "Kişisel verilerinize erişim, düzeltme, dışa aktarım veya hesap silme için iletişim",
        )}
        : <a href="mailto:info@cmsmotive.de">info@cmsmotive.de</a>
      </p>
    </>
  );
}
