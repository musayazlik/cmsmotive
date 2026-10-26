import assert from "node:assert/strict";
import { test } from "node:test";
import { crc32, deflateRawSync } from "node:zlib";
import { auditPackage, dependencyCompatible, isGplLicense, licenseKindOf, readZipEntries } from "../lib/package-audit";

/** A minimal ZIP writer (deflate) for fixtures. */
function zip(files: Record<string, string | Buffer>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const data = deflateRawSync(raw);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const GPL2 = "GNU GENERAL PUBLIC LICENSE\n Version 2, June 1991\n\n Copyright (C) 1989, 1991 Free Software Foundation, Inc.";
const MIT = "MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy";
const HEADER = "<?php\n\n/*\n * This file is part of the \"aurelia\" extension for TYPO3 CMS.\n * GPL-2.0-or-later\n */\n";

test("a clean TYPO3 extension passes, also when wrapped in one folder", () => {
  for (const prefix of ["", "aurelia/"]) {
    const audit = auditPackage(
      zip({
        [`${prefix}LICENSE.txt`]: GPL2,
        [`${prefix}composer.json`]: JSON.stringify({ name: "cmsmotive/aurelia", license: "GPL-2.0-or-later" }),
        [`${prefix}ext_emconf.php`]: "<?php $EM_CONF[$_EXTKEY] = [];",
        [`${prefix}Classes/Controller/PageController.php`]: `${HEADER}final class PageController {}`,
        [`${prefix}Resources/Public/JavaScript/main.js`]: "/* (c) 2026 CMSMotive, GPL-2.0-or-later */ console.log(1);",
      }),
      { gplRequired: true, declaredLicense: "GPL-2.0-or-later" },
    );
    assert.deepEqual(audit.errors, [], prefix);
    assert.deepEqual(audit.warnings, [], prefix);
    assert.equal(audit.licenseFile, "LICENSE.txt");
    assert.equal(audit.licenseKind, "gpl-2.0");
    assert.equal(audit.sourceFiles, 3);
  }
});

test("a missing licence file blocks every package; a non-GPL one blocks only where GPL is required", () => {
  const missing = auditPackage(zip({ "Classes/A.php": `${HEADER}class A {}` }), { gplRequired: false });
  assert.deepEqual(missing.errors.map((issue) => issue.code), ["license-missing"]);

  const mit = zip({ LICENSE: MIT, "Classes/A.php": `${HEADER}class A {}` });
  assert.deepEqual(auditPackage(mit, { gplRequired: true }).errors.map((issue) => issue.code), ["license-not-gpl"]);
  assert.deepEqual(auditPackage(mit, { gplRequired: false }).errors, []);
  assert.deepEqual(auditPackage(mit, { gplRequired: false, declaredLicense: "GPL-2.0-or-later" }).warnings.map((issue) => issue.code), ["license-mismatch"]);
});

test("encoded PHP blocks a GPL store and is a warning elsewhere", () => {
  const encoded = zip({
    LICENSE: GPL2,
    "Classes/Loader.php": "<?php //0046a\nif(!extension_loaded('ionCube Loader')){die();}",
    "Classes/Eval.php": `${HEADER}eval(base64_decode('ZWNobyAxOw=='));`,
  });
  const strict = auditPackage(encoded, { gplRequired: true });
  assert.deepEqual(strict.errors.map((issue) => issue.code), ["obfuscated"]);
  assert.deepEqual(strict.errors[0].files?.sort(), ["Classes/Eval.php", "Classes/Loader.php"]);
  assert.match(strict.errors[0].message, /ionCube/);
  assert.deepEqual(auditPackage(encoded, { gplRequired: false }).errors, []);
  assert.ok(auditPackage(encoded, { gplRequired: false }).warnings.some((issue) => issue.code === "obfuscated"));
});

test("source files without a licence header are listed; bundled libraries are not checked", () => {
  const audit = auditPackage(
    zip({
      LICENSE: GPL2,
      "Classes/A.php": "<?php\nclass A {}",
      "Classes/B.php": `${HEADER}class B {}`,
      "Resources/Public/JavaScript/app.js": "console.log(1)",
      "Resources/Public/JavaScript/Contrib/lib.js": "console.log(2)",
      THIRD_PARTY_NOTICES: "lib.js 1.0 MIT",
    }),
    { gplRequired: true },
  );
  const headers = audit.warnings.find((issue) => issue.code === "headers");
  assert.deepEqual(headers?.files, ["Classes/A.php", "Resources/Public/JavaScript/app.js"]);
  assert.match(headers?.message ?? "", /^2 of 3/);
  assert.equal(audit.noticesFile, "THIRD_PARTY_NOTICES");
});

test("bundled packages need a notices file and GPL-combinable licences", () => {
  const files = {
    LICENSE: GPL2,
    "Classes/A.php": `${HEADER}class A {}`,
    "vendor/composer/installed.json": JSON.stringify({
      packages: [
        { name: "symfony/yaml", license: ["MIT"] },
        { name: "acme/closed", license: ["proprietary"] },
        { name: "php/license", license: "PHP-3.01" },
        { name: "dual/licensed", license: "(MIT OR proprietary)" },
      ],
    }),
    "vendor/symfony/yaml/Yaml.php": "<?php",
  };
  const audit = auditPackage(zip(files), { gplRequired: true });
  assert.deepEqual(audit.errors, []);
  assert.deepEqual(audit.warnings.map((issue) => issue.code).sort(), ["dependency-license", "notices-missing"]);
  assert.deepEqual(audit.warnings.find((issue) => issue.code === "dependency-license")?.files, ["acme/closed (proprietary)", "php/license (PHP-3.01)"]);
  assert.equal(audit.dependencies.length, 4);

  const withNotices = auditPackage(zip({ ...files, "THIRD-PARTY-NOTICES.md": "# Notices" }), { gplRequired: true });
  assert.deepEqual(withNotices.warnings.map((issue) => issue.code), ["dependency-license"]);
});

test("minified files need their source and composer.json its licence", () => {
  const audit = auditPackage(
    zip({
      LICENSE: GPL2,
      "composer.json": JSON.stringify({ name: "cmsmotive/x", license: "proprietary" }),
      "Resources/Public/JavaScript/app.min.js": "/* (c) CMSMotive */!function(){}()",
    }),
    { gplRequired: true },
  );
  assert.deepEqual(audit.warnings.map((issue) => issue.code).sort(), ["composer-license", "minified-without-source"]);
});

test("unreadable archives fail cleanly and ZIP bombs stay within the read budget", () => {
  assert.deepEqual(auditPackage(Buffer.from("not a zip at all"), { gplRequired: true }).errors.map((issue) => issue.code), ["unreadable"]);
  const bomb = Buffer.alloc(200 * 1024 * 1024, 0x61);
  const audit = auditPackage(zip({ LICENSE: GPL2, "Classes/Huge.php": Buffer.concat([Buffer.from(HEADER), bomb]) }), { gplRequired: true });
  assert.deepEqual(audit.errors, []);
  assert.equal(readZipEntries(zip({ a: "1", b: "2" })).length, 2);
});

test("licence names and texts are classified", () => {
  for (const id of ["GPL-2.0-or-later", "GPL-3.0-only", "GPLv2", "LGPL-2.1", "GNU General Public License v2"]) assert.equal(isGplLicense(id), true, id);
  for (const id of ["MIT", "AGPL-3.0", "Commercial", ""]) assert.equal(isGplLicense(id), false, id);
  assert.equal(dependencyCompatible("MIT OR GPL-2.0-or-later"), true);
  assert.equal(dependencyCompatible("MIT AND proprietary"), false);
  assert.equal(licenseKindOf("GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007"), "gpl-3.0");
  assert.equal(licenseKindOf("Apache License\n Version 2.0, January 2004"), "apache-2.0");
});
