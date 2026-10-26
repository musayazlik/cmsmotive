import assert from "node:assert/strict";
import { test } from "node:test";
import { compileDocumentCss, BREAKPOINTS } from "../lib/page-builder/style/css";
import { blockStyleSchema } from "../lib/page-builder/style/types";
import { DEFAULT_PROTOTYPE_DOCUMENT } from "../lib/page-builder/default-document";
import { validateDocument } from "../lib/page-builder/validate";
import { sanitizeDocumentContent } from "../lib/page-builder/sanitize";

/**
 * Phase 0 unit checks for the structured style layer (plan section 8):
 * schemas must refuse hostile values, the compiler must scope and layer
 * CSS correctly, and the sanitizer must strip markup that could restyle
 * or script the page.
 */

const validStyle = {
  typography: {
    base: {
      fontFamily: "sans",
      fontSize: { value: 56, unit: "px" },
      fontWeight: 700,
      lineHeight: 1.1,
      letterSpacing: { value: -0.02, unit: "em" },
      textAlign: "center",
      textColor: { source: "token", value: "indigo" },
    },
    mobile: { fontSize: { value: 34, unit: "px" } },
  },
  spacing: {
    base: { marginTop: { value: 48, unit: "px" }, marginBottom: { value: 20, unit: "px" } },
  },
} as const;

const headingBlock = (style: unknown) => ({
  type: "HeadingBlock",
  props: { id: "hero", text: "Hello", level: "h1", ...(style ? { style } : {}) },
});

const documentWithStyle = (style: unknown) => ({
  root: {},
  content: [headingBlock(style)],
});

// ---------------------------------------------------------------------------
// Style schemas
// ---------------------------------------------------------------------------

test("style schema accepts the structured values that the panel writes", () => {
  const parsed = blockStyleSchema.safeParse(structuredClone(validStyle));
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
});

test("style schema refuses CSS injection attempts in every group", () => {
  const attempts = [
    { typography: { base: { textColor: { source: "raw", value: "url(https://evil.example)" } } } },
    { typography: { base: { textColor: { source: "raw", value: "#ffffff;background:url(//e)" } } } },
    { spacing: { base: { marginTop: { value: 10, unit: "rem;background:url(//e)" } } } },
    { typography: { base: { fontFamily: "Manrope, var(--x)" } } },
    { unknownGroup: { base: {} } },
  ];
  for (const attempt of attempts) {
    const parsed = blockStyleSchema.safeParse(attempt);
    assert.equal(parsed.success, false, JSON.stringify(attempt));
  }
});

test("style schema refuses out-of-range numbers and unknown units", () => {
  for (const attempt of [
    { typography: { base: { fontSize: { value: 400, unit: "px" } } } }, // > 200
    { typography: { base: { fontSize: { value: 2, unit: "px" } } } }, // < 6
    { typography: { base: { fontWeight: 450 } } }, // not a 100-step
    { typography: { base: { lineHeight: 3 } } }, // > 2.4
    { spacing: { base: { marginLeft: { value: -600, unit: "px" } } } }, // < -360
    { typography: { base: { fontSize: { value: 16, unit: "%" } } } }, // unit not whitelisted
  ]) {
    assert.equal(blockStyleSchema.safeParse(attempt).success, false, JSON.stringify(attempt));
  }
});

// ---------------------------------------------------------------------------
// CSS compiler
// ---------------------------------------------------------------------------

test("compiler scopes every rule to the block and layers base → tablet → mobile", () => {
  const css = compileDocumentCss({
    root: {},
    content: [
      {
        type: "HeadingBlock",
        props: {
          id: "hero",
          text: "t",
          level: "h1",
          style: {
            typography: {
              base: { fontSize: { value: 56, unit: "px" } },
              tablet: { fontSize: { value: 44, unit: "px" } },
              mobile: { fontSize: { value: 34, unit: "px" } },
            },
          },
        },
      },
    ],
  } as never);

  const mobileIndex = css.indexOf(`@media (${BREAKPOINTS.mobile})`);
  const tabletIndex = css.indexOf(`@media (${BREAKPOINTS.tablet})`);
  assert.ok(css.includes('[data-pb="hero"]{font-size:56px}'), css);
  assert.ok(tabletIndex > -1 && mobileIndex > tabletIndex, css);
  assert.ok(css.slice(tabletIndex).includes("font-size:44px"));
  assert.ok(css.slice(mobileIndex).includes("font-size:34px"));
});

test("compiler emits grid layout into the base layer only", () => {
  const css = compileDocumentCss({
    root: {},
    content: [
      {
        type: "GridBlock",
        props: { id: "g", variant: "2/3+1/3", gap: "lg", col1: [], col2: [], col3: [], col4: [] },
      },
    ],
  } as never);
  // The scoped rule sits outside any media query — the base layer.
  assert.ok(css.startsWith('[data-pb="g"]{grid-template-columns:minmax(0, 2fr) minmax(0, 1fr);gap:24px}'), css);
  // Media layers (when present) never carry grid layout in phase 0.
  const mediaStates = css.match(/@media[^{]+\{[\s\S]*?\}/g) ?? [];
  for (const block of mediaStates) assert.ok(!block.includes("grid-template-columns"), css);
});

test("compiler drops unsafe raw colors, malformed ids and unknown variants", () => {
  const css = compileDocumentCss({
    root: {},
    content: [
      {
        type: "HeadingBlock",
        props: {
          id: "hero",
          text: "t",
          level: "h1",
          style: { typography: { base: { textColor: { source: "raw", value: "expression(alert(1))" } } } },
        },
      },
      {
        type: "HeadingBlock",
        props: {
          id: 'not".allowed',
          text: "t",
          level: "h1",
          style: { typography: { base: { fontSize: { value: 16, unit: "px" } } } },
        },
      },
      {
        type: "GridBlock",
        props: { id: "g2", variant: "hack" as string, gap: "sm", col1: [], col2: [], col3: [], col4: [] },
      },
    ],
  } as never);
  assert.ok(!css.includes("expression("), css);
  assert.ok(!css.includes('not".allowed'), css);
  assert.ok(!css.includes("hack"), css);
});

test("compiler binds theme colors to their CSS variables", () => {
  const css = compileDocumentCss({
    root: {},
    content: [headingBlock({ typography: { base: { textColor: { source: "token", value: "indigo" } } } })],
  } as never);
  assert.ok(css.includes("color:var(--indigo)"), css);
});

// ---------------------------------------------------------------------------
// Document validation
// ---------------------------------------------------------------------------

test("validateDocument accepts the demo document untouched", () => {
  const result = validateDocument(structuredClone(DEFAULT_PROTOTYPE_DOCUMENT));
  assert.ok(result.ok, result.ok ? "" : result.error);
});

test("validateDocument refuses hostile styles, unknown types and nested bad values", () => {
  assert.equal(
    validateDocument(documentWithStyle({ typography: { base: { textColor: { source: "raw", value: "url(//e)" } } } })).ok,
    false,
  );
  assert.equal(
    validateDocument({ root: {}, content: [{ type: "NotABlock", props: {} }] }).ok,
    false,
  );
  assert.equal(
    validateDocument({
      root: {},
      content: [
        {
          type: "ContainerBlock",
          props: {
            id: "c",
            width: "default",
            children: [headingBlock({ typography: { base: { fontSize: { value: 9999, unit: "px" } } } })],
          },
        },
      ],
    }).ok,
    false,
  );
});

test("validateDocument refuses unknown props and oversize rich text", () => {
  assert.equal(
    validateDocument({
      root: {},
      content: [{ type: "TextBlock", props: { id: "t", content: "<p>hi</p>", script: "alert(1)" } }],
    }).ok,
    false,
  );
  assert.equal(
    validateDocument({
      root: {},
      content: [{ type: "TextBlock", props: { id: "t", content: "x".repeat(512 * 1024 + 1) } }],
    }).ok,
    false,
  );
});

// ---------------------------------------------------------------------------
// Sanitizer (documents)
// ---------------------------------------------------------------------------

type RawDocument = { root: unknown; content: Array<{ type: string; props: Record<string, unknown> }> };
const asDocument = (raw: RawDocument): Parameters<typeof sanitizeDocumentContent>[0] =>
  raw as unknown as Parameters<typeof sanitizeDocumentContent>[0];

test("document sanitizer strips script, javascript links and inline handlers", () => {
  const document = asDocument({
    root: {},
    content: [
      {
        type: "TextBlock",
        props: {
          id: "t",
          content:
            '<p onclick="alert(1)">Hi<script>alert(2)</script></p><a href="javascript:alert(3)">x</a><p style="position:fixed">y</p>',
        },
      },
    ],
  });
  sanitizeDocumentContent(document);
  const content = document.content ?? [];
  const html = String((content[0] as { props: { content: unknown } }).props.content);
  assert.ok(!html.includes("<script"), html);
  assert.ok(!html.includes("javascript:"), html);
  assert.ok(!html.includes("onclick"), html);
  assert.ok(!html.includes("style="), html);
  assert.ok(html.includes("Hi"), html);
});
