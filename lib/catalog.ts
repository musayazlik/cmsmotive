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
 *   its slug as id (anchor links), `limit=N` keeps the first N, `min=N`
 *   tops the grid up with "Coming soon" placeholder cards until it holds N,
 *   so a short (or empty) list still shows a full grid.
 * - The home journal strip works the same way with
 *   `<!-- catalog:journal limit=3 -->`: it is replaced by the latest
 *   published posts from /panel/blog. As long as no posts exist (or the
 *   database cannot be reached) build.py's static article cards stay, since
 *   those are real pages worth linking.
 *
 * The card markup mirrors build.py's product_card(), extension_card(),
 * theme_placeholder() and extension_placeholder(), with root-relative URLs,
 * and is injected before translation, so card copy that matches the English
 * catalog is localized.
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

export type PublicPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  /** Publication year; the card footer shows `category &nbsp; / &nbsp; year`. */
  year: number;
  /** Cover from the media library; journal cards show it when set. */
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

/** Upper bound for journal strips; the marker usually asks for limit=3. */
const JOURNAL_TAKE = 12;

/** Published posts in the journal list order (featured first, then by date) — same as app/[locale]/blog. */
export async function listPosts(): Promise<PublicPost[]> {
  const posts = await prisma.post.findMany({
    where: { status: "published" },
    orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
    take: JOURNAL_TAKE,
    select: { slug: true, title: true, excerpt: true, publishedAt: true, category: { select: { name: true } }, cover: coverSelect },
  });
  return posts.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category?.name ?? null,
    year: (post.publishedAt ?? new Date()).getFullYear(),
    cover: post.cover,
  }));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Text-node escaping that keeps `&` raw, exactly as build.py writes its copy, so the
 * i18n keys (which store raw ampersands) keep matching the injected card text. */
function escapeText(value: string) {
  return value.replace(/[<>]/g, (ch) => ({ "<": "&lt;", ">": "&gt;" })[ch]!);
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
      <div class="product-body"><span class="product-kicker">${escapeText(theme.industry)}</span><h3><a href="${href}">${escapeText(theme.name)}</a></h3><p>${escapeText(theme.summary)}</p><div class="badge-row">${themeBadges(theme).map(badge).join("")}</div><div class="product-bottom"><span class="product-price"><small>${priceLabel}</small>${displayPrice}</span><a class="text-link" href="${href}">Explore theme${ARROW}</a></div></div>
    </article>`;
}

function extensionBadge(status: string): [string, string] {
  if (status === "published") return ["Available", "green"];
  if (status === "in-development") return ["In development", ""];
  if (status === "planning") return ["Planning", "indigo"];
  return ["Roadmap concept", "indigo"];
}

function extensionCard(extension: PublicExtension, withId: boolean) {
  return `<article class="article-card"${withId ? ` id="${escapeHtml(extension.slug)}"` : ""}>${coverImage(extension.cover, "article-card-cover")}${badge(extensionBadge(extension.status))}<h3><a href="${extension.href}">${escapeText(extension.name)}</a></h3><p>${escapeText(extension.summary)}</p><a class="text-link" href="${extension.href}">Explore extension${ARROW}</a></article>`;
}

/** Journal card: mirrors build.py's article_card(), with the post cover as a
 * compact banner (.journal-card-cover, see site.css). Post copy stays authored English. */
function journalCard(post: PublicPost) {
  return `<article class="article-card" data-reveal>${coverImage(post.cover, "journal-card-cover")}<span class="micro">${escapeText(post.category ?? "Journal")} &nbsp; / &nbsp; ${post.year}</span><h3><a href="/blog/${escapeHtml(post.slug)}">${escapeText(post.title)}</a></h3><p>${escapeText(post.excerpt)}</p><a class="text-link" href="/blog/${escapeHtml(post.slug)}">Read article${ARROW}</a></article>`;
}

// Placeholder cards: a wireframe page sketch and shimmering skeleton lines
// where the copy will go (site.css, "Coming soon" cards). `data-placeholder`
// lets the /themes filter hide them while a filter is active.
const SOON_DOT = '<span class="soon-dot" aria-hidden="true"></span>';
const SOON_SKETCH = '<span class="soon-sketch" aria-hidden="true"><span class="soon-sketch-bar"><i></i><i></i><i></i></span><span class="soon-sketch-body"><span class="skel soon-sketch-hero"></span><span class="soon-sketch-row"><span class="skel"></span><span class="skel"></span><span class="skel"></span></span></span></span>';
const SOON_PROGRESS = '<span class="soon-progress" aria-hidden="true"><i></i></span>';

function themePlaceholder() {
  return `<article class="product-card product-card-soon" data-placeholder data-reveal>
      <div class="product-visual soon-visual"><span class="visual-label soon-label">${SOON_DOT}Coming soon</span>${SOON_SKETCH}</div>
      <div class="product-body"><span class="product-kicker">New theme</span><span class="skel skel-title" aria-hidden="true"></span><span class="skel-lines" aria-hidden="true"><span class="skel"></span><span class="skel"></span></span><div class="badge-row" aria-hidden="true"><span class="skel skel-chip"></span><span class="skel skel-chip"></span></div><div class="product-bottom"><span class="soon-status"><small>Status</small>In progress</span>${SOON_PROGRESS}</div></div>
    </article>`;
}

/** `withCover` adds a cover-sized sketch so the placeholder lines up with extension cards that have covers. */
function extensionPlaceholder(withCover: boolean) {
  const cover = withCover ? `<span class="article-card-cover soon-visual" aria-hidden="true">${SOON_SKETCH}</span>` : "";
  return `<article class="article-card article-card-soon" data-placeholder>${cover}<span class="badge soon-badge">${SOON_DOT}Coming soon</span><span class="soon-kicker">New extension</span><span class="skel skel-title" aria-hidden="true"></span><span class="skel-lines" aria-hidden="true"><span class="skel"></span><span class="skel"></span><span class="skel"></span></span><div class="soon-foot"><span class="soon-status"><small>Status</small>In progress</span>${SOON_PROGRESS}</div></article>`;
}

const MARKER = /<!--\s*catalog:(themes|extensions|journal)((?:\s+[\w=]+)*)\s*-->[\s\S]*?<!--\s*\/catalog:\1\s*-->/g;

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
  let posts: PublicPost[];
  try {
    [themes, extensions, posts] = await Promise.all([
      kinds.has("themes") ? listThemes() : Promise.resolve([]),
      kinds.has("extensions") ? listExtensions() : Promise.resolve([]),
      kinds.has("journal") ? listPosts() : Promise.resolve([]),
    ]);
  } catch (error) {
    console.error("catalogue unavailable, serving the static cards", error);
    return html;
  }

  return html.replace(MARKER, (match, kind: string, options: string) => {
    const withId = /\bids\b/.test(options);
    const limit = Number(/\blimit=(\d+)/.exec(options)?.[1] ?? (kind === "journal" ? 3 : Infinity));
    const min = Number(/\bmin=(\d+)/.exec(options)?.[1] ?? 0);
    if (kind === "themes") {
      const shown = themes.slice(0, limit);
      return shown.map((theme) => themeCard(theme, withId)).join("") + themePlaceholder().repeat(Math.max(0, min - shown.length));
    }
    if (kind === "extensions") {
      const shown = extensions.slice(0, limit);
      const withCover = shown.length === 0 || shown.some((extension) => extension.cover);
      return shown.map((extension) => extensionCard(extension, withId)).join("") + extensionPlaceholder(withCover).repeat(Math.max(0, min - shown.length));
    }
    // Journal: with no published posts the marked region keeps build.py's
    // static article cards, because those are real pages worth linking.
    return posts.slice(0, limit).map(journalCard).join("") || match;
  });
}
