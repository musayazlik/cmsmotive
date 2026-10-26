# Package licensing checks

Every ZIP uploaded under **Products → Packages** gets a licence audit (`lib/package-audit.ts`) before customers can download it. The report is stored with the release (`ProductRelease.audit`), shown in the package list, and the product's **Publish** checklist requires the latest package to pass.

TYPO3 states that extensions fall under GPL-2.0-or-later because TYPO3 and its extensions form one combined program, and that they may be sold as long as the licence terms are not changed ([typo3.com licences](https://typo3.com/typo3-cms/what-is-typo3/open-source/licenses)).

## The store setting

**Settings → Legal → “Products in this store are GPL code”** (`gplCodeRequired`). The TYPO3 store seed turns it on; a store selling other code (e.g. commercial starter kits) leaves it off. With it on:

- a product's code licence (package checklist) must be a GPL licence, e.g. `GPL-2.0-or-later`; uploads and publishing are refused otherwise;
- the stricter package rules below apply.

## What is checked

| Check | GPL store | Other stores |
| --- | --- | --- |
| `LICENSE` or `COPYING` (`.txt`/`.md` allowed) at the top of the package, or of its single top folder | Required, and must be the GNU GPL/LGPL text | Required |
| Encoded or obfuscated PHP (ionCube, SourceGuardian, Zend Guard, `eval(base64_decode(…))`) | Refuses the upload | Warning |
| Copyright or licence header in the first lines of own source files (PHP, JS/TS, SCSS…; bundled libraries excluded) | Warning with the files | Warning |
| Bundled third-party code (`vendor/`, `node_modules/`, `Contrib/`, `libs/`, `third-party/`) without `THIRD-PARTY-NOTICES` (or `NOTICE`, `CREDITS`, `LICENSES/`) | Warning | Warning |
| Bundled Composer/npm packages whose licence cannot be combined with GPL code (e.g. proprietary, `PHP-3.01`) | Warning with the packages | — |
| `composer.json` `license` field | Warning if missing or not GPL | Warning if missing |
| Minified `.min.js` / `.min.css` without the unminified file or build sources | Warning | Warning |
| Checklist licence differs from the licence file | Warning | Warning |

Errors refuse the upload (R2: the staged object is deleted; UploadThing: the uploaded file is deleted). Warnings are listed on the release so the next version can fix them. Packages uploaded before the audit existed show **Not checked**; use **Check** in the package list (`POST /api/admin/releases/:id`) to run it on the stored file.

## Preparing a TYPO3 package

```
my_extension/
├── LICENSE                  # full GPL-2.0 text (https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt)
├── THIRD-PARTY-NOTICES.md   # only when libraries are bundled
├── composer.json            # "license": "GPL-2.0-or-later"
├── ext_emconf.php
├── Classes/…                # each file starts with the header below
└── Resources/…              # ship unminified sources (or Build/) next to *.min.js/css
```

File header:

```php
<?php

/*
 * This file is part of the "my_extension" extension for TYPO3 CMS.
 *
 * (c) 2026 CMSMotive
 *
 * It is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License, either version 2
 * of the License, or any later version. See the LICENSE file.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
```

`THIRD-PARTY-NOTICES.md`: one entry per bundled library with name, version, licence (SPDX id), copyright line and source URL.

## Sales terms

The terms (`lib/legal-copy.ts`, “Software licenses and paid services”) state that GPL code may be used on any number of sites, modified and redistributed, that licence keys, installation counts and update periods only describe paid services, and that the CMSMotive name and logo are not licensed with the code. `tests/legal-gpl-terms.test.ts` fails if that promise disappears or wording that forbids redistributing, modifying or reselling the code is added. After changing the terms text, raise the terms version in **Settings → Legal** so new checkouts record acceptance of the new text.

This describes technical checks, not legal advice; confirm the licensing model with counsel before live sales.

## Checks

```sh
pnpm test:package-licensing
pnpm test:package-storage
```
