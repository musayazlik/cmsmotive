import { prisma } from "./prisma";
import { publicAuthorName } from "./reviews";
import { getReviewSettings } from "./settings";

/**
 * Home page social proof from real customer words only. The early-access
 * section (static-site/build.py early_voices()) marks its cards with
 * `<!-- voices:reviews limit=3 min=3 -->…<!-- /voices:reviews -->`; this swaps
 * them for the newest approved product reviews at or above the minimum rating
 * of Settings → Reviews (moderated under /panel/reviews) and keeps "open beta seat" cards for the rest, up to `min`.
 * Without approved reviews, or without a database, build.py's seats stay.
 *
 * Runs before translation like lib/catalog.ts, so the fixed card copy is
 * localized; the quote keeps the language it was written in (`lang`).
 */

const MARKER = /<!--\s*voices:reviews((?:\s+[\w=]+)*)\s*-->[\s\S]*?<!--\s*\/voices:reviews\s*-->/;

/** Quotes longer than this are shortened on the card; the full review stays on the product page. */
const QUOTE_LENGTH = 240;
/** Shorter reviews ("Great!") stay on their product page; a quote on the home page should say something. */
const QUOTE_MIN_LENGTH = 40;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** Mirrors build.py voice_seat(). */
function seatCard(number: number) {
  const n = String(number).padStart(2, "0");
  return `<figure class="voice-card voice-card-open"><span class="voice-mark" aria-hidden="true">“</span><span class="skel-lines" aria-hidden="true"><span class="skel"></span><span class="skel"></span><span class="skel"></span></span><figcaption><span class="voice-avatar" aria-hidden="true">${n}</span><span class="voice-meta"><strong>Beta seat <span>${n}</span></strong><small>Open for early feedback</small></span></figcaption></figure>`;
}

type Review = {
  authorName: string;
  rating: number;
  body: string;
  locale: string;
  theme: { slug: string; name: string } | null;
  extension: { slug: string; name: string } | null;
};

function reviewCard(review: Review) {
  const name = publicAuthorName(review.authorName);
  const initials = name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
  const body = review.body.trim().replace(/\s+/g, " ");
  const quote = body.length > QUOTE_LENGTH ? `${body.slice(0, QUOTE_LENGTH - 1).trimEnd()}…` : body;
  const product = review.theme
    ? { href: `/theme/${review.theme.slug}`, name: review.theme.name, kind: "TYPO3 theme" }
    : review.extension
      ? { href: `/extension/${review.extension.slug}`, name: review.extension.name, kind: "TYPO3 extension" }
      : null;
  const rating = Math.min(5, Math.max(1, Math.round(review.rating)));
  return `<figure class="voice-card"><span class="voice-stars" role="img" aria-label="Rated ${rating} out of 5">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</span><blockquote lang="${escapeHtml(review.locale)}"><p>${escapeHtml(quote)}</p></blockquote><figcaption><span class="voice-avatar" aria-hidden="true">${escapeHtml(initials)}</span><span class="voice-meta"><strong>${escapeHtml(name)}</strong>${product ? `<small><a href="${escapeHtml(product.href)}">${escapeHtml(product.name)}</a> · <span>${product.kind}</span></small>` : ""}</span></figcaption></figure>`;
}

export async function injectTestimonials(html: string): Promise<string> {
  const match = MARKER.exec(html);
  if (!match) return html;
  const limit = Number(/\blimit=(\d+)/.exec(match[1])?.[1] ?? 3);
  const min = Number(/\bmin=(\d+)/.exec(match[1])?.[1] ?? 0);

  let reviews: Review[];
  try {
    const settings = await getReviewSettings();
    if (!settings.showcase) return html;
    const recent = await prisma.productReview.findMany({
      where: { status: "approved", rating: { gte: settings.showcaseMinRating } },
      orderBy: { createdAt: "desc" },
      // Room for short reviews that are skipped below.
      take: limit * 4,
      select: {
        authorName: true,
        rating: true,
        body: true,
        locale: true,
        theme: { select: { slug: true, name: true } },
        extension: { select: { slug: true, name: true } },
      },
    });
    reviews = recent.filter((review) => review.body.trim().length >= QUOTE_MIN_LENGTH).slice(0, limit);
  } catch (error) {
    console.error("reviews unavailable, keeping the beta seats", error);
    return html;
  }
  if (reviews.length === 0) return html;

  const seats = Array.from({ length: Math.max(0, min - reviews.length) }, (_, index) => seatCard(reviews.length + index + 1));
  return html.replace(MARKER, () => [...reviews.map(reviewCard), ...seats].join(""));
}
