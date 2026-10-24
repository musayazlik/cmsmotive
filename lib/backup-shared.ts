/** Public backup contract. Keep database credentials and authentication tables out of this format. */
export const BACKUP_FORMAT = "cmsmotive.backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export const BACKUP_TABLE_LABELS = {
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
  settings: "Panel settings",
} as const;

export type BackupSummary = {
  createdAt: string;
  counts: Record<keyof typeof BACKUP_TABLE_LABELS, number>;
  panelPath: string;
};
