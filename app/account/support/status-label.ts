import type { Locale } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";

/** Customer-facing wording of a request's status: whose turn it is. */
export function supportStatusLabel(status: string, l: Locale) {
  if (status === "answered") return copy(l, "Answered", "Beantwortet", "Yanıtlandı");
  if (status === "closed") return copy(l, "Closed", "Geschlossen", "Kapandı");
  return copy(l, "Waiting for us", "Wartet auf uns", "Bizden yanıt bekleniyor");
}
