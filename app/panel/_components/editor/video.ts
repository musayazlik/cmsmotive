import { mergeAttributes, Node } from "@tiptap/react";

/** Uploaded or linked videos become plain, self-contained block nodes. */
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return { src: { default: null } };
  },

  parseHTML() {
    return [{ tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["video", mergeAttributes({ controls: true, preload: "metadata" }, HTMLAttributes)];
  },
});
