"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, type MutableRefObject } from "react";
import { createUsePuck, type Data } from "@puckeditor/core";
import { findBlockById, regenerateBlockIds, updateBlockById } from "@/lib/page-builder/data";
import { deleteSnippetAction, saveSnippetAction, translatePageAction } from "../_actions";

/**
 * Faz 4 tools that need the Puck store (selection, dispatch): style
 * copy/paste/reset, saved sections/templates and AI translation. They render
 * through the headerActions override, so they live inside Puck's context;
 * autosave and navigation arrive from the editor via context.
 */

const usePuckApi = createUsePuck();

const STYLE_CLIPBOARD_KEY = "pb-style-clipboard";

export type SnippetDto = {
  id: string;
  name: string;
  kind: string;
  category: string | null;
  data: Data;
};

type EditorToolsValue = {
  pageId: string;
  locale: string;
  storeLocales: string[];
  /** Applies data to Puck AND marks the draft dirty for autosave. */
  setPuckData: (data: Data) => void;
  /** Written by the tools override so the main toolbar can restore revisions. */
  applyDataRef: MutableRefObject<(data: Data) => void>;
  goLocale: (locale: string) => void;
};

const EditorToolsContext = createContext<EditorToolsValue | null>(null);

export function EditorToolsProvider({ value, children }: { value: EditorToolsValue; children: ReactNode }) {
  return <EditorToolsContext.Provider value={value}>{children}</EditorToolsContext.Provider>;
}

/** Both clicks and keyboard submits land here. */
function notify(message: string) {
  window.alert(message);
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T | { error: string }> {  try {
    const response = await fetch(input, init);
    const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!response.ok || !payload) return { error: "The request failed." };
    if (payload.error) return { error: payload.error };
    return payload;
  } catch {
    return { error: "Network error." };
  }
}

function SectionsPanel({ data, selectedId, applyData }: { data: Data; selectedId: string | null; applyData: (next: Data) => void }) {
  const [snippets, setSnippets] = useState<SnippetDto[] | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const result = await fetchJson<SnippetDto[]>("/api/admin/pages/snippets");
    setSnippets(Array.isArray(result) ? result : []);
  }, []);

  async function saveSelection() {
    const block = selectedId ? findBlockById(data, selectedId) : null;
    if (!block) return;
    const name = window.prompt("Name this section");
    if (!name) return;
    setBusy(true);
    const result = await fetchJson<{ id: string }>("/api/admin/pages/snippets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, kind: "section", data: { root: { props: {} }, content: [block] } }),
    });
    setBusy(false);
    if ("error" in result) window.alert(result.error);
    else await reload();
  }

  async function apply(snippet: SnippetDto) {
    const isTemplate = snippet.kind === "template";
    // A template throws the whole draft away — say so before it happens.
    if (isTemplate && !window.confirm(`Replace the whole page content with the template "${snippet.name}"?`)) return;
    // Fresh ids everywhere: two copies of one section would share scoped CSS rules.
    const fresh = regenerateBlockIds(snippet.data).content;
    applyData(isTemplate ? { ...data, content: fresh } : { ...data, content: [...(data.content ?? []), ...fresh] });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this saved item?")) return;
    const result = await fetchJson<{ ok: boolean }>(`/api/admin/pages/snippets?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if ("error" in result) window.alert(result.error);
    else await reload();
  }

  return (
    <details className="pb-editor-revisions" onToggle={(event) => (event.currentTarget.open ? void reload() : undefined)}>
      <summary className="pb-editor-button">Sections</summary>
      <div className="pb-editor-revisions-list pb-editor-snippets">
        <button type="button" className="pb-editor-button" disabled={busy || !selectedId} onClick={() => void saveSelection()}>
          Save selected block as section
        </button>
        {!snippets ? (
          <p>Loading…</p>
        ) : snippets.length === 0 ? (
          <p>No saved sections yet.</p>
        ) : (
          snippets.map((snippet) => (
            <div key={snippet.id} className="pb-editor-snippet-row">
              <button type="button" className="pb-editor-button" onClick={() => void apply(snippet)}>
                {snippet.kind === "template" ? "▤" : "▣"} {snippet.name}
              </button>
              <button type="button" className="pb-editor-button" aria-label={`Delete ${snippet.name}`} onClick={() => void remove(snippet.id)}>
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </details>
  );
}

function TranslatePanel() {
  const tools = useContext(EditorToolsContext);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  if (!tools) return null;
  const targets = tools.storeLocales.filter((candidate) => candidate !== tools.locale);

  async function translate() {
    if (!target) return;
    // The translation overwrites an existing draft of the target language.
    if (!window.confirm(`Translate this ${tools!.locale} version to ${target}? An existing ${target} draft will be replaced.`)) return;
    setBusy(true);
    const result = await translatePageAction(tools!.pageId, tools!.locale, target);
    setBusy(false);
    if (result.ok) tools!.goLocale(target);
    else window.alert(result.error);
  }

  if (targets.length === 0) return null;
  return (
    <span className="pb-editor-translate">
      <select
        className="pb-editor-select"
        aria-label="Translate page to"
        value={target}
        onChange={(event) => setTarget(event.currentTarget.value)}
      >
        <option value="">Translate to…</option>
        {targets.map((candidate) => (
          <option key={candidate} value={candidate}>
            {candidate}
          </option>
        ))}
      </select>
      <button type="button" className="pb-editor-button" disabled={!target || busy} onClick={() => void translate()}>
        {busy ? "Translating…" : "AI"}
      </button>
    </span>
  );
}

/** The headerActions override: rendered inside Puck, where the store lives. */
export function EditorHeaderTools({ children }: { children?: ReactNode }) {
  const tools = useContext(EditorToolsContext);
  const selectedItem = usePuckApi((store) => store.selectedItem);
  const data = usePuckApi((store) => store.appState.data);
  const dispatch = usePuckApi((store) => store.dispatch);
  const selectedId = selectedItem ? String((selectedItem.props as { id?: unknown }).id ?? "") : "";
  const selectedBlock = selectedId ? findBlockById(data, selectedId) : null;

  const applyData = useCallback(
    (next: Data) => {
      dispatch({ type: "setData", data: next });
      tools?.setPuckData(next);
    },
    [dispatch, tools],
  );

  // The main toolbar (restore revisions) applies documents through this ref.
  useEffect(() => {
    if (tools) tools.applyDataRef.current = applyData;
  }, [applyData, tools]);

  const styleOf = () => (selectedBlock?.props as { style?: unknown } | null)?.style ?? null;

  function copyStyle() {
    const style = styleOf();
    if (!style) return notify("The selected block has no custom styles.");
    window.localStorage.setItem(STYLE_CLIPBOARD_KEY, JSON.stringify(style));
  }

  function pasteStyle() {
    if (!selectedBlock) return notify("Select a block first.");
    let style: unknown;
    try {
      style = JSON.parse(window.localStorage.getItem(STYLE_CLIPBOARD_KEY) ?? "null");
    } catch {
      return notify("The style clipboard is broken — copy a style first.");
    }
    if (!style) return notify("No style copied yet — copy one first.");
    applyData(
      updateBlockById(data, selectedId, (block) => ({
        ...block,
        props: { ...block.props, style } as typeof block.props,
      })),
    );
  }

  function resetStyle() {
    if (!selectedBlock) return notify("Select a block first.");
    applyData(
      updateBlockById(data, selectedId, (block) => ({
        ...block,
        props: { ...block.props, style: undefined } as typeof block.props,
      })),
    );
  }

  return (
    <>
      {children}
      <button type="button" className="pb-editor-button" disabled={!selectedBlock || !styleOf()} onClick={copyStyle}>
        Copy style
      </button>
      <button type="button" className="pb-editor-button" disabled={!selectedBlock} onClick={pasteStyle}>
        Paste style
      </button>
      <button type="button" className="pb-editor-button" disabled={!selectedBlock || !styleOf()} onClick={resetStyle}>
        Reset style
      </button>
      <SectionsPanel data={data} selectedId={selectedId} applyData={applyData} />
      <TranslatePanel />
    </>
  );
}
