"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import MediaPicker from "../media-picker";
import type { MediaEndpoint, MediaKind } from "../use-optimized-upload";
import { richTextExtensions } from "./extensions";
import { looksLikeMarkdown, markdownToHtml } from "./markdown";
import { ImageBar, TableBar, Toolbar } from "./toolbar";
import { toMediaNodes, useMediaUpload } from "./use-media-upload";
import { IconUpload } from "./icons";

type Props = {
  id: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Accessible name of the editing area. */
  label?: string;
  /** Upload endpoint for embedded images and videos. */
  endpoint?: MediaEndpoint;
};

type Prompt = { kind: "link" | "embed"; value: string };

const YOUTUBE = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i;

/** Word and character counts for the status bar. */
function useCounts(editor: Editor | null) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e ? { words: e.storage.characterCount.words(), characters: e.storage.characterCount.characters() } : { words: 0, characters: 0 },
  }) ?? { words: 0, characters: 0 };
}

/**
 * Full rich text editor (Tiptap 3) for catalogue descriptions: headings, marks,
 * colours, alignment, lists and checklists, tables, links, resizable images,
 * videos and YouTube embeds. The image and video buttons open the media
 * library to reuse an upload or add a new one; files can also be pasted or
 * dropped straight in. Images are optimized to WebP before every upload.
 */
export default function RichTextEditor({ id, value, onChange, placeholder = "Start writing…", label = "Description", endpoint = "catalogContent" }: Props) {
  const onChangeRef = useRef(onChange);
  // The editor's own handlers are created once, so they reach the instance and the uploader through refs.
  const editorRef = useRef<Editor | null>(null);
  const uploadRef = useRef<(files: File[], at?: number) => Promise<void>>(async () => {});
  const [source, setSource] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [promptError, setPromptError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [picker, setPicker] = useState<MediaKind | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: richTextExtensions(placeholder),
    content: value,
    // Next.js renders on the server; deferring construction avoids a hydration mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "wtiptap-content", id, "aria-label": label, "aria-multiline": "true" },
      handlePaste: (_view, event) => {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        const files = Array.from(clipboard.files);
        if (files.length > 0) {
          void uploadRef.current(files);
          return true;
        }
        // Rendered clipboards (websites, Office) keep the default paste; only plain-text markdown converts.
        if (clipboard.types.includes("text/html")) return false;
        const text = clipboard.getData("text/plain");
        if (!looksLikeMarkdown(text) || !editorRef.current) return false;
        editorRef.current.chain().focus().insertContent(markdownToHtml(text)).run();
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || files.length === 0) return false;
        event.preventDefault();
        void uploadRef.current(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          openPrompt("link");
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: instance }) => onChangeRef.current(instance.getHTML()),
  });

  const media = useMediaUpload(editor, endpoint);

  useEffect(() => {
    // The editor's own handlers are created once; they reach the current
    // instance and uploader through these refs after every commit.
    editorRef.current = editor;
    uploadRef.current = media.upload;
  });
  const counts = useCounts(editor);

  // Keep the document in sync when the value changes outside the editor.
  useEffect(() => {
    if (editor && source === null && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value, source]);

  // Full screen: Esc leaves it and the page behind stops scrolling.
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: globalThis.KeyboardEvent) => {
      // Esc in an open dialog (the media library) closes only that dialog.
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  function openPrompt(kind: Prompt["kind"]) {
    const instance = editorRef.current;
    if (!instance) return;
    setPromptError("");
    setPrompt({ kind, value: kind === "link" ? ((instance.getAttributes("link").href as string | undefined) ?? "") : "" });
  }

  function closePrompt() {
    setPrompt(null);
    setPromptError("");
    editor?.commands.focus();
  }

  function applyPrompt() {
    if (!editor || !prompt) return;
    const url = prompt.value.trim();

    if (prompt.kind === "link") {
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
      } else if (editor.state.selection.empty && !editor.isActive("link")) {
        editor.chain().focus().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }
      closePrompt();
      return;
    }

    if (!/^https?:\/\//i.test(url) && !YOUTUBE.test(url)) {
      setPromptError("Paste a full link that starts with https://");
      return;
    }
    const inserted = YOUTUBE.test(url)
      ? editor.chain().focus().setYoutubeVideo({ src: url }).run()
      : editor.chain().focus().insertContent({ type: "video", attrs: { src: url } }).run();
    if (!inserted) {
      setPromptError("That YouTube link could not be embedded. Use the video's watch or share link.");
      return;
    }
    closePrompt();
  }

  function onPromptKey(event: KeyboardEvent<HTMLInputElement>) {
    // Enter must not submit the surrounding form.
    if (event.key === "Enter") {
      event.preventDefault();
      applyPrompt();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePrompt();
    }
  }

  function toggleSource() {
    if (!editor) return;
    if (source === null) {
      setPrompt(null);
      setSource(editor.getHTML());
      return;
    }
    editor.commands.setContent(source, { emitUpdate: false });
    onChangeRef.current(editor.getHTML());
    setSource(null);
  }

  const dropHandlers = {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (source === null && event.dataTransfer.types.includes("Files")) setDragging(true);
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setDragging(false);
    },
    onDrop: () => setDragging(false),
  };

  if (!editor) return <div className="wtiptap wtiptap-rich is-loading" aria-busy="true" />;

  return (
    <div className={fullscreen ? "wtiptap wtiptap-rich is-fullscreen" : "wtiptap wtiptap-rich"}>
      <Toolbar
        editor={editor}
        source={source !== null}
        fullscreen={fullscreen}
        uploading={media.busy}
        onLink={() => openPrompt("link")}
        onImage={() => setPicker("image")}
        onVideo={() => setPicker("video")}
        onEmbed={() => openPrompt("embed")}
        onToggleSource={toggleSource}
        onToggleFullscreen={() => setFullscreen((value) => !value)}
      />

      {prompt ? (
        <div className="wtiptap-prompt" role="group" aria-label={prompt.kind === "link" ? "Link" : "Embed a video"}>
          <label htmlFor={`${id}-prompt`}>{prompt.kind === "link" ? "Link URL" : "YouTube or video URL"}</label>
          <input
            key={prompt.kind}
            autoFocus
            id={`${id}-prompt`}
            type="url"
            inputMode="url"
            value={prompt.value}
            placeholder={prompt.kind === "link" ? "https://example.com" : "https://www.youtube.com/watch?v=… or https://…/clip.mp4"}
            onChange={(event) => setPrompt({ ...prompt, value: event.target.value })}
            onKeyDown={onPromptKey}
          />
          <button type="button" className="wtiptap-chip is-primary" onClick={applyPrompt}>
            {prompt.kind === "link" ? "Apply" : "Embed"}
          </button>
          {prompt.kind === "link" && editor.isActive("link") ? (
            <button
              type="button"
              className="wtiptap-chip is-danger"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                closePrompt();
              }}
            >
              Remove link
            </button>
          ) : null}
          <button type="button" className="wtiptap-chip" onClick={closePrompt}>
            Cancel
          </button>
          {promptError ? (
            <p className="wtiptap-prompt-error" role="alert">
              {promptError}
            </p>
          ) : null}
        </div>
      ) : null}

      {source === null ? (
        <>
          <TableBar editor={editor} />
          <ImageBar editor={editor} />
        </>
      ) : null}

      {media.error ? (
        <p className="wdialog-error" role="alert">
          {media.error}{" "}
          <button type="button" className="wtiptap-dismiss" onClick={media.clearError}>
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="wtiptap-body" {...dropHandlers}>
        {source === null ? (
          <EditorContent editor={editor} />
        ) : (
          <textarea
            className="wtiptap-source"
            aria-label={`${label} HTML source`}
            spellCheck={false}
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              onChangeRef.current(event.target.value);
            }}
          />
        )}
        {dragging ? (
          <div className="wtiptap-drop" aria-hidden="true">
            <IconUpload />
            Drop images or videos to upload
          </div>
        ) : null}
      </div>

      <div className="wtiptap-status">
        <span>
          {counts.words} {counts.words === 1 ? "word" : "words"} · {counts.characters} characters
        </span>
        <span aria-live="polite">{media.busy ? media.status : source !== null ? "Editing HTML source" : "Paste or drop images and videos to upload"}</span>
      </div>

      <MediaPicker
        open={picker !== null}
        title={picker === "video" ? "Insert a video" : "Insert images"}
        kinds={["image", "video"]}
        initialKind={picker ?? "image"}
        multiple
        endpoint={endpoint}
        confirmLabel="Insert"
        onClose={() => setPicker(null)}
        onSelect={(items) => editor.chain().focus().insertContent(toMediaNodes(items)).run()}
      />
    </div>
  );
}
