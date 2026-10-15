import "dotenv/config";
import { statSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

/**
 * The theme catalogue the public site launched with. The site renders its
 * product cards from these rows (lib/catalog.ts), so the panel is the place
 * to edit them. Covers point at the bundled images in public/assets/images.
 */
const seedThemes = [
  {
    slug: "nordform",
    name: "Nordform",
    summary: "A precise visual system for architecture studios and considered corporate sites.",
    description:
      "<p>Nordform brings together decisive typography, space for large project imagery and a disciplined content rhythm. It is a visual preview of a planned TYPO3 product, built to make architecture and corporate stories feel specific rather than templated.</p>",
    industry: "Architecture & corporate",
    versionTarget: "TYPO3 13 / 14",
    status: "concept",
    price: 269,
    position: 10,
    cover: { file: "nordform-architecture.webp", alt: "Contemporary pale concrete architecture" },
  },
  {
    slug: "foundation",
    name: "Foundation",
    summary: "The clean starting point for teams who want to explore the CMSMotive approach.",
    description:
      "<p>Foundation is planned as a free starter. Availability and the final feature set will be announced after a verified release.</p>",
    industry: "Free starter",
    versionTarget: "TYPO3 13 / 14",
    status: "concept",
    price: 0,
    position: 20,
    cover: { file: "foundation-studio.webp", alt: "Designer working in a bright architecture studio" },
  },
  {
    slug: "campus",
    name: "Campus",
    summary: "A structured direction for content-rich universities and public institutions.",
    description:
      "<p>Campus is a roadmap concept. Pricing, compatibility and delivery timing have not been set.</p>",
    industry: "Education & public",
    versionTarget: "TYPO3 13 / 14",
    status: "in-development",
    price: null,
    position: 30,
    cover: { file: "campus-library.webp", alt: "Students outside a modern brick and glass campus library" },
  },
];

/**
 * Adds the launch themes and their cover images when they are missing.
 * Existing rows are left alone, so re-running the seed never undoes edits
 * made in the panel.
 */
export async function seedCatalog() {
  for (const { cover, ...theme } of seedThemes) {
    const file = path.join(process.cwd(), "public", "assets", "images", cover.file);
    const asset = await prisma.mediaAsset.upsert({
      where: { key: `static:${cover.file}` },
      create: {
        key: `static:${cover.file}`,
        url: `/assets/images/${cover.file}`,
        fileName: cover.file,
        fileSize: statSync(file).size,
        mimeType: "image/webp",
        alt: cover.alt,
        width: 1536,
        height: 1024,
      },
      update: {},
      select: { id: true },
    });
    const existing = await prisma.theme.findUnique({ where: { slug: theme.slug }, select: { id: true } });
    if (existing) {
      console.log(`  theme      ${theme.slug}  (exists, left as is)`);
      continue;
    }
    await prisma.theme.create({ data: { ...theme, coverId: asset.id } });
    console.log(`  theme      ${theme.slug}  created`);
  }
}

/** `pnpm db:seed:catalog` adds only the catalogue, without touching accounts. */
if (process.argv[1] && path.basename(process.argv[1]).startsWith("seed-catalog")) {
  seedCatalog()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error("Catalogue seed failed:", error instanceof Error ? error.message : error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
