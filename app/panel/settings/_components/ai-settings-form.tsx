"use client";

import { useEffect, useState } from "react";
import CheckBox from "@/app/panel/_components/ui/checkbox";
import Select from "@/app/panel/_components/ui/select";
import ModelPicker from "@/app/panel/blog/_components/model-picker";
import {
  AI_DEPTHS,
  AI_DEPTH_LABELS,
  AI_LANGUAGES,
  AI_LANGUAGE_LABELS,
  AI_STYLES,
  AI_STYLE_LABELS,
  type AiDepth,
  type AiLanguage,
  type AiModelInfo,
  type AiStyle,
} from "@/app/panel/blog/_ai";
import { DEFAULT_RESEARCH_MODEL, NATIVE_RESEARCH, type AiSettings, type InlineCitations } from "@/lib/ai-settings-shared";

/** What each research option does; keyed by the stored value ("" = the default model). */
const RESEARCH_NOTES: Record<string, string> = {
  "": "Perplexity Sonar Pro: searches the web in one pass and cites every fact. Fast (under a minute) and typically a few cents per post.",
  "perplexity/sonar-deep-research":
    "Deep research: runs dozens of searches and reads them before answering. The most thorough option, but takes several minutes and costs noticeably more per post.",
  "perplexity/sonar-reasoning-pro": "Searches the web and reasons over the results before answering; slower than Sonar Pro.",
  "perplexity/sonar-pro-search": "Sonar Pro with multi-step search; more thorough than Sonar Pro, priced higher per search.",
  "perplexity/sonar": "The cheapest Perplexity model; fewer and shallower sources.",
  [NATIVE_RESEARCH]:
    "The content model researches with its provider's own web search — Google Search for Gemini models. Fewer sources than Perplexity.",
};
import { saveAiSettingsAction } from "../_actions";
import { EnvFacts, SettingsFoot, useSettingsForm } from "./settings-kit";

const options = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

type Catalogue = { text: AiModelInfo[]; image: AiModelInfo[] };
type KeyUsage = {
  usage: number;
  usage_daily: number;
  usage_weekly: number;
  usage_monthly: number;
  limit_remaining: number | null;
  limit: number | null;
  free_model_daily_requests: { used: number; limit: number; remaining: number };
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });

function credit(value: number | null) {
  return value === null ? "Unlimited" : usd.format(value);
}

/** Model default with an "automatic" escape hatch, since the catalogue changes over time. */
function ModelDefault({
  label,
  models,
  value,
  onChange,
}: {
  label: string;
  models: AiModelInfo[] | null;
  value: string;
  onChange: (id: string) => void;
}) {
  const unknown = Boolean(value) && models !== null && !models.some((model) => model.id === value);
  return (
    <div className="wsettings-quality">
      <CheckBox
        checked={!value}
        onChange={(automatic) => onChange(automatic ? "" : (models?.find((model) => model.free) ?? models?.[0])?.id ?? "")}
        label={`${label}: choose automatically`}
        note="The assistant picks a fast, inexpensive model that is currently available."
        disabled={!models?.length && !value}
      />
      {value ? (
        models?.length ? (
          <ModelPicker label={label} models={models} value={value} onChange={onChange} />
        ) : (
          <p className="wfield-hint-block">
            Saved: <code>{value}</code>
          </p>
        )
      ) : null}
      {unknown ? (
        <p className="wfield-error" role="alert">
          <code>{value}</code> is no longer offered by OpenRouter; the assistant falls back to automatic.
        </p>
      ) : null}
    </div>
  );
}

export default function AiSettingsForm({ settings, configured }: { settings: AiSettings; configured: boolean }) {
  const form = useSettingsForm(settings, saveAiSettingsAction);
  const { values, set } = form;
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState("");
  const [usage, setUsage] = useState<KeyUsage | null>(null);
  const [usageError, setUsageError] = useState("");

  // Perplexity models search by themselves; any other model researches through its native web search.
  const perplexity = (catalogue?.text ?? []).filter(
    (model) => model.id.startsWith("perplexity/") && model.id !== DEFAULT_RESEARCH_MODEL,
  );
  const researchOptions = [
    { value: "", label: "Perplexity Sonar Pro (recommended)" },
    ...perplexity.map((model) => ({ value: model.id, label: model.name })),
    { value: NATIVE_RESEARCH, label: "Content model with its own web search" },
    ...(values.researchModel && values.researchModel !== NATIVE_RESEARCH && !perplexity.some((model) => model.id === values.researchModel)
      ? [{ value: values.researchModel, label: values.researchModel }]
      : []),
  ];

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/ai/models");
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setCatalogueError(payload.error ?? "The model list could not be loaded.");
          return;
        }
        setCatalogue({ text: payload.text, image: payload.image });
      } catch {
        if (!cancelled) setCatalogueError("Could not reach the server.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/ai/usage");
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setUsageError(payload.error ?? "Usage data could not be loaded.");
          return;
        }
        setUsage(payload);
      } catch {
        if (!cancelled) setUsageError("Could not reach the server.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Models</p>
        <EnvFacts
          facts={[
            {
              label: "OpenRouter",
              value: configured
                ? catalogue
                  ? `${catalogue.text.length} text · ${catalogue.image.length} image models`
                  : catalogueError || "Loading models…"
                : "OPENROUTER_API_KEY is empty",
              ok: configured && !catalogueError,
            },
          ]}
        />
        <ModelDefault
          label="Text model"
          models={catalogue?.text ?? null}
          value={values.textModel}
          onChange={(id) => set("textModel", id)}
        />
        <ModelDefault
          label="Image model"
          models={catalogue?.image ?? null}
          value={values.imageModel}
          onChange={(id) => set("imageModel", id)}
        />
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Support chat</p>
        <ModelDefault
          label="Chat model"
          models={catalogue?.text ?? null}
          value={values.chatModel}
          onChange={(id) => set("chatModel", id)}
        />
        <p className="wfield-hint-block" style={{ marginTop: 0 }}>
          Answers the floating assistant in the corner of every panel page. Picked separately from the blog&apos;s
          text model — short questions are usually best served by a fast, inexpensive model.
        </p>
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Credits &amp; usage</p>
        {usage ? (
          <EnvFacts
            facts={[
              { label: "Remaining", value: credit(usage.limit_remaining), ok: usage.limit_remaining === null || usage.limit_remaining > 0 },
              { label: "Used all time", value: credit(usage.usage) },
              { label: "Used today", value: credit(usage.usage_daily) },
              { label: "Used this week", value: credit(usage.usage_weekly) },
              { label: "Used this month", value: credit(usage.usage_monthly) },
              { label: "Free requests today", value: `${usage.free_model_daily_requests.remaining.toLocaleString()} remaining of ${usage.free_model_daily_requests.limit.toLocaleString()}` },
            ]}
          />
        ) : (
          <p className="wfield-hint-block" role={usageError ? "alert" : undefined}>
            {usageError || "Loading credit usage…"}
          </p>
        )}
        <p className="wfield-hint-block" style={{ marginBottom: 0 }}>
          OpenRouter exposes key counters here. It does not provide a list endpoint for historical model-by-model activity;
          detailed records require a generation ID from an individual completion.
        </p>
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Research</p>
        <CheckBox
          checked={values.webSearch}
          onChange={(checked) => set("webSearch", checked)}
          label="Research the web before writing"
          note="A research model searches the web first and the content model writes only from what it found, citing [1], [2]… in the text. Every post ends with a numbered bibliography; if the research finds no sources, no post is written."
        />
        {values.webSearch ? (
          <Select
            label="Research model"
            value={values.researchModel}
            onChange={(value) => set("researchModel", value)}
            options={researchOptions}
            note={RESEARCH_NOTES[values.researchModel] ?? "Searches the web through OpenRouter; priced per search on top of tokens."}
          />
        ) : null}
        {values.webSearch ? (
          <Select
            label="Source numbers in the text"
            value={values.inlineCitations}
            onChange={(value) => set("inlineCitations", value as InlineCitations)}
            options={[
              { value: "none", label: "None — bibliography at the end only" },
              { value: "light", label: "Light — at most one per paragraph" },
            ]}
            note="The bibliography at the end lists every source the post is based on either way. Numbers in the text help fact-checking but make long posts harder to read."
          />
        ) : (
          <p className="wdialog-error" role="alert" style={{ margin: 0 }}>
            Without research, posts are written from the model&apos;s own knowledge: no sources, and facts about recent
            events may be outdated or wrong.
          </p>
        )}
      </div>

      <div className="wsettings-section">
        <p className="wsection-label">Writing defaults</p>
        <Select
          label="Style"
          value={values.style}
          onChange={(value) => set("style", value as AiStyle)}
          options={options(AI_STYLES, AI_STYLE_LABELS)}
        />
        <Select
          label="Length"
          value={values.depth}
          onChange={(value) => set("depth", value as AiDepth)}
          options={options(AI_DEPTHS, AI_DEPTH_LABELS)}
        />
        <Select
          label="Language"
          value={values.language}
          onChange={(value) => set("language", value as AiLanguage)}
          options={options(AI_LANGUAGES, AI_LANGUAGE_LABELS)}
        />
        <p className="wfield-hint-block" style={{ marginTop: 0 }}>
          These are starting values — every choice can still be changed in the assistant before generating.
        </p>
      </div>

      <SettingsFoot form={form} />
    </div>
  );
}
