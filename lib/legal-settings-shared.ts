export const LEGAL_VERSION = "2026-10-24";
/** Each store's own values come from its seed (prisma/seeds/<store>) and the panel. */
export const DEFAULT_LEGAL_SETTINGS = {
  legalName: "",
  address: "",
  country: "",
  representative: "",
  registerDetails: "",
  vatId: "",
  contactEmail: "",
  privacyEmail: "",
  audience: "both",
  hostDetails: "",
  retentionDetails: "",
  transferDetails: "",
  supervisoryAuthority: "",
  membershipDetails: "",
  termsVersion: LEGAL_VERSION,
  privacyVersion: LEGAL_VERSION,
  accountTermsReviewed: false,
  privacyReviewed: false,
  salesTermsReviewed: false,
};
export type LegalSettings = typeof DEFAULT_LEGAL_SETTINGS;

export function legalReadiness(s: LegalSettings) {
  const missing: string[] = [];
  for (const [key, label] of [
    ["legalName", "Legal name"],
    ["address", "Postal address"],
    ["country", "Seller country"],
    ["contactEmail", "Contact email"],
    ["privacyEmail", "Privacy contact"],
    ["hostDetails", "Hosting provider and region"],
    ["retentionDetails", "Retention schedule"],
    ["transferDetails", "Processors and international transfers"],
    ["supervisoryAuthority", "Supervisory authority"],
  ] as const) {
    if (!s[key].trim()) missing.push(label);
  }
  if (!s.privacyReviewed) missing.push("Reviewed privacy information");
  if (!s.accountTermsReviewed) missing.push("Reviewed account terms");
  return missing;
}

export function validateLegalSettings(
  input: Record<string, unknown>,
): { data: LegalSettings } | { error: string } {
  const data = { ...DEFAULT_LEGAL_SETTINGS };
  for (const key of Object.keys(data) as (keyof LegalSettings)[]) {
    if (typeof data[key] === "boolean") {
      if (typeof input[key] !== "boolean") return { error: `Invalid ${key}.` };
      Object.assign(data, { [key]: input[key] });
    } else {
      if (
        typeof input[key] !== "string" ||
        (input[key] as string).length > 3000
      )
        return { error: `Invalid ${key}.` };
      Object.assign(data, { [key]: (input[key] as string).trim() });
    }
  }
  if (!["undecided", "b2b", "b2c", "both"].includes(data.audience))
    return { error: "Choose the customer audience." };
  for (const key of ["contactEmail", "privacyEmail"] as const) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[key]) || data[key].length > 254)
      return { error: `Enter a valid ${key}.` };
  }
  if (
    ![data.termsVersion, data.privacyVersion].every((v) =>
      /^[\w.-]{1,40}$/.test(v),
    )
  )
    return {
      error:
        "Document versions must use 1–40 letters, numbers, dots or hyphens.",
    };
  if (
    (data.accountTermsReviewed || data.privacyReviewed) &&
    (!data.legalName || !data.address || !data.country)
  )
    return {
      error: "Complete the seller identity before marking documents reviewed.",
    };
  if (
    data.salesTermsReviewed &&
    (legalReadiness(data).length || data.audience === "undecided")
  )
    return {
      error:
        "Complete and review the legal information and customer audience first.",
    };
  return { data };
}
