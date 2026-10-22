"use client";

import type { AiFields } from "../_ai";
import { FIELD_OPTIONS } from "./ai-dialog-setup";

/**
 * The in-progress animation shown while a generation runs: the working
 * skeleton, the fields being generated and a progress bar. Presentational.
 */

type Props = {
  fields: AiFields;
  /** Whether web research runs before writing, mentioned in the copy. */
  webSearch: boolean;
};

export default function AiGeneratingView({ fields, webSearch }: Props) {
  const selectedFields = FIELD_OPTIONS.filter((option) => fields[option.key]);
  return (
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
  );
}
