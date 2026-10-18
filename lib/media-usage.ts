import { prisma } from "@/lib/prisma";

/**
 * Where media files appear inside rich text: images and videos placed in a
 * post body or a theme/extension description are plain <img>/<video> URLs in
 * the HTML, with no relation in the database the way covers and galleries
 * have. UploadThing URLs carry the file key (…/f/<key>), so counting the keys
 * found in each document finds every embed, whichever host variant is used,
 * and works for untracked files too.
 */

export type EmbeddedUsage = { posts: number; themes: number; extensions: number };

const FILE_KEY = /\/f\/([A-Za-z0-9_-]{8,})/g;

function keysIn(html: string): Set<string> {
  return new Set(Array.from(html.matchAll(FILE_KEY), (match) => match[1]));
}

/** File key → number of posts, themes and extensions whose text embeds it. */
export async function getEmbeddedUsage(): Promise<Map<string, EmbeddedUsage>> {
  const [posts, themes, extensions] = await Promise.all([
    prisma.post.findMany({ select: { content: true } }),
    prisma.theme.findMany({ select: { description: true } }),
    prisma.extension.findMany({ select: { description: true } }),
  ]);

  const usage = new Map<string, EmbeddedUsage>();
  const count = (documents: string[], field: keyof EmbeddedUsage) => {
    for (const html of documents) {
      for (const key of keysIn(html)) {
        const entry = usage.get(key) ?? { posts: 0, themes: 0, extensions: 0 };
        entry[field] += 1;
        usage.set(key, entry);
      }
    }
  };
  count(posts.map((post) => post.content), "posts");
  count(themes.map((theme) => theme.description), "themes");
  count(extensions.map((extension) => extension.description), "extensions");
  return usage;
}

export const NO_EMBEDS: EmbeddedUsage = { posts: 0, themes: 0, extensions: 0 };
