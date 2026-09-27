/**
 * Shared types and formatters for the contact inbox. The page hands the
 * client the full row list (newest first) so search and the inbox/archived
 * tabs filter without further server round trips.
 */

export type InquiryRow = {
  id: string;
  name: string;
  email: string;
  agency: string;
  typo3Version: string;
  license: string;
  message: string;
  emailSent: boolean;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export function formatInquiryDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
