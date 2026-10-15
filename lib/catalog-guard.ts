export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const THEME_STATUSES = ["concept", "in-development", "published"] as const;
export const EXTENSION_STATUSES = ["concept", "planning", "in-development", "published"] as const;

export const THEME_INDUSTRIES = [
  "Architecture & corporate",
  "Free starter",
  "Agency starter",
  "Education & public",
  "Other",
] as const;

export const VERSION_TARGETS = ["TYPO3 13", "TYPO3 14", "TYPO3 13 / 14", "Not decided"] as const;

export const MAX_GALLERY = 12;

/** Upper bound for the indicative catalogue price, in whole euros. */
export const MAX_PRICE = 100000;

/** Reads the public sort `position` of a theme or extension payload (empty = 0). */
export function validatePosition(body: Record<string, unknown>): { error: string } | { data: number } {
  const position = body.position === undefined || body.position === null || body.position === "" ? 0 : Number(body.position);
  if (!Number.isInteger(position) || position < 0 || position > 9999) {
    return { error: "Sort order must be a whole number between 0 and 9999." };
  }
  return { data: position };
}

/**
 * Reads the catalogue fields of a theme payload: `price` in whole euros
 * (empty or null = not set yet, 0 = free) and the public sort `position`.
 */
export function validateListing(body: Record<string, unknown>) {
  const raw = body.price;
  let price: number | null = null;
  if (raw !== null && raw !== undefined && raw !== "") {
    const value = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isInteger(value) || value < 0 || value > MAX_PRICE) {
      return { error: `Price must be a whole number of euros between 0 and ${MAX_PRICE}, or empty.` };
    }
    price = value;
  }
  const position = validatePosition(body);
  if ("error" in position) return position;
  return { data: { price, position: position.data } };
}

/* ---------------------------------------------------------------- detail page fields */

export type CompatibilityRow = { area: string; target: string; status: string };
export type Licence = { name: string; price: number };

export const DETAIL_LIMITS = {
  tagline: 80,
  intro: 400,
  highlights: 8,
  highlight: 120,
  compatibilityRows: 20,
  compatibilityCell: 80,
  ctaLabel: 40,
  url: 300,
  licences: 6,
  licenceName: 40,
} as const;

/** Buttons may point at a page of the site, an external page or an e-mail address. */
const LINK = /^(?:https?:\/\/\S+|mailto:\S+|\/(?!\/)\S*)$/i;

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Reads the detail page fields themes and extensions share: hero tagline and
 * intro, the highlight lines, the compatibility table and the buy panel links.
 * Empty strings become null so the page can fall back to its defaults.
 */
export function validateDetail(body: Record<string, unknown>) {
  const tagline = trimmed(body.tagline);
  if (tagline.length > DETAIL_LIMITS.tagline) return { error: `The tagline can be at most ${DETAIL_LIMITS.tagline} characters.` };
  const intro = trimmed(body.intro);
  if (intro.length > DETAIL_LIMITS.intro) return { error: `The intro can be at most ${DETAIL_LIMITS.intro} characters.` };

  const rawHighlights = Array.isArray(body.highlights) ? body.highlights : trimmed(body.highlights).split("\n");
  const highlights = rawHighlights.map(trimmed).filter(Boolean);
  if (highlights.length > DETAIL_LIMITS.highlights) return { error: `Add at most ${DETAIL_LIMITS.highlights} highlights.` };
  if (highlights.some((line) => line.length > DETAIL_LIMITS.highlight)) {
    return { error: `Each highlight can be at most ${DETAIL_LIMITS.highlight} characters.` };
  }

  const rows = Array.isArray(body.compatibility) ? body.compatibility : [];
  const compatibility: CompatibilityRow[] = [];
  for (const row of rows) {
    const record = (row ?? {}) as Record<string, unknown>;
    const entry = { area: trimmed(record.area), target: trimmed(record.target), status: trimmed(record.status) };
    if (!entry.area && !entry.target && !entry.status) continue;
    if (!entry.area) return { error: "Every compatibility row needs an area, for example “TYPO3 CMS”." };
    if (Object.values(entry).some((cell) => cell.length > DETAIL_LIMITS.compatibilityCell)) {
      return { error: `Compatibility cells can be at most ${DETAIL_LIMITS.compatibilityCell} characters.` };
    }
    compatibility.push(entry);
  }
  if (compatibility.length > DETAIL_LIMITS.compatibilityRows) {
    return { error: `The compatibility table can have at most ${DETAIL_LIMITS.compatibilityRows} rows.` };
  }

  const ctaLabel = trimmed(body.ctaLabel);
  if (ctaLabel.length > DETAIL_LIMITS.ctaLabel) return { error: `The button label can be at most ${DETAIL_LIMITS.ctaLabel} characters.` };
  const links: Record<"ctaUrl" | "demoUrl", string> = { ctaUrl: trimmed(body.ctaUrl), demoUrl: trimmed(body.demoUrl) };
  for (const [key, url] of Object.entries(links)) {
    if (url && (url.length > DETAIL_LIMITS.url || !LINK.test(url))) {
      return {
        error: `${key === "ctaUrl" ? "The button link" : "The demo link"} must be a site path (/contact), a full https:// address or a mailto: link.`,
      };
    }
  }

  return {
    data: {
      tagline: tagline || null,
      intro: intro || null,
      highlights,
      compatibility,
      ctaLabel: ctaLabel || null,
      ctaUrl: links.ctaUrl || null,
      demoUrl: links.demoUrl || null,
    },
  };
}

/** Stored compatibility rows are JSON; anything malformed is skipped. */
export function readCompatibility(value: unknown): CompatibilityRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({ area: String(row.area ?? ""), target: String(row.target ?? ""), status: String(row.status ?? "") }))
    .filter((row) => row.area);
}

export function readLicences(value: unknown): Licence[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map((row) => ({ name: String(row.name ?? ""), price: Number(row.price) || 0 }))
    .filter((row) => row.name);
}

/** Licence options for a theme's buy panel; rows without a name and price are dropped. */
export function validateLicences(body: Record<string, unknown>): { error: string } | { data: Licence[] } {
  const rows = Array.isArray(body.licences) ? body.licences : [];
  const licences: Licence[] = [];
  for (const row of rows) {
    const record = (row ?? {}) as Record<string, unknown>;
    const name = trimmed(record.name);
    const rawPrice = record.price === null || record.price === undefined ? "" : String(record.price).trim();
    if (!name && !rawPrice) continue;
    const price = Number(rawPrice);
    if (!name || name.length > DETAIL_LIMITS.licenceName) {
      return { error: `Every licence needs a name of at most ${DETAIL_LIMITS.licenceName} characters.` };
    }
    if (rawPrice === "" || !Number.isInteger(price) || price < 0 || price > MAX_PRICE) {
      return { error: `The ${name} licence needs a whole-euro price between 0 and ${MAX_PRICE}.` };
    }
    licences.push({ name, price });
  }
  if (licences.length > DETAIL_LIMITS.licences) return { error: `Add at most ${DETAIL_LIMITS.licences} licences.` };
  return { data: licences };
}

/* ---------------------------------------------------------------- changelog */

export const CHANGE_KINDS = ["new", "improved", "fixed"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
export type ChangeItem = { kind: ChangeKind; text: string };

export const CHANGELOG_LIMITS = { version: 30, title: 120, changes: 20, change: 300 } as const;

const isChangeKind = (value: unknown): value is ChangeKind =>
  typeof value === "string" && (CHANGE_KINDS as readonly string[]).includes(value);

/**
 * Reads a changelog entry payload. `product` is "theme:<id>" or
 * "extension:<id>"; the caller checks that the record exists.
 */
export function validateChangelog(body: Record<string, unknown>) {
  const product = trimmed(body.product);
  const match = product.match(/^(theme|extension):(\S+)$/);
  if (!match) return { error: "Choose the theme or extension this entry belongs to." };

  const version = trimmed(body.version);
  if (!version || version.length > CHANGELOG_LIMITS.version) {
    return { error: `Enter a version of at most ${CHANGELOG_LIMITS.version} characters, for example v1.2.0.` };
  }
  const title = trimmed(body.title);
  if (!title || title.length > CHANGELOG_LIMITS.title) {
    return { error: `Enter a title of at most ${CHANGELOG_LIMITS.title} characters.` };
  }
  const releasedAt = new Date(trimmed(body.releasedAt));
  if (!trimmed(body.releasedAt) || Number.isNaN(releasedAt.getTime())) return { error: "Choose the release date." };

  const rows = Array.isArray(body.changes) ? body.changes : [];
  const changes: ChangeItem[] = [];
  for (const row of rows) {
    const record = (row ?? {}) as Record<string, unknown>;
    const text = trimmed(record.text);
    if (!text) continue;
    if (!isChangeKind(record.kind)) return { error: "Every change needs a type: new, improved or fixed." };
    if (text.length > CHANGELOG_LIMITS.change) return { error: `Each change can be at most ${CHANGELOG_LIMITS.change} characters.` };
    changes.push({ kind: record.kind, text });
  }
  if (changes.length === 0) return { error: "Add at least one change." };
  if (changes.length > CHANGELOG_LIMITS.changes) return { error: `Add at most ${CHANGELOG_LIMITS.changes} changes per entry.` };

  const kind = match[1] as "theme" | "extension";
  return {
    data: {
      themeId: kind === "theme" ? match[2] : null,
      extensionId: kind === "extension" ? match[2] : null,
      version,
      title,
      releasedAt,
      changes,
    },
  };
}

export type ThemeStatus = (typeof THEME_STATUSES)[number];
export type ExtensionStatus = (typeof EXTENSION_STATUSES)[number];

export function isThemeStatus(value: unknown): value is ThemeStatus {
  return typeof value === "string" && (THEME_STATUSES as readonly string[]).includes(value);
}

export function isExtensionStatus(value: unknown): value is ExtensionStatus {
  return typeof value === "string" && (EXTENSION_STATUSES as readonly string[]).includes(value);
}

export type EditableTheme = {
  name: string;
  slug: string;
  summary: string;
  description: string;
  industry: string;
  versionTarget: string;
  status: string;
  price: number | null;
  position: number;
  coverId: string | null;
  galleryIds: string[];
};

/** Validates the shared shape used by both theme and extension payloads. */
export function validateCore(body: Record<string, unknown>) {
  const text = (key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");

  const name = text("name");
  if (name.length < 2 || name.length > 80) {
    return { error: "Name must be between 2 and 80 characters." };
  }

  const slug = text("slug").toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    return { error: "Slug may only contain lowercase letters, numbers and hyphens." };
  }

  const summary = text("summary");
  if (summary.length < 10 || summary.length > 300) {
    return { error: "Summary must be between 10 and 300 characters." };
  }

  const description = text("description");
  if (description.length < 10) {
    return { error: "Description is required." };
  }

  const coverId = typeof body.coverId === "string" && body.coverId ? body.coverId : null;
  const galleryIds = Array.isArray(body.galleryIds)
    ? Array.from(new Set(body.galleryIds.filter((id): id is string => typeof id === "string" && id.length > 0)))
    : [];

  if (galleryIds.length > MAX_GALLERY) {
    return { error: `A gallery can hold at most ${MAX_GALLERY} images.` };
  }

  return { data: { name, slug, summary, description, coverId, galleryIds } };
}

/** Confirms the referenced uploads exist before the record is written. */
export async function assertAssetsExist(assetIds: (string | null)[], prisma: typeof import("@/lib/prisma").prisma) {
  const ids = assetIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;
  const found = await prisma.mediaAsset.count({ where: { id: { in: ids } } });
  if (found !== new Set(ids).size) {
    return Response.json({ error: "One or more selected images could not be found." }, { status: 400 });
  }
  return null;
}
