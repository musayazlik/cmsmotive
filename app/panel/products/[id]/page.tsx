import Link from "@/app/panel/_components/panel-navigation";
import { notFound } from "next/navigation";
import { creemConfigured, creemMode } from "@/lib/creem";
import { requirePanelUser } from "@/lib/panel-auth";
import { panelStore } from "@/lib/panel-store";
import { prisma } from "@/lib/prisma";
import { productReadiness, type ReadinessTab } from "@/lib/product-readiness";
import { packageStorageStatus } from "@/lib/package-storage-config";
import { getUploadSettings } from "@/lib/settings";
import DeliverySettings from "../_components/delivery-settings";
import PackageChecklist from "../_components/package-checklist";
import PriceManager, { type PriceRow } from "../_components/price-manager";
import ProductForm from "../_components/product-form";
import PublishPanel from "../_components/publish-panel";
import ReleaseManager from "../_components/release-manager";
import { loadProduct, otherStores, productTypeOptions } from "../_record";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "general", label: "General" },
  { key: "prices", label: "Prices" },
  { key: "packages", label: "Packages" },
  { key: "publish", label: "Publish" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const STATUS_LABELS: Record<string, string> = { draft: "Draft", preview: "Preview", published: "Published" };

/** The product editor: one tab per step, each marked done or open by the ready-to-sell check. */
export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePanelUser();
  const storeId = (await panelStore()).id;
  const { id } = await params;
  const [{ tab }, record, readiness] = await Promise.all([searchParams, loadProduct(storeId, id), productReadiness(id)]);
  if (!record || !readiness) notFound();

  const active: TabKey = TABS.some((entry) => entry.key === tab) ? (tab as TabKey) : "general";
  const openTabs = new Set<ReadinessTab>(readiness.items.filter((item) => !item.ok).map((item) => item.tab));
  const packageUploaded = readiness.items.find((item) => item.key === "package")?.ok ?? false;
  const packageChecklist = readiness.items.find((item) => item.key === "checklist");
  // The package step records successful delivery-file upload. Publication still
  // requires the entire checklist, including licensing and notices.
  const tabOpen = (key: TabKey) => key === "packages" ? !packageUploaded : key === "publish" ? !readiness.ready : openTabs.has(key as ReadinessTab);

  const mode = creemMode();
  const field = mode === "prod" ? "creemLiveProductId" : "creemTestProductId";
  const [prices, releases, types, stores] = await Promise.all([
    active === "prices"
      ? prisma.price.findMany({
          where: { productId: id },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: { _count: { select: { orders: true, subscriptions: true } } },
        })
      : Promise.resolve([]),
    active === "packages" ? prisma.productRelease.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
    active === "general" ? productTypeOptions() : Promise.resolve([]),
    active === "publish" ? otherStores(storeId) : Promise.resolve([]),
  ]);

  const priceRows: PriceRow[] = prices.map((price) => ({
    id: price.id,
    name: price.name,
    billingType: price.billingType,
    interval: price.interval,
    amountCents: price.amountCents,
    currency: price.currency,
    taxMode: price.taxMode,
    updatesMonths: price.updatesMonths,
    seats: price.seats,
    features: price.features,
    creemProductId: price[field],
    enabled: price.enabled,
    position: price.position,
    sold: price._count.orders + price._count.subscriptions > 0,
  }));

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / <Link href="/panel/products">PRODUCTS</Link> / {record.name.toUpperCase()}
      </div>
      <div className="workspace-intro">
        <div>
          <h1>{record.name}</h1>
          <p>
            <span className={`wbadge ${record.status === "published" ? "wbadge-verified" : record.status === "preview" ? "wbadge-user" : "wbadge-missing"}`}>
              {STATUS_LABELS[record.status] ?? record.status}
            </span>{" "}
            /products/{record.slug}
          </p>
        </div>
        <span className="workspace-index">CATALOGUE</span>
      </div>

      <div className="weditor-tabs">
        <nav className="weditor-tabs-nav" aria-label="Product sections">
          {TABS.map((entry) => (
            <Link
              key={entry.key}
              className={`weditor-tab ${active === entry.key ? "active" : ""}`}
              href={`/panel/products/${record.id}?tab=${entry.key}`}
              aria-current={active === entry.key ? "page" : undefined}
              title={entry.key === "packages" ? packageUploaded ? "Package uploaded. Publication also requires the release checklist." : "Upload a ZIP package." : undefined}
            >
              {entry.label}
              <span className={`weditor-tab-mark ${tabOpen(entry.key) ? "is-open" : "is-done"}`} aria-label={tabOpen(entry.key) ? "needs work" : "done"}>
                {tabOpen(entry.key) ? "•" : "✓"}
              </span>
            </Link>
          ))}
        </nav>
        {record.status !== "draft" ? (
          <div className="weditor-tabs-actions">
            <a className="wbtn wbtn-ghost" href={`/products/${record.slug}`} target="_blank" rel="noreferrer">
              View on site ↗
            </a>
          </div>
        ) : null}
      </div>

      {active === "general" ? <ProductForm record={record} types={types} /> : null}
      {active === "prices" ? <PriceManager productId={record.id} prices={priceRows} mode={mode} configured={creemConfigured()} /> : null}
      {active === "packages" ? (
        <div className="wform-stack">
          {packageUploaded && packageChecklist && !packageChecklist.ok ? (
            <div className="wpkg-readiness-note" role="note">
              <div>
                <strong>Package uploaded. One more step before publishing.</strong>
                <p>{packageChecklist.hint}</p>
              </div>
              <a className="wbtn wbtn-ghost wbtn-sm" href="#package-checklist">Complete checklist</a>
            </div>
          ) : null}
          <ReleaseManager
            productId={record.id}
            releases={releases.map((release) => ({
              id: release.id,
              version: release.version,
              fileName: release.fileName,
              codeLicense: release.codeLicense,
              createdAt: release.createdAt.toISOString(),
            }))}
            licenseReady={record.compliance.codeLicense !== ""}
            storage={packageStorageStatus((await getUploadSettings(storeId)).packageProvider)}
          />
          <DeliverySettings productId={record.id} issueLicenseKeys={record.issueLicenseKeys} deliveryNote={record.deliveryNote} />
          <PackageChecklist productId={record.id} value={record.compliance} />
        </div>
      ) : null}
      {active === "publish" ? (
        <PublishPanel
          productId={record.id}
          name={record.name}
          status={record.status}
          items={readiness.items}
          ready={readiness.ready}
          testMode={readiness.mode === "test"}
          stores={stores}
        />
      ) : null}
    </>
  );
}
