import { legalReadiness, type LegalSettings } from "./legal-settings-shared";
/** Only local development may exercise registration while legal drafts are being completed. */
export function localRegistrationPreview() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.CREEM_MODE === "live"
  )
    return false;
  try {
    return ["localhost", "127.0.0.1"].includes(
      new URL(process.env.BETTER_AUTH_URL ?? "").hostname,
    );
  } catch {
    return false;
  }
}
export function accountRegistrationReady(legal: LegalSettings) {
  return !legalReadiness(legal).length || localRegistrationPreview();
}
export function googleAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}
