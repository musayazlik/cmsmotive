import { walkBlocks, type PageBuilderData } from "./data";
import { createBlockId } from "./ids";
import { sanitizeDocumentContent } from "./sanitize";
import { validateDocument } from "./validate";

/**
 * The one door documents pass through (plan 5.13). Writes (editor save,
 * publish, revision restore, MCP, AI, backup restore) call prepareDocument;
 * every page render calls renderableDocument. Both validate and clean, because
 * Puck's `<Render>` prints rich text exactly as stored.
 *
 * Server-only: sanitize-html must never reach a client bundle.
 */

/** Document cap; matches the default Server Action body limit (1 MB). */
export const MAX_DOCUMENT_BYTES = 1024 * 1024;

export type PreparedDocument = { ok: true; data: PageBuilderData } | { ok: false; error: string };

/**
 * Size check → JSON round trip (drops functions, `undefined` and React nodes
 * left by Puck's editing state) → schema validation → rich text cleaning.
 * Works on a copy; the input is never modified.
 */
export function prepareDocument(input: unknown): PreparedDocument {
  let json: string | undefined;
  try {
    json = JSON.stringify(input);
  } catch {
    return { ok: false, error: "The document could not be serialized." };
  }
  if (json === undefined) return { ok: false, error: "Not a document." };
  if (Buffer.byteLength(json, "utf8") > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "Document exceeds the 1 MB limit." };
  }
  const document = JSON.parse(json);
  if (document && Array.isArray(document.content)) {
    walkBlocks(document, (block) => {
      if (!block.props) return;
      // Older seeds put ids on the envelope; Puck's outline requires props.id.
      if (block.props.id === undefined) {
        const legacyId = (block as unknown as { id?: unknown }).id;
        block.props.id = typeof legacyId === "string" ? legacyId : createBlockId();
      }
    });
  }
  const validation = validateDocument(document);
  if (!validation.ok) return validation;
  const data = validation.data as PageBuilderData;
  sanitizeDocumentContent(data);
  return { ok: true, data };
}

/**
 * The document as it may be rendered: validated and cleaned again, whatever
 * stored it. Returns null for a document that no longer validates, so the
 * page can fall back instead of printing unchecked markup.
 */
export function renderableDocument(input: unknown): PageBuilderData | null {
  const prepared = prepareDocument(input);
  if (!prepared.ok) {
    console.error("page builder: refusing to render an invalid document", prepared.error);
    return null;
  }
  return prepared.data;
}
