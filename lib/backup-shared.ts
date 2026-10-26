/** Public backup contract. Keep database credentials and authentication tables out of this format. */
export const BACKUP_FORMAT = "cmsmotive.backup";
/** 4: a product belongs to one store (no store listings), with draft/preview/published, a badge and its own sort order. */
export const BACKUP_VERSION = 4;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export const BACKUP_TABLE_LABELS = {
  stores: "Stores",
  storeDomains: "Store domains",
  storeSettings: "Store settings",
  productTypes: "Product types",
  products: "Products",
  productGallery: "Product gallery images",
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
  pages: "Builder pages",
  pageLocales: "Builder page languages",
  pageRevisions: "Builder page revisions",
  pageRedirects: "Builder page redirects",
  pageSnippets: "Builder page snippets",
} as const;

export type BackupSummary = {
  createdAt: string;
  counts: Record<keyof typeof BACKUP_TABLE_LABELS, number>;
  panelPath: string;
};
