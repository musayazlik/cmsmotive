export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const THEME_STATUSES = ["concept", "in-development", "published"] as const;
export const EXTENSION_STATUSES = ["concept", "planning", "in-development", "published"] as const;

export const THEME_INDUSTRIES = [
  "Architecture & corporate",
  "Agency starter",
  "Education & public",
  "Other",
] as const;

export const VERSION_TARGETS = ["TYPO3 13", "TYPO3 14", "TYPO3 13 / 14", "Not decided"] as const;

export const MAX_GALLERY = 12;

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
