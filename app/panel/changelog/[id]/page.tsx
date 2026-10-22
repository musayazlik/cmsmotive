import { requirePanelUser } from "@/lib/panel-auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readChanges } from "@/lib/changelog";
import ChangelogForm from "../_components/changelog-form";
import { productOptions } from "../_products";
import type { ChangelogRecord } from "../_lib";

export const dynamic = "force-dynamic";

export default async function EditChangelogEntryPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser();
  const { id } = await params;
  const [entry, products] = await Promise.all([prisma.changelogEntry.findUnique({ where: { id } }), productOptions()]);
  if (!entry) notFound();

  const record: ChangelogRecord = {
    id: entry.id,
    product: entry.themeId ? `theme:${entry.themeId}` : entry.extensionId ? `extension:${entry.extensionId}` : "",
    version: entry.version,
    title: entry.title,
    // Release dates are stored as UTC midnight of the chosen day.
    releasedAt: entry.releasedAt.toISOString().slice(0, 10),
    changes: readChanges(entry.changes),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };

  return (
    <>
      <div className="workspace-eyebrow">
        <span className="workspace-dot" /> CATALOGUE / CHANGELOG / EDIT
      </div>
      <div className="workspace-intro">
        <div>
          <h1>
            Edit <em>{entry.version}.</em>
          </h1>
          <p>Changes show in the product&apos;s Changelog tab as soon as you save.</p>
        </div>
        <span className="workspace-index">CHANGELOG</span>
      </div>

      <ChangelogForm products={products} record={record} />
    </>
  );
}
