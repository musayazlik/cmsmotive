import "dotenv/config";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { globalStore } from "./global";
import { seedHomepage } from "./homepage";
import type { StoreSeed } from "./types";
import { typo3Store } from "./typo3";

/** Every store this install serves, one folder each. */
export const storeSeeds: StoreSeed[] = [typo3Store, globalStore];

/** Key of the neutral store the store_scoped_content migration creates on a database without stores. */
const PLACEHOLDER_KEY = "default";

/**
 * Creates or refreshes each store and its domains, then adds its missing
 * settings and content. Store rows and domains follow the seed; settings and
 * content are only added where missing, so panel edits survive a re-run.
 */
export async function seedStores() {
  for (const seed of storeSeeds) {
    const { store, domains } = seed;
    // The migration's placeholder already owns the existing content: the default store takes it over.
    if (store.isDefault && !(await prisma.store.findUnique({ where: { key: store.key } }))) {
      await prisma.store.updateMany({ where: { key: PLACEHOLDER_KEY }, data: { key: store.key } });
    }
    const row = await prisma.store.upsert({ where: { key: store.key }, create: store, update: store });
    for (const [index, host] of domains.entries()) {
      const domain = { host, storeId: row.id, primary: index === 0 };
      await prisma.storeDomain.upsert({ where: { host }, create: domain, update: domain });
    }

    const settings = Object.entries(seed.settings).flatMap(([group, fields]) =>
      Object.entries(fields).map(([field, value]) => ({ storeId: row.id, key: `${group}.${field}`, value: JSON.stringify(value) })),
    );
    const added = await prisma.storeSetting.createMany({ data: settings, skipDuplicates: true });
    console.log(`  store      ${store.key.padEnd(10)} ${domains.join(", ")}  (${added.count} new settings)`);

    await seed.content?.(row.id);
  }
}

/** `pnpm db:seed:stores` seeds the stores and their content without touching accounts. */
if (process.argv[1] && /[\\/]seeds[\\/]index\.ts$/.test(path.resolve(process.argv[1]))) {
  seedStores()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error("Store seed failed:", error instanceof Error ? error.message : error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
