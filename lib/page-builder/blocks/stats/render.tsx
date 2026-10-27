import type { PuckComponent } from "@puckeditor/core";
import { blockAttributes } from "../shared";
import { statsDefaultProps, type StatsProps } from "./schema";

export const StatsRender: PuckComponent<StatsProps> = ({
  items = statsDefaultProps.items as any,
  id,
  lang,
  ariaLabel,
}) => {
  return (
    <section data-pb={id} {...blockAttributes({ id, lang, ariaLabel })} className="container" style={{ margin: "50px auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`,
          gap: 24,
          textAlign: "center",
        }}
      >
        {items.map((item: any, i: number) => (
          <div
            key={i}
            style={{
              padding: "28px 20px",
              background: "var(--surface, #fff)",
              border: "1px solid var(--line, #cbd2d3)",
              borderRadius: "var(--radius, 14px)",
            }}
          >
            <div style={{ fontSize: "2.6rem", fontWeight: 800, color: "var(--indigo, #4353e8)", lineHeight: 1.1, marginBottom: 8 }}>
              {item.value}
              {item.suffix && <span style={{ fontSize: "1.6rem", fontWeight: 600 }}>{item.suffix}</span>}
            </div>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--ink, #101418)", marginBottom: 4 }}>
              {item.label}
            </div>
            {item.description && (
              <p style={{ fontSize: "0.82rem", color: "var(--muted, #5e666d)", margin: 0 }}>{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
