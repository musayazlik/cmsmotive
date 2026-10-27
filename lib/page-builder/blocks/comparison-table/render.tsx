import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { comparisonTableDefaultProps, type ComparisonTableProps } from "./schema";

export const ComparisonTableRender: PuckComponent<ComparisonTableProps> = ({
  title = comparisonTableDefaultProps.title,
  columns = comparisonTableDefaultProps.columns as any,
  rows = comparisonTableDefaultProps.rows as any,
  id,
  lang,
  ariaLabel,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "50px auto" }}>
      {title && <h2 style={{ fontSize: "2rem", fontWeight: 800, textAlign: "center", marginBottom: 32 }}>{title}</h2>}
      <div style={{ overflowX: "auto" }}>
        <table className="compare-table">
          <thead>
            <tr>
              {columns.map((col: string, idx: number) => (
                <th key={idx}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, rIdx: number) => (
              <tr key={rIdx}>
                <td style={{ fontWeight: 600 }}>{row.feature}</td>
                {row.values?.map((val: string, vIdx: number) => (
                  <td key={vIdx} style={{ color: val === "✓" ? "var(--success, #365a11)" : "inherit" }}>
                    {val}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
