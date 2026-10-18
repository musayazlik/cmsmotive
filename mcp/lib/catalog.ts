import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import {
  EXTENSION_STATUSES,
  isExtensionStatus,
  isThemeStatus,
  readCompatibility,
  readLicences,
  THEME_INDUSTRIES,
  THEME_STATUSES,
  validateCore,
  validateDetail,
  validateLicences,
  validateListing,
  validatePosition,
  VERSION_TARGETS,
  type CompatibilityRow,
  type Licence,
} from "@/lib/catalog-guard";
import { ToolError } from "./result";

/**
 * Theme and extension rules mirrored from the admin API routes. Creation
 * validates the full payload; updates accept partial fields and merge them
 * with the stored record, so an agent can change a single field without
 * re-sending the whole product.
 */

export type CatalogInput = {
  name?: string;
  slug?: string;
  summary?: string;
  description?: string;
  status?: string;
  industry?: string;
  versionTarget?: string;
  price?: number | null;
  position?: number;
  tagline?: string;
  intro?: string;
  highlights?: string[];
  compatibility?: CompatibilityRow[];
  licences?: Licence[];
  ctaLabel?: string;
  ctaUrl?: string;
  demoUrl?: string;
  coverId?: string | null;
  galleryIds?: string[];
};

export type ThemeCreateInput = CatalogInput & {
  name: string;
  summary: string;
  description: string;
  industry: string;
  versionTarget: string;
};

export type ExtensionCreateInput = CatalogInput & {
  name: string;
  summary: string;
  description: string;
};

async function assertAssetsExist(ids: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return;
  const found = await prisma.mediaAsset.count({ where: { id: { in: unique } } });
  if (found !== unique.length) {
    throw new ToolError("One or more selected images could not be found.");
  }
}

async function ensureThemeSlugFree(slug: string, excludeId?: string): Promise<void> {
  const clash = await prisma.theme.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== excludeId) {
    throw new ToolError("A theme with this slug already exists.");
  }
}

async function ensureExtensionSlugFree(slug: string, excludeId?: string): Promise<void> {
  const clash = await prisma.extension.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== excludeId) {
    throw new ToolError("An extension with this slug already exists.");
  }
}

/* ------------------------------------------------------------------ themes */

export async function createTheme(input: ThemeCreateInput) {
  if (!(THEME_INDUSTRIES as readonly string[]).includes(input.industry)) {
    throw new ToolError(`Industry must be one of: ${THEME_INDUSTRIES.join(", ")}.`);
  }
  if (!(VERSION_TARGETS as readonly string[]).includes(input.versionTarget)) {
    throw new ToolError(`Version target must be one of: ${VERSION_TARGETS.join(", ")}.`);
  }
  const status = input.status ?? "concept";
  if (!isThemeStatus(status)) {
    throw new ToolError(`Status must be one of: ${THEME_STATUSES.join(", ")}.`);
  }

  const body: Record<string, unknown> = {
    ...input,
    slug: slugify(input.slug?.trim() || input.name),
    price: input.price ?? null,
    position: input.position ?? 0,
    tagline: input.tagline ?? "",
    intro: input.intro ?? "",
    highlights: input.highlights ?? [],
    compatibility: input.compatibility ?? [],
    licences: input.licences ?? [],
    ctaLabel: input.ctaLabel ?? "",
    ctaUrl: input.ctaUrl ?? "",
    demoUrl: input.demoUrl ?? "",
    coverId: input.coverId ?? null,
    galleryIds: input.galleryIds ?? [],
  };

  const core = validateCore(body);
  if ("error" in core) throw new ToolError(core.error);
  const listing = validateListing(body);
  if ("error" in listing) throw new ToolError(listing.error);
  const detail = validateDetail(body);
  if ("error" in detail) throw new ToolError(detail.error);
  const licences = validateLicences(body);
  if ("error" in licences) throw new ToolError(licences.error);

  await ensureThemeSlugFree(core.data.slug);
  await assertAssetsExist([core.data.coverId, ...core.data.galleryIds]);

  const theme = await prisma.theme.create({
    data: {
      name: core.data.name,
      slug: core.data.slug,
      summary: core.data.summary,
      description: core.data.description,
      industry: input.industry,
      versionTarget: input.versionTarget,
      status,
      price: listing.data.price,
      position: listing.data.position,
      ...detail.data,
      licences: licences.data,
      coverId: core.data.coverId,
      gallery: {
        create: core.data.galleryIds.map((assetId, position) => ({ assetId, position })),
      },
    },
    select: { id: true, slug: true, name: true, status: true },
  });
  return theme;
}

export async function updateTheme(id: string, input: CatalogInput) {
  const current = await prisma.theme.findUnique({
    where: { id },
    include: { gallery: { orderBy: { position: "asc" }, select: { assetId: true } } },
  });
  if (!current) throw new ToolError("Theme not found.");

  const slug =
    input.slug !== undefined
      ? input.slug.trim()
        ? slugify(input.slug)
        : current.slug
      : current.slug;

  const body: Record<string, unknown> = {
    name: input.name ?? current.name,
    slug,
    summary: input.summary ?? current.summary,
    description: input.description ?? current.description,
    price: input.price !== undefined ? input.price : current.price,
    position: input.position ?? current.position,
    tagline: input.tagline !== undefined ? input.tagline : (current.tagline ?? ""),
    intro: input.intro !== undefined ? input.intro : (current.intro ?? ""),
    highlights: input.highlights ?? current.highlights,
    compatibility: input.compatibility ?? readCompatibility(current.compatibility),
    licences: input.licences ?? readLicences(current.licences),
    ctaLabel: input.ctaLabel !== undefined ? input.ctaLabel : (current.ctaLabel ?? ""),
    ctaUrl: input.ctaUrl !== undefined ? input.ctaUrl : (current.ctaUrl ?? ""),
    demoUrl: input.demoUrl !== undefined ? input.demoUrl : (current.demoUrl ?? ""),
    coverId: input.coverId !== undefined ? input.coverId : current.coverId,
    galleryIds: input.galleryIds ?? current.gallery.map((entry) => entry.assetId),
  };

  const industry = input.industry ?? current.industry;
  if (!(THEME_INDUSTRIES as readonly string[]).includes(industry)) {
    throw new ToolError(`Industry must be one of: ${THEME_INDUSTRIES.join(", ")}.`);
  }
  const versionTarget = input.versionTarget ?? current.versionTarget;
  if (!(VERSION_TARGETS as readonly string[]).includes(versionTarget)) {
    throw new ToolError(`Version target must be one of: ${VERSION_TARGETS.join(", ")}.`);
  }
  const status = input.status ?? current.status;
  if (!isThemeStatus(status)) {
    throw new ToolError(`Status must be one of: ${THEME_STATUSES.join(", ")}.`);
  }

  const core = validateCore(body);
  if ("error" in core) throw new ToolError(core.error);
  const listing = validateListing(body);
  if ("error" in listing) throw new ToolError(listing.error);
  const detail = validateDetail(body);
  if ("error" in detail) throw new ToolError(detail.error);
  const licences = validateLicences(body);
  if ("error" in licences) throw new ToolError(licences.error);

  await ensureThemeSlugFree(core.data.slug, id);
  await assertAssetsExist([core.data.coverId, ...core.data.galleryIds]);

  const theme = await prisma.$transaction(async (tx) => {
    await tx.themeGallery.deleteMany({ where: { themeId: id } });
    return tx.theme.update({
      where: { id },
      data: {
        name: core.data.name,
        slug: core.data.slug,
        summary: core.data.summary,
        description: core.data.description,
        industry,
        versionTarget,
        status,
        price: listing.data.price,
        position: listing.data.position,
        ...detail.data,
        licences: licences.data,
        coverId: core.data.coverId,
        gallery: {
          create: core.data.galleryIds.map((assetId, position) => ({ assetId, position })),
        },
      },
      select: { id: true, slug: true, name: true, status: true, updatedAt: true },
    });
  });

  return { ...theme, updatedAt: theme.updatedAt.toISOString() };
}

export async function deleteThemeRecord(id: string): Promise<{ id: string; deleted: true }> {
  const existing = await prisma.theme.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ToolError("Theme not found.");
  await prisma.theme.delete({ where: { id } });
  return { id, deleted: true };
}

/* -------------------------------------------------------------- extensions */

export async function createExtension(input: ExtensionCreateInput) {
  const status = input.status ?? "concept";
  if (!isExtensionStatus(status)) {
    throw new ToolError(`Status must be one of: ${EXTENSION_STATUSES.join(", ")}.`);
  }

  const body: Record<string, unknown> = {
    ...input,
    slug: slugify(input.slug?.trim() || input.name),
    position: input.position ?? 0,
    tagline: input.tagline ?? "",
    intro: input.intro ?? "",
    highlights: input.highlights ?? [],
    compatibility: input.compatibility ?? [],
    ctaLabel: input.ctaLabel ?? "",
    ctaUrl: input.ctaUrl ?? "",
    demoUrl: input.demoUrl ?? "",
    coverId: input.coverId ?? null,
    galleryIds: input.galleryIds ?? [],
  };

  const core = validateCore(body);
  if ("error" in core) throw new ToolError(core.error);
  const position = validatePosition(body);
  if ("error" in position) throw new ToolError(position.error);
  const detail = validateDetail(body);
  if ("error" in detail) throw new ToolError(detail.error);

  await ensureExtensionSlugFree(core.data.slug);
  await assertAssetsExist([core.data.coverId, ...core.data.galleryIds]);

  const extension = await prisma.extension.create({
    data: {
      name: core.data.name,
      slug: core.data.slug,
      summary: core.data.summary,
      description: core.data.description,
      status,
      position: position.data,
      ...detail.data,
      coverId: core.data.coverId,
      gallery: {
        create: core.data.galleryIds.map((assetId, position) => ({ assetId, position })),
      },
    },
    select: { id: true, slug: true, name: true, status: true },
  });
  return extension;
}

export async function updateExtension(id: string, input: CatalogInput) {
  const current = await prisma.extension.findUnique({
    where: { id },
    include: { gallery: { orderBy: { position: "asc" }, select: { assetId: true } } },
  });
  if (!current) throw new ToolError("Extension not found.");

  const slug =
    input.slug !== undefined
      ? input.slug.trim()
        ? slugify(input.slug)
        : current.slug
      : current.slug;

  const body: Record<string, unknown> = {
    name: input.name ?? current.name,
    slug,
    summary: input.summary ?? current.summary,
    description: input.description ?? current.description,
    position: input.position ?? current.position,
    tagline: input.tagline !== undefined ? input.tagline : (current.tagline ?? ""),
    intro: input.intro !== undefined ? input.intro : (current.intro ?? ""),
    highlights: input.highlights ?? current.highlights,
    compatibility: input.compatibility ?? readCompatibility(current.compatibility),
    ctaLabel: input.ctaLabel !== undefined ? input.ctaLabel : (current.ctaLabel ?? ""),
    ctaUrl: input.ctaUrl !== undefined ? input.ctaUrl : (current.ctaUrl ?? ""),
    demoUrl: input.demoUrl !== undefined ? input.demoUrl : (current.demoUrl ?? ""),
    coverId: input.coverId !== undefined ? input.coverId : current.coverId,
    galleryIds: input.galleryIds ?? current.gallery.map((entry) => entry.assetId),
  };

  const status = input.status ?? current.status;
  if (!isExtensionStatus(status)) {
    throw new ToolError(`Status must be one of: ${EXTENSION_STATUSES.join(", ")}.`);
  }

  const core = validateCore(body);
  if ("error" in core) throw new ToolError(core.error);
  const position = validatePosition(body);
  if ("error" in position) throw new ToolError(position.error);
  const detail = validateDetail(body);
  if ("error" in detail) throw new ToolError(detail.error);

  await ensureExtensionSlugFree(core.data.slug, id);
  await assertAssetsExist([core.data.coverId, ...core.data.galleryIds]);

  const extension = await prisma.$transaction(async (tx) => {
    await tx.extensionGallery.deleteMany({ where: { extensionId: id } });
    return tx.extension.update({
      where: { id },
      data: {
        name: core.data.name,
        slug: core.data.slug,
        summary: core.data.summary,
        description: core.data.description,
        status,
        position: position.data,
        ...detail.data,
        coverId: core.data.coverId,
        gallery: {
          create: core.data.galleryIds.map((assetId, positionIndex) => ({
            assetId,
            position: positionIndex,
          })),
        },
      },
      select: { id: true, slug: true, name: true, status: true, updatedAt: true },
    });
  });

  return { ...extension, updatedAt: extension.updatedAt.toISOString() };
}

export async function deleteExtensionRecord(
  id: string,
): Promise<{ id: string; deleted: true }> {
  const existing = await prisma.extension.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ToolError("Extension not found.");
  await prisma.extension.delete({ where: { id } });
  return { id, deleted: true };
}
