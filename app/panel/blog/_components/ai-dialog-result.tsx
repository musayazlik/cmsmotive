"use client";

import type { AiGenerateResult } from "../_ai";

/**
 * The generated result: warnings, each produced block and the save error.
 * Presentational — the dialog shell owns the state.
 */

type Props = {
  result: AiGenerateResult;
  /** True while the draft is being saved. */
  busy: boolean;
  error: string;
};

export default function AiResultView({ result, busy, error }: Props) {
  return (
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
  );
}
