export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Every catalogue validator returns either a message for the user or parsed data. */
export type ValidationResult<T> = { error: string } | { data: T };

/** Lifecycle of a product; only `published` products can be sold live. */
export const PRODUCT_STATUSES = ["concept", "planning", "in-development", "published"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === "string" && (PRODUCT_STATUSES as readonly string[]).includes(value);
}

export const MAX_GALLERY = 12;

/** Upper bound for the indicative catalogue price, in whole currency units. */
export const MAX_LIST_PRICE = 100000;

export const PRODUCT_LIMITS = { category: 80, technologies: 12, technology: 40 } as const;

/** Reads the public sort `position` of a catalogue payload (empty = 0). */
export function validatePosition(body: Record<string, unknown>): ValidationResult<number> {
  const position = body.position === undefined || body.position === null || body.position === "" ? 0 : Number(body.position);
  if (!Number.isInteger(position) || position < 0 || position > 9999) {
    return { error: "Sort order must be a whole number between 0 and 9999." };
  }
  return { data: position };
}

/* ---------------------------------------------------------------- detail page fields */

export type CompatibilityRow = { area: string; target: string; status: string };

export const DETAIL_LIMITS = {
  tagline: 80,
  intro: 400,
  highlights: 8,
  highlight: 120,
  compatibilityRows: 20,
  compatibilityCell: 80,
  ctaLabel: 40,
  url: 300,
} as const;

/** Buttons may point at a page of the site, an external page or an e-mail address. */
const LINK = /^(?:https?:\/\/\S+|mailto:\S+|\/(?!\/)\S*)$/i;

const trimmed = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Reads the detail page fields of a product: hero tagline and
 * intro, the highlight lines, the compatibility table and the buy panel links.
 * Empty strings become null so the page can fall back to its defaults.
 */
export type DetailFields = {
  tagline: string | null;
  intro: string | null;
  highlights: string[];
  compatibility: CompatibilityRow[];
  ctaLabel: string | null;
  ctaUrl: string | null;
  demoUrl: string | null;
};

export function validateDetail(body: Record<string, unknown>): ValidationResult<DetailFields> {
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

/* ---------------------------------------------------------------- changelog */

export const CHANGE_KINDS = ["new", "improved", "fixed"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
export type ChangeItem = { kind: ChangeKind; text: string };

export const CHANGELOG_LIMITS = { version: 30, title: 120, changes: 20, change: 300 } as const;

const isChangeKind = (value: unknown): value is ChangeKind =>
  typeof value === "string" && (CHANGE_KINDS as readonly string[]).includes(value);

/** Reads a changelog entry payload; the caller checks that `productId` exists in its store. */
export type ChangelogFields = {
  productId: string;
  version: string;
  title: string;
  releasedAt: Date;
  changes: ChangeItem[];
};

export function validateChangelog(body: Record<string, unknown>): ValidationResult<ChangelogFields> {
  const productId = trimmed(body.productId);
  if (!productId) return { error: "Choose the product this entry belongs to." };

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

  return {
    data: {
      productId,
      version,
      title,
      releasedAt,
      changes,
    },
  };
}

export type CoreFields = {
  name: string;
  slug: string;
  summary: string;
  description: string;
  coverId: string | null;
  galleryIds: string[];
};

/** Validates the identity and media of a product payload. */
export function validateCore(body: Record<string, unknown>): ValidationResult<CoreFields> {
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

/** Every selected image must exist in the store's own media library. */
export async function assertAssetsExist(storeId: string, assetIds: (string | null)[], prisma: typeof import("@/lib/prisma").prisma) {
  const ids = assetIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;
  const found = await prisma.mediaAsset.count({ where: { id: { in: ids }, storeId } });
  if (found !== new Set(ids).size) {
    return Response.json({ error: "One or more selected images could not be found." }, { status: 400 });
  }
  return null;
}

/** Everything a product payload carries besides its detail-page fields and compliance checklist. */
export type ProductFields = CoreFields & {
  typeId: string;
  status: ProductStatus;
  category: string | null;
  technologies: string[];
  listPrice: number | null;
  position: number;
};

export function validateProduct(body: Record<string, unknown>): ValidationResult<ProductFields> {
  const core = validateCore(body);
  if ("error" in core) return core;

  const typeId = trimmed(body.typeId);
  if (!typeId) return { error: "Choose the product type." };
  if (!isProductStatus(body.status)) return { error: `Status must be one of: ${PRODUCT_STATUSES.join(", ")}.` };

  const category = trimmed(body.category);
  if (category.length > PRODUCT_LIMITS.category) return { error: `The category can be at most ${PRODUCT_LIMITS.category} characters.` };

  const rawTechnologies = Array.isArray(body.technologies) ? body.technologies : trimmed(body.technologies).split(",");
  const technologies = [...new Set(rawTechnologies.map(trimmed).filter(Boolean))];
  if (technologies.length > PRODUCT_LIMITS.technologies) return { error: `Add at most ${PRODUCT_LIMITS.technologies} technologies.` };
  if (technologies.some((item) => item.length > PRODUCT_LIMITS.technology)) {
    return { error: `Each technology can be at most ${PRODUCT_LIMITS.technology} characters.` };
  }

  let listPrice: number | null = null;
  const raw = body.listPrice;
  if (raw !== null && raw !== undefined && raw !== "") {
    const value = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isInteger(value) || value < 0 || value > MAX_LIST_PRICE) {
      return { error: `The indicative price must be a whole number between 0 and ${MAX_LIST_PRICE}, or empty.` };
    }
    listPrice = value;
  }

  const position = validatePosition(body);
  if ("error" in position) return position;

  return {
    data: { ...core.data, typeId, status: body.status, category: category || null, technologies, listPrice, position: position.data },
  };
}

export type ProductTypeFields = { key: string; name: string; pluralName: string; description: string | null; listPath: string | null; position: number };

export function validateProductType(body: Record<string, unknown>): ValidationResult<ProductTypeFields> {
  const key = trimmed(body.key).toLowerCase();
  if (!SLUG_PATTERN.test(key) || key.length > 40) return { error: "The key may only contain lowercase letters, numbers and hyphens (max 40)." };
  const name = trimmed(body.name);
  const pluralName = trimmed(body.pluralName);
  if (!name || name.length > 40 || !pluralName || pluralName.length > 40) return { error: "Enter a name and a plural name of at most 40 characters." };
  const description = trimmed(body.description);
  if (description.length > 300) return { error: "The description can be at most 300 characters." };
  const listPath = trimmed(body.listPath);
  if (listPath && !/^\/(?!\/)[a-z0-9/-]*$/.test(listPath)) return { error: "The listing page must be a site path such as /themes, or empty." };
  const position = validatePosition(body);
  if ("error" in position) return position;
  return { data: { key, name, pluralName, description: description || null, listPath: listPath || null, position: position.data } };
}
