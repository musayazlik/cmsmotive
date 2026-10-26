import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/customer-auth";
import { loadLicenseInstances } from "@/lib/customer-billing";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import { getRequestLocale } from "@/lib/i18n/request";
import { copy } from "@/lib/legal-copy";
import { AccountEmpty, AccountHeading, AccountIcon } from "../../account-ui";
import InstanceList from "./instance-list";

/** The sites or installations a Creem licence key is activated on, with a way to release them. */
export default async function LicensePage({ params }: { params: Promise<{ id: string }> }) {
  const [user, l, { id }] = await Promise.all([requireCustomer(), getRequestLocale(), params]);
  const loaded = await loadLicenseInstances(user.id, id);
  if (!loaded) notFound();
  const { license, instances, failed } = loaded;
  const date = new Intl.DateTimeFormat(LOCALE_TAGS[l], { dateStyle: "medium" });
  const active = instances.filter((instance) => instance.status === "active").length;

  return (
    <>
      <AccountHeading
        title={copy(l, "Licence installations", "Lizenz-Installationen", "Lisans kurulumları")}
        description={copy(
          l,
          `Where your ${license.entitlement.product.name} licence key is in use. Release an installation to move the licence to another site.`,
          `Wo Ihr Lizenzschlüssel für ${license.entitlement.product.name} verwendet wird. Geben Sie eine Installation frei, um die Lizenz auf eine andere Website zu übertragen.`,
          `${license.entitlement.product.name} lisans anahtarınızın kullanıldığı yerler. Lisansı başka bir siteye taşımak için bir kurulumu serbest bırakın.`,
        )}
        action={
          <a className="wbtn wbtn-ghost" href={`/account/products?lang=${l}`}>
            {copy(l, "Back to my products", "Zurück zu meinen Produkten", "Ürünlerime dön")}
          </a>
        }
      />
      <div className="customer-columns">
        <section className="customer-card" aria-labelledby="instances-title">
          <header className="customer-card-head">
            <h2 id="instances-title">{copy(l, "Installations", "Installationen", "Kurulumlar")}</h2>
            <span className="customer-count">
              {active}
              {license.activationLimit !== null ? ` / ${license.activationLimit}` : ""}
            </span>
          </header>
          {failed ? (
            <AccountEmpty
              icon="key"
              title={copy(l, "Installations could not be loaded", "Installationen konnten nicht geladen werden", "Kurulumlar yüklenemedi")}
              description={copy(l, "The licence service did not respond. Try again in a moment.", "Der Lizenzdienst hat nicht geantwortet. Versuchen Sie es gleich erneut.", "Lisans servisi yanıt vermedi. Birazdan tekrar deneyin.")}
            />
          ) : instances.length ? (
            <InstanceList
              licenseKeyId={license.id}
              locale={l}
              instances={instances.map((instance) => ({
                id: instance.id,
                name: instance.name || copy(l, "Unnamed installation", "Unbenannte Installation", "Adsız kurulum"),
                status: instance.status,
                activatedAt: date.format(new Date(instance.created_at)),
              }))}
            />
          ) : (
            <AccountEmpty
              icon="key"
              title={copy(l, "Not activated yet", "Noch nicht aktiviert", "Henüz etkinleştirilmedi")}
              description={copy(l, "Installations appear here once the key is activated on a site.", "Installationen erscheinen hier, sobald der Schlüssel auf einer Website aktiviert wurde.", "Anahtar bir sitede etkinleştirildiğinde kurulumlar burada görünür.")}
            />
          )}
        </section>
        <aside className="customer-card customer-aside">
          <AccountIcon name="key" />
          <h2>{copy(l, "Licence key", "Lizenzschlüssel", "Lisans anahtarı")}</h2>
          <p>
            <code className="customer-license-key">{license.key}</code>
          </p>
          <p>
            {copy(l, "Status", "Status", "Durum")}: {license.status}
            {license.expiresAt ? ` · ${copy(l, "valid until", "gültig bis", "geçerlilik")} ${date.format(license.expiresAt)}` : ""}
          </p>
        </aside>
      </div>
    </>
  );
}
