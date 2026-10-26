export const DEFAULT_COMPLIANCE = {
  codeLicense: "",
  noticesUrl: "",
  releaseVersion: "",
  testedVersions: "",
  serviceScope: "",
  reviewed: false,
};
export type ProductCompliance = typeof DEFAULT_COMPLIANCE;
export const COMPLIANCE_LABELS: Record<keyof ProductCompliance, string> = {
  codeLicense: "Code license",
  noticesUrl: "License and third-party notices URL",
  releaseVersion: "Release version",
  testedVersions: "Tested platform and runtime versions",
  serviceScope: "Support scope and included services",
  reviewed: "Package, compatibility, rights and service review",
};
export function readCompliance(value: unknown): ProductCompliance {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_COMPLIANCE).map(([key, fallback]) => [
      key,
      typeof raw[key] === typeof fallback ? raw[key] : fallback,
    ]),
  ) as ProductCompliance;
}
export function validateCompliance(
  input: unknown,
): { data: ProductCompliance } | { error: string } {
  const data = readCompliance(input);
  if (
    Object.entries(data).some(
      ([, v]) => typeof v === "string" && v.length > 2000,
    )
  )
    return {
      error: "Release checklist fields must be at most 2,000 characters.",
    };
  if (
    data.noticesUrl &&
    !/^(https:\/\/[^\s]+|\/(?!\/)[^\s]*)$/.test(data.noticesUrl)
  )
    return { error: "Notices must use an HTTPS URL or a site path." };
  return { data };
}
export function publicationMissing(data: ProductCompliance) {
  const missing = Object.entries(data)
    .filter(([, v]) => !v)
    .map(([key]) => key);
  // Each product names its own licence (open source or commercial); the code
  // licence only has to be set.
  return missing;
}

export function publicationMissingLabels(data: ProductCompliance) {
  return publicationMissing(data).map((key) => COMPLIANCE_LABELS[key as keyof ProductCompliance]);
}

/** The plain-text delivery note buyers see in their account (Product.deliveryNote). */
export const DELIVERY_NOTE_LIMIT = 2000;
