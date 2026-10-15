import { prisma } from "./prisma";

/**
 * Public product catalogue: the themes and extensions edited under
 * /panel/themes and /panel/extensions, in their panel sort order.
 *
 * - /api/themes and /api/extensions serve these lists as JSON.
 * - The home page, /themes and /extensions mark their grids with
 *   `<!-- catalog:themes -->…<!-- /catalog:themes -->` and
 *   `<!-- catalog:extensions -->…<!-- /catalog:extensions -->`
 *   (static-site/build.py); the legacy route swaps those regions for cards
 *   built from the same lists. Options after the kind: `ids` gives each card
 *   its slug as id (anchor links), `limit=N` keeps the first N.
 * - An element with `data-catalog-section="<kind>"` is hidden while that
 *   list is empty, so a heading never sits above an empty grid.
 *
 * The card markup mirrors build.py's product_card() and extension_card(),
 * with root-relative URLs, and is injected before translation, so card copy
 * that matches the English catalog is localized.
 */

type Cover = { url: string; alt: string | null; width: number | null; height: number | null } | null;

export type PublicTheme = {
  slug: string;
  name: string;
  summary: string;
  status: string;
  industry: string;
  versionTarget: string;
  /** Whole euros: 0 = free, null = not set yet. */
  price: number | null;
  /** Root-relative page the card links to. */
  href: string;
  cover: Cover;
};

export type PublicExtension = {
  slug: string;
  name: string;
  summary: string;
  status: string;
  href: string;
  cover: Cover;
};

const coverSelect = { select: { url: true, alt: true, width: true, height: true } } as const;


export async function listThemes(): Promise<PublicTheme[]> {
  const themes = await prisma.theme.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { slug: true, name: true, summary: true, status: true, industry: true, versionTarget: true, price: true, cover: coverSelect },
  });
  return themes.map((theme) => ({ ...theme, href: `/theme/${theme.slug}` }));
}

export async function listExtensions(): Promise<PublicExtension[]> {
  const extensions = await prisma.extension.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { slug: true, name: true, summary: true, status: true, cover: coverSelect },
  });
  return extensions.map((extension) => ({ ...extension, href: `/extension/${extension.slug}` }));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

const ARROW = '<img src="/assets/icons/arrow-right.svg" alt="" width="16" height="16">';

function badge([text, tone]: [string, string]) {
  return `<span class="badge${tone ? ` ${tone}` : ""}">${escapeHtml(text)}</span>`;
}

function coverImage(cover: Cover, className?: string) {
  if (!cover) return "";
  const cls = className ? ` class="${className}"` : "";
  return `<img${cls} src="${escapeHtml(cover.url)}" width="${cover.width ?? 1536}" height="${cover.height ?? 1024}" loading="lazy" alt="${escapeHtml(cover.alt ?? "")}">`;
}

/** Card label in the image corner, matching the launch wording. */
function visualLabel(theme: PublicTheme) {
  if (theme.status === "published") return "Available now";
  if (theme.price === 0) return "Free starter concept";
  if (theme.price === null) return "Roadmap concept";
  return "Featured concept";
}

function themeBadges(theme: PublicTheme): [string, string][] {
  const list: [string, string][] = [];
  if (theme.versionTarget && theme.versionTarget !== "Not decided") list.push([theme.versionTarget, "orange"]);
  if (theme.status === "published") list.push(["Available", "green"]);
  else if (theme.status === "in-development") list.push(["In development", ""]);
  else if (theme.price === 0) list.push(["Planned free", "green"]);
  else list.push(["Composer", "indigo"]);
  return list;
}

function themeCard(theme: PublicTheme, withId: boolean) {
  const { href, price } = theme;
  const displayPrice = price ? `€${price}` : price === 0 ? "Free" : "TBD";
  const priceLabel = price ? "Preview price" : price === 0 ? "Planned price" : "Roadmap price";
  // "TYPO3 13 / 14" -> "13 14" for the /themes version filter.
  const version = (theme.versionTarget.match(/\b\d{2,}\b/g) ?? []).join(" ");
  return `<article class="product-card"${withId ? ` id="${escapeHtml(theme.slug)}"` : ""} data-product data-name="${escapeHtml(theme.name.toLowerCase())}" data-industry="${escapeHtml(theme.industry.toLowerCase())}" data-price="${price ?? -1}" data-version="${version}" data-reveal>
      <a class="product-visual" href="${href}" aria-label="Explore ${escapeHtml(theme.name)}">${coverImage(theme.cover)}<span class="visual-label">${visualLabel(theme)}</span></a>
      <div class="product-body"><span class="product-kicker">${escapeHtml(theme.industry)}</span><h3>${escapeHtml(theme.name)}</h3><p>${escapeHtml(theme.summary)}</p><div class="badge-row">${themeBadges(theme).map(badge).join("")}</div><div class="product-bottom"><span class="product-price"><small>${priceLabel}</small>${displayPrice}</span><a class="text-link" href="${href}">Explore theme${ARROW}</a></div></div>
    </article>`;
}

function extensionBadge(status: string): [string, string] {
  if (status === "published") return ["Available", "green"];
  if (status === "in-development") return ["In development", ""];
  if (status === "planning") return ["Planning", "indigo"];
  return ["Roadmap concept", "indigo"];
}

function extensionCard(extension: PublicExtension, withId: boolean) {
  return `<article class="article-card"${withId ? ` id="${escapeHtml(extension.slug)}"` : ""}>${coverImage(extension.cover, "article-card-cover")}${badge(extensionBadge(extension.status))}<h3>${escapeHtml(extension.name)}</h3><p>${escapeHtml(extension.summary)}</p><a class="text-link" href="${extension.href}">Explore extension${ARROW}</a></article>`;
}

const MARKER = /<!--\s*catalog:(themes|extensions)((?:\s+[\w=]+)*)\s*-->[\s\S]*?<!--\s*\/catalog:\1\s*-->/g;

/**
 * Replaces the marked product grids in `html` with the current catalogue.
 * Pages without a marker are returned untouched; if the database cannot be
 * reached the static cards from build.py stay in place.
 */
export async function injectCatalog(html: string): Promise<string> {
  const kinds = new Set(Array.from(html.matchAll(MARKER), (match) => match[1]));
  if (kinds.size === 0) return html;

  let themes: PublicTheme[];
  let extensions: PublicExtension[];
  try {
    [themes, extensions] = await Promise.all([
      kinds.has("themes") ? listThemes() : [],
      kinds.has("extensions") ? listExtensions() : [],
    ]);
  } catch (error) {
    console.error("catalogue unavailable, serving the static cards", error);
    return html;
  }

  let out = html.replace(MARKER, (_match, kind: string, options: string) => {
    const withId = /\bids\b/.test(options);
    const limit = Number(/\blimit=(\d+)/.exec(options)?.[1] ?? Infinity);
    return kind === "themes"
      ? themes.slice(0, limit).map((theme) => themeCard(theme, withId)).join("")
      : extensions.slice(0, limit).map((extension) => extensionCard(extension, withId)).join("");
  });
  for (const [kind, list] of [["themes", themes], ["extensions", extensions]] as const) {
    const attribute = `data-catalog-section="${kind}"`;
    if (kinds.has(kind) && list.length === 0) out = out.replaceAll(attribute, `${attribute} hidden`);
  }
  return out;
}
