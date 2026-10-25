import { formatAmount } from "./prices";
import { prisma } from "./prisma";

/**
 * Public product catalogue: the products listed in a store, in that store's
 * sort order (edited under /panel/products).
 *
 * - /api/products serves the list as JSON (?type=<key> filters it).
 * - Static pages mark product grids with `<!-- catalog:<layout> … -->` …
 *   `<!-- /catalog:<layout> -->` (static-site/build.py). The layout picks the
 *   card markup: `themes` = large product cards, `extensions` = compact article
 *   cards. Options: `type=<key>` limits the grid to one product type, `ids`
 *   gives each card its slug as id (anchor links), `limit=N` keeps the first
 *   N, `min=N` tops the grid up with "Coming soon" placeholder cards until it
 *   holds N, so a short (or empty) list still shows a full grid.
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

export type PublicProduct = {
  slug: string;
  name: string;
  summary: string;
  status: string;
  type: { key: string; name: string };
  /** Card kicker; falls back to the type name. */
  category: string | null;
  technologies: string[];
  /** Indicative whole-unit price before real prices exist: 0 = free, null = not set yet. */
  listPrice: number | null;
  /** Lowest price of the store, enabled or indicative. */
  fromPrice: { amountCents: number; currency: string; billingType: string; interval: string | null } | null;
  /** Root-relative page the card links to. */
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


/** The products listed in a store, optionally of one type, in the store's sort order. */
export async function listProducts(storeId: string, typeKey?: string): Promise<PublicProduct[]> {
  const listings = await prisma.productStore.findMany({
    where: { storeId, ...(typeKey ? { product: { type: { key: typeKey } } } : {}) },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      product: {
        select: {
          slug: true, name: true, summary: true, status: true, category: true, technologies: true, listPrice: true,
          type: { select: { key: true, name: true } },
          cover: coverSelect,
          prices: {
            where: { storeId },
            orderBy: { amountCents: "asc" },
            take: 1,
            select: { amountCents: true, currency: true, billingType: true, interval: true },
          },
        },
      },
    },
  });
  return listings.map(({ product: { prices, ...product } }) => ({
    ...product,
    fromPrice: prices[0] ?? null,
    href: `/products/${product.slug}`,
  }));
}

/** Upper bound for journal strips; the marker usually asks for limit=3. */
const JOURNAL_TAKE = 12;

/** Published posts in the journal list order (featured first, then by date) — same as app/[locale]/blog. */
export async function listPosts(storeId: string): Promise<PublicPost[]> {
  const posts = await prisma.post.findMany({
    where: { storeId, status: "published" },
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
function visualLabel(product: PublicProduct) {
  if (product.status === "published") return "Available now";
  if (!product.fromPrice && product.listPrice === 0) return "Free starter concept";
  if (!product.fromPrice && product.listPrice === null) return "Roadmap concept";
  return "Featured concept";
}

function statusBadge(product: PublicProduct): [string, string] {
  if (product.status === "published") return ["Available", "green"];
  if (product.status === "in-development") return ["In development", ""];
  if (product.status === "planning") return ["Planning", "indigo"];
  if (!product.fromPrice && product.listPrice === 0) return ["Planned free", "green"];
  return ["Roadmap concept", "indigo"];
}

/** Lowest price as card text: a real price in its currency, else the indicative list price. */
function cardPrice(product: PublicProduct): { label: string; text: string; value: number } {
  const from = product.fromPrice;
  if (from) {
    const per = from.billingType === "recurring" ? ` <small>/ ${from.interval === "month" ? "month" : "year"}</small>` : "";
    return { label: product.status === "published" ? "Price" : "Preview price", text: `${escapeText(formatAmount(from.amountCents, from.currency))}${per}`, value: from.amountCents / 100 };
  }
  const { listPrice } = product;
  if (listPrice) return { label: "Preview price", text: `€${listPrice} <small>/ year</small>`, value: listPrice };
  return listPrice === 0 ? { label: "Planned price", text: "Free", value: 0 } : { label: "Roadmap price", text: "TBD", value: -1 };
}

/** Large card (the `themes` layout): cover, kicker, technologies and price. Also the /products grid. */
export function productCard(product: PublicProduct, withId: boolean) {
  const { href } = product;
  const price = cardPrice(product);
  const kicker = product.category ?? product.type.name;
  // ["TYPO3 13", "TYPO3 14"] -> "13 14" for the /themes version filter.
  const version = product.technologies.flatMap((item) => item.match(/\b\d{2,}\b/g) ?? []).join(" ");
  const badges: [string, string][] = [];
  if (product.technologies.length) badges.push([product.technologies.join(" / "), "orange"]);
  badges.push(statusBadge(product));
  return `<article class="product-card"${withId ? ` id="${escapeHtml(product.slug)}"` : ""} data-product data-name="${escapeHtml(product.name.toLowerCase())}" data-industry="${escapeHtml(kicker.toLowerCase())}" data-price="${price.value}" data-version="${version}" data-reveal>
      <a class="product-visual" href="${href}" aria-label="Explore ${escapeHtml(product.name)}">${coverImage(product.cover)}<span class="visual-label">${visualLabel(product)}</span></a>
      <div class="product-body"><span class="product-kicker">${escapeText(kicker)}</span><h3><a href="${href}">${escapeText(product.name)}</a></h3><p>${escapeText(product.summary)}</p><div class="badge-row">${badges.map(badge).join("")}</div><div class="product-bottom"><span class="product-price"><small>${price.label}</small>${price.text}</span><a class="text-link" href="${href}">Explore ${escapeText(product.type.name.toLowerCase())}${ARROW}</a></div></div>
    </article>`;
}

/** Compact card (the `extensions` layout). */
function articleCard(product: PublicProduct, withId: boolean) {
  return `<article class="article-card"${withId ? ` id="${escapeHtml(product.slug)}"` : ""}>${coverImage(product.cover, "article-card-cover")}${badge(statusBadge(product))}<h3><a href="${product.href}">${escapeText(product.name)}</a></h3><p>${escapeText(product.summary)}</p><a class="text-link" href="${product.href}">Explore ${escapeText(product.type.name.toLowerCase())}${ARROW}</a></article>`;
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

export function themePlaceholder() {
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

const MARKER = /<!--\s*catalog:(themes|extensions|journal)((?:\s+[\w=-]+)*)\s*-->[\s\S]*?<!--\s*\/catalog:\1\s*-->/g;

/**
 * Replaces the marked product grids in `html` with the store's catalogue.
 * Pages without a marker are returned untouched; if the database cannot be
 * reached the static cards from build.py stay in place.
 */
export async function injectCatalog(html: string, storeId: string): Promise<string> {
  const kinds = new Set(Array.from(html.matchAll(MARKER), (match) => match[1]));
  if (kinds.size === 0) return html;

  let products: PublicProduct[];
  let posts: PublicPost[];
  try {
    const wantsProducts = kinds.has("themes") || kinds.has("extensions");
    [products, posts] = await Promise.all([
      wantsProducts ? listProducts(storeId) : Promise.resolve([]),
      kinds.has("journal") ? listPosts(storeId) : Promise.resolve([]),
    ]);
  } catch (error) {
    console.error("catalogue unavailable, serving the static cards", error);
    return html;
  }

  return html.replace(MARKER, (match, kind: string, options: string) => {
    const withId = /\bids\b/.test(options);
    const limit = Number(/\blimit=(\d+)/.exec(options)?.[1] ?? (kind === "journal" ? 3 : Infinity));
    const min = Number(/\bmin=(\d+)/.exec(options)?.[1] ?? 0);
    const type = /\btype=([\w-]+)/.exec(options)?.[1];
    if (kind === "journal") {
      // With no published posts the marked region keeps build.py's
      // static article cards, because those are real pages worth linking.
      return posts.slice(0, limit).map(journalCard).join("") || match;
    }
    const shown = products.filter((product) => !type || product.type.key === type).slice(0, limit);
    const missing = Math.max(0, min - shown.length);
    if (kind === "themes") return shown.map((product) => productCard(product, withId)).join("") + themePlaceholder().repeat(missing);
    const withCover = shown.length === 0 || shown.some((product) => product.cover);
    return shown.map((product) => articleCard(product, withId)).join("") + extensionPlaceholder(withCover).repeat(missing);
  });
}
