"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { MediaAlign } from "./extensions";
import {
  IconAlignCenter, IconAlignJustify, IconAlignLeft, IconAlignRight, IconBold, IconBulletList, IconClearFormat,
  IconCode, IconCollapse, IconDivider, IconExpand, IconHighlight, IconImage, IconIndent, IconInlineCode, IconItalic,
  IconLink, IconOrderedList, IconOutdent, IconQuote, IconRedo, IconSource, IconStrike, IconSubscript, IconSuperscript,
  IconTable, IconTaskList, IconTextColor, IconUnderline, IconUndo, IconVideo, IconYoutube,
} from "./icons";

const TEXT_COLORS = [
  { label: "Ink", value: "#101418" },
  { label: "Slate", value: "#5e666d" },
  { label: "Indigo", value: "#4353e8" },
  { label: "Green", value: "#2f7a3d" },
  { label: "Amber", value: "#b45309" },
  { label: "Red", value: "#b3372a" },
  { label: "Violet", value: "#7c3aed" },
];

const HIGHLIGHTS = [
  { label: "Lime", value: "#e6f7c2" },
  { label: "Yellow", value: "#fff1a8" },
  { label: "Sky", value: "#dde5ff" },
  { label: "Rose", value: "#fde1e1" },
  { label: "Mint", value: "#d9f2e2" },
  { label: "Sand", value: "#f1e9dc" },
  { label: "Grey", value: "#e8ebe9" },
];

const BLOCKS = [
  { value: "paragraph", label: "Paragraph" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
] as const;

/** Toolbar buttons never take focus away from the document, so the selection stays put. */
function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={active ? "is-active" : undefined}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const Separator = () => <span className="wtiptap-sep" aria-hidden="true" />;

/** A toolbar button that opens a swatch palette; picking a swatch or "none" closes it. */
function ColorMenu({
  label, swatches, current, icon, onPick, onClear,
}: {
  label: string;
  swatches: { label: string; value: string }[];
  current?: string;
  icon: ReactNode;
  onPick: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <span className="wtiptap-menu" ref={ref}>
      <Tool label={label} active={open || Boolean(current)} onClick={() => setOpen((value) => !value)}>
        {icon}
      </Tool>
      {open ? (
        <span className="wtiptap-pop" role="menu" aria-label={label}>
          {swatches.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              role="menuitem"
              title={swatch.label}
              aria-label={swatch.label}
              className={current?.toLowerCase() === swatch.value ? "wtiptap-swatch is-current" : "wtiptap-swatch"}
              style={{ background: swatch.value }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onPick(swatch.value);
                setOpen(false);
              }}
            />
          ))}
          <button
            type="button"
            role="menuitem"
            title="None"
            aria-label={`Remove ${label.toLowerCase()}`}
            className="wtiptap-swatch is-none"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onClear();
              setOpen(false);
            }}
          />
        </span>
      ) : null}
    </span>
  );
}

type ToolbarProps = {
  editor: Editor;
  /** In source (HTML) mode only the mode toggles stay active. */
  source: boolean;
  fullscreen: boolean;
  uploading: boolean;
  onLink: () => void;
  onImage: () => void;
  onVideo: () => void;
  onEmbed: () => void;
  onToggleSource: () => void;
  onToggleFullscreen: () => void;
};

export function Toolbar({ editor, source, fullscreen, uploading, onLink, onImage, onVideo, onEmbed, onToggleSource, onToggleFullscreen }: ToolbarProps) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("heading", { level: 4 }) ? "h4" : "paragraph",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      subscript: e.isActive("subscript"),
      superscript: e.isActive("superscript"),
      color: e.getAttributes("textStyle").color as string | undefined,
      highlight: e.isActive("highlight") ? ((e.getAttributes("highlight").color as string | undefined) ?? "#fff1a8") : undefined,
      align: (["left", "center", "right", "justify"] as const).find((value) => e.isActive({ textAlign: value })) ?? "left",
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      taskList: e.isActive("taskList"),
      canIndent: e.can().sinkListItem("listItem") || e.can().sinkListItem("taskItem"),
      canOutdent: e.can().liftListItem("listItem") || e.can().liftListItem("taskItem"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();
  const off = source;

  return (
    <div className="wtiptap-toolbar" role="toolbar" aria-label="Formatting">
      <Tool label="Undo" disabled={off || !state.canUndo} onClick={() => chain().undo().run()}>
        <IconUndo />
      </Tool>
      <Tool label="Redo" disabled={off || !state.canRedo} onClick={() => chain().redo().run()}>
        <IconRedo />
      </Tool>
      <Separator />

      <label className="visually-hidden" htmlFor={`${editor.instanceId}-block`}>
        Text style
      </label>
      <select
        id={`${editor.instanceId}-block`}
        className="wtiptap-select"
        value={state.block}
        disabled={off}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "paragraph") chain().setParagraph().run();
          else chain().setHeading({ level: Number(value.slice(1)) as 2 | 3 | 4 }).run();
        }}
      >
        {BLOCKS.map((block) => (
          <option key={block.value} value={block.value}>
            {block.label}
          </option>
        ))}
      </select>
      <Separator />

      <Tool label="Bold (Ctrl+B)" active={state.bold} disabled={off} onClick={() => chain().toggleBold().run()}>
        <IconBold />
      </Tool>
      <Tool label="Italic (Ctrl+I)" active={state.italic} disabled={off} onClick={() => chain().toggleItalic().run()}>
        <IconItalic />
      </Tool>
      <Tool label="Underline (Ctrl+U)" active={state.underline} disabled={off} onClick={() => chain().toggleUnderline().run()}>
        <IconUnderline />
      </Tool>
      <Tool label="Strikethrough" active={state.strike} disabled={off} onClick={() => chain().toggleStrike().run()}>
        <IconStrike />
      </Tool>
      <Tool label="Inline code" active={state.code} disabled={off} onClick={() => chain().toggleCode().run()}>
        <IconInlineCode />
      </Tool>
      <Tool label="Subscript" active={state.subscript} disabled={off} onClick={() => chain().toggleSubscript().run()}>
        <IconSubscript />
      </Tool>
      <Tool label="Superscript" active={state.superscript} disabled={off} onClick={() => chain().toggleSuperscript().run()}>
        <IconSuperscript />
      </Tool>
      {off ? null : (
        <>
          <ColorMenu
            label="Text colour"
            swatches={TEXT_COLORS}
            current={state.color}
            icon={<IconTextColor swatch={state.color} />}
            onPick={(value) => chain().setColor(value).run()}
            onClear={() => chain().unsetColor().run()}
          />
          <ColorMenu
            label="Highlight"
            swatches={HIGHLIGHTS}
            current={state.highlight}
            icon={<IconHighlight swatch={state.highlight} />}
            onPick={(value) => chain().setHighlight({ color: value }).run()}
            onClear={() => chain().unsetHighlight().run()}
          />
        </>
      )}
      <Separator />

      <Tool label="Align left" active={state.align === "left"} disabled={off} onClick={() => chain().setTextAlign("left").run()}>
        <IconAlignLeft />
      </Tool>
      <Tool label="Align centre" active={state.align === "center"} disabled={off} onClick={() => chain().setTextAlign("center").run()}>
        <IconAlignCenter />
      </Tool>
      <Tool label="Align right" active={state.align === "right"} disabled={off} onClick={() => chain().setTextAlign("right").run()}>
        <IconAlignRight />
      </Tool>
      <Tool label="Justify" active={state.align === "justify"} disabled={off} onClick={() => chain().setTextAlign("justify").run()}>
        <IconAlignJustify />
      </Tool>
      <Separator />

      <Tool label="Bullet list" active={state.bulletList} disabled={off} onClick={() => chain().toggleBulletList().run()}>
        <IconBulletList />
      </Tool>
      <Tool label="Numbered list" active={state.orderedList} disabled={off} onClick={() => chain().toggleOrderedList().run()}>
        <IconOrderedList />
      </Tool>
      <Tool label="Checklist" active={state.taskList} disabled={off} onClick={() => chain().toggleTaskList().run()}>
        <IconTaskList />
      </Tool>
      <Tool
        label="Indent (Tab)"
        disabled={off || !state.canIndent}
        onClick={() => (editor.can().sinkListItem("taskItem") ? chain().sinkListItem("taskItem") : chain().sinkListItem("listItem")).run()}
      >
        <IconIndent />
      </Tool>
      <Tool
        label="Outdent (Shift+Tab)"
        disabled={off || !state.canOutdent}
        onClick={() => (editor.can().liftListItem("taskItem") ? chain().liftListItem("taskItem") : chain().liftListItem("listItem")).run()}
      >
        <IconOutdent />
      </Tool>
      <Separator />

      <Tool label="Quote" active={state.blockquote} disabled={off} onClick={() => chain().toggleBlockquote().run()}>
        <IconQuote />
      </Tool>
      <Tool label="Code block" active={state.codeBlock} disabled={off} onClick={() => chain().toggleCodeBlock().run()}>
        <IconCode />
      </Tool>
      <Tool label="Divider" disabled={off} onClick={() => chain().setHorizontalRule().run()}>
        <IconDivider />
      </Tool>
      <Separator />

      <Tool label="Link (Ctrl+K)" active={state.link} disabled={off} onClick={onLink}>
        <IconLink />
      </Tool>
      <Tool label="Image: choose from the library or upload" disabled={off || uploading} onClick={onImage}>
        <IconImage />
      </Tool>
      <Tool label="Video: choose from the library or upload" disabled={off || uploading} onClick={onVideo}>
        <IconVideo />
      </Tool>
      <Tool label="Embed YouTube or video link" disabled={off} onClick={onEmbed}>
        <IconYoutube />
      </Tool>
      <Tool
        label="Insert table"
        active={state.table}
        disabled={off || state.table}
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <IconTable />
      </Tool>
      <Separator />

      <Tool label="Clear formatting" disabled={off} onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <IconClearFormat />
      </Tool>
      <span className="wtiptap-toolbar-end">
        <Tool label={source ? "Back to the editor" : "Edit HTML source"} active={source} onClick={onToggleSource}>
          <IconSource />
        </Tool>
        <Tool label={fullscreen ? "Exit full screen (Esc)" : "Full screen"} active={fullscreen} onClick={onToggleFullscreen}>
          {fullscreen ? <IconCollapse /> : <IconExpand />}
        </Tool>
      </span>
    </div>
  );
}

/** Row and column tools, shown while the cursor is inside a table. */
export function TableBar({ editor }: { editor: Editor }) {
  const can = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      inTable: e.isActive("table"),
      merge: e.can().mergeCells(),
      split: e.can().splitCell(),
    }),
  });
  if (!can.inTable) return null;
  const chain = () => editor.chain().focus();
  const action = (label: string, run: () => void, disabled = false, danger = false) => (
    <button
      type="button"
      className={danger ? "wtiptap-chip is-danger" : "wtiptap-chip"}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );

  return (
    <div className="wtiptap-context" role="toolbar" aria-label="Table">
      <span className="wtiptap-context-label">Table</span>
      {action("+ Row above", () => chain().addRowBefore().run())}
      {action("+ Row below", () => chain().addRowAfter().run())}
      {action("+ Column left", () => chain().addColumnBefore().run())}
      {action("+ Column right", () => chain().addColumnAfter().run())}
      {action("Header row", () => chain().toggleHeaderRow().run())}
      {action("Merge cells", () => chain().mergeCells().run(), !can.merge)}
      {action("Split cell", () => chain().splitCell().run(), !can.split)}
      {action("Delete row", () => chain().deleteRow().run(), false, true)}
      {action("Delete column", () => chain().deleteColumn().run(), false, true)}
      {action("Delete table", () => chain().deleteTable().run(), false, true)}
    </div>
  );
}

const ALIGNMENTS: { value: MediaAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
  { value: "wide", label: "Full width" },
];

/** Alt text, alignment and size for the selected image. */
export function ImageBar({ editor }: { editor: Editor }) {
  const image = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e.isActive("image")
        ? {
            alt: (e.getAttributes("image").alt as string | null) ?? "",
            align: ((e.getAttributes("image").align as MediaAlign | null) ?? "center") as MediaAlign,
            sized: Boolean(e.getAttributes("image").width),
          }
        : null,
  });
  if (!image) return null;

  return (
    <div className="wtiptap-context" role="toolbar" aria-label="Image">
      <span className="wtiptap-context-label">Image</span>
      <label className="wtiptap-alt">
        <span>Alt text</span>
        <input
          type="text"
          value={image.alt}
          placeholder="Describe the image for screen readers"
          onChange={(event) => editor.chain().updateAttributes("image", { alt: event.target.value }).run()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
        />
      </label>
      <span className="wtiptap-chip-group" role="group" aria-label="Alignment">
        {ALIGNMENTS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={image.align === option.value ? "wtiptap-chip is-active" : "wtiptap-chip"}
            aria-pressed={image.align === option.value}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              editor
                .chain()
                .updateAttributes("image", option.value === "wide" ? { align: "wide", width: null, height: null } : { align: option.value })
                .run()
            }
          >
            {option.label}
          </button>
        ))}
      </span>
      <button
        type="button"
        className="wtiptap-chip"
        disabled={!image.sized}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().updateAttributes("image", { width: null, height: null }).run()}
      >
        Original size
      </button>
      <button
        type="button"
        className="wtiptap-chip is-danger"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().deleteSelection().run()}
      >
        Remove
      </button>
    </div>
  );
}
