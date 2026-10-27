import { Prisma, type Page, type PageLocale } from "@/generated/prisma/client";
import { PUBLIC_PATH_SEGMENTS } from "@/lib/admin-access-shared";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { auditDocumentA11y } from "./a11y";
import { regenerateBlockIds, type PageBuilderData } from "./data";
import { prepareDocument } from "./document";
import { usedFontFiles } from "./fonts";
import { CURRENT_SCHEMA_VERSION, migrateDocument } from "./migrations";
import { invalidatePageRegistry } from "./registry";
import { compileDocumentCss } from "./style/css";

/**
 * The database rock the page builder stands on (plan 5.1, 5.6): reads, writes,
 * publish, revisions and slug rules — all store-scoped. Every write funnels
 * the document through document.ts (plan 5.13) before it reaches the database,
 * and every mutation invalidates the proxy's page registry (plan 5.8).
 *
 * `storeId` always comes from the panel's store resolution; the functions pass
 * it into every where clause so another store's pages are unreachable.
 */

export type AdminResult<T> = { data: T } | { error: string; status?: number };

const fail = (error: string, status = 400): { error: string; status: number } => ({ error, status });

function uniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Media served by this installation (`/api/media/r2/...`) must belong to the
 * page's store (plan 5.14): a draft cannot reference another store's library
 * by URL. External https/uploadthing addresses are public by nature and stay
 * out of scope. Key shape per lib/media-upload-shared.ts (`r2://<path>`).
 */
async function foreignInstallerMedia(storeId: string, data: PageBuilderData): Promise<string[]> {
  const keys = new Set(
    Array.from(
      JSON.stringify(data).matchAll(/\/api\/media\/r2\/([A-Za-z0-9-]+\/media\/[A-Za-z0-9_-]+\/[a-f0-9-]+\.[a-z0-9]+)/g),
      (match) => `r2://${match[1]}`,
    ),
  );
  if (keys.size === 0) return [];
  const rows = await prisma.mediaAsset.findMany({ where: { storeId, key: { in: [...keys] } }, select: { key: true } });
  const known = new Set(rows.map((row) => row.key));
  return [...keys].filter((key) => !known.has(key));
}

/** The home page (slug "") stays unique per store; landing pages are the v1 default. */
export const PAGE_KINDS = ["home", "landing", "page"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

export const PAGE_STATUSES = ["draft", "published", "scheduled", "unpublished"] as const;

/** Published and freshly built documents start empty: the editor fills them. */
function emptyDocument(): PageBuilderData {
  return { content: [], root: {} };
}

/* ------------------------------------------------------------------ slug rules (plan 5.8) */

/** `""` (the home page) or lowercase `a-z0-9-` segments joined by `/`. */
export const PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

const MAX_SLUG_SEGMENTS = 6;
const MAX_SEGMENT_LENGTH = 80;

/** Normalizes panel input per segment (diacritics, spaces, case) while keeping `/`. */
export function normalizePageSlug(raw: string): string {
  const segments = raw.split("/").map((part) => slugify(part)).filter(Boolean);
  return segments.join("/");
}

export type SlugCheck = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Slug validation (plan 5.8). Reserved segments are blocked from v1; the
 * panel's private address is a runtime setting, so it arrives as an extra
 * reserved segment.
 */
export function validatePageSlug(raw: string, kind: string, extraReserved: readonly string[] = []): SlugCheck {
  if (kind === "home") {
    if (raw.trim() !== "") return { ok: false, error: "The home page always lives at the root address." };
    return { ok: true, slug: "" };
  }
  const slug = normalizePageSlug(raw);
  if (!slug) return { ok: false, error: "Enter an address, e.g. \"black-friday\"." };
  const segments = slug.split("/");
  if (segments.length > MAX_SLUG_SEGMENTS) return { ok: false, error: `Use at most ${MAX_SLUG_SEGMENTS} address segments.` };
  if (segments.some((segment) => segment.length > MAX_SEGMENT_LENGTH)) {
    return { ok: false, error: "Address segments are too long." };
  }
  const extra = extraReserved.map((segment) => segment.replace(/^\/+|\/+$/g, "").toLowerCase()).filter(Boolean);
  for (const reserved of [...PUBLIC_PATH_SEGMENTS, "panel", "_next", ...extra]) {
    if (segments.includes(reserved)) {
      return { ok: false, error: `The address segment "${reserved}" is already used by the public site.` };
    }
  }
  return { ok: true, slug };
}

/** Free-address check against pages and old addresses; `ignorePageId` keeps a page's own slug. */
export async function checkSlugAvailable(storeId: string, slug: string, ignorePageId?: string): Promise<string | null> {
  const page = await prisma.page.findUnique({ where: { storeId_slug: { storeId, slug } }, select: { id: true } });
  if (page && page.id !== ignorePageId) return "Another page already uses this address.";
  const redirect = await prisma.pageRedirect.findUnique({
    where: { storeId_fromSlug: { storeId, fromSlug: slug } },
    select: { pageId: true },
  });
  if (redirect && redirect.pageId !== ignorePageId) {
    return "An old address still redirects from this address. Choose another.";
  }
  return null;
}

/** The panel's private address must never collide with a page slug. */
async function reservedPanelSegments(): Promise<string[]> {
  const { getAdminAccessSettings } = await import("@/lib/admin-access");
  return [(await getAdminAccessSettings()).panelPath];
}

/* ------------------------------------------------------------------ reads */

export type PageListItem = Page & { locales: Array<PageLocale> };

/** Panel list (plan 5.6): the home page pinned first, then latest activity. */
export async function listStorePages(storeId: string): Promise<PageListItem[]> {
  const rows = await prisma.page.findMany({
    where: { storeId },
    orderBy: { createdAt: "asc" },
    include: { locales: { orderBy: { locale: "asc" } } },
  });
  return [...rows].sort((a, b) => {
    if (a.kind === "home") return -1;
    if (b.kind === "home") return 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

/** The page and one language version for the editing view (null when absent). */
export async function loadPageLocale(storeId: string, pageId: string, locale: string): Promise<{
  page: { id: string; slug: string; kind: string };
  locale: PageLocale | null;
} | null> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, storeId },
    select: { id: true, slug: true, kind: true },
  });
  if (!page) return null;
  const data = await prisma.pageLocale.findUnique({ where: { pageId_locale: { pageId, locale } } });
  return { page, locale: data };
}

/* ------------------------------------------------------------------ public render */

export type PublishedPageView = {
  page: { id: string; slug: string; kind: string };
  locale: {
    id: string;
    locale: string;
    title: string;
    seoTitle: string | null;
    seoDescription: string | null;
    noindex: boolean;
    published: PageBuilderData;
    publishedCss: string | null;
    /** Font preload files chosen at publish time (plan 5.5). */
    usedFonts: string[];
    publishedAt: Date | null;
  };
  /** OG asset picked per locale: its URL plus dimensions for og:image. */
  ogImage: { url: string; width: number | null; height: number | null } | null;
  /** The locales in which this slug is live right now; hreflang stays in sync with the proxy. */
  publishedLocales: string[];
};

/**
 * The published version of `slug` in `locale`, for the public route (plan 5.8):
 * the proxy matched the URL against the page registry, this is the one row the
 * renderer needs. Null when no such version exists — drafts render through the
 * panel preview, not the public route.
 */
export async function findPublishedPageLocale(
  storeId: string,
  slug: string,
  locale: string,
): Promise<PublishedPageView | null> {
  const row = await prisma.pageLocale.findFirst({
    where: { locale, status: "published", page: { storeId, slug } },
    select: {
      id: true,
      locale: true,
      title: true,
      seoTitle: true,
      seoDescription: true,
      noindex: true,
      published: true,
      publishedCss: true,
      usedFonts: true,
      publishedAt: true,
      ogImageId: true,
      page: { select: { id: true, slug: true, kind: true } },
    },
  });
  if (!row) return null;
  const peers = await prisma.pageLocale.findMany({
    where: { pageId: row.page.id, status: "published" },
    select: { locale: true },
  });
  // ogImageId is a plain string on the schema (a deleted asset should only drop
  // the image), so the asset joins here instead of along the relation.
  const asset = row.ogImageId
    ? await prisma.mediaAsset.findFirst({
        where: { id: row.ogImageId, storeId },
        select: { url: true, width: true, height: true },
      })
    : null;
  return {
    page: row.page,
    locale: {
      id: row.id,
      locale: row.locale,
      title: row.title,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      noindex: row.noindex,
      published: row.published as PageBuilderData,
      publishedCss: row.publishedCss,
      usedFonts: row.usedFonts,
      publishedAt: row.publishedAt,
    },
    ogImage: asset ? { url: asset.url, width: asset.width, height: asset.height } : null,
    publishedLocales: peers.map((peer) => peer.locale),
  };
}

/* ------------------------------------------------------------------ create / delete / rename */

export type CreatePageInput = {
  kind: string;
  /** The home page ignores this and stays at "". */
  slug?: string;
  locale: string;
  title: string;
  userId?: string;
};

export async function createPage(storeId: string, input: CreatePageInput): Promise<AdminResult<{ pageId: string }>> {
  const kind: PageKind = (PAGE_KINDS as readonly string[]).includes(input.kind) ? (input.kind as PageKind) : "landing";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (title.length < 1 || title.length > 120) return fail("The title must be 1–120 characters long.");

  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { locales: true } });
  if (!store) return fail("Unknown store.", 404);
  if (!store.locales.includes(input.locale)) return fail(`The store has no "${input.locale}" language.`);

  const slugCheck = validatePageSlug(input.slug ?? "", kind, await reservedPanelSegments());
  if (!slugCheck.ok) return fail(slugCheck.error);
  if (kind === "home" && (await prisma.page.findFirst({ where: { storeId, kind: "home" }, select: { id: true } }))) {
    return fail("The store already has a home page.");
  }
  const available = await checkSlugAvailable(storeId, slugCheck.slug);
  if (available) return fail(available);

  const document = prepareDocument(emptyDocument());
  if (!document.ok) return fail(document.error, 500);
  try {
    const page = await prisma.page.create({
      data: {
        storeId,
        slug: slugCheck.slug,
        kind,
        locales: {
          create: {
            locale: input.locale,
            title,
            draft: document.data as unknown as Prisma.InputJsonValue,
            updatedById: input.userId,
          },
        },
      },
      select: { id: true },
    });
    invalidatePageRegistry(storeId);
    return { data: { pageId: page.id } };
  } catch (error) {
    if (uniqueViolation(error)) return fail("Another page already uses this address.");
    throw error;
  }
}

export async function deletePage(storeId: string, pageId: string): Promise<AdminResult<{ ok: true }>> {
  const page = await prisma.page.findFirst({ where: { id: pageId, storeId }, select: { id: true, kind: true } });
  if (!page) return fail("Page not found.", 404);
  if (page.kind === "home") return fail("The home page cannot be deleted.", 400);
  await prisma.page.delete({ where: { id: page.id } });
  invalidatePageRegistry(storeId);
  return { data: { ok: true } };
}

/** Renaming keeps the old address working through a PageRedirect (plan 5.8). */
export async function renamePage(storeId: string, pageId: string, rawSlug: string): Promise<AdminResult<{ slug: string }>> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, storeId },
    select: { id: true, slug: true, kind: true },
  });
  if (!page) return fail("Page not found.", 404);
  if (page.kind === "home") return fail("The home page keeps the root address.");
  const slugCheck = validatePageSlug(rawSlug, page.kind, await reservedPanelSegments());
  if (!slugCheck.ok) return fail(slugCheck.error);
  const conflict = await checkSlugAvailable(storeId, slugCheck.slug, page.id);
  if (conflict) return fail(conflict);
  if (slugCheck.slug === page.slug) return { data: { slug: page.slug } };

  const operations: Array<Prisma.PrismaPromise<unknown>> = [
    // Stale self-redirects from earlier renamings would otherwise eat this address.
    prisma.pageRedirect.deleteMany({ where: { storeId, fromSlug: slugCheck.slug, pageId: page.id } }),
  ];
  if (page.slug !== "") {
    operations.push(prisma.pageRedirect.create({ data: { storeId, fromSlug: page.slug, pageId: page.id } }));
  }
  operations.push(prisma.page.update({ where: { id: page.id }, data: { slug: slugCheck.slug } }));
  await prisma.$transaction(operations);
  invalidatePageRegistry(storeId);
  return { data: { slug: slugCheck.slug } };
}

/* ------------------------------------------------------------------ page locales */

const TITLE_LIMIT = { min: 1, max: 120 } as const;

/**
 * Opens a language version for editing, creating an empty one when missing.
 * The store's own locale list gates it — pages never teach a store a language.
 */
export async function ensurePageLocale(
  storeId: string,
  pageId: string,
  locale: string,
  title: string,
  userId?: string,
): Promise<AdminResult<{ localeId: string }>> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, storeId },
    select: { id: true, locales: { select: { id: true, locale: true } } },
  });
  if (!page) return fail("Page not found.", 404);
  const existing = page.locales.find((candidate) => candidate.locale === locale);
  if (existing) return { data: { localeId: existing.id } };
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { locales: true } });
  if (!store?.locales.includes(locale)) return fail(`The store has no "${locale}" language.`);
  if (title.trim().length < TITLE_LIMIT.min || title.length > TITLE_LIMIT.max) {
    return fail("The title must be 1–120 characters long.");
  }
  const document = prepareDocument(emptyDocument());
  if (!document.ok) return fail(document.error, 500);
  try {
    const row = await prisma.pageLocale.create({
      data: {
        pageId: page.id,
        locale,
        title: title.trim(),
        draft: document.data as unknown as Prisma.InputJsonValue,
        updatedById: userId,
      },
      select: { id: true },
    });
    return { data: { localeId: row.id } };
  } catch (error) {
    if (uniqueViolation(error)) {
      const concurrent = await prisma.pageLocale.findUnique({
        where: { pageId_locale: { pageId: page.id, locale } },
        select: { id: true },
      });
      if (concurrent) return { data: { localeId: concurrent.id } };
      return fail("This language already exists on the page.");
    }
    throw error;
  }
}

/** Copies draft content, SEO fields and layout from an existing language version to another. */
export async function copyPageLocale(
  storeId: string,
  pageId: string,
  sourceLocale: string,
  targetLocale: string,
  targetTitle: string,
  userId?: string,
): Promise<AdminResult<{ localeId: string }>> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, storeId },
    select: {
      id: true,
      locales: {
        select: {
          id: true,
          locale: true,
          draft: true,
          title: true,
          seoTitle: true,
          seoDescription: true,
          ogImageId: true,
        },
      },
    },
  });
  if (!page) return fail("Page not found.", 404);
  const source = page.locales.find((candidate) => candidate.locale === sourceLocale);
  if (!source) return fail(`Source language "${sourceLocale}" not found.`);
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { locales: true } });
  if (!store?.locales.includes(targetLocale)) return fail(`The store has no "${targetLocale}" language.`);

  const cleanTitle = (targetTitle.trim() || `${source.title} (${targetLocale})`).slice(0, TITLE_LIMIT.max);
  const reIdDocument = regenerateBlockIds(source.draft as PageBuilderData);
  const prepared = prepareDocument(reIdDocument);
  if (!prepared.ok) return fail(prepared.error, 500);

  const existingTarget = page.locales.find((candidate) => candidate.locale === targetLocale);
  if (existingTarget) {
    const updated = await prisma.pageLocale.update({
      where: { id: existingTarget.id },
      data: {
        draft: prepared.data as unknown as Prisma.InputJsonValue,
        title: cleanTitle,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        ogImageId: source.ogImageId,
        updatedById: userId,
        version: { increment: 1 },
      },
      select: { id: true },
    });
    await prisma.page.update({ where: { id: pageId }, data: { updatedAt: new Date() } });
    return { data: { localeId: updated.id } };
  }

  const created = await prisma.pageLocale.create({
    data: {
      pageId: page.id,
      locale: targetLocale,
      title: cleanTitle,
      draft: prepared.data as unknown as Prisma.InputJsonValue,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      ogImageId: source.ogImageId,
      updatedById: userId,
    },
    select: { id: true },
  });
  await prisma.page.update({ where: { id: pageId }, data: { updatedAt: new Date() } });
  return { data: { localeId: created.id } };
}

/* ------------------------------------------------------------------ draft + SEO */

export type DraftSaveResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; currentVersion: number }
  | { ok: false; conflict: false; error: string; status: number };

/**
 * The single draft write door (plan 5.13): validate + clean, then an
 * optimistic update. `expectedVersion` must match — two admins editing at
 * once get a conflict instead of a silent overwrite (plan 5.6).
 */
export async function saveDraft(
  storeId: string,
  pageId: string,
  locale: string,
  document: unknown,
  expectedVersion: number,
  userId?: string,
): Promise<DraftSaveResult> {
  const page = await prisma.page.findFirst({ where: { id: pageId, storeId }, select: { id: true } });
  if (!page) return { ok: false, conflict: false, error: "Page not found.", status: 404 };
  const row = await prisma.pageLocale.findUnique({
    where: { pageId_locale: { pageId, locale } },
    select: { id: true, version: true },
  });
  if (!row) return { ok: false, conflict: false, error: "Language version not found.", status: 404 };
  if (!Number.isInteger(expectedVersion) || expectedVersion !== row.version) {
    return { ok: false, conflict: true, currentVersion: row.version };
  }
  const prepared = prepareDocument(document);
  if (!prepared.ok) return { ok: false, conflict: false, error: prepared.error, status: 400 };
  const foreign = await foreignInstallerMedia(storeId, prepared.data);
  if (foreign.length) return { ok: false, conflict: false, error: "The draft references media from another store's library.", status: 400 };
  const result = await prisma.pageLocale.updateMany({
    where: { id: row.id, version: row.version },
    data: {
      draft: prepared.data as unknown as Prisma.InputJsonValue,
      updatedById: userId,
      version: { increment: 1 },
    },
  });
  if (result.count === 0) return { ok: false, conflict: true, currentVersion: row.version };
  await prisma.page.update({ where: { id: pageId }, data: { updatedAt: new Date() } });
  return { ok: true, version: row.version + 1 };
}

export type PageSeoInput = {
  /** The page's display title in this language (the list and metadata fallback use it). */
  title?: string;
  seoTitle?: string;
  seoDescription?: string;
  ogImageId?: string;
  noindex?: boolean;
  expectedVersion: number;
  userId?: string;
};

function optionalText(value: string | undefined, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  const text = typeof value === "string" ? value.trim() : "";
  return text.length ? text.slice(0, max) : null;
}

/** SEO tab: per-locale metadata and the noindex switch; versioned like the draft. */
export async function updatePageSeo(
  storeId: string,
  pageId: string,
  locale: string,
  input: PageSeoInput,
): Promise<AdminResult<{ version: number }>> {
  const row = await prisma.pageLocale.findFirst({
    where: { locale, page: { id: pageId, storeId } },
    select: { id: true, version: true },
  });
  if (!row) return fail("Language version not found.", 404);
  if (input.expectedVersion !== row.version) return fail("The page changed elsewhere. Reload and try again.", 409);
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title.length < 1) return fail("The title cannot be empty.");
    if (title.length > 120) return fail("The title must be 1–120 characters long.");
  }
  const seoTitle = optionalText(input.seoTitle, 60);
  const seoDescription = optionalText(input.seoDescription, 160);
  let ogImageId: string | null | undefined = undefined;
  if (input.ogImageId !== undefined) {
    const value = input.ogImageId.trim();
    if (!value) ogImageId = null;
    else if (await prisma.mediaAsset.findFirst({ where: { id: value, storeId }, select: { id: true } })) ogImageId = value;
    else return fail("The OG image must come from this store's media library.");
  }
  const result = await prisma.pageLocale.updateMany({
    where: { id: row.id, version: row.version },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim().slice(0, 120) } : {}),
      ...(seoTitle !== undefined ? { seoTitle } : {}),
      ...(seoDescription !== undefined ? { seoDescription } : {}),
      ...(ogImageId !== undefined ? { ogImageId } : {}),
      ...(input.noindex !== undefined ? { noindex: input.noindex } : {}),
      updatedById: input.userId,
      version: { increment: 1 },
    },
  });
  if (result.count === 0) return fail("The page changed elsewhere. Reload and try again.", 409);
  await prisma.page.update({ where: { id: pageId }, data: { updatedAt: new Date() } });
  return { data: { version: row.version + 1 } };
}

/* ------------------------------------------------------------------ publish (plan 5.7) */

export type PublishResult =
  | { ok: true; warnings: string[]; publishedAt: Date; version: number }
  | { ok: false; error: string; status?: number; blockers?: string[]; warnings?: string[] };

/**
 * Publishing: draft → published in one door — migrate, validate, clean,
 * accessibility audit, scoped CSS and font preload list, a revision snapshot,
 * then the proxy list invalidation. Before this runs, prepareDocument already
 * cleaned the draft on every save.
 */
export async function publishPage(
  storeId: string,
  pageId: string,
  locale: string,
  context: { userId?: string; note?: string } = {},
  expectedVersion?: number,
): Promise<PublishResult> {
  const page = await prisma.page.findFirst({ where: { id: pageId, storeId } });
  if (!page) return { ok: false, error: "Page not found.", status: 404 };
  const row = await prisma.pageLocale.findUnique({
    where: { pageId_locale: { pageId, locale } },
    select: {
      id: true, version: true, schemaVersion: true, draft: true,
    },
  });
  if (!row) return { ok: false, error: "Language version not found.", status: 404 };
  if (expectedVersion !== undefined && row.version !== expectedVersion) {
    return { ok: false, error: "The page was modified elsewhere. Reload and try again.", status: 409 };
  }

  const migrated = migrateDocument(row.draft as PageBuilderData, row.schemaVersion);
  const prepared = prepareDocument(migrated.data);
  if (!prepared.ok) return { ok: false, error: `The draft no longer validates: ${prepared.error}`, blockers: [], warnings: [] };
  const foreign = await foreignInstallerMedia(storeId, prepared.data);
  if (foreign.length) return { ok: false, error: "The draft references media from another store's library.", blockers: [], warnings: [] };
  const audit = auditDocumentA11y(prepared.data);
  if (audit.blockers.length) {
    return { ok: false, error: "Accessibility check failed.", blockers: audit.blockers, warnings: audit.warnings };
  }

  const publishedCss = compileDocumentCss(prepared.data);
  const usedFonts = usedFontFiles(prepared.data);
  const publishedAt = new Date();
  const note = typeof context.note === "string" ? context.note.slice(0, 200) : null;

  class StalePublish extends Error {}

  try {
    await prisma.$transaction(async (tx) => {
      // The version condition makes the write atomic: a concurrent draft or
      // SEO save between the read above and this update aborts the publish
      // instead of shipping the older snapshot (plan 5.6/5.7).
      const updated = await tx.pageLocale.updateMany({
        where: { id: row.id, version: row.version },
        data: {
          published: prepared.data as unknown as Prisma.InputJsonValue,
          publishedCss,
          usedFonts,
          schemaVersion: CURRENT_SCHEMA_VERSION,
          status: "published",
          publishedAt,
          publishAt: null,
          updatedById: context.userId,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) throw new StalePublish("The page was modified elsewhere. Reload and try again.");
      await tx.page.update({ where: { id: pageId }, data: { updatedAt: new Date() } });
      await tx.pageRevision.create({
        data: {
          pageLocaleId: row.id,
          data: prepared.data as unknown as Prisma.InputJsonValue,
          authorId: context.userId,
          note,
        },
      });
    });
  } catch (error) {
    if (error instanceof StalePublish) return { ok: false, error: error.message, status: 409 };
    throw error;
  }

  // Keep only the last 50 revisions per language (plan 5.1).
  const overflow = await prisma.pageRevision.findMany({
    where: { pageLocaleId: row.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: 50,
    select: { id: true },
  });
  if (overflow.length) {
    await prisma.pageRevision.deleteMany({ where: { id: { in: overflow.map((entry) => entry.id) } } });
  }

  invalidatePageRegistry(storeId);
  return { ok: true, warnings: audit.warnings, publishedAt, version: row.version + 1 };
}

/** Unpublish returns the public URL to the legacy flow immediately (Faz 1 criterion). */
export async function unpublishPage(
  storeId: string,
  pageId: string,
  locale: string,
  userId?: string,
): Promise<AdminResult<{ status: string }>> {
  const row = await prisma.pageLocale.findFirst({
    where: { locale, status: "published", page: { id: pageId, storeId } },
    select: { id: true },
  });
  if (!row) return fail("The page is not published in this language.", 404);
  await prisma.pageLocale.update({
    where: { id: row.id },
    data: { status: "unpublished", updatedById: userId },
  });
  invalidatePageRegistry(storeId);
  return { data: { status: "unpublished" } };
}

/* ------------------------------------------------------------------ revisions */

export type RevisionSummary = {
  id: string;
  note: string | null;
  createdAt: Date;
  authorId: string | null;
};

/** The revision list behind the editor's "Revisions" dropdown (rollback is Faz 4). */
export async function listRevisions(storeId: string, pageId: string, locale: string, limit = 20): Promise<RevisionSummary[]> {
  const page = await prisma.page.findFirst({
    where: { id: pageId, storeId },
    select: {
      locales: {
        where: { locale },
        select: {
          revisions: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: Math.min(Math.max(limit, 1), 50),
            select: { id: true, note: true, createdAt: true, authorId: true },
          },
        },
      },
    },
  });
  return page?.locales[0]?.revisions ?? [];
}
