"use client";

import CheckBox from "@/app/panel/_components/ui/checkbox";
import Select from "@/app/panel/_components/ui/select";
import {
  AI_DEPTHS,
  AI_DEPTH_LABELS,
  AI_LANGUAGES,
  AI_LANGUAGE_LABELS,
  AI_STYLES,
  AI_STYLE_LABELS,
  type AiDepth,
  type AiFields,
  type AiLanguage,
  type AiModelInfo,
  type AiStyle,
} from "../_ai";
import ModelPicker from "./model-picker";

/**
 * The setup half of the AI dialog: topic brief, fields to generate, model
 * pickers and the writing preferences. Presentational — the dialog shell
 * owns the state.
 */

export const FIELD_OPTIONS: { key: keyof AiFields; label: string; note: string }[] = [
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

type Props = {
  topic: string;
  onTopicChange: (topic: string) => void;
  fields: AiFields;
  onFieldChange: (key: keyof AiFields, checked: boolean) => void;
  models: { text: AiModelInfo[]; image: AiModelInfo[] } | null;
  modelsError: string;
  textModelId: string;
  onTextModelChange: (id: string) => void;
  imageModelId: string;
  onImageModelChange: (id: string) => void;
  style: AiStyle;
  onStyleChange: (style: AiStyle) => void;
  depth: AiDepth;
  onDepthChange: (depth: AiDepth) => void;
  language: AiLanguage;
  onLanguageChange: (language: AiLanguage) => void;
  webSearch: boolean;
  onWebSearchChange: (webSearch: boolean) => void;
  /** Generation or saving error, shown at the bottom of the form. */
  error: string;
};

export default function AiSetupView({
  topic,
  onTopicChange,
  fields,
  onFieldChange,
  models,
  modelsError,
  textModelId,
  onTextModelChange,
  imageModelId,
  onImageModelChange,
  style,
  onStyleChange,
  depth,
  onDepthChange,
  language,
  onLanguageChange,
  webSearch,
  onWebSearchChange,
  error,
}: Props) {
  return (
    <div className="wform">
      <div className="wfield">
        <label htmlFor="wai-topic">Topic / brief</label>
        <textarea
          id="wai-topic"
          rows={3}
          value={topic}
          maxLength={2000}
          onChange={(event) => onTopicChange(event.target.value)}
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
                onChange={(checked) => onFieldChange(option.key, checked)}
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
        <ModelPicker label="Text model" models={models.text} value={textModelId} onChange={onTextModelChange} />
      ) : null}
      {(fields.cover || fields.contentImages) && models && models.image.length > 0 ? (
        <ModelPicker label="Image model" models={models.image} value={imageModelId} onChange={onImageModelChange} />
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
            onChange={(next) => onStyleChange(next as AiStyle)}
            options={AI_STYLES.map((value) => ({ value, label: AI_STYLE_LABELS[value] }))}
            note={STYLE_NOTES[style]}
          />
          <Select
            label="Depth"
            value={depth}
            onChange={(next) => onDepthChange(next as AiDepth)}
            options={AI_DEPTHS.map((value) => ({ value, label: AI_DEPTH_LABELS[value] }))}
            note={DEPTH_NOTES[depth]}
          />
          <Select
            label="Language"
            value={language}
            onChange={(next) => onLanguageChange(next as AiLanguage)}
            options={AI_LANGUAGES.map((value) => ({ value, label: AI_LANGUAGE_LABELS[value] }))}
            note="Language used for the generated text."
          />
        </div>
      </section>

      <CheckBox
        className="wai-web-search"
        checked={webSearch}
        onChange={onWebSearchChange}
        label="Research the web first"
        note="A research model (Settings → AI) searches the web; the post cites its sources and ends with a numbered bibliography. Adds a small cost and up to a few minutes."
      />

      {error ? (
        <p className="wdialog-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
