"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import CheckBox from "@/app/panel/_components/ui/checkbox";
import Select from "@/app/panel/_components/ui/select";
import type { SelectOption } from "@/app/panel/_components/ui/select";
import { slugify } from "@/lib/slug";
import { saveCategory, saveTag } from "../_actions";
import {
  AI_DEPTHS,
  AI_DEPTH_LABELS,
  AI_LANGUAGES,
  AI_LANGUAGE_LABELS,
  AI_STYLES,
  AI_STYLE_LABELS,
  type AiDepth,
  type AiFields,
  type AiGenerateResult,
  type AiLanguage,
  type AiModelInfo,
  type AiStyle,
} from "../_ai";
import type { CoverRef } from "../_lib";

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

const FIELD_OPTIONS: { key: keyof AiFields; label: string; note: string }[] = [
  { key: "title", label: "Title", note: "SEO headline, max 60 characters" },
  { key: "description", label: "Description", note: "Meta description, max 160 characters" },
  { key: "content", label: "Content", note: "Full post body with headings and lists" },
  { key: "contentImages", label: "In-content images", note: "Illustrations placed between sections" },
  { key: "cover", label: "Cover image", note: "AI-generated featured image" },
  { key: "category", label: "Category", note: "Matched to the content — created when missing" },
  { key: "tags", label: "Tags", note: "Existing tags plus new suggestions" },
];

const STYLE_NOTES: Record<AiStyle, string> = {
  informative: "Clear, neutral and fact-focused.",
  conversational: "Friendly and easy to read.",
  persuasive: "Benefit-led and action-oriented.",
  technical: "Precise with implementation detail.",
};

const DEPTH_NOTES: Record<AiDepth, string> = {
  concise: "A quick overview, about 400 words.",
  standard: "Balanced detail, about 800 words.",
  "in-depth": "Thorough coverage, about 1,400 words.",
};

/** Preferred defaults, tried in order; falls back to the first free model. */
const DEFAULT_TEXT_MODELS = [
  "openai/gpt-5-mini",
  "google/gemini-3.1-flash-lite",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
];
const DEFAULT_IMAGE_MODELS = [
  "google/gemini-3.1-flash-lite-image",
  "google/gemini-3.1-flash-image",
  "google/gemini-2.5-flash-image",
];

function defaultModelId(models: AiModelInfo[], preferred: string[]): string {
  for (const id of preferred) {
    if (models.some((model) => model.id === id)) return id;
  }
  return models.find((model) => model.free)?.id ?? models[0]?.id ?? "";
}

function formatContext(context: number | null): string {
  if (!context) return "";
  return context >= 1000 ? `${Math.round(context / 1000)}k context` : `${context} context`;
}

/** Same conversion the editor uses for pasted markdown. */
function markdownToHtml(text: string): string {
  const html = marked.parse(text, { async: false }) as string;
  return html.replace(/<h([1-6])>/g, (_, level: string) => `<h${Math.min(4, Math.max(2, Number(level)))}>`);
}

/** Collapsed trigger + searchable list; native selects choke on 300+ models. */
function ModelPicker({
  label,
  models,
  value,
  onChange,
}: {
  label: string;
  models: AiModelInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState("");
  const selected = models.find((model) => model.id === value) ?? null;

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return models;
    return models.filter((model) => model.id.toLowerCase().includes(query) || model.name.toLowerCase().includes(query));
  }, [filter, models]);

  return (
    <div className="wfield">
      <div className="wfield-inline-head">
        <label>{label}</label>
      </div>
      <div className="wai-model">
        <button
          type="button"
          className="wai-model-trigger"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          disabled={models.length === 0}
        >
          <span>
            <strong>{selected?.name ?? "Choose a model"}</strong>
            <small>
              {selected
                ? `${selected.id}${selected.context ? ` · ${formatContext(selected.context)}` : ""}`
                : `${models.length} model${models.length === 1 ? "" : "s"} available`}
            </small>
          </span>
          <span aria-hidden="true" className="wai-model-chevron">
            {expanded ? "▴" : "▾"}
          </span>
        </button>

        {expanded ? (
          <div className="wai-model-list">
            <div className="wai-model-search">
              <label className="visually-hidden" htmlFor={`wai-filter-${label}`}>
                Filter models
              </label>
              <input
                id={`wai-filter-${label}`}
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by name or id…"
                autoFocus
              />
            </div>
            {filtered.map((model) => (
              <button
                type="button"
                key={model.id}
                className={`wai-model-option ${model.id === value ? "is-selected" : ""}`}
                aria-pressed={model.id === value}
                onClick={() => {
                  onChange(model.id);
                  setExpanded(false);
                  setFilter("");
                }}
              >
                <span>
                  <strong>{model.name}</strong>
                  <small>
                    {model.id}
                    {model.context ? ` · ${formatContext(model.context)}` : ""}
                  </small>
                </span>
                {model.free ? (
                  <span className="wai-free">FREE</span>
                ) : model.priceIn !== null ? (
                  <span className="wai-price">${model.priceIn.toFixed(2)}/1M</span>
                ) : null}
              </button>
            ))}
            {filtered.length === 0 ? <p className="wai-model-empty">No models match the filter.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
        setModels({ text, image });
        setTextModelId((current) => current || defaultModelId(text, DEFAULT_TEXT_MODELS));
        setImageModelId((current) => current || defaultModelId(image, DEFAULT_IMAGE_MODELS));
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
  const selectedFields = FIELD_OPTIONS.filter((option) => fields[option.key]);

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
          <div className="wform">
            <div className="wfield">
              <label htmlFor="wai-topic">Topic / brief</label>
              <textarea
                id="wai-topic"
                rows={3}
                value={topic}
                maxLength={2000}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="What should the post be about? Include the angle, audience and any must-mention details."
              />
              <p className="wfield-hint-block">
                The more specific the brief, the better the output. Existing title is used as the starting
                point.
              </p>
            </div>

            <section className="wai-fieldset" aria-labelledby="wai-fields-heading">
              <div className="wai-fieldset-head">
                <div>
                  <span className="wai-fieldset-kicker">Output / selection</span>
                  <h3 id="wai-fields-heading">Fields to generate</h3>
              <p>Generated content is saved automatically as a draft.</p>
                </div>
                <span className="wai-fields-count">{Object.values(fields).filter(Boolean).length} / {FIELD_OPTIONS.length} selected</span>
              </div>
              <div className="wai-fields">
                {FIELD_OPTIONS.map((option) => {
                  const noImageModels = (models?.image.length ?? 0) === 0;
                  const needsImages = option.key === "cover" || option.key === "contentImages";
                  const needsContent = option.key === "contentImages" && !fields.content;
                  const disabled = Boolean(modelsError) || (needsImages && noImageModels) || needsContent;
                  const note = needsContent
                    ? "Select Content first"
                    : needsImages && noImageModels
                      ? "No image model available"
                      : option.note;
                  return (
                    <CheckBox
                      key={option.key}
                      checked={fields[option.key]}
                      disabled={disabled}
                      label={option.label}
                      note={note}
                      onChange={(checked) => setFields((current) => ({ ...current, [option.key]: checked }))}
                    />
                  );
                })}
              </div>
            </section>

            {modelsError ? (
              <p className="wdialog-error" role="alert">
                {modelsError}
              </p>
            ) : null}

            {models && models.text.length > 0 ? (
              <ModelPicker label="Text model" models={models.text} value={textModelId} onChange={setTextModelId} />
            ) : null}
            {(fields.cover || fields.contentImages) && models && models.image.length > 0 ? (
              <ModelPicker label="Image model" models={models.image} value={imageModelId} onChange={setImageModelId} />
            ) : null}

            <section className="wai-preferences" aria-labelledby="wai-preferences-heading">
              <div className="wai-preferences-head">
                <span className="wai-fieldset-kicker">Article / settings</span>
                <h3 id="wai-preferences-heading">Shape the writing</h3>
                <p>Choose the tone, length and language of the generated text.</p>
              </div>
              <div className="wai-row">
                <Select
                  label="Writing style"
                  value={style}
                  onChange={(next) => setStyle(next as AiStyle)}
                  options={AI_STYLES.map((value) => ({ value, label: AI_STYLE_LABELS[value] }))}
                  note={STYLE_NOTES[style]}
                />
                <Select
                  label="Depth"
                  value={depth}
                  onChange={(next) => setDepth(next as AiDepth)}
                  options={AI_DEPTHS.map((value) => ({ value, label: AI_DEPTH_LABELS[value] }))}
                  note={DEPTH_NOTES[depth]}
                />
                <Select
                  label="Language"
                  value={language}
                  onChange={(next) => setLanguage(next as AiLanguage)}
                  options={AI_LANGUAGES.map((value) => ({ value, label: AI_LANGUAGE_LABELS[value] }))}
                  note="Language used for the generated text."
                />
              </div>
            </section>

            <CheckBox
              className="wai-web-search"
              checked={webSearch}
              onChange={setWebSearch}
              label="Let the model search the web"
              note="Checks current sources before writing. Useful for dates, versions and links; adds a small cost per request."
            />

            {error ? (
              <p className="wdialog-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : result ? (
          <div className="wai-result">
            {busy ? <p className="wai-save-state" role="status">Saving generated content as a draft…</p> : null}
            {result.warnings.length > 0 ? (
              <div className="wai-warning" role="status">
                <span aria-hidden="true">⚠</span>
                <div>
                  {result.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            ) : null}

            {result.title !== undefined ? (
              <div className="wai-result-block">
                <span className="wai-result-label">Title · {result.title.length} chars</span>
                <p className="wai-result-text">{result.title}</p>
              </div>
            ) : null}
            {result.description !== undefined ? (
              <div className="wai-result-block">
                <span className="wai-result-label">Description · {result.description.length}/160 chars</span>
                <p className="wai-result-text">{result.description}</p>
              </div>
            ) : null}
            {result.cover ? (
              <div className="wai-result-block">
                <span className="wai-result-label">Cover image · uploaded to the media library</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- UploadThing hosts are arbitrary */}
                <img className="wai-result-cover" src={result.cover.url} alt="Generated cover" />
              </div>
            ) : null}
            {result.content !== undefined ? (
              <div className="wai-result-block">
                <span className="wai-result-label">
                  Content · markdown, {result.content.split(/\s+/).length} words
                  {(result.content.match(/!\[[^\]]*\]\(/g) ?? []).length > 0
                    ? `, ${(result.content.match(/!\[[^\]]*\]\(/g) ?? []).length} inline images`
                    : ""}
                </span>
                <p className="wai-result-text">{result.content}</p>
              </div>
            ) : null}
            {result.category !== undefined ? (
              <div className="wai-result-block">
                <span className="wai-result-label">Category · created when new</span>
                <p className="wai-result-text">{result.category ?? "None suggested."}</p>
              </div>
            ) : null}
            {result.tags.length > 0 ? (
              <div className="wai-result-block">
                <span className="wai-result-label">Tags</span>
                <p className="wai-result-tags">
                  {result.tags.map((tag) => (
                    <span key={tag} className="wbadge wbadge-verified">
                      {tag}
                    </span>
                  ))}
                </p>
              </div>
            ) : null}

            {error ? (
              <p className="wdialog-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        {view === "generating" ? (
          <div className="wai-working" role="status" aria-live="polite">
            <div className="wai-working-visual" aria-hidden="true">
              <div className="wai-working-halo" />
              <div className="wai-working-sheet">
                <div className="wai-working-sheet-top">
                  <span>DRAFT / 01</span>
                  <span className="wai-working-spark">✦</span>
                </div>
                <div className="wai-working-line wai-working-line-title" />
                <div className="wai-working-line wai-working-line-long" />
                <div className="wai-working-line wai-working-line-medium" />
                <div className="wai-working-line wai-working-line-short" />
                <div className="wai-working-sheet-foot"><i /><i /><i /></div>
              </div>
            </div>
            <span className="wai-working-kicker"><i /> AI ASSISTANT / IN PROGRESS</span>
            <h3>Building your draft<span aria-hidden="true">…</span></h3>
            <p className="wai-working-description">
              Your brief is being turned into a post{webSearch ? " with current web sources" : ""}.
              You can cancel the generation and adjust your settings while it runs.
            </p>
            <div className="wai-working-fields" aria-label="Fields being generated">
              <span>CREATING</span>
              {selectedFields.map((field) => <span key={field.key}>{field.label}</span>)}
            </div>
            <div className="wai-working-progress" aria-hidden="true"><span /></div>
          </div>
        ) : null}
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
            <button
              type="button"
              className="wbtn wbtn-ghost"
              onClick={generate}
              disabled={busy}
              title="Run the generation again with the same settings"
            >
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
