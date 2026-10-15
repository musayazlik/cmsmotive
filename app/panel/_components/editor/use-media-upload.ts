"use client";

import { useRef } from "react";
import type { Editor, JSONContent } from "@tiptap/react";
import { mediaKindOf, useOptimizedUpload, type MediaEndpoint, type UploadedMedia } from "../use-optimized-upload";

/** Editor nodes for library items or fresh uploads: videos as video blocks, images with their alt text. */
export function toMediaNodes(items: UploadedMedia[]): JSONContent[] {
  return items.map((item) =>
    mediaKindOf(item.mimeType) === "video"
      ? { type: "video", attrs: { src: item.url } }
      : { type: "image", attrs: { src: item.url, alt: item.alt || item.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") } },
  );
}

/**
 * Uploads images and videos pasted or dropped into the editor (optimized
 * first, see useOptimizedUpload) and inserts them where the cursor or the
 * drop point was when the upload started.
 */
export function useMediaUpload(editor: Editor | null, endpoint: MediaEndpoint) {
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const insertAt = useRef<number | null>(null);

  const uploader = useOptimizedUpload(endpoint, ["image", "video"], (files) => {
    const instance = editorRef.current;
    const at = insertAt.current;
    insertAt.current = null;
    if (!instance) return;
    const chain = instance.chain().focus();
    const nodes = toMediaNodes(files);
    (at === null ? chain.insertContent(nodes) : chain.insertContentAt(Math.min(at, instance.state.doc.content.size), nodes)).run();
  });

  return {
    /** Uploads `files` and inserts them at `at`, or at the cursor when omitted. */
    upload: async (files: File[], at?: number) => {
      insertAt.current = at ?? editorRef.current?.state.selection.to ?? null;
      await uploader.upload(files);
    },
    busy: uploader.busy,
    status: uploader.status,
    error: uploader.error,
    clearError: () => uploader.setError(""),
  };
}
