import { currentStoreId } from "@/lib/current-store";
import { getSeoSettings } from "@/lib/settings";
import type { CustomMeta } from "@/lib/seo-settings-shared";

/**
 * The custom meta tags from Settings → SEO as head tags on the React public
 * pages: React 19 hoists the rendered <meta> elements into the document head,
 * so they can be added from anywhere in the tree. Name/property and repeated
 * names (e.g. several marketing tags) are rendered exactly as saved.
 */
export default async function CustomMetaTags() {
  const { customMetas } = await getSeoSettings(await currentStoreId());
  return customMetas.map((meta) => <MetaTag key={`${meta.attr}-${meta.name}-${meta.content}`} meta={meta} />);
}

function MetaTag({ meta }: { meta: CustomMeta }) {
  const name = { name: meta.name, content: meta.content };
  const property = { property: meta.name, content: meta.content };
  return <meta {...(meta.attr === "property" ? property : name)} />;
}
