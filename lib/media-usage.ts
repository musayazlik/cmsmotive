import { prisma } from "@/lib/prisma";

/**
 * Where media files appear inside rich text: images and videos placed in a
 * post body or a product description are plain <img>/<video> URLs in the
 * HTML, with no relation in the database the way covers and galleries have.
 * UploadThing URLs carry the file key (/f/<key>), so counting the keys found
 * in each document finds every embed, whichever host variant is used, and
 * works for untracked files too.
 */

export type EmbeddedUsage = { posts: number; products: number };

const FILE_KEY = /\/f\/([A-Za-z0-9_-]{8,})/g;

export function mediaKeysIn(html: string): Set<string> {
  return new Set([
    ...Array.from(html.matchAll(FILE_KEY), (match) => match[1]),
    ...Array.from(html.matchAll(/\/api\/media\/r2\/([a-z0-9-]+\/media\/[A-Za-z0-9_-]+\/[a-f0-9-]+\.[a-z0-9]+)/g), (match) => `r2://${match[1]}`),
  ]);
}

/** File key → number of the store's posts and products whose text embeds it. */
export async function getEmbeddedUsage(storeId: string): Promise<Map<string, EmbeddedUsage>> {
  const [posts, products] = await Promise.all([
    prisma.post.findMany({ where: { storeId }, select: { content: true } }),
    prisma.product.findMany({ where: { storeId }, select: { description: true } }),
  ]);

  const usage = new Map<string, EmbeddedUsage>();
  const count = (documents: string[], field: keyof EmbeddedUsage) => {
    for (const html of documents) {
      for (const key of mediaKeysIn(html)) {
        const entry = usage.get(key) ?? { posts: 0, products: 0 };
        entry[field] += 1;
        usage.set(key, entry);
      }
    }
  };
  count(posts.map((post) => post.content), "posts");
  count(products.map((product) => product.description), "products");
  return usage;
}

export const NO_EMBEDS: EmbeddedUsage = { posts: 0, products: 0 };
