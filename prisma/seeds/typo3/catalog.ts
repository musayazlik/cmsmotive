import { statSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type { ChangeItem, CompatibilityRow } from "@/lib/catalog-guard";
import { DEFAULT_COMPLIANCE } from "@/lib/product-compliance";

/**
 * The theme and extension catalogue the public site launched with, including
 * what the detail pages (/products/<slug>) show: the copy of the former
 * static theme pages, compatibility rows, indicative licence prices and the
 * changelog. The site renders all of it from these rows (lib/catalog.ts,
 * lib/product-page.ts), so the panel is the place to edit them. Covers and
 * galleries point at the bundled images in public/assets/images.
 */
type SeedImage = { file: string; alt: string };
type SeedRelease = { version: string; releasedAt: string; title: string; changes: ChangeItem[] };

/** Detail page fields shared by themes and extensions. */
type SeedDetails = {
  tagline?: string;
  intro?: string;
  highlights?: string[];
  compatibility?: CompatibilityRow[];
  ctaLabel?: string;
  ctaUrl?: string;
  demoUrl?: string;
  changelog: SeedRelease[];
  /** The description an earlier seed wrote; a row still holding it has not been edited and gets the full copy. */
  legacyDescription?: string;
};

/** Pixel sizes of the bundled images, so the MediaAsset rows carry real dimensions. */
const IMAGE_SIZES: Record<string, [number, number]> = {
  "nordform-architecture.webp": [1536, 1024],
  "foundation-studio.webp": [1536, 1024],
  "campus-library.webp": [1536, 1024],
  "hero-nordform-v2.webp": [1536, 1024],
  "hero-typo3-template-v1.webp": [1536, 1024],
  "hero-ribbon-3d.webp": [1295, 1214],
  "hero-burst-2d.webp": [1254, 1254],
};

const IMAGES = {
  nordform: { file: "nordform-architecture.webp", alt: "Contemporary pale concrete architecture" },
  studio: { file: "foundation-studio.webp", alt: "Designer working in a bright architecture studio" },
  campus: { file: "campus-library.webp", alt: "Students outside a modern brick and glass campus library" },
  cultural: { file: "hero-nordform-v2.webp", alt: "Contemporary cultural building with limestone and glass volumes" },
  template: { file: "hero-typo3-template-v1.webp", alt: "TYPO3 template preview with a dark editorial panel" },
  ribbon: { file: "hero-ribbon-3d.webp", alt: "Abstract folded ribbon loop in cobalt indigo" },
  burst: { file: "hero-burst-2d.webp", alt: "Flat acid-lime modular starburst" },
} satisfies Record<string, SeedImage>;

const VERIFY = "To verify at release";

/** One catalogue row; themes and extensions share the shape and differ in their type. */
type SeedProductCore = SeedDetails & {
  slug: string;
  name: string;
  summary: string;
  description: string;
  status: string;
  /** Order on the store's catalogue (ProductStore.position). */
  position: number;
  gallery: SeedImage[];
  /** Card kicker such as an industry; empty = the type name. */
  category?: string;
  /** Stacks and versions it targets, e.g. ["TYPO3 13", "TYPO3 14"]. */
  technologies?: string[];
  /** Indicative whole-unit price on the card: 0 = free, null = not set. */
  listPrice?: number | null;
  /** Indicative licence tiers, seeded as disabled yearly prices. */
  licences?: { name: string; price: number }[];
};

type SeedProduct = SeedProductCore & { type: "theme" | "extension"; cover?: SeedImage };

const seedThemes: (SeedProductCore & { cover: SeedImage })[] = [
  {
    slug: "nordform",
    name: "Nordform",
    summary: "A precise visual system for architecture studios and considered corporate sites.",
    tagline: "The featured concept",
    intro:
      "A restrained, confident theme direction for architecture practices and corporate teams that want their work to speak clearly.",
    description: [
      "<h2>Purposeful from page one.</h2>",
      "<p>Nordform brings together decisive typography, space for large project imagery and a disciplined content rhythm. It is a visual preview of a planned TYPO3 product, built to make architecture and corporate stories feel specific rather than templated.</p>",
      "<h2>A useful product shape.</h2>",
      "<ul><li><p>Homepage, project index, project detail, studio, journal and contact patterns.</p></li><li><p>Reusable editorial modules for image, quote, feature and split layouts.</p></li><li><p>Composer-oriented packaging with Fluid and TypoScript structures.</p></li><li><p>Documentation for installation, customization and content entry.</p></li></ul>",
      "<blockquote><p>These are proposed scope items. The release page will provide a verified feature list, supported versions and changelog.</p></blockquote>",
      "<h2>Make the next handoff easier.</h2>",
      '<p>Clean file organization and a small set of deliberate components should give agencies a strong starting point without hiding how the theme works. See the <a href="/docs">documentation concept</a> for the proposed structure.</p>',
      "<h2>Put inclusive behavior in the system.</h2>",
      "<p>Nordform targets semantic templates, visible focus states, keyboard use and legible contrast. Any formal conformance statement will follow an actual product audit rather than this visual preview.</p>",
    ].join(""),
    legacyDescription:
      "<p>Nordform brings together decisive typography, space for large project imagery and a disciplined content rhythm. It is a visual preview of a planned TYPO3 product, built to make architecture and corporate stories feel specific rather than templated.</p>",
    category: "Architecture & corporate",
    technologies: ["TYPO3 13", "TYPO3 14"],
    status: "concept",
    listPrice: 269,
    position: 10,
    licences: [
      { name: "Single site", price: 269 },
      { name: "Agency", price: 419 },
      { name: "Enterprise", price: 659 },
    ],
    highlights: ["Visual demo available now", "Final package specification pending", "Final terms confirmed before sale"],
    compatibility: [
      { area: "TYPO3 CMS", target: "13 LTS / 14 LTS", status: VERIFY },
      { area: "Installation", target: "Composer", status: VERIFY },
      { area: "Templating", target: "Fluid / TypoScript", status: VERIFY },
      { area: "Accessibility", target: "WCAG-informed checks", status: "Audit pending" },
    ],
    ctaLabel: "Request early access",
    ctaUrl: "mailto:hello@cmsmotive.de?subject=Nordform%20early%20access%20request",
    demoUrl: "/demo-nordform",
    cover: IMAGES.nordform,
    gallery: [IMAGES.nordform, IMAGES.studio, IMAGES.campus],
    changelog: [
      {
        version: "v0.3.0",
        releasedAt: "2026-10-01",
        title: "Visual demo",
        changes: [
          { kind: "new", text: "Standalone visual demo page with the full homepage composition." },
          { kind: "improved", text: "Project detail pattern with larger image ratios and calmer captions." },
        ],
      },
      {
        version: "v0.2.0",
        releasedAt: "2026-09-01",
        title: "Editorial modules",
        changes: [
          { kind: "new", text: "Image, quote, feature and split-layout modules drafted." },
          { kind: "new", text: "Accessibility targets for focus states, contrast and keyboard use." },
          { kind: "improved", text: "Typography scale tightened for long project titles." },
        ],
      },
      {
        version: "v0.1.0",
        releasedAt: "2026-08-01",
        title: "Concept direction",
        changes: [
          { kind: "new", text: "Visual direction, colour palette and type pairing defined." },
          { kind: "new", text: "Homepage, project index and contact page outlines." },
        ],
      },
    ],
  },
  {
    slug: "foundation",
    name: "Foundation",
    summary: "The clean starting point for teams who want to explore the CMSMotive approach.",
    tagline: "Free starter concept",
    intro: "A clean starting direction for teams exploring the CMSMotive way of building TYPO3 websites.",
    description: [
      "<h2>Three ideas behind the concept.</h2>",
      "<h3>A useful baseline</h3><p>A considered layout and component structure to adapt to your own work.</p>",
      "<h3>Readable organization</h3><p>A proposed Fluid and TypoScript setup that makes the next change easier.</p>",
      "<h3>Room to grow</h3><p>A lightweight foundation that can support more specific visual identities.</p>",
      "<h2>Made for the work ahead.</h2>",
      "<p>Foundation is planned as a free starter. Availability and the final feature set will be announced after a verified release.</p>",
    ].join(""),
    legacyDescription:
      "<p>Foundation is planned as a free starter. Availability and the final feature set will be announced after a verified release.</p>",
    category: "Free starter",
    technologies: ["TYPO3 13", "TYPO3 14"],
    status: "concept",
    listPrice: 0,
    position: 20,
    cover: IMAGES.studio,
    gallery: [IMAGES.studio, IMAGES.template],
    changelog: [
      {
        version: "v0.2.0",
        releasedAt: "2026-10-01",
        title: "Starter structure",
        changes: [
          { kind: "new", text: "Proposed Fluid and TypoScript folder structure." },
          { kind: "improved", text: "Layout tokens simplified for easier rebranding." },
        ],
      },
      {
        version: "v0.1.0",
        releasedAt: "2026-09-01",
        title: "Concept announced",
        changes: [{ kind: "new", text: "Free starter concept and scope published." }],
      },
    ],
  },
  {
    slug: "campus",
    name: "Campus",
    summary: "A structured direction for content-rich universities and public institutions.",
    tagline: "Education & public roadmap",
    intro: "A structured theme direction for universities, education and public sector websites with complex content needs.",
    description: [
      "<h2>Three ideas behind the concept.</h2>",
      "<h3>Complex content, clear paths</h3><p>Navigation and page patterns planned for large information structures.</p>",
      "<h3>Inclusive by intent</h3><p>Accessibility considerations built into the proposed component approach.</p>",
      "<h3>Editorial confidence</h3><p>Useful templates for departments, news, events and long-form content.</p>",
      "<h2>Made for the work ahead.</h2>",
      "<p>Campus is a roadmap concept. Pricing, compatibility and delivery timing have not been set.</p>",
    ].join(""),
    legacyDescription: "<p>Campus is a roadmap concept. Pricing, compatibility and delivery timing have not been set.</p>",
    category: "Education & public",
    technologies: ["TYPO3 13", "TYPO3 14"],
    status: "in-development",
    listPrice: null,
    position: 30,
    cover: IMAGES.campus,
    gallery: [IMAGES.campus, IMAGES.cultural],
    changelog: [
      {
        version: "v0.1.0",
        releasedAt: "2026-09-01",
        title: "Roadmap concept",
        changes: [
          { kind: "new", text: "Information architecture outline for faculties, news and events." },
          { kind: "new", text: "Accessibility-first component list drafted." },
        ],
      },
    ],
  },
];

const EXTENSION_COMPATIBILITY: CompatibilityRow[] = [
  { area: "TYPO3 CMS", target: "13 LTS / 14 LTS", status: VERIFY },
  { area: "Installation", target: "Composer", status: VERIFY },
];

const roadmapRelease = (releasedAt: string): SeedRelease[] => [
  { version: "v0.1.0", releasedAt, title: "Roadmap concept", changes: [{ kind: "new", text: "Use case and scope outlined." }] },
];

const seedExtensions: SeedProductCore[] = [
  {
    slug: "editorial-workflow",
    name: "Editorial Workflow",
    summary: "Make review states, handoffs and publishing responsibilities easier to understand across a content team.",
    description:
      "<p>Editorial Workflow is a roadmap concept. Scope, pricing and release timing have not been set.</p>",
    status: "concept",
    position: 10,
    compatibility: EXTENSION_COMPATIBILITY,
    gallery: [IMAGES.template, IMAGES.ribbon],
    changelog: roadmapRelease("2026-09-01"),
  },
  {
    slug: "structured-seo",
    name: "Structured SEO",
    summary: "Practical defaults for metadata, page previews and structured content without an overloaded control panel.",
    description:
      "<p>Structured SEO is a roadmap concept. Scope, pricing and release timing have not been set.</p>",
    status: "concept",
    position: 20,
    compatibility: EXTENSION_COMPATIBILITY,
    gallery: [IMAGES.burst, IMAGES.template],
    changelog: roadmapRelease("2026-09-01"),
  },
  {
    slug: "content-utilities",
    name: "Content Utilities",
    summary: "Small, documented tools for the repetitive details that slow real TYPO3 projects down.",
    description:
      "<p>Content Utilities is a roadmap concept. Scope, pricing and release timing have not been set.</p>",
    status: "concept",
    position: 30,
    compatibility: EXTENSION_COMPATIBILITY,
    gallery: [IMAGES.ribbon, IMAGES.burst],
    changelog: roadmapRelease("2026-10-01"),
  },
];

/** The MediaAsset row for a bundled image, created on first use and keyed `static:<file>`. */
async function staticAsset(storeId: string, { file, alt }: SeedImage) {
  const [width, height] = IMAGE_SIZES[file];
  const asset = await prisma.mediaAsset.upsert({
    where: { storeId_key: { storeId, key: `static:${file}` } },
    create: {
      storeId,
      key: `static:${file}`,
      url: `/assets/images/${file}`,
      fileName: file,
      fileSize: statSync(path.join(process.cwd(), "public", "assets", "images", file)).size,
      mimeType: "image/webp",
      alt,
      width,
      height,
    },
    update: {},
    select: { id: true },
  });
  return asset.id;
}

/** Sequential, so an image used as both cover and gallery is upserted once. */
async function staticAssets(storeId: string, images: SeedImage[]) {
  const ids: string[] = [];
  for (const image of images) ids.push(await staticAsset(storeId, image));
  return ids;
}

const galleryRows = (assetIds: string[]) => assetIds.map((assetId, position) => ({ assetId, position }));

const changelogRows = (releases: SeedRelease[]) =>
  releases.map(({ releasedAt, ...release }) => ({ ...release, releasedAt: new Date(`${releasedAt}T00:00:00Z`) }));

/** The detail fields a fresh row gets. */
function detailData(seed: Omit<SeedDetails, "changelog">) {
  return {
    tagline: seed.tagline ?? null,
    intro: seed.intro ?? null,
    highlights: seed.highlights ?? [],
    compatibility: seed.compatibility ?? [],
    ctaLabel: seed.ctaLabel ?? null,
    ctaUrl: seed.ctaUrl ?? null,
    demoUrl: seed.demoUrl ?? null,
  };
}

type ExistingRow = {
  description: string;
  tagline: string | null;
  intro: string | null;
  highlights: string[];
  compatibility: unknown;
  ctaLabel: string | null;
  ctaUrl: string | null;
  demoUrl: string | null;
};

/** Detail fields an existing row is still missing; anything set in the panel stays as it is. */
function missingDetails(row: ExistingRow, seed: SeedDetails & { description: string }) {
  const update: Record<string, unknown> = {};
  if (seed.legacyDescription && row.description === seed.legacyDescription) update.description = seed.description;
  if (!row.tagline && seed.tagline) update.tagline = seed.tagline;
  if (!row.intro && seed.intro) update.intro = seed.intro;
  if (row.highlights.length === 0 && seed.highlights?.length) update.highlights = seed.highlights;
  if ((!Array.isArray(row.compatibility) || row.compatibility.length === 0) && seed.compatibility?.length) update.compatibility = seed.compatibility;
  if (!row.ctaLabel && !row.ctaUrl && seed.ctaUrl) Object.assign(update, { ctaLabel: seed.ctaLabel ?? null, ctaUrl: seed.ctaUrl });
  if (!row.demoUrl && seed.demoUrl) update.demoUrl = seed.demoUrl;
  return update;
}

const detailSelect = {
  id: true, description: true, tagline: true, intro: true, highlights: true, compatibility: true, ctaLabel: true, ctaUrl: true, demoUrl: true,
  _count: { select: { gallery: true, changelog: true, listings: true, prices: true } },
} as const;

/** The product types the catalogue markers reference (type=<key>); the panel manages them. */
const PRODUCT_TYPES = [
  { key: "theme", name: "Theme", pluralName: "Themes", listPath: "/themes", position: 0 },
  { key: "extension", name: "Extension", pluralName: "Extensions", listPath: "/extensions", position: 1 },
] as const;

/** The themes' indicative licence list becomes disabled yearly prices (shown, not buyable). */
const licencePriceRows = (storeId: string, licences: NonNullable<SeedProduct["licences"]>) =>
  licences.map((licence, index) => ({
    storeId,
    name: licence.name,
    billingType: "recurring",
    interval: "year",
    amountCents: licence.price * 100,
    currency: "EUR",
    taxMode: "inclusive",
    enabled: false,
    position: 10 + index + 1,
  }));

/**
 * Adds the launch themes and extensions as products of their type when they
 * are missing. For launch records that exist, it only fills what is still
 * empty: the gallery, the store listing, the disabled licence prices, the
 * detail page fields, the changelog, and a description nobody has edited.
 * Everything changed in the panel is left alone, so re-running the seed
 * never undoes it.
 */
export async function seedCatalog(storeId: string) {
  const typeIds: Record<(typeof PRODUCT_TYPES)[number]["key"], string> = { theme: "", extension: "" };
  for (const type of PRODUCT_TYPES) {
    const row = await prisma.productType.upsert({
      where: { key: type.key },
      create: { ...type, description: null },
      update: {},
      select: { id: true },
    });
    typeIds[type.key] = row.id;
  }

  for (const [type, seeds] of [
    ["theme", seedThemes],
    ["extension", seedExtensions],
  ] as const) {
    for (const partial of seeds) {
      const seed: SeedProduct = { ...partial, type };
      const { cover, gallery, changelog, licences, legacyDescription, ...core } = seed;
      const coverId = cover ? await staticAsset(storeId, cover) : null;
      const galleryIds = await staticAssets(storeId, gallery);
      const existing = await prisma.product.findUnique({ where: { slug: core.slug }, select: detailSelect });
      const { slug, name, summary, description, status, position } = core;

      if (!existing) {
        await prisma.product.create({
          data: {
            storeId,
            typeId: typeIds[type],
            slug, name, summary, description, status,
            category: core.category ?? null,
            technologies: core.technologies ?? [],
            listPrice: core.listPrice ?? null,
            compliance: DEFAULT_COMPLIANCE,
            ...detailData(core),
            coverId,
            gallery: { create: galleryRows(galleryIds) },
            listings: { create: { storeId, position } },
            prices: { create: licencePriceRows(storeId, licences ?? []) },
            changelog: { create: changelogRows(changelog) },
          },
        });
        console.log(`  ${type.padEnd(10)} ${slug}  created`);
        continue;
      }

      const filled: string[] = [];
      if (existing._count.gallery === 0) {
        await prisma.productGallery.createMany({ data: galleryRows(galleryIds).map((row) => ({ ...row, productId: existing.id })) });
        filled.push("gallery");
      }
      if (existing._count.listings === 0) {
        await prisma.productStore.create({ data: { productId: existing.id, storeId, position } });
        filled.push("listing");
      }
      const update = missingDetails(existing, seed);
      if (Object.keys(update).length > 0) {
        await prisma.product.update({ where: { id: existing.id }, data: update });
        filled.push(...Object.keys(update));
      }
      if (existing._count.changelog === 0 && changelog.length > 0) {
        await prisma.changelogEntry.createMany({ data: changelogRows(changelog).map((row) => ({ ...row, productId: existing.id })) });
        filled.push("changelog");
      }
      if (existing._count.prices === 0 && licences?.length) {
        await prisma.price.createMany({ data: licencePriceRows(storeId, licences).map((row) => ({ ...row, productId: existing.id })) });
        filled.push("prices");
      }
      console.log(`  ${type.padEnd(10)} ${slug}  (exists, ${filled.length ? `filled: ${filled.join(", ")}` : "left as is"})`);
    }
  }
}
