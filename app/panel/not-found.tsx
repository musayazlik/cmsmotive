import Link from "next/link";

/** Unmatched URLs inside the workspace, still wrapped in the panel shell. */
export default function PanelNotFound() {
  return (
    <div className="wtable-card wstate-card">
      <span className="workspace-eyebrow">
        <span className="workspace-dot" /> 404 / NOT FOUND
      </span>
      <h2>This page does not exist.</h2>
      <p>
        The address may have been moved or typed incorrectly. Everything the workspace offers lives in
        the navigation on the left.
      </p>
      <div className="wstate-actions">
        <Link className="wbtn wbtn-primary" href="/panel">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
