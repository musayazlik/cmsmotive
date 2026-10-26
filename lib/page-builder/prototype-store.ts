import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PROTOTYPE_DOCUMENT } from "./default-document";
import type { PageBuilderData } from "./data";
import { prepareDocument, renderableDocument, type PreparedDocument } from "./document";

/**
 * Phase 0 storage: a git-ignored JSON file (the plan's dev-only prototype
 * store). The database is deliberately untouched until Phase 1 — this module
 * is the only thing to swap out for `lib/page-builder/pages.ts` later, so the
 * editor page, the save action and the public render all go through it, and
 * all of them through document.ts (plan 5.13).
 */

const PROTOTYPE_DIR = path.join(process.cwd(), ".temp_files", "page-builder");
const PROTOTYPE_FILE = path.join(PROTOTYPE_DIR, "prototype.json");

/** The prototype never ships in production; its routes 404 there. */
export function prototypeEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

async function readRaw(): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(PROTOTYPE_FILE, "utf8"));
  } catch {
    return null;
  }
}

/** The draft for the editor: the stored file when it still validates, otherwise the demo document. */
export async function readPrototypeDocument(): Promise<PageBuilderData> {
  const prepared = prepareDocument(await readRaw());
  return prepared.ok ? prepared.data : structuredClone(DEFAULT_PROTOTYPE_DOCUMENT);
}

/** The document for the public render: validated and cleaned again on every read. */
export async function readRenderablePrototypeDocument(): Promise<PageBuilderData> {
  return renderableDocument(await readRaw()) ?? renderableDocument(DEFAULT_PROTOTYPE_DOCUMENT) ?? { content: [], root: {} };
}

/**
 * The only write: prepares (validates + cleans) the input, then writes
 * atomically (temp file + rename) so a crashed save can't truncate the draft.
 */
export async function writePrototypeDocument(input: unknown): Promise<PreparedDocument> {
  const prepared = prepareDocument(input);
  if (!prepared.ok) return prepared;
  await fs.mkdir(PROTOTYPE_DIR, { recursive: true });
  const temp = `${PROTOTYPE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(prepared.data, null, 2), "utf8");
  await fs.rename(temp, PROTOTYPE_FILE);
  return prepared;
}
