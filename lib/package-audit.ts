import { constants, inflateRawSync } from "node:zlib";
import { isGplLicense } from "./code-license";

export { isGplLicense };

/**
 * Licence audit of a product package (ZIP) before customers can download it.
 *
 * Checks what open-source distribution needs and what TYPO3 requires of its
 * extensions (GPL-2.0-or-later, https://typo3.com/typo3-cms/what-is-typo3/open-source/licenses):
 *  - a licence file (LICENSE / COPYING) shipped with the code, GPL when the store requires it;
 *  - no obfuscated or encoded code (GPL requires the source in its preferred form);
 *  - licence or copyright headers at the top of source files;
 *  - bundled third-party code listed with its licence (a notices file), and no dependency
 *    whose licence cannot be combined with GPL code.
 * Errors block the upload; warnings are shown on the release so they can be fixed in the next one.
 *
 * Pure: takes the ZIP bytes, reads only the central directory and the few files it needs,
 * with size limits against ZIP bombs. Covers regular ZIP files (stored and deflate, no ZIP64).
 */

export type AuditIssue = { code: string; message: string; files?: string[] };
export type DependencyLicense = { name: string; license: string; source: string };

export type PackageAudit = {
  checkedAt: string;
  gplRequired: boolean;
  errors: AuditIssue[];
  warnings: AuditIssue[];
  licenseFile: string | null;
  licenseKind: LicenseKind | null;
  noticesFile: string | null;
  sourceFiles: number;
  dependencies: DependencyLicense[];
};

export type LicenseKind = "gpl-2.0" | "gpl-3.0" | "lgpl" | "agpl" | "mit" | "bsd" | "apache-2.0" | "mpl-2.0" | "other";

/* ------------------------------------------------------------------ ZIP reading */

type ZipEntry = { name: string; method: number; compressedSize: number; size: number; offset: number };

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_ENTRIES = 50_000;

/** The archive's file list from its central directory. Throws on anything that is not a readable ZIP. */
export function readZipEntries(zip: Buffer): ZipEntry[] {
  const floor = Math.max(0, zip.length - 22 - 0xffff);
  let end = -1;
  for (let at = zip.length - 22; at >= floor; at--) {
    if (zip.readUInt32LE(at) === EOCD) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error("not-a-zip");
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  if (count === 0xffff || at === 0xffffffff) throw new Error("zip64-unsupported");
  if (count > MAX_ENTRIES) throw new Error("too-many-entries");
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (at + 46 > zip.length || zip.readUInt32LE(at) !== CENTRAL) throw new Error("corrupt-zip");
    const method = zip.readUInt16LE(at + 10);
    const compressedSize = zip.readUInt32LE(at + 20);
    const size = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const offset = zip.readUInt32LE(at + 42);
    const name = zip.toString("utf8", at + 46, at + 46 + nameLength).replace(/\\/g, "/");
    entries.push({ name, method, compressedSize, size, offset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** The first `limit` bytes of one entry, or null when it cannot be read (encrypted, unknown method). */
function readEntry(zip: Buffer, entry: ZipEntry, limit: number): Buffer | null {
  if (entry.offset + 30 > zip.length || zip.readUInt32LE(entry.offset) !== LOCAL) return null;
  const flags = zip.readUInt16LE(entry.offset + 6);
  if (flags & 0x1) return null; // encrypted
  const start = entry.offset + 30 + zip.readUInt16LE(entry.offset + 26) + zip.readUInt16LE(entry.offset + 28);
  const data = zip.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data.subarray(0, limit);
  if (entry.method !== 8) return null;
  if (entry.size <= limit) {
    try {
      return inflateRawSync(data, { maxOutputLength: Math.max(1, limit) });
    } catch {
      return null;
    }
  }
  // Only the head is needed: inflate a growing prefix of the compressed data; the output is always capped.
  for (let take = Math.min(data.length, limit); take >= 64; take = Math.floor(take / 4)) {
    try {
      return inflateRawSync(data.subarray(0, take), { finishFlush: constants.Z_SYNC_FLUSH, maxOutputLength: limit });
    } catch {
      // Too much output for this prefix (highly compressible file); try a shorter one.
    }
  }
  return null;
}

/* ------------------------------------------------------------------ licences */

/** Classifies a licence text (LICENSE / COPYING file). */
export function licenseKindOf(text: string): LicenseKind {
  const head = text.slice(0, 4000);
  if (/GNU AFFERO GENERAL PUBLIC LICENSE/i.test(head)) return "agpl";
  if (/GNU LESSER GENERAL PUBLIC LICENSE|GNU LIBRARY GENERAL PUBLIC LICENSE/i.test(head)) return "lgpl";
  if (/GNU GENERAL PUBLIC LICENSE/i.test(head)) return /Version 3/i.test(head) ? "gpl-3.0" : "gpl-2.0";
  if (/Apache License[\s\S]{0,40}Version 2\.0/i.test(head)) return "apache-2.0";
  if (/Mozilla Public License[\s\S]{0,20}2\.0/i.test(head)) return "mpl-2.0";
  if (/Permission is hereby granted, free of charge/i.test(head)) return "mit";
  if (/Redistribution and use in source and binary forms/i.test(head)) return "bsd";
  return "other";
}

const isGplFamily = (kind: LicenseKind | null) => kind === "gpl-2.0" || kind === "gpl-3.0" || kind === "lgpl";

/** Dependency licences that may be combined with GPL code (SPDX ids, compared case-insensitively). */
const GPL_COMPATIBLE = [
  "MIT", "MIT-0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "ISC", "Apache-2.0", "Zlib", "Unlicense", "CC0-1.0", "WTFPL",
  "MPL-2.0", "Artistic-2.0", "BSL-1.0", "Python-2.0", "X11", "PostgreSQL",
];

/** Whether a dependency's licence expression allows combining it with GPL code. */
export function dependencyCompatible(license: string): boolean {
  const options = license.replace(/[()]/g, " ").split(/\s+OR\s+/i).map((part) => part.trim()).filter(Boolean);
  return options.some((option) => {
    // "A AND B" needs every part to be compatible.
    return option.split(/\s+AND\s+/i).every((part) => {
      const id = part.trim().replace(/\+$/, "");
      return isGplLicense(id) || GPL_COMPATIBLE.some((ok) => ok.toLowerCase() === id.toLowerCase());
    });
  });
}

/* ------------------------------------------------------------------ audit */

const SOURCE = /\.(php|phtml|inc|js|mjs|ts|tsx|jsx|vue|scss|sass|less|css|py|rb)$/i;
const HEADER_CHECKED = /\.(php|js|mjs|ts|tsx|jsx|vue|scss|sass|less)$/i;
const LICENSE_NAME = /^(LICEN[CS]E|COPYING)(\.(txt|md|rst))?$/i;
const NOTICE_NAME = /^(THIRD[-_ ]?PARTY([-_ ](NOTICES?|LICEN[CS]ES?))?|NOTICES?|CREDITS|ATTRIBUTIONS?)(\.(txt|md|rst|json))?$/i;
const BUNDLED = /(^|\/)(vendor|node_modules|Contrib|contrib|third[-_]?party|libs?)\//;
const HEADER = /copyright|licen[cs]e|SPDX-License-Identifier|This file is part of|General Public License|\(c\)\s*\d{4}|©/i;
const OBFUSCATION: [RegExp, string][] = [
  [/ionCube Loader|<\?php\s*\/\/0[0-9a-f]{2,}/i, "ionCube"],
  [/sg_load\s*\(|SourceGuardian/i, "SourceGuardian"],
  [/Zend Guard|@Zend;/i, "Zend Guard"],
  [/eval\s*\(\s*(base64_decode|gzinflate|gzuncompress|gzdecode|str_rot13|strrev)\s*\(/i, "encoded eval()"],
];
const MINIFIED = /\.min\.(js|css)$/i;

const HEAD_BYTES = 4 * 1024;
const SCAN_BYTES = 64 * 1024;
const META_BYTES = 2 * 1024 * 1024;
/** Upper bound of uncompressed bytes the audit reads in total. */
const BUDGET = 96 * 1024 * 1024;
const SAMPLE = 10;

const sample = (files: string[]) => files.slice(0, SAMPLE);
const baseName = (path: string) => path.split("/").pop() ?? path;

function parseJson(buffer: Buffer | null): unknown {
  if (!buffer) return null;
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    return null;
  }
}

const licenseOf = (value: unknown) =>
  Array.isArray(value) ? value.filter((item) => typeof item === "string").join(" OR ") : typeof value === "string" ? value : "";

/** Licences of bundled packages from Composer and npm metadata found in the archive. */
function collectDependencies(entries: ZipEntry[], read: (entry: ZipEntry, limit: number) => Buffer | null): DependencyLicense[] {
  const found = new Map<string, DependencyLicense>();
  const add = (name: unknown, license: unknown, source: string) => {
    if (typeof name !== "string" || !name || found.has(name)) return;
    found.set(name, { name, license: licenseOf(license) || "unknown", source });
  };
  for (const entry of entries) {
    const name = baseName(entry.name);
    if (name === "installed.json" && entry.name.includes("vendor/composer/")) {
      const data = parseJson(read(entry, META_BYTES)) as { packages?: unknown[] } | unknown[] | null;
      const packages = Array.isArray(data) ? data : Array.isArray(data?.packages) ? data.packages : [];
      for (const item of packages as { name?: unknown; license?: unknown }[]) add(item?.name, item?.license, entry.name);
    } else if (name === "composer.lock") {
      const data = parseJson(read(entry, META_BYTES)) as { packages?: { name?: unknown; license?: unknown }[] } | null;
      for (const item of data?.packages ?? []) add(item?.name, item?.license, entry.name);
    } else if (name === "package.json" && /(^|\/)node_modules\/(@[^/]+\/)?[^/]+\/package\.json$/.test(entry.name)) {
      const data = parseJson(read(entry, 256 * 1024)) as { name?: unknown; license?: unknown } | null;
      add(data?.name, data?.license, entry.name);
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Audits a package. `gplRequired` (Settings → Legal of the store) makes the GPL
 * rules errors; without it the same findings are warnings, except a missing
 * licence file, which every package needs.
 */
export function auditPackage(zip: Buffer, options: { gplRequired: boolean; declaredLicense?: string }): PackageAudit {
  const errors: AuditIssue[] = [];
  const warnings: AuditIssue[] = [];
  const gpl = options.gplRequired;
  const strict = (issue: AuditIssue) => (gpl ? errors : warnings).push(issue);

  let entries: ZipEntry[];
  try {
    entries = readZipEntries(zip).filter((entry) => !entry.name.endsWith("/") && !entry.name.startsWith("__MACOSX/") && !baseName(entry.name).startsWith("._"));
  } catch (error) {
    const code = error instanceof Error ? error.message : "corrupt-zip";
    errors.push({ code: "unreadable", message: code === "zip64-unsupported" ? "The ZIP uses the ZIP64 format; save it as a regular ZIP (under 4 GB)." : "The file is not a readable ZIP archive." });
    return { checkedAt: new Date().toISOString(), gplRequired: gpl, errors, warnings, licenseFile: null, licenseKind: null, noticesFile: null, sourceFiles: 0, dependencies: [] };
  }

  let budget = BUDGET;
  const read = (entry: ZipEntry, limit: number) => {
    if (budget <= 0) return null;
    const data = readEntry(zip, entry, Math.min(limit, budget));
    if (data) budget -= data.length;
    return data;
  };

  // A package is either the extension folder's content or one folder holding it.
  const tops = new Set(entries.map((entry) => entry.name.split("/")[0]));
  const root = tops.size === 1 && entries.every((entry) => entry.name.includes("/")) ? `${[...tops][0]}/` : "";
  const relative = (path: string) => (root && path.startsWith(root) ? path.slice(root.length) : path);
  const atRoot = (entry: ZipEntry) => !relative(entry.name).includes("/");

  // Licence file
  const licenseEntry = entries.find((entry) => atRoot(entry) && LICENSE_NAME.test(baseName(entry.name)));
  const licenseText = licenseEntry ? read(licenseEntry, SCAN_BYTES)?.toString("utf8") ?? "" : "";
  const licenseKind = licenseEntry ? licenseKindOf(licenseText) : null;
  if (!licenseEntry) {
    errors.push({ code: "license-missing", message: "Add the licence text as LICENSE or COPYING at the top of the package (for TYPO3 code: the GPL-2.0 text)." });
  } else if (gpl && !isGplFamily(licenseKind)) {
    errors.push({ code: "license-not-gpl", message: `${relative(licenseEntry.name)} is not a GNU GPL licence text. TYPO3 extensions are distributed under GPL-2.0-or-later.`, files: [relative(licenseEntry.name)] });
  }
  if (licenseEntry && options.declaredLicense && isGplLicense(options.declaredLicense) !== isGplFamily(licenseKind)) {
    warnings.push({ code: "license-mismatch", message: `The package checklist says “${options.declaredLicense}” but ${relative(licenseEntry.name)} contains a different licence.` });
  }

  // composer.json licence field
  const composer = entries.find((entry) => relative(entry.name) === "composer.json");
  if (composer) {
    const declared = licenseOf((parseJson(read(composer, META_BYTES)) as { license?: unknown } | null)?.license);
    if (!declared) warnings.push({ code: "composer-license-missing", message: "composer.json has no \"license\" field; use \"GPL-2.0-or-later\" for TYPO3 extensions." });
    else if (gpl && !isGplLicense(declared)) warnings.push({ code: "composer-license", message: `composer.json declares “${declared}”; TYPO3 extensions should declare GPL-2.0-or-later.` });
  }

  // Own source files: headers, obfuscation, minified bundles without their source
  const own = entries.filter((entry) => SOURCE.test(entry.name) && !BUNDLED.test(relative(entry.name)));
  const withoutHeader: string[] = [];
  const obfuscated: string[] = [];
  const kinds = new Set<string>();
  for (const entry of own) {
    const checkHeader = HEADER_CHECKED.test(entry.name) && !MINIFIED.test(entry.name) && baseName(entry.name) !== "ext_emconf.php";
    const isPhp = /\.(php|phtml|inc)$/i.test(entry.name);
    if (!checkHeader && !isPhp) continue;
    const text = read(entry, isPhp ? SCAN_BYTES : HEAD_BYTES)?.toString("latin1");
    if (text === undefined) continue;
    if (checkHeader && !HEADER.test(text.slice(0, HEAD_BYTES))) withoutHeader.push(relative(entry.name));
    if (isPhp) {
      const match = OBFUSCATION.find(([pattern]) => pattern.test(text));
      if (match) {
        obfuscated.push(relative(entry.name));
        kinds.add(match[1]);
      }
    }
  }
  if (obfuscated.length) {
    strict({
      code: "obfuscated",
      message: `${obfuscated.length} file(s) look encoded or obfuscated (${[...kinds].join(", ")}). GPL code must be shipped as readable source.`,
      files: sample(obfuscated),
    });
  }
  if (withoutHeader.length) {
    warnings.push({
      code: "headers",
      message: `${withoutHeader.length} of ${own.filter((entry) => HEADER_CHECKED.test(entry.name) && !MINIFIED.test(entry.name)).length} source files have no copyright or licence header in their first lines.`,
      files: sample(withoutHeader),
    });
  }
  const names = new Set(entries.map((entry) => relative(entry.name).toLowerCase()));
  const minifiedAlone = own
    .filter((entry) => MINIFIED.test(entry.name))
    .map((entry) => relative(entry.name))
    .filter((path) => !names.has(path.toLowerCase().replace(/\.min\.(js|css)$/, ".$1")));
  if (minifiedAlone.length && !entries.some((entry) => /\.(scss|sass|less|ts|tsx)$/i.test(entry.name) || /(^|\/)(src|Build|Sources?)\//.test(relative(entry.name)))) {
    warnings.push({
      code: "minified-without-source",
      message: `${minifiedAlone.length} minified file(s) ship without their source. Under the GPL, include the unminified files or the build sources.`,
      files: sample(minifiedAlone),
    });
  }

  // Third-party code
  const noticesEntry = entries.find((entry) => atRoot(entry) && NOTICE_NAME.test(baseName(entry.name))) ??
    entries.find((entry) => /^LICENSES\//i.test(relative(entry.name)));
  const bundled = entries.filter((entry) => BUNDLED.test(relative(entry.name)));
  const dependencies = collectDependencies(entries, read);
  if ((bundled.length || dependencies.length) && !noticesEntry) {
    warnings.push({
      code: "notices-missing",
      message: "The package bundles third-party code but has no notices file. Add THIRD-PARTY-NOTICES (name, version, licence and copyright of each library).",
      files: sample([...new Set(bundled.map((entry) => relative(entry.name).split("/").slice(0, 2).join("/")))]),
    });
  }
  const incompatible = dependencies.filter((dependency) => !dependencyCompatible(dependency.license));
  if (gpl && incompatible.length) {
    warnings.push({
      code: "dependency-license",
      message: `${incompatible.length} bundled package(s) have a licence that may not be combinable with GPL code. Check them before release.`,
      files: sample(incompatible.map((dependency) => `${dependency.name} (${dependency.license})`)),
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    gplRequired: gpl,
    errors,
    warnings,
    licenseFile: licenseEntry ? relative(licenseEntry.name) : null,
    licenseKind,
    noticesFile: noticesEntry ? relative(noticesEntry.name) : null,
    sourceFiles: own.length,
    dependencies,
  };
}

/** Reads a stored audit (ProductRelease.audit) back, or null for releases uploaded before audits existed. */
export function readAudit(value: unknown): PackageAudit | null {
  if (!value || typeof value !== "object") return null;
  const audit = value as Partial<PackageAudit>;
  return Array.isArray(audit.errors) && Array.isArray(audit.warnings) ? (audit as PackageAudit) : null;
}

/** One sentence for an upload that was refused, listing what to fix. */
export function auditFailureMessage(audit: PackageAudit): string {
  return `The package did not pass the licence check: ${audit.errors.map((issue) => issue.message).join(" ")}`;
}
