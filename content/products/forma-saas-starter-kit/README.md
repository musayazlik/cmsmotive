# Forma — SaaS Theme & Starter Kit

Created in CMSMotive Global (`global`) as a visible `preview` product.

- Product ID: `cmvoa10om00074guok1myfob5`
- Slug: `forma-saas-starter-kit`
- Type: Theme
- Copy language: English
- Indicative pricing: USD 79 / Single project; USD 199 / Studio (5 projects)
- Both prices are disabled; no checkout or downloadable release exists.
- Package checklist code license: `Commercial`. This unlocks ZIP uploads;
  the other publication checks are evaluated separately.
- Planned frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- Planned scope: marketing pages, workspace dashboard, projects, settings,
  account interface templates, responsive layouts, light and dark styles.

## Assets

The one cover and six gallery PNGs are saved in
`public/products/forma-saas-starter-kit/`. All are 1536 × 1024.
They are also uploaded to UploadThing and registered in the global store's
media library with alt text and dimensions. The cover is separate from the
six ordered gallery entries.

The images were generated using the built-in `image_gen` tool, following the
invoked `ai-image-generation` and `imagegen` skill guidance. The inference.sh
CLI was not needed. See `image-prompts.md` for every final prompt.
The device screens illustrate a concept; they are not screenshots of released
software. The listing explains the planned scope and demo screen data.

## Reuse and verification

`product.json` contains the catalogue content, proposed prices, image order,
and alt text. The importer uses the app's existing product, price, media,
actor, and store-scoping operations:

```powershell
node --import tsx scripts/catalog/create-forma-product.ts
node --import tsx scripts/catalog/create-forma-product.ts --apply
```

The first command is read-only. The second imports the preview and uses a
local ignored checkpoint to resume uploads. A completed import is left
unchanged on subsequent runs; no duplicate product or price is created.

Verified with the running local app:

- English preview: http://global.localhost:9485/en/products/forma-saas-starter-kit
- Database record belongs to `global`; one cover and six gallery entries.
- All seven remote images loaded at 1536 × 1024.
- Price picker offers Single project / USD 79 and Studio / USD 199.
- Mobile viewport 390 px: document width 390 px, no horizontal overflow.
- No browser application errors during verification.
- TypeScript check and importer ESLint passed; repeat import made no changes.

Existing site behavior: the bare `/products/...` route currently uses German
site chrome even on the global host. The English `/en/products/...` route was
used for verification. This import does not change storefront routing or
shared site chrome.
