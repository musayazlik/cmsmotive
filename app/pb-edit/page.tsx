import { notFound } from "next/navigation";
import { requirePanelUser } from "@/lib/panel-auth";
import { prototypeEnabled, readPrototypeDocument } from "@/lib/page-builder/prototype-store";
import { PrototypeEditor } from "./prototype-editor";

/**
 * Phase 0 editor route (temporary; Phase 1 moves this under /panel/pages).
 * Guarded with the standard panel guard; the whole route 404s in production,
 * same as the prototype store itself.
 */

export const metadata = {
  title: "Page builder — prototype editor",
  robots: { index: false, follow: false },
};

export default async function PrototypeEditorPage() {
  if (!prototypeEnabled()) notFound();
  await requirePanelUser();

  const document = await readPrototypeDocument();
  return <PrototypeEditor initialData={document} />;
}
