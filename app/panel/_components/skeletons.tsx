import type { CSSProperties } from "react";

/**
 * Skeleton primitives for panel loading states. They are pure markup + CSS
 * (no client JS) and mirror the two shapes every panel page has: the page
 * header and a table card. Navigation shows the composed skeleton, and slow
 * pages stream their data inside <Suspense> with the same pieces as fallback.
 */

/** One shimmering placeholder block. Purely decorative. */
export function Sk({
  w,
  h,
  round = 6,
  className,
  style,
}: {
  w?: number | string;
  h: number;
  round?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={["wsk", className].filter(Boolean).join(" ")}
      style={{ width: w, height: h, borderRadius: round, ...style }}
    />
  );
}

/**
 * The generic panel page: eyebrow, big headline, intro paragraph and a table
 * card. Used as app/panel/loading.tsx, so it appears while any panel segment
 * without its own boundary is loading.
 */
export function PanelPageSkeleton() {
  return (
    <div className="wskeleton" role="status" aria-label="Loading page">
      <div className="workspace-eyebrow">
        <span className="workspace-dot" />
        <Sk w={170} h={10} />
      </div>
      <div className="workspace-intro">
        <div>
          <Sk w={430} h={62} round={10} />
          <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
            <Sk w={480} h={12} />
            <Sk w={392} h={12} />
          </div>
        </div>
        <span className="workspace-index">
          <Sk w={64} h={12} />
        </span>
      </div>
      <TableCardSkeleton />
    </div>
  );
}

/**
 * A wtable-card with toolbar, header band and body rows, so placeholders
 * align with the real tables they replace.
 */
export function TableCardSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  const middle = Math.max(1, columns - 2);
  const barWidths = [118, 150, 92, 126, 104];

  return (
    <div className="wtable-card wskeleton" role="status" aria-label="Loading list">
      <div className="wtable-toolbar">
        <Sk w={260} h={42} round={8} />
        <span style={{ marginLeft: "auto", display: "flex", gap: 9 }}>
          <Sk w={96} h={42} round={8} />
          <Sk w={128} h={42} round={8} />
        </span>
      </div>
      <div className="wtable-scroll">
        <table className="wtable">
          <thead>
            <tr>
              {Array.from({ length: columns }, (_, col) => (
                <th key={col} scope="col">
                  <Sk w={54 + col * 8} h={9} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row}>
                <td>
                  <div className="wtable-user">
                    <Sk w={36} h={36} round={8} />
                    <div>
                      <Sk w={104 + (row % 3) * 16} h={11} />
                      <Sk w={148} h={9} className="wsk-dim" style={{ marginTop: 3 }} />
                    </div>
                  </div>
                </td>
                {Array.from({ length: middle }, (_, col) => (
                  <td key={col}>
                    {col === 1 ? (
                      <Sk w={56} h={20} round={99} />
                    ) : (
                      <Sk w={barWidths[(row + col) % barWidths.length]} h={11} />
                    )}
                  </td>
                ))}
                <td className="wtable-actions-col">
                  <span style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
                    <Sk w={54} h={28} round={8} />
                    <Sk w={66} h={28} round={8} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="wtable-foot">
        <Sk w={92} h={10} />
      </div>
    </div>
  );
}
