import { getLegalSettings } from "./legal";
import { legalReadiness } from "./legal-settings-shared";
import {
  publicationMissing,
  type ProductCompliance,
} from "./product-compliance";
export async function publicationError(
  status: unknown,
  name: string,
  data: ProductCompliance,
) {
  if (status !== "published") return null;
  const legal = await getLegalSettings();
  const missing = [...legalReadiness(legal), ...publicationMissing(data)];
  if (!legal.salesTermsReviewed) missing.push("Sales terms review");
  if (/\bTYPO3\b/i.test(name))
    missing.push(
      "Use your own product name; describe TYPO3 compatibility separately",
    );
  return missing.length
    ? `Before publishing, complete: ${missing.join(", ")}.`
    : null;
}
