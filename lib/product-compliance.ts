export const DEFAULT_COMPLIANCE = {
  codeLicense: "",
  noticesUrl: "",
  releaseVersion: "",
  testedVersions: "",
  serviceScope: "",
  reviewed: false,
};
export type ProductCompliance = typeof DEFAULT_COMPLIANCE;
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
  // Each product names its own licence (GPL for TYPO3 packages, a commercial
  // licence for a CMS or starter kit); the code licence only has to be set.
  return missing;
}
