import { z } from "zod";
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupSummary } from "./backup-shared";
import { DEFAULT_ADMIN_ACCESS_SETTINGS, validateAdminAccessSettings } from "./admin-access-shared";

const text = z.string();
const id = text.min(1);
const integer = z.number().int().min(-2147483648).max(2147483647);
const date = z.iso.datetime({ offset: true }).pipe(z.coerce.date());
const timestamps = { createdAt: date, updatedAt: date };
const owned = { storeId: id };
const moderation = {
  id, authorName: text, authorEmail: text, body: text, status: text, locale: text,
  requestKey: id, moderatedAt: date.nullable(), createdAt: date,
};
const rows = <T extends z.ZodType>(schema: T) => z.array(schema).max(100_000);
// Seeded catalogue media lives under /assets; uploaded media uses an absolute storage URL.
const mediaUrl = z.union([z.httpUrl(), text.regex(/^\/(?!\/)[^\\\s]*$/)]);

export const backupSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  createdAt: z.iso.datetime({ offset: true }),
  // Identities only: used to reconnect authors and integrations by email on another installation.
  users: rows(z.strictObject({ id, email: z.email() })),
  data: z.strictObject({
    stores: rows(z.strictObject({ id, key: id, name: text, defaultLocale: text, locales: z.array(text), isDefault: z.boolean(), ...timestamps })),
    storeDomains: rows(z.strictObject({ id, host: id, storeId: id, primary: z.boolean(), createdAt: date })),
    storeSettings: rows(z.strictObject({ storeId: id, key: id, value: text, updatedAt: date })),
    productTypes: rows(z.strictObject({ id, key: id, name: text, pluralName: text, description: text.nullable(), listPath: text.nullable(), position: integer, ...timestamps })),
    products: rows(z.strictObject({
      id, ...owned, typeId: id, slug: id, name: text, summary: text, description: text, status: text,
      badge: text.nullable(), position: integer, category: text.nullable(), technologies: z.array(text),
      compliance: z.json().default({}), tagline: text.nullable(), intro: text.nullable(),
      highlights: z.array(text), compatibility: z.json(), ctaLabel: text.nullable(),
      ctaUrl: text.nullable(), demoUrl: text.nullable(), coverId: id.nullable(), ...timestamps,
    })),
    productGallery: rows(z.strictObject({ id, productId: id, assetId: id, position: integer })),
    changelog: rows(z.strictObject({ id, productId: id, version: text, title: text, releasedAt: date, changes: z.json(), ...timestamps })),
    media: rows(z.strictObject({
      id, ...owned, key: id, url: mediaUrl, fileName: text, fileSize: integer.nonnegative(), mimeType: text,
      alt: text.nullable(), width: integer.nullable(), height: integer.nullable(), uploadedById: id.nullable(), createdAt: date,
    })),
    posts: rows(z.strictObject({
      id, ...owned, title: text, slug: id, excerpt: text, content: text, coverId: id.nullable(), status: text,
      scheduledAt: date.nullable(), featured: z.boolean(), readingTime: integer,
      publishedAt: date.nullable(), authorId: id.nullable(), categoryId: id.nullable(), ...timestamps,
    })),
    categories: rows(z.strictObject({ id, ...owned, name: text, slug: id, description: text.nullable(), color: text, ...timestamps })),
    tags: rows(z.strictObject({ id, ...owned, name: text, slug: id, ...timestamps })),
    postTags: rows(z.strictObject({ postId: id, tagId: id })),
    comments: rows(z.strictObject({
      ...moderation, postId: id, parentId: id.nullable(), aiStatus: text, aiNote: text.nullable(),
      aiModel: text.nullable(), aiCheckedAt: date.nullable(), aiReviewToken: text.nullable(),
    })),
    reviews: rows(z.strictObject({ ...moderation, ...owned, productId: id, productSlug: text, rating: integer.min(1).max(5) })),
    inquiries: rows(z.strictObject({
      id, ...owned, name: text, email: text, agency: text, typo3Version: text, license: text, message: text,
      emailSent: z.boolean(), readAt: date.nullable(), archivedAt: date.nullable(), createdAt: date,
    })),
    subscribers: rows(z.strictObject({ id, ...owned, email: text, firstName: text, lastName: text, source: text, locale: text.default("en"), consentVersion: text.nullable().default(null), confirmedAt: date.nullable().default(null), unsubscribedAt: date.nullable().default(null), confirmationTokenHash: text.nullable().default(null), confirmationExpiresAt: date.nullable().default(null), confirmationSentAt: date.nullable().default(null), unsubscribeTokenHash: text.nullable().default(null), ...timestamps })),
    pageViews: rows(z.strictObject({ id, ...owned, date, slug: text, views: integer, updatedAt: date })),
    settings: rows(z.strictObject({ key: id, value: text, updatedAt: date })),
  }),
});

export type Backup = z.output<typeof backupSchema>;

export class BackupValidationError extends Error {}

function fail(message: string): never {
  throw new BackupValidationError(message);
}

function unique<T>(rows: T[], key: (row: T) => string, label: string) {
  const keys = new Set<string>();
  for (const row of rows) {
    const value = key(row);
    if (keys.has(value)) fail(`Duplicate ${label} in backup.`);
    keys.add(value);
  }
  return keys;
}

export function backupPanelPath(backup: Backup): string {
  const value = backup.data.settings.find((row) => row.key === "security.panelPath")?.value;
  if (value === undefined) return DEFAULT_ADMIN_ACCESS_SETTINGS.panelPath;
  let panelPath: unknown;
  try { panelPath = JSON.parse(value); } catch { return fail("Invalid panel address in backup."); }
  const result = validateAdminAccessSettings({ panelPath });
  if ("error" in result) fail("Invalid panel address in backup.");
  return result.data.panelPath;
}

export function parseBackup(input: unknown): Backup {
  const parsed = backupSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(`Invalid or unsupported backup (${issue.path.join(".") || "file"}). Use a version ${BACKUP_VERSION} CMSMotive backup.`);
  }
  const backup = parsed.data;
  const d = backup.data;
  const identities = unique(backup.users, (row) => row.id, "user ID");
  unique(backup.users, (row) => row.email.toLowerCase(), "user email");
  for (const [name, records] of Object.entries(d)) {
    if (name !== "settings" && name !== "postTags" && name !== "storeSettings") {
      unique(records as { id: string }[], (row) => row.id, `${name} ID`);
    }
  }
  // Slugs, media keys, subscribers and counters are unique within their store.
  for (const name of ["products", "posts", "categories", "tags"] as const) unique<{ storeId: string; slug: string }>(d[name], (row) => `${row.storeId}:${row.slug}`, `${name} slug`);
  unique(d.productTypes, (row) => row.key, "product type key");
  unique(d.media, (row) => `${row.storeId}:${row.key}`, "media key");
  unique(d.settings, (row) => row.key, "setting key");
  unique(d.storeSettings, (row) => `${row.storeId}:${row.key}`, "store setting key");
  unique(d.stores, (row) => row.key, "store key");
  unique(d.storeDomains, (row) => row.host, "store domain");
  if (d.settings.some((row) => !row.key.startsWith("security."))) fail("Only panel security settings are install-wide; other settings belong to a store.");
  unique(d.reviews, (row) => row.requestKey, "review request key");
  unique(d.comments, (row) => row.requestKey, "comment request key");
  unique(d.subscribers, (row) => `${row.storeId}:${row.email.toLowerCase()}:${row.source}`, "subscriber email/purpose");
  unique(d.postTags, (row) => JSON.stringify([row.postId, row.tagId]), "post tag link");
  unique(d.productGallery, (row) => JSON.stringify([row.productId, row.assetId]), "product gallery link");
  unique(d.pageViews, (row) => JSON.stringify([row.storeId, row.date.toISOString().slice(0, 10), row.slug]), "page view date and slug");

  const ids = (records: { id: string }[]) => new Set(records.map((row) => row.id));
  const productTypes = ids(d.productTypes), products = ids(d.products), media = ids(d.media);
  const posts = ids(d.posts), categories = ids(d.categories), tags = ids(d.tags);
  const reference = (set: Set<string>, value: string | null, label: string) => {
    if (value !== null && !set.has(value)) fail(`Missing ${label} reference in backup.`);
  };
  const stores = ids(d.stores);
  for (const name of ["products", "media", "posts", "categories", "tags", "reviews", "inquiries", "subscribers", "pageViews", "storeDomains", "storeSettings"] as const) {
    for (const row of d[name] as { storeId: string }[]) reference(stores, row.storeId, "store");
  }
  for (const product of d.products) {
    reference(productTypes, product.typeId, "product type");
    reference(media, product.coverId, "cover image");
  }
  for (const row of d.media) reference(identities, row.uploadedById, "uploader");
  for (const row of d.posts) {
    reference(media, row.coverId, "post cover");
    reference(categories, row.categoryId, "category");
    reference(identities, row.authorId, "author");
  }
  for (const row of d.productGallery) { reference(products, row.productId, "product"); reference(media, row.assetId, "gallery image"); }
  for (const row of d.changelog) reference(products, row.productId, "product");
  for (const row of d.reviews) reference(products, row.productId, "product");
  for (const row of d.postTags) { reference(posts, row.postId, "post"); reference(tags, row.tagId, "tag"); }
  const comments = new Map(d.comments.map((row) => [row.id, row]));
  const visited = new Set<string>();
  for (const row of d.comments) {
    reference(posts, row.postId, "comment post");
    const chain = new Set<string>();
    let current: typeof row | undefined = row;
    while (current && !visited.has(current.id)) {
      if (chain.has(current.id)) fail("Comment replies contain a cycle.");
      chain.add(current.id);
      if (current.parentId === null) break;
      const parent = comments.get(current.parentId);
      if (!parent || parent.postId !== current.postId) fail("Invalid comment parent in backup.");
      current = parent;
    }
    for (const key of chain) visited.add(key);
  }
  backupPanelPath(backup);
  for (const telegramLinks of d.storeSettings.filter((row) => row.key === "telegram.links")) {
    let links: unknown;
    try { links = JSON.parse(telegramLinks.value); } catch { fail("Invalid Telegram account links in backup."); }
    const result = z.array(z.object({
      userId: id, telegramUserId: z.number().int(), chatId: z.number().int(),
      username: text.nullable(), name: text, linkedAt: z.iso.datetime({ offset: true }),
    })).safeParse(links);
    if (!result.success) fail("Invalid Telegram account links in backup.");
    for (const link of result.data) reference(identities, link.userId, "Telegram administrator");
  }
  for (const row of d.storeSettings) {
    if (row.key === "mcp.actor.userId" && row.value) reference(identities, row.value, "MCP administrator");
  }
  return backup;
}

export function summarizeBackup(backup: Backup): BackupSummary {
  return {
    createdAt: backup.createdAt,
    counts: Object.fromEntries(Object.entries(backup.data).map(([key, records]) => [key, records.length])) as BackupSummary["counts"],
    panelPath: backupPanelPath(backup),
  };
}
