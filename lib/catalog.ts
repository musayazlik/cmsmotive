import { existsSync } from "node:fs";
import path from "node:path";
import { prisma } from "./prisma";

/**
 * Public theme catalogue. The home page and /themes mark their product grid
 * with `<!-- catalog:themes -->…<!-- /catalog:themes -->` (static-site/build.py);
 * the legacy route swaps that region for cards built from the Theme table, so
 * whatever is edited under /panel/themes is what visitors see. The markup
 * mirrors build.py's product_card(), with root-relative URLs, and runs before
 * translation, so card copy that matches the English catalog is localized.
 */

const MARKER = /<!--\s*catalog:themes(\s+ids)?\s*-->[\s\S]*?<!--\s*\/catalog:themes\s*-->/g;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

type CatalogTheme = {
  slug: string;
  name: string;
  summary: string;
  status: string;
  industry: string;
  versionTarget: string;
  price: number | null;
  cover: { url: string; alt: string | null; width: number | null; height: number | null } | null;
};

/** Card label in the image corner, matching the launch wording. */
function visualLabel(theme: CatalogTheme) {
  if (theme.status === "published") return "Available now";
  if (theme.price === 0) return "Free starter concept";
  if (theme.price === null) return "Roadmap concept";
  return "Featured concept";
}

function badges(theme: CatalogTheme): [string, string][] {
  const list: [string, string][] = [];
  if (theme.versionTarget && theme.versionTarget !== "Not decided") list.push([theme.versionTarget, "orange"]);
  if (theme.status === "published") list.push(["Available", "green"]);
  else if (theme.status === "in-development") list.push(["In development", ""]);
  else if (theme.price === 0) list.push(["Planned free", "green"]);
  else list.push(["Composer", "indigo"]);
  return list;
}

/** Themes with a static detail page link there; others go to the contact page until they get one. */
function detailHref(slug: string) {
  return existsSync(path.join(process.cwd(), "static-site", `theme-${slug}.html`)) ? `/theme-${slug}` : "/contact";
}

function card(theme: CatalogTheme, withId: boolean) {
  const href = detailHref(theme.slug);
  const price = theme.price;
  const displayPrice = price ? `€${price}` : price === 0 ? "Free" : "TBD";
  const priceLabel = price ? "Preview price" : price === 0 ? "Planned price" : "Roadmap price";
  // "TYPO3 13 / 14" -> "13 14" for the /themes version filter.
  const version = (theme.versionTarget.match(/\b\d{2,}\b/g) ?? []).join(" ");
  const chips = badges(theme)
    .map(([text, cls]) => `<span class="badge${cls ? ` ${cls}` : ""}">${escapeHtml(text)}</span>`)
    .join("");
  const image = theme.cover
    ? `<img src="${escapeHtml(theme.cover.url)}" width="${theme.cover.width ?? 1536}" height="${theme.cover.height ?? 1024}" loading="lazy" alt="${escapeHtml(theme.cover.alt ?? "")}">`
    : "";
  return `<article class="product-card"${withId ? ` id="${escapeHtml(theme.slug)}"` : ""} data-product data-name="${escapeHtml(theme.name.toLowerCase())}" data-industry="${escapeHtml(theme.industry.toLowerCase())}" data-price="${price ?? -1}" data-version="${version}" data-reveal>
      <a class="product-visual" href="${href}" aria-label="Explore ${escapeHtml(theme.name)}">${image}<span class="visual-label">${visualLabel(theme)}</span></a>
      <div class="product-body"><span class="product-kicker">${escapeHtml(theme.industry)}</span><h3>${escapeHtml(theme.name)}</h3><p>${escapeHtml(theme.summary)}</p><div class="badge-row">${chips}</div><div class="product-bottom"><span class="product-price"><small>${priceLabel}</small>${displayPrice}</span><a class="text-link" href="${href}">Explore theme<img src="/assets/icons/arrow-right.svg" alt="" width="16" height="16"></a></div></div>
    </article>`;
}

/**
 * Replaces the marked product grids in `html` with the current catalogue.
 * Pages without a marker are returned untouched; if the database cannot be
 * reached the static cards from build.py stay in place.
 */
export async function injectThemeCatalog(html: string): Promise<string> {
  if (!html.includes("catalog:themes")) return html;
  let themes: CatalogTheme[];
  try {
    themes = await prisma.theme.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        slug: true,
        name: true,
        summary: true,
        status: true,
        industry: true,
        versionTarget: true,
        price: true,
        cover: { select: { url: true, alt: true, width: true, height: true } },
      },
    });
  } catch (error) {
    console.error("theme catalogue unavailable, serving the static cards", error);
    return html;
  }
  return html.replace(MARKER, (_match, ids: string | undefined) => themes.map((theme) => card(theme, Boolean(ids))).join(""));
}
