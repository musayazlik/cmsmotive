"use client";

import { Mark, mergeAttributes, type Editor } from "@tiptap/core";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Element-language support for the rich text fields (plan 5.3, "lang" mark):
 * a Tiptap mark that wraps the selection in `<span lang="…">` — exactly the
 * shape the sanitizer keeps (sanitize.ts allows `lang` on span) — plus the
 * inline-menu select that sets it. Client-only: imported by block-fields.tsx
 * for the editor config, never by the server config or public routes.
 */

/** Quick picks for the select; arbitrary BCP 47 tags remain valid in storage. */
const LANG_CHOICES: ReadonlyArray<readonly [string, string]> = [
  ["de", "Deutsch"],
  ["tr", "Türkçe"],
  ["en", "English"],
  ["fr", "Français"],
  ["es", "Español"],
  ["it", "Italiano"],
  ["pt", "Português"],
  ["nl", "Nederlands"],
  ["pl", "Polski"],
  ["ru", "Русский"],
  ["ar", "العربية"],
  ["zh", "中文"],
];

/**
 * The `lang` mark. Puck appends it after its own extension set
 * (`field.tiptap.extensions`), so it can parse the spans the sanitizer keeps
 * and write new ones the sanitizer accepts unchanged.
 */
export const LangMark = Mark.create({
  name: "lang",
  // Leaving the marked phrase should not require re-selecting it.
  exitable: true,
  parseHTML() {
    return [{ tag: "span[lang]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
  addAttributes() {
    return {
      lang: {
        default: null,
        parseHTML: (element) => element.getAttribute("lang"),
      },
    };
  },
});

/**
 * `renderInlineMenu` for richtext fields: keeps Puck's own buttons
 * (`children`) and appends the language select on the right.
 */
export function langInlineMenu({
  children,
  editor,
  readOnly,
}: {
  children: ReactNode;
  editor: Editor | null;
  readOnly: boolean;
}): ReactNode {
  return (
    <>
      {children}
      {!readOnly && <LangSelect editor={editor} />}
    </>
  );
}

function LangSelect({ editor }: { editor: Editor | null }) {
  const [lang, setLang] = useState("");

  useEffect(() => {
    if (!editor) return;
    const sync = () => setLang((editor.getAttributes("lang").lang as string | undefined) ?? "");
    sync();
    editor.on("transaction", sync);
    return () => {
      editor.off("transaction", sync);
    };
  }, [editor]);

  return (
    <select
      className="pbstyle-lang-select"
      title="Mark the selected text as another language"
      aria-label="Selection language"
      value={lang}
      onChange={(event) => {
        const next = event.currentTarget.value;
        if (!editor) return;
        if (next) editor.chain().focus().setMark("lang", { lang: next }).run();
        else editor.chain().focus().unsetMark("lang", { extendEmptyMarkRange: true }).run();
      }}
    >
      <option value="">Language</option>
      {LANG_CHOICES.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
