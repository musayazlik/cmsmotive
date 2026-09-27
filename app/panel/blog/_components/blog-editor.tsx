"use client";

import { marked } from "marked";
import { Image } from "@tiptap/extension-image";
import { Youtube } from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import {
  EditorContent,
  mergeAttributes,
  Node,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import {
  IconBold, IconBulletList, IconCode, IconImage, IconItalic, IconLink, IconOrderedList,
  IconQuote, IconRedo, IconStrike, IconUnderline, IconUndo, IconUnlink, IconVideo, IconYoutube,
} from "./icons";

/** Uploaded videos become plain, self-contained block nodes. */
const Video = Node.create({
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

/*
 * Markdown paste support: plain-text clipboards that clearly carry markdown are
 * converted to the schema's nodes instead of landing as literal text. The
 * scoring is deliberately conservative — a lone `**word**` or one link stays
 * literal text, whole documents convert.
 */
const MD_SIGNALS: { pattern: RegExp; score: number }[] = [
  { pattern: /(^|\n) {0,3}(?:```|~~~)/, score: 3 }, // fenced code block
  { pattern: /(^|\n) {0,3}#{1,6} \S/, score: 3 }, // heading
  { pattern: /(^|\n) {0,3}> \S/, score: 2 }, // blockquote
  { pattern: /\*\*[^*\n]+\*\*|__[^_\n]+__/, score: 2 }, // bold
  { pattern: /\[[^\]\n]+\]\([^)\n]{4,}\)/, score: 2 }, // link
];

function looksLikeMarkdown(text: string) {
  if (text.trim().length < 6) return false;
  let score = 0;
  for (const { pattern, score: value } of MD_SIGNALS) {
    if (pattern.test(text)) score += value;
  }
  if ((text.match(/(^|\n) {0,3}[-*+] \S/g) ?? []).length >= 2) score += 3; // bullet list
  if ((text.match(/(^|\n) {0,3}\d{1,9}[.)] \S/g) ?? []).length >= 2) score += 3; // ordered list
  return score >= 3;
}

/** Markdown → schema HTML; headings clamp to the levels the toolbar offers. */
function markdownToHtml(text: string) {
  const html = marked.parse(text, { async: false }) as string;
  return html.replace(/<h([1-6])>/g, (_, level: string) => `<h${Math.min(4, Math.max(2, Number(level)))}>`);
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

/** Tracks the active marks/nodes so the toolbar can highlight them. */
function useToolbarState(editor: Editor | null) {
  // The selector always returns an object, even for a null editor.
  return useEditorState({
    editor,
    selector: ({ editor: instance }) =>
      instance
        ? {
            bold: instance.isActive("bold"),
            italic: instance.isActive("italic"),
            underline: instance.isActive("underline"),
            strike: instance.isActive("strike"),
            h2: instance.isActive("heading", { level: 2 }),
            h3: instance.isActive("heading", { level: 3 }),
            bulletList: instance.isActive("bulletList"),
            orderedList: instance.isActive("orderedList"),
            blockquote: instance.isActive("blockquote"),
            codeBlock: instance.isActive("codeBlock"),
            link: instance.isActive("link"),
            canUndo: instance.can().undo(),
            canRedo: instance.can().redo(),
          }
        : {
            bold: false, italic: false, underline: false, strike: false,
            h2: false, h3: false, bulletList: false, orderedList: false,
            blockquote: false, codeBlock: false, link: false, canUndo: false, canRedo: false,
          },
  })!;
}

export default function BlogEditor({ value, onChange, placeholder }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const editorRef = useRef<Editor | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [error, setError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Write the post…" }),
      Image,
      Youtube.configure({ controls: false, nocookie: true, width: 720 }),
      Video,
    ],
    content: value,
    // Next.js renders on the server; deferring construction avoids a hydration mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "wtiptap-content", "aria-label": "Post content", spellcheck: "false" },
      handlePaste: (_view, event) => {
        const clipboard = event.clipboardData;
        // Rendered clipboard content (websites, Office) keeps the default paste;
        // markdown conversion only kicks in for plain-text clipboards.
        if (!clipboard || clipboard.types.includes("text/html")) return false;
        const text = clipboard.getData("text/plain");
        if (!looksLikeMarkdown(text) || !editorRef.current) return false;
        editorRef.current.chain().focus().insertContent(markdownToHtml(text)).run();
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => onChangeRef.current(instance.getHTML()),
  });

  // Keep the field in sync when the value is changed outside the editor.
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const state = useToolbarState(editor);

  const { startUpload: uploadImage, isUploading: uploadingImage } = useUploadThing("blogMedia", {
    onClientUploadComplete: (files) => {
      setError("");
      const file = files[0];
      if (file && editor) {
        editor.chain().focus().setImage({ src: file.ufsUrl, alt: file.name }).run();
      }
    },
    onUploadError: (message) => setError(message.message || "The image could not be uploaded."),
  });

  const { startUpload: uploadVideo, isUploading: uploadingVideo } = useUploadThing("blogMedia", {
    onClientUploadComplete: (files) => {
      setError("");
      const file = files[0];
      if (file && editor) {
        editor.chain().focus().insertContent({ type: "video", attrs: { src: file.ufsUrl } }).run();
      }
    },
    onUploadError: (message) => setError(message.message || "The video could not be uploaded."),
  });

  function promptLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", previous ?? "https://");
    if (href === null) return;
    if (href.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: href.trim() }).run();
  }

  function promptYoutube() {
    if (!editor) return;
    const url = window.prompt("YouTube video URL", "https://www.youtube.com/watch?v=");
    if (!url || url === "https://www.youtube.com/watch?v=") return;
    editor.commands.setYoutubeVideo({ src: url });
  }

  if (!editor) return <div className="wtiptap is-loading" aria-busy="true" />;

  const busy = uploadingImage || uploadingVideo;

  return (
    <div className="wtiptap">
      <div className="wtiptap-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" title="Bold" aria-label="Bold" aria-pressed={state.bold} className={state.bold ? "is-active" : undefined} onClick={() => editor.chain().focus().toggleBold().run()}>
          <IconBold />
        </button>
        <button type="button" title="Italic" aria-label="Italic" aria-pressed={state.italic} className={state.italic ? "is-active" : undefined} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <IconItalic />
        </button>
        <button type="button" title="Underline" aria-label="Underline" aria-pressed={state.underline} className={state.underline ? "is-active" : undefined} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <IconUnderline />
        </button>
        <button type="button" title="Strikethrough" aria-label="Strikethrough" aria-pressed={state.strike} className={state.strike ? "is-active" : undefined} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <IconStrike />
        </button>

        <button type="button" title="Heading 2" aria-label="Heading 2" aria-pressed={state.h2} className="wtiptap-text" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </button>
        <button type="button" title="Heading 3" aria-label="Heading 3" aria-pressed={state.h3} className="wtiptap-text" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </button>

        <button type="button" title="Bullet list" aria-label="Bullet list" aria-pressed={state.bulletList} className={state.bulletList ? "is-active" : undefined} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <IconBulletList />
        </button>
        <button type="button" title="Numbered list" aria-label="Numbered list" aria-pressed={state.orderedList} className={state.orderedList ? "is-active" : undefined} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <IconOrderedList />
        </button>
        <button type="button" title="Quote" aria-label="Quote" aria-pressed={state.blockquote} className={state.blockquote ? "is-active" : undefined} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <IconQuote />
        </button>
        <button type="button" title="Code block" aria-label="Code block" aria-pressed={state.codeBlock} className={state.codeBlock ? "is-active" : undefined} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <IconCode />
        </button>

        <button type="button" title="Add link" aria-label="Add link" aria-pressed={state.link} className={state.link ? "is-active" : undefined} onClick={promptLink}>
          <IconLink />
        </button>
        <button type="button" title="Remove link" aria-label="Remove link" disabled={!state.link} onClick={() => editor.chain().focus().unsetLink().run()}>
          <IconUnlink />
        </button>

        <button
          type="button"
          title="Insert image"
          aria-label="Insert image"
          disabled={busy}
          onClick={() => imageInputRef.current?.click()}
        >
          <IconImage />
        </button>
        <button
          type="button"
          title="Insert video"
          aria-label="Insert video"
          disabled={busy}
          onClick={() => videoInputRef.current?.click()}
        >
          <IconVideo />
        </button>
        <button type="button" title="Embed YouTube video" aria-label="Embed YouTube video" onClick={promptYoutube}>
          <IconYoutube />
        </button>

        <button type="button" title="Undo" aria-label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <IconUndo />
        </button>
        <button type="button" title="Redo" aria-label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <IconRedo />
        </button>

        <button
          type="button"
          className="wtiptap-clear"
          aria-pressed={tab === "preview"}
          onClick={() => setTab(tab === "write" ? "preview" : "write")}
        >
          {tab === "write" ? "Preview" : "Keep writing"}
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) uploadImage(files.slice(0, 1));
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) uploadVideo(files.slice(0, 1));
          }}
        />
      </div>

      {error ? (
        <p className="wdialog-error" role="alert">
          {error}
        </p>
      ) : null}

      {tab === "write" ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="wtiptap-content" aria-label="Post preview">
          <div dangerouslySetInnerHTML={{ __html: value }} />
        </div>
      )}
    </div>
  );
}
