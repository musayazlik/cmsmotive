import type { ChangeKind } from "@/lib/catalog-guard";
import type { SelectOption } from "../_components/ui";

/** A changelog entry as the edit page loads it. `product` is the product's id. */
export type ChangelogRecord = {
  id: string;
  product: string;
  version: string;
  title: string;
  /** YYYY-MM-DD, the DatePicker format. */
  releasedAt: string;
  changes: { kind: ChangeKind; text: string }[];
  createdAt: string;
  updatedAt: string;
};

export type ProductOption = SelectOption;

export const CHANGE_LABELS: Record<ChangeKind, string> = { new: "New", improved: "Improved", fixed: "Fixed" };
