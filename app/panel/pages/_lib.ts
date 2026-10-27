/** Serializable rows and labels for the builder pages list (plan 5.6). */

export type LocaleStatus = "draft" | "published" | "scheduled" | "unpublished";

export type PageLocaleRow = {
  locale: string;
  title: string;
  status: LocaleStatus;
  version: number;
  publishedAt: string | null;
  updatedByName: string | null;
  /** Signed preview link for this language's draft (lib/page-builder/preview-token.ts). */
  previewPath: string;
};

export type PageRow = {
  id: string;
  kind: string;
  slug: string;
  updatedAt: string;
  locales: PageLocaleRow[];
};

export function filterPages(rows: PageRow[], query: string, status: string): PageRow[] {
  const needle = query.trim().toLocaleLowerCase();
  return rows.filter((row) =>
    (status === "all" || row.locales.some((locale) => locale.status === status)) &&
    (!needle || `/${row.slug} ${row.locales.map((locale) => locale.title).join(" ")}`.toLocaleLowerCase().includes(needle)),
  ).sort((a, b) => Number(b.kind === "home") - Number(a.kind === "home"));
}

export const STATUS_LABELS: Record<LocaleStatus, string> = {
  draft: "Draft",
  published: "Published",
  scheduled: "Scheduled",
  unpublished: "Unpublished",
};

export const STATUS_BADGES: Record<LocaleStatus, string> = {
  draft: "wbadge wbadge-user",
  published: "wbadge wbadge-verified",
  scheduled: "wbadge wbadge-pending",
  unpublished: "wbadge wbadge-muted",
};
