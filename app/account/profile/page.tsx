import { requireCustomer } from "@/lib/customer-auth";
import { copy } from "@/lib/legal-copy";
import { getRequestLocale } from "@/lib/i18n/request";
import AccountForm from "@/app/panel/account/_components/account-form";
import { AccountHeading, AccountIcon } from "../account-ui";
import AddressForm from "./_components/address-form";
import AvatarEditor from "./_components/avatar-editor";
import ProfileDetailsForm from "./_components/profile-details-form";

export default async function ProfilePage() {
  const [user, l] = await Promise.all([requireCustomer(), getRequestLocale()]);
  return (
    <>
      <AccountHeading
        title={copy(l, "My account", "Mein Konto", "Hesabım")}
        description={copy(
          l,
          "Your profile photo, details, address and sign-in security, all in one place.",
          "Ihr Profilbild, Ihre Daten, Ihre Adresse und die Sicherheit Ihres Kontos an einem Ort.",
          "Profil fotoğrafınız, bilgileriniz, adresiniz ve hesap güvenliğiniz bir arada.",
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
            <AvatarEditor
              image={user.image}
              name={user.name}
              labels={{
                change: copy(l, "Change photo", "Profilbild ändern", "Fotoğrafı değiştir"),
                uploading: copy(l, "Uploading…", "Wird hochgeladen…", "Yükleniyor…"),
                remove: copy(l, "Remove photo", "Profilbild entfernen", "Fotoğrafı kaldır"),
                removing: copy(l, "Removing…", "Wird entfernt…", "Kaldırılıyor…"),
                hint: copy(l, "JPG, PNG or WebP, up to 4 MB.", "JPG, PNG oder WebP, bis 4 MB.", "JPG, PNG ya da WebP, en fazla 4 MB."),
                fallbackError: copy(
                  l,
                  "The picture could not be uploaded.",
                  "Das Profilbild konnte nicht hochgeladen werden.",
                  "Fotoğraf yüklenemedi.",
                ),
                notAnImage: copy(
                  l,
                  "Choose an image file (JPG, PNG or WebP).",
                  "Wählen Sie eine Bilddatei (JPG, PNG oder WebP).",
                  "Bir görsel dosyası seçin (JPG, PNG ya da WebP).",
                ),
                tooLarge: copy(
                  l,
                  "The picture must be 4 MB or smaller.",
                  "Das Profilbild darf höchstens 4 MB groß sein.",
                  "Fotoğraf en fazla 4 MB olabilir.",
                ),
              }}
            />
            <div className="customer-profile-form">
              <ProfileDetailsForm
                name={user.name}
                bio={user.bio ?? ""}
                labels={{
                  name: copy(l, "Display name", "Anzeigename", "Görünen ad"),
                  nameHint: copy(l, "How your name appears in your account.", "So erscheint Ihr Name in Ihrem Konto.", "Adınız hesapınızda bu şekilde görünür."),
                  bio: copy(l, "About", "Über Sie", "Hakkında"),
                  bioHint: copy(l, "A short optional introduction.", "Eine kurze optionale Einführung.", "Kısa, isteğe bağlı bir tanıtım."),
                  save: copy(l, "Save details", "Details speichern", "Bilgileri kaydet"),
                  saving: copy(l, "Saving…", "Wird gespeichert…", "Kaydediliyor…"),
                }}
              />
              <p className="customer-profile-mail">
                {copy(l, "E-mail", "E-Mail", "E-posta")}: {user.email}
              </p>
            </div>
          </section>
          <section className="customer-card" aria-labelledby="address-title">
            <header className="customer-card-head">
              <h2 id="address-title">
                {copy(
                  l,
                  "Contact & address",
                  "Kontakt & Adresse",
                  "İletişim ve adres",
                )}
              </h2>
              <AccountIcon name="mail" className="customer-heading-icon" />
            </header>
            <div className="customer-profile-form">
              <AddressForm
                values={{
                  phone: user.phone ?? "",
                  company: user.company ?? "",
                  street: user.street ?? "",
                  postalCode: user.postalCode ?? "",
                  city: user.city ?? "",
                  country: user.country ?? "",
                }}
                labels={{
                  phone: copy(l, "Phone", "Telefon", "Telefon"),
                  phoneHint: copy(
                    l,
                    "Optional; used if we need to reach you about billing.",
                    "Optional; für Rückfragen zur Abrechnung.",
                    "İsteğe bağlı; faturalandırma soruları için kullanılır.",
                  ),
                  company: copy(l, "Company", "Firma", "Şirket"),
                  street: copy(l, "Street", "Straße", "Sokak"),
                  postalCode: copy(l, "Postal code", "Postleitzahl", "Posta kodu"),
                  city: copy(l, "City", "Stadt", "Şehir"),
                  country: copy(l, "Country", "Land", "Ülke"),
                  save: copy(l, "Save address", "Adresse speichern", "Adresi kaydet"),
                  saving: copy(l, "Saving…", "Wird gespeichert…", "Kaydediliyor…"),
                }}
              />
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