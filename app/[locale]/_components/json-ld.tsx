import { serializeJsonLd } from "@/lib/seo";

/** Structured data for search engines (lib/seo.ts), as a plain script tag like the Next.js JSON-LD guide recommends. */
export function JsonLd({ data }: { data: Parameters<typeof serializeJsonLd>[0] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
