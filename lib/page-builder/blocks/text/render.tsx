import type { PuckComponent } from "@puckeditor/core";
import type { TextProps } from "./schema";

/**
 * Rich text body (plan 5.2). Puck turns the `richtext` prop into its own
 * `.rich-text` node before this component runs, but it prints the stored HTML
 * inside it unfiltered (Faz 0: `onerror` and `<script>` came out as stored).
 * The XSS boundary is therefore lib/page-builder/document.ts: every document
 * is validated and cleaned on write and again before render. This render
 * must not reinterpret the prop as a string.
 */
export const TextRender: PuckComponent<TextProps> = ({ content, id }) => (
  <div data-pb={id} className="pb-text">
    {content}
  </div>
);
