import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Render } from "@puckeditor/core";
import { prototypeEnabled, readRenderablePrototypeDocument } from "@/lib/page-builder/prototype-store";
import { serverConfig } from "@/lib/page-builder/config.server";
import { compileDocumentCss } from "@/lib/page-builder/style/css";

/**
 * Public Phase 0 preview of the prototype document; 404s in production like
 * the editor. Only server code may be imported here: `Render`, config.server
 * and the pure CSS compiler all come from the react-server side of
 * @puckeditor/core, so the client bundle for this route stays free of the
 * editor runtime (plan 5.16). The document is validated and cleaned on every
 * read, because `<Render>` prints rich text as stored (plan 5.13).
 */

export const metadata: Metadata = {
  title: "Page builder (prototype)",
  robots: { index: false, follow: false },
};

export default async function PrototypeRenderPage() {
  if (!prototypeEnabled()) notFound();
  const document = await readRenderablePrototypeDocument();

  return (
    <main className="pb-render">
      {/* Static layers first: fonts, site tokens, block shapes. */}
      <link rel="stylesheet" href="/assets/css/fonts.css" precedence="default" />
      <link rel="stylesheet" href="/assets/css/site.css" precedence="default" />
      <link rel="stylesheet" href="/assets/css/pb-blocks.css" precedence="default" />
      {/* Scoped element styles keep the top layer of the cascade. */}
      <style dangerouslySetInnerHTML={{ __html: compileDocumentCss(document) }} />
      <Render config={serverConfig} data={document} />
    </main>
  );
}
