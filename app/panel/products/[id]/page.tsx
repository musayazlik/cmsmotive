import Link from "@/app/panel/_components/panel-navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { creemConfigured, creemMode } from "@/lib/creem";
import { readCompliance } from "@/lib/product-compliance";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductForm from "../_components/product-form";
import PriceManager, { type PriceRow } from "../_components/price-manager";
import ReleaseManager from "../_components/release-manager";
import { loadProduct, productFormOptions } from "../_record";
import { panelStore } from "@/lib/panel-store";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "content", label: "Content" },
  { key: "pricing", label: "Pricing" },
  { key: "releases", label: "Releases" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

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
  const [{ tab }, record] = await Promise.all([searchParams, loadProduct(storeId, id)]);
  if (!record) notFound();

  const active: TabKey = TABS.some((entry) => entry.key === tab) ? (tab as TabKey) : "content";

  // The pricing tab needs this store's prices with a sold flag; releases are
  // global to the product, so the two are only loaded when their tab is open.
  const [prices, releases] = await Promise.all([
    active === "pricing"
      ? prisma.price.findMany({
          where: { productId: id, storeId },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: { _count: { select: { orders: true, subscriptions: true } } },
        })
      : Promise.resolve([]),
    active === "releases"
      ? prisma.productRelease.findMany({ where: { productId: id }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
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
    creemTestProductId: price.creemTestProductId,
    creemLiveProductId: price.creemLiveProductId,
    enabled: price.enabled,
    position: price.position,
    sold: price._count.orders + price._count.subscriptions > 0,
  }));

  const { types, stores } = await productFormOptions();

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / PRODUCTS / {record.name.toUpperCase()}
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            {record.name}
          </h1>
          <p>
            {record.ownedHere
              ? `This store owns the product: content, media, prices and releases are edited here. /products/${record.slug}`
              : `This store lists the product: its content is owned by another store, prices are set per store. /products/${record.slug}`}
          </p>
        </div>
        <span className="workspace-index">CATALOGUE</span>
      </div>

      <nav className="winbox-tabs" aria-label="Product sections">
        {TABS.map((entry) => (
          <Link
            key={entry.key}
            className={`winbox-tab ${active === entry.key ? "active" : ""}`}
            href={`/panel/products/${record.id}?tab=${entry.key}`}
            aria-current={active === entry.key ? "page" : undefined}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      {active === "content" ? <ProductForm record={record} types={types} stores={stores} storeId={storeId} /> : null}
      {active === "pricing" ? <PriceManager productId={record.id} prices={priceRows} mode={creemMode()} configured={creemConfigured()} /> : null}
      {active === "releases" ? (
        <ReleaseManager
          productId={record.id}
          releases={releases.map((release) => ({
            id: release.id,
            version: release.version,
            fileName: release.fileName,
            codeLicense: release.codeLicense,
            createdAt: release.createdAt.toISOString(),
          }))}
          licenseReady={readCompliance(record.compliance).codeLicense !== ""}
        />
      ) : null}
    </>
  );
}
