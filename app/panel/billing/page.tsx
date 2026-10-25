import { prisma } from "@/lib/prisma";
import { creemConfigured, creemMode } from "@/lib/creem";
import BillingManager from "./billing-manager";
import { panelStore } from "@/lib/panel-store";
export default async function BillingPage() {
  const storeId = (await panelStore()).id;
  const [themes, extensions, plans, releases] = await Promise.all([
    prisma.theme.findMany({
      where: { storeId },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.extension.findMany({
      where: { storeId },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.billingPlan.findMany({ where: { storeId }, orderBy: { createdAt: "asc" } }),
    prisma.productRelease.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        productSlug: true,
        version: true,
        fileName: true,
      },
    }),
  ]);
  return (
    <>
      <div className="workspace-title-row">
        <div>
          <p className="workspace-eyebrow">COMMERCE</p>
          <h1>Subscriptions & packages</h1>
          <p>Annual billing, private releases and customer downloads.</p>
        </div>
      </div>
      <BillingManager
        configured={creemConfigured()}
        mode={creemMode()}
        products={[
          ...themes.map((p) => ({ ...p, kind: "theme" as const })),
          ...extensions.map((p) => ({ ...p, kind: "extension" as const })),
        ]}
        plans={plans.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }))}
        releases={releases}
      />
    </>
  );
}
