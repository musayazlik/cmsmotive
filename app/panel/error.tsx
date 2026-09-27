"use client";

import { useEffect } from "react";

/**
 * Segment error boundary for every panel route. The shell around it keeps
 * rendering, so navigation away is always possible.
 */
export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("panel error boundary:", error);
  }, [error]);

  return (
    <div className="wtable-card wstate-card" role="alert">
      <span className="workspace-eyebrow">
        <span className="workspace-dot" /> SOMETHING WENT WRONG
      </span>
      <h2>This view could not be loaded.</h2>
      <p>
        The request failed while the page was being rendered. Retrying usually helps — if the error
        keeps coming back, the details below are what support needs.
      </p>
      {error.digest ? <code className="wstate-code">Error ID: {error.digest}</code> : null}
      <div className="wstate-actions">
        <button type="button" className="wbtn wbtn-primary" onClick={reset}>
          Try again
        </button>
        <a className="wbtn wbtn-ghost" href="/panel">
          Back to overview
        </a>
      </div>
    </div>
  );
}
