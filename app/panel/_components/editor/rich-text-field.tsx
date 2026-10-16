"use client";

import type { MediaEndpoint } from "../use-optimized-upload";
import RichTextEditor from "./rich-text-editor";

type Props = {
  id: string;
  /** Section heading above the editor; also its accessible name. */
  label: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Upload endpoint for images and videos embedded through the toolbar or pasted in. */
  endpoint?: MediaEndpoint;
  /** Shorter editing area for the catalogue forms; the blog uses the full height. */
  compact?: boolean;
};

/**
 * Section-labelled card around the rich text editor (catalogue descriptions
 * and blog post content). Both forms mount this component so every long-form
 * field in the panel looks and behaves the same.
 */
export default function RichTextField({ id, label, value, onChange, placeholder, endpoint, compact = false }: Props) {
  return (
    <div className={compact ? "wfield-editor is-compact" : "wfield-editor"}>
      <p className="wsection-label">{label}</p>
      <RichTextEditor
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        endpoint={endpoint}
      />
    </div>
  );
}
