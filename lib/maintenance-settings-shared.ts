/**
 * Client-safe contract for Settings → Maintenance: whether the public pages
 * should serve the maintenance page instead of their content, and the copy on
 * that page. Panel routes, auth flows and APIs are never affected.
 */

export type MaintenanceSettings = {
  /** On = every public page serves the maintenance page with HTTP 503. */
  enabled: boolean;
  /** The big heading on the maintenance page. */
  title: string;
  /** The paragraph under the heading. */
  message: string;
};

export const DEFAULT_MAINTENANCE_TITLE = "We’ll be right back.";
export const DEFAULT_MAINTENANCE_MESSAGE =
  "The site is being worked on right now. Everything is safe — we expect to be live again shortly.";

export const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  enabled: false,
  title: DEFAULT_MAINTENANCE_TITLE,
  message: DEFAULT_MAINTENANCE_MESSAGE,
};

export const MAINTENANCE_LIMITS = { title: 80, message: 400 } as const;

export function validateMaintenanceSettings(input: Record<string, unknown>): { error: string } | { data: MaintenanceSettings } {
  if (typeof input.enabled !== "boolean") return { error: "Invalid maintenance settings." };

  const title = (typeof input.title === "string" ? input.title : "")
    .replace(/[\r\n]+/g, " ")
    .trim();
  if (title.length > MAINTENANCE_LIMITS.title) {
    return { error: `The heading can be at most ${MAINTENANCE_LIMITS.title} characters.` };
  }

  const message = (typeof input.message === "string" ? input.message : "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (message.length > MAINTENANCE_LIMITS.message) {
    return { error: `The message can be at most ${MAINTENANCE_LIMITS.message} characters.` };
  }

  return { data: { enabled: input.enabled, title: title || DEFAULT_MAINTENANCE_TITLE, message: message || DEFAULT_MAINTENANCE_MESSAGE } };
}
