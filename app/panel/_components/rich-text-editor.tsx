"use client";

import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

type Props = {
  id: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

const CONTROLS: { label: string; isActive: (editor: Editor) => boolean; run: (editor: Editor) => void }[] = [
  { label: "Bold", isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { label: "Italic", isActive: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: "Strike", isActive: (e) => e.isActive("strike"), run: (e) => e.chain().focus().toggleStrike().run() },
  { label: "H2", isActive: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "H3", isActive: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "List", isActive: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbered", isActive: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Quote", isActive: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: "Code", isActive: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
];

export default function RichTextEditor({ id, value, onChange, placeholder }: Props) {
  const editor = useEditor({
    // Image keeps AI-generated inline illustrations (markdown → <img>) alive in the editor.
    extensions: [StarterKit, Image, Placeholder.configure({ placeholder: placeholder ?? "Write the description…" })],
    content: value,
    // Next.js renders on the server; deferring construction avoids a hydration mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "wtiptap-content", id, "aria-label": "Description" },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  // Keep the field in sync when the value is changed outside the editor.
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return <div className="wtiptap is-loading" aria-busy="true" />;

  return (
    <div className="wtiptap">
      <div className="wtiptap-toolbar" role="toolbar" aria-label="Formatting">
        {CONTROLS.map((control) => {
          const active = control.isActive(editor);
          return (
            <button
              key={control.label}
              type="button"
              className={active ? "is-active" : undefined}
              onClick={() => control.run(editor)}
              aria-pressed={active}
            >
              {control.label}
            </button>
          );
        })}
        <button
          type="button"
          className="wtiptap-clear"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          Clear
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
