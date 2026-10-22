"use client";

import { useEffect, useRef, useState } from "react";
import type { SelectOption } from "@/app/panel/_components/ui/select";
import { markdownToHtml } from "@/app/panel/_components/editor/markdown";
import { slugify } from "@/lib/slug";
import { saveCategory, saveTag } from "../_actions";
import type {
  AiDepth,
  AiFields,
  AiGenerateResult,
  AiLanguage,
  AiModelInfo,
  AiStyle,
} from "../_ai";
import type { CoverRef } from "../_lib";
import { DEFAULT_IMAGE_MODELS, DEFAULT_TEXT_MODELS, pickModel, type AiSettings } from "@/lib/ai-settings-shared";
import AiSetupView from "./ai-dialog-setup";
import AiResultView from "./ai-dialog-result";
import AiGeneratingView from "./ai-dialog-generating";

/** Everything the dialog produced, resolved to form-ready values. */
export type AiApplyPayload = {
  /** Used as the draft title when the form and generated result have no title. */
  fallbackTitle: string;
  title?: string;
  description?: string;
  contentHtml?: string;
  categoryId?: string;
  /** Category the dialog created on the fly, so the form can extend its options. */
  newCategoryOption?: SelectOption;
  /** Tags to merge into the current selection (ids). */
  tagIds?: string[];
  /** Tags the dialog created on the fly, so the form can extend its options. */
  newTagOptions?: SelectOption[];
  cover?: CoverRef | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Current title, used as the starting point for the topic brief. */
  initialTopic: string;
  categoryOptions: SelectOption[];
  tagOptions: SelectOption[];
  onApply: (payload: AiApplyPayload) => Promise<void>;
};

/** The dialog shell: view state machine, generation request and draft saving. */
export default function AiDialog({ open, onClose, initialTopic, categoryOptions, tagOptions, onApply }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const preparedDraft = useRef<{ result: AiGenerateResult; payload: AiApplyPayload } | null>(null);
  const generationRef = useRef<AbortController | null>(null);
  const generationReturnView = useRef<"setup" | "result">("setup");
  const [view, setView] = useState<"setup" | "generating" | "result">("setup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [models, setModels] = useState<{ text: AiModelInfo[]; image: AiModelInfo[] } | null>(null);
  const [modelsError, setModelsError] = useState("");

  const [topic, setTopic] = useState("");
  const [fields, setFields] = useState<AiFields>({
    title: true, description: true, content: true, contentImages: false, cover: false, category: false, tags: false,
  });
  const [style, setStyle] = useState<AiStyle>("informative");
  const [depth, setDepth] = useState<AiDepth>("standard");
  const [language, setLanguage] = useState<AiLanguage>("en");
  const [webSearch, setWebSearch] = useState(false);
  const [textModelId, setTextModelId] = useState("");
  const [imageModelId, setImageModelId] = useState("");
  const [result, setResult] = useState<AiGenerateResult | null>(null);
  // Settings → AI defaults are applied once; later openings keep the user's picks.
  const defaultsApplied = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open) {
      if (generationRef.current) {
        generationRef.current.abort();
        generationRef.current = null;
        setBusy(false);
      }
      if (dialog.open) dialog.close();
    }
  }, [open]);

  useEffect(() => () => {
    generationRef.current?.abort();
    generationRef.current = null;
  }, []);

  // Fresh state per opening; the topic starts from the current title.
  useEffect(() => {
    if (!open) return;
    setView("setup");
    setError("");
    setResult(null);
    setTopic((current) => current || initialTopic.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-initialize on open only
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setModelsError("");
    (async () => {
      try {
        const response = await fetch("/api/admin/ai/models");
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setModelsError(payload.error ?? "The model list could not be loaded.");
          setModels({ text: [], image: [] });
          return;
        }
        const text = payload.text as AiModelInfo[];
        const image = payload.image as AiModelInfo[];
        const defaults = payload.defaults as AiSettings | undefined;
        setModels({ text, image });
        const preferredText = defaults?.textModel ? [defaults.textModel, ...DEFAULT_TEXT_MODELS] : DEFAULT_TEXT_MODELS;
        const preferredImage = defaults?.imageModel ? [defaults.imageModel, ...DEFAULT_IMAGE_MODELS] : DEFAULT_IMAGE_MODELS;
        setTextModelId((current) => current || pickModel(text, preferredText));
        setImageModelId((current) => current || pickModel(image, preferredImage));
        if (defaults && !defaultsApplied.current) {
          defaultsApplied.current = true;
          setStyle(defaults.style);
          setDepth(defaults.depth);
          setLanguage(defaults.language);
          setWebSearch(defaults.webSearch);
        }
      } catch {
        if (!cancelled) {
          setModelsError("Could not reach the server.");
          setModels({ text: [], image: [] });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function generate() {
    if (!models || busy || generationRef.current) return;
    const controller = new AbortController();
    generationRef.current = controller;
    generationReturnView.current = view === "result" ? "result" : "setup";
    setBusy(true);
    setError("");
    setView("generating");
    try {
      const response = await fetch("/api/admin/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          fields,
          topic: topic.trim(),
          style,
          depth,
          language,
          webSearch,
          model: textModelId,
          imageModel: imageModelId,
          categories: categoryOptions.map((option) => option.label),
          tags: tagOptions.map((option) => option.label),
        }),
      });
      const payload = await response.json();
      if (controller.signal.aborted || generationRef.current !== controller) return;
      if (!response.ok) {
        setError(payload.error ?? "Generation failed.");
        setView(generationReturnView.current);
        return;
      }
      const generated = payload as AiGenerateResult;
      setResult(generated);
      setView("result");
      await applyGenerated(generated);
    } catch {
      if (controller.signal.aborted || generationRef.current !== controller) return;
      setError("Could not reach the server.");
      setView(generationReturnView.current);
    } finally {
      if (generationRef.current === controller) {
        generationRef.current = null;
        setBusy(false);
      }
    }
  }

  function cancelGeneration() {
    const controller = generationRef.current;
    if (!controller) return;
    generationRef.current = null;
    controller.abort();
    setBusy(false);
    setError("");
    setView(generationReturnView.current);
  }

  function closeDialog() {
    if (busy && view === "result") return;
    cancelGeneration();
    onClose();
  }

  /** Resolve generated taxonomies, then let the form save the post as a draft. */
  async function applyGenerated(generated: AiGenerateResult) {
    setBusy(true);
    setError("");
    try {
      if (preparedDraft.current?.result === generated) {
        await onApply(preparedDraft.current.payload);
        return;
      }
      const payload: AiApplyPayload = { fallbackTitle: topic.trim() };
      if (generated.title !== undefined) payload.title = generated.title;
      if (generated.description !== undefined) payload.description = generated.description;
      if (generated.content !== undefined) payload.contentHtml = markdownToHtml(generated.content);

      if (generated.category) {
        const match = categoryOptions.find((option) => option.label.toLowerCase() === generated.category?.toLowerCase());
        if (match) {
          payload.categoryId = match.value;
        } else {
          // The suggestion names the content but no category exists yet — create it.
          const created = await saveCategory({ name: generated.category, slug: slugify(generated.category), description: "", color: "#4353e8" });
          if (created.ok && created.id && created.name) {
            payload.categoryId = created.id;
            payload.newCategoryOption = { value: created.id, label: created.name };
          }
        }
      }

      if (generated.tags.length > 0) {
        const tagIds: string[] = [];
        const newTagOptions: SelectOption[] = [];
        for (const name of generated.tags) {
          const existing = tagOptions.find((option) => option.label.toLowerCase() === name.toLowerCase());
          if (existing) {
            tagIds.push(existing.value);
            continue;
          }
          const created = await saveTag({ name, slug: slugify(name) });
          if (created.ok && created.id && created.name) {
            tagIds.push(created.id);
            newTagOptions.push({ value: created.id, label: created.name });
          }
        }
        payload.tagIds = tagIds;
        payload.newTagOptions = newTagOptions;
      }

      if (generated.cover) payload.cover = generated.cover;
      preparedDraft.current = { result: generated, payload };
      await onApply(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The generated draft could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const anyField = Object.values(fields).some(Boolean);
  const needsImageModel = fields.cover || fields.contentImages;
  const canGenerate =
    Boolean(models) && !modelsError && anyField && topic.trim().length >= 3 && Boolean(textModelId) &&
    (!needsImageModel || Boolean(imageModelId));

  return (
    <dialog
      ref={ref}
      className="wdialog wdialog-wide"
      onClose={() => {
        if (open) closeDialog();
      }}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      onClick={(event) => {
        if (event.target === ref.current) closeDialog();
      }}
    >
      <header className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">Blog / AI assistant</span>
          <h2 id="wdialog-title">Generate with AI</h2>
        </div>
        <button type="button" className="wdialog-close" aria-label="Close dialog" onClick={closeDialog} disabled={busy && view === "result"}>
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="wdialog-body">
        {view === "setup" ? (
          <AiSetupView
            topic={topic}
            onTopicChange={setTopic}
            fields={fields}
            onFieldChange={(key, checked) => setFields((current) => ({ ...current, [key]: checked }))}
            models={models}
            modelsError={modelsError}
            textModelId={textModelId}
            onTextModelChange={setTextModelId}
            imageModelId={imageModelId}
            onImageModelChange={setImageModelId}
            style={style}
            onStyleChange={setStyle}
            depth={depth}
            onDepthChange={setDepth}
            language={language}
            onLanguageChange={setLanguage}
            webSearch={webSearch}
            onWebSearchChange={setWebSearch}
            error={error}
          />
        ) : result ? (
          <AiResultView result={result} busy={busy} error={error} />
        ) : null}

        {view === "generating" ? <AiGeneratingView fields={fields} webSearch={webSearch} /> : null}
      </div>

      <footer className="wdialog-foot">
        {view === "generating" ? (
          <>
            <span className="wai-foot-status"><i /> Request in progress</span>
            <button type="button" className="wbtn wbtn-ghost" onClick={cancelGeneration}>
              Cancel generation
            </button>
          </>
        ) : view === "setup" ? (
          <>
            <button type="button" className="wbtn wbtn-ghost" onClick={closeDialog} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="wbtn wbtn-primary" onClick={generate} disabled={busy || !canGenerate}>
              {busy ? "Generating…" : "Generate & save draft"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="wbtn wbtn-ghost" onClick={() => setView("setup")} disabled={busy}>
              Back to settings
            </button>
            <button type="button" className="wbtn wbtn-ghost" onClick={generate} disabled={busy} title="Run the generation again with the same settings">
              Regenerate
            </button>
            <button type="button" className="wbtn wbtn-primary" onClick={() => result && applyGenerated(result)} disabled={busy || !error}>
              {busy ? "Saving draft…" : "Retry saving draft"}
            </button>
          </>
        )}
      </footer>
    </dialog>
  );
}
