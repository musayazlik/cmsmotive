import { notFound } from "next/navigation";
import { isLocale, localizePath } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
import "../../../public/assets/css/site.css";
import "../../../public/assets/css/fonts.css";
export default async function NewsletterPage({
  params,
  searchParams,
}: {
  params: Promise<{ action: string }>;
  searchParams: Promise<{ token?: string; lang?: string; done?: string }>;
}) {
  const [{ action }, query] = await Promise.all([params, searchParams]);
  if (!["confirm", "unsubscribe"].includes(action)) notFound();
  const l = isLocale(query.lang) ? query.lang : "de";
  const unsubscribe = action === "unsubscribe";
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        <span className="eyebrow">CMSMotive</span>
        <h1>
          {copy(
            l,
            unsubscribe ? "Unsubscribe" : "Confirm your subscription",
            unsubscribe ? "Abmelden" : "Anmeldung bestätigen",
            unsubscribe ? "Abonelikten ayrıl" : "Aboneliğinizi doğrulayın",
          )}
        </h1>
        {query.done ? (
          <p role="status">
            {query.done === "ok"
              ? copy(
                  l,
                  unsubscribe
                    ? "You have been unsubscribed from this list."
                    : "Your subscription is confirmed.",
                  unsubscribe
                    ? "Sie wurden von dieser Liste abgemeldet."
                    : "Ihre Anmeldung wurde bestätigt.",
                  unsubscribe
                    ? "Bu listeden ayrıldınız."
                    : "Aboneliğiniz doğrulandı.",
                )
              : copy(
                  l,
                  "This link is invalid or expired.",
                  "Dieser Link ist ungültig oder abgelaufen.",
                  "Bağlantı geçersiz veya süresi dolmuş.",
                )}
          </p>
        ) : query.token ? (
          <form action={`/api/newsletter/${action}`} method="post">
            <input type="hidden" name="token" value={query.token} />
            <input type="hidden" name="lang" value={l} />
            <p>
              {copy(
                l,
                "Confirm your choice below. Opening this page does not change your subscription.",
                "Bestätigen Sie unten Ihre Auswahl. Das Öffnen dieser Seite ändert Ihr Abo nicht.",
                "Seçiminizi aşağıdan onaylayın. Bu sayfayı açmak aboneliğinizi değiştirmez.",
              )}
            </p>
            <button className="btn btn-primary">
              {copy(
                l,
                unsubscribe ? "Unsubscribe" : "Confirm",
                unsubscribe ? "Abmelden" : "Bestätigen",
                unsubscribe ? "Abonelikten ayrıl" : "Doğrula",
              )}
            </button>
          </form>
        ) : (
          <p>
            {copy(
              l,
              "Open the link from your email.",
              "Öffnen Sie den Link aus Ihrer E-Mail.",
              "E-postanızdaki bağlantıyı açın.",
            )}
          </p>
        )}
        <p>
          <a href={localizePath("/privacy", l)}>
            {copy(l, "Privacy", "Datenschutz", "Gizlilik")}
          </a>{" "}
          ·{" "}
          <a href={localizePath("/imprint", l)}>
            {copy(l, "Imprint", "Impressum", "Yasal bilgiler")}
          </a>
        </p>
      </div>
    </main>
  );
}
