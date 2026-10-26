/**
 * Code licence rules shared by the panel (client-safe) and the upload routes.
 * A store that sells GPL code (Settings → Legal → GPL code) accepts only GPL
 * licences for its products; TYPO3 itself requires GPL-2.0-or-later.
 */

export const RECOMMENDED_GPL_LICENSE = "GPL-2.0-or-later";

/** Whether a declared licence (SPDX id or name) is a GPL licence TYPO3 code may be distributed under. */
export function isGplLicense(declared: string): boolean {
  const value = declared.trim();
  if (/AGPL|Affero/i.test(value)) return false;
  return /^(L?GPL)(-|v|\s|$)/i.test(value) || /GNU (Lesser )?General Public License/i.test(value);
}

/** Why a product's code licence cannot be used in its store, or null when it can. */
export function codeLicenseProblem(license: string, gplRequired: boolean): string | null {
  if (!license.trim()) return "Set the code license in the package checklist first.";
  if (gplRequired && !isGplLicense(license))
    return `This store sells GPL code: set the code license to ${RECOMMENDED_GPL_LICENSE} (currently “${license.trim()}”).`;
  return null;
}
