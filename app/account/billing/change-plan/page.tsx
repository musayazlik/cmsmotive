import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer-auth";
import { loadUpgradeOptions } from "@/lib/customer-billing";
import { LOCALE_TAGS, type Locale } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { formatAmount } from "@/lib/prices";
import { AccountHeading, AccountIcon } from "../../account-ui";
import PlanForm from "./plan-form";

const per = (interval: string | null, l: Locale) =>
  ({
    month: copy(l, "/ month", "/ Monat", "/ ay"),
    quarter: copy(l, "/ 3 months", "/ 3 Monate", "/ 3 ay"),
    "half-year": copy(l, "/ 6 months", "/ 6 Monate", "/ 6 ay"),
    year: copy(l, "/ year", "/ Jahr", "/ yıl"),
  })[interval ?? ""] ?? "";

const seats = (count: number, l: Locale) =>
  count === 1 ? copy(l, "1 installation", "1 Installation", "1 kurulum") : copy(l, `${count} installations`, `${count} Installationen`, `${count} kurulum`);

/** Moving a running subscription to a bigger plan of the same product. */
export default async function ChangePlanPage({ searchParams }: { searchParams: Promise<{ subscription?: string }> }) {
  const [user, l, query] = await Promise.all([requireCustomer(), getRequestLocale(), searchParams]);
  const loaded = await loadUpgradeOptions(user.id, query.subscription ?? "");
  if (!loaded) notFound();
  const { subscription, options } = loaded;
  const money = (cents: number, currency: string) => formatAmount(cents, currency, LOCALE_TAGS[l]);

  return (
    <>
      <AccountHeading
        title={copy(l, "Change plan", "Tarif wechseln", "Planı değiştir")}
        description={copy(
          l,
          `Move ${subscription.product.name} to a bigger plan. You keep your licence keys, downloads and renewal date.`,
          `Wechseln Sie ${subscription.product.name} in einen größeren Tarif. Lizenzschlüssel, Downloads und Verlängerungsdatum bleiben erhalten.`,
          `${subscription.product.name} ürününü daha büyük bir plana taşıyın. Lisans anahtarlarınız, indirmeleriniz ve yenileme tarihiniz korunur.`,
        )}
        action={
          <a className="wbtn wbtn-ghost" href={`/account/billing?lang=${l}`}>
            {copy(l, "Back to billing", "Zurück zur Abrechnung", "Faturalara dön")}
          </a>
        }
      />
      <div className="customer-columns">
        <section className="customer-card" aria-labelledby="plans-title">
          <header className="customer-card-head">
            <h2 id="plans-title">{copy(l, "Available plans", "Verfügbare Tarife", "Uygun planlar")}</h2>
          </header>
          <div className="customer-card-body">
            {options.length ? (
              <PlanForm
                subscriptionId={subscription.id}
                locale={l}
                options={options.map((option) => ({
                  id: option.id,
                  name: option.name,
                  price: `${money(option.amountCents, option.currency)} ${per(option.interval, l)}`,
                  seats: seats(option.seats, l),
                  features: option.features,
                }))}
              />
            ) : (
              <p className="customer-card-lead">
                {["active", "trialing"].includes(subscription.status)
                  ? copy(
                      l,
                      "You are already on the biggest plan. To move to a smaller one, contact support; the change applies at your next renewal.",
                      "Sie nutzen bereits den größten Tarif. Für einen kleineren Tarif wenden Sie sich an den Support; die Änderung gilt ab der nächsten Verlängerung.",
                      "Zaten en büyük plandasınız. Daha küçük bir plana geçmek için destekle iletişime geçin; değişiklik bir sonraki yenilemede geçerli olur.",
                    )
                  : copy(
                      l,
                      "Only running subscriptions can change plan.",
                      "Nur laufende Abonnements können den Tarif wechseln.",
                      "Yalnızca devam eden abonelikler plan değiştirebilir.",
                    )}{" "}
                <a href={`/account/support?lang=${l}`}>{copy(l, "Contact support", "Support kontaktieren", "Destekle iletişime geç")}</a>
              </p>
            )}
          </div>
        </section>
        <aside className="customer-card customer-aside">
          <AccountIcon name="billing" />
          <h2>{copy(l, "Current plan", "Aktueller Tarif", "Mevcut plan")}</h2>
          <p>
            <strong>{subscription.price.name}</strong>
            <br />
            {money(subscription.price.amountCents, subscription.price.currency)} {per(subscription.price.interval, l)} · {seats(subscription.price.seats, l)}
          </p>
          <p>
            {copy(l, "Renews on", "Verlängert sich am", "Yenileme tarihi")}{" "}
            {new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "long" }).format(subscription.currentPeriodEnd)}
          </p>
        </aside>
      </div>
    </>
  );
}
