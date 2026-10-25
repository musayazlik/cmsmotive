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
  if (
    data.codeLicense &&
    !["GPL-2.0-or-later", "GPL-3.0-or-later"].includes(data.codeLicense)
  )
    missing.push("GPL-compatible code license for the TYPO3 package");
  return missing;
}
