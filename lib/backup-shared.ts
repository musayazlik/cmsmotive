/** Public backup contract. Keep database credentials and authentication tables out of this format. */
export const BACKUP_FORMAT = "cmsmotive.backup";
/** 2: every row belongs to a store; stores, their domains and per-store settings are included. */
export const BACKUP_VERSION = 2;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export const BACKUP_TABLE_LABELS = {
  stores: "Stores",
  storeDomains: "Store domains",
  storeSettings: "Store settings",
  themes: "Themes",
  extensions: "Extensions",
  themeGallery: "Theme gallery images",
  extensionGallery: "Extension gallery images",
  changelog: "Changelog entries",
  posts: "Blog posts",
  categories: "Categories",
  tags: "Tags",
  postTags: "Post tag links",
  comments: "Blog comments",
  reviews: "Product reviews",
  media: "Media records",
  inquiries: "Contact messages",
  subscribers: "Newsletter subscribers",
  pageViews: "Daily page views",
  settings: "Panel security settings",
} as const;

export type BackupSummary = {
  createdAt: string;
  counts: Record<keyof typeof BACKUP_TABLE_LABELS, number>;
  panelPath: string;
};
