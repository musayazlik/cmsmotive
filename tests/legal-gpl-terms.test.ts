import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCALES } from "../lib/i18n/config";
import { legalSections } from "../lib/legal-copy";
import { DEFAULT_LEGAL_SETTINGS } from "../lib/legal-settings-shared";

/**
 * GPL code may not carry extra restrictions (GPLv2 §6, GPLv3 §10). The sales terms
 * must keep saying so, and no wording may creep in that forbids using the code on
 * more sites, changing it or passing it on.
 */
const text = (l: (typeof LOCALES)[number]) => JSON.stringify(legalSections("terms", l, DEFAULT_LEGAL_SETTINGS));

const FORBIDDING = [
  /(may|must) not\s+(be\s+)?(redistribut|modif|resell|re-sell|share|copy|pass)/i,
  /(prohibited|forbidden|not permitted)[^.]{0,60}(redistribut|modif|resale|shar|cop)/i,
  /(Weitergabe|Veränderung|Bearbeitung|Weiterverkauf)[^.]{0,60}(untersagt|verboten|nicht gestattet|nicht erlaubt)/i,
  /(nicht|keine)[^.]{0,30}(weitergegeben|verändert|weiterverkauft) werden (darf|dürfen)/i,
  // About the code, not e.g. "sharing unlawful content is prohibited" in the account rules.
  /(kod|yazılım|ürün|paket)[^.]{0,60}(yeniden dağıt|değiştir|yeniden sat|paylaş)[^.]{0,40}(yasak|izin verilmez|edilemez|yapılamaz)/i,
];

test("the sales terms guarantee GPL rights in every language", () => {
  const promises: Record<string, RegExp[]> = {
    en: [/GNU General Public License/, /modified and redistributed/, /nothing in these terms restricts those rights/, /source code is part of the package/],
    de: [/GNU General Public License/, /verändert und unter dieser Lizenz weitergegeben/, /schränken diese Rechte nicht ein/, /Quellcode ist Teil des Pakets/],
    tr: [/GPL/, /değiştirilebilir ve yeniden dağıtılabilir/, /hakları kısıtlamaz/, /kaynak kod paketin parçasıdır/],
  };
  for (const l of LOCALES) for (const pattern of promises[l]) assert.match(text(l), pattern, `${l}: ${pattern}`);
});

test("no legal text forbids redistributing, changing or reselling the code", () => {
  for (const slug of ["terms", "privacy", "imprint", "cookies"] as const)
    for (const l of LOCALES) {
      const body = JSON.stringify(legalSections(slug, l, DEFAULT_LEGAL_SETTINGS));
      for (const pattern of FORBIDDING) assert.doesNotMatch(body, pattern, `${slug}/${l}: ${pattern}`);
    }
});
