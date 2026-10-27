import assert from "node:assert/strict";
import { test } from "node:test";
import { compileDocumentCss, BREAKPOINTS, BREAKPOINT_WIDTHS } from "../lib/page-builder/style/css";
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

test("visibility schema accepts the three device flags only", () => {
  assert.equal(blockStyleSchema.safeParse({ visibility: { desktop: true } }).success, true);
  assert.equal(blockStyleSchema.safeParse({ visibility: { tablet: true, mobile: true } }).success, true);
  // Unknown devices and non-boolean flags are refused.
  assert.equal(blockStyleSchema.safeParse({ visibility: { watch: true } }).success, false);
  assert.equal(blockStyleSchema.safeParse({ visibility: { mobile: "yes" } }).success, false);
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
  assert.ok(css.includes('[data-pb="hero"][data-pb]{font-size:56px}'), css);
  assert.ok(tabletIndex > -1 && mobileIndex > tabletIndex, css);
  assert.ok(css.slice(tabletIndex).includes("font-size:44px"));
  assert.ok(css.slice(mobileIndex).includes("font-size:34px"));
});

test("compiler emits grid layout into the base layer and overrides into device bands", () => {
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
  assert.ok(css.startsWith('[data-pb="g"][data-pb]{grid-template-columns:minmax(0, 2fr) minmax(0, 1fr);gap:24px}'), css);
  // No override props → no device-band grid rules (the stylesheet's own stacking applies).
  const mediaStates = css.match(/@media[^{]+\{[\s\S]*?\}/g) ?? [];
  for (const block of mediaStates) assert.ok(!block.includes("grid-template-columns"), css);

  // With overrides, each band carries its own column layout (plan 5.3).
  const responsive = compileDocumentCss({
    root: {},
    content: [
      {
        type: "GridBlock",
        props: {
          id: "g",
          variant: "4",
          gap: "lg",
          columnsTablet: "2",
          columnsMobile: "1/3+2/3",
          col1: [],
          col2: [],
          col3: [],
          col4: [],
        },
      },
    ],
  } as never);
  const tabletBand = responsive.slice(responsive.indexOf(`@media (${BREAKPOINTS.tablet})`), responsive.indexOf(`@media (${BREAKPOINTS.mobile})`));
  const mobileBand = responsive.slice(responsive.indexOf(`@media (${BREAKPOINTS.mobile})`));
  assert.ok(tabletBand.includes('[data-pb="g"][data-pb]{grid-template-columns:repeat(2, minmax(0, 1fr))}'), responsive);
  assert.ok(mobileBand.includes('[data-pb="g"][data-pb]{grid-template-columns:minmax(0, 1fr) minmax(0, 2fr)}'), responsive);
});

test("compiler renders gradient, dim overlay and shadow from validated values only", () => {
  const css = compileDocumentCss({
    root: {},
    content: [
      headingBlock({
        background: {
          base: {
            color: { source: "token", value: "canvas" },
            gradient: { from: { source: "token", value: "indigo" }, to: { source: "raw", value: "#101418" }, angle: 160 },
            image: "https://example.test/hero.jpg",
            overlayColor: { source: "raw", value: "#000000" },
            overlayOpacity: 0.4,
          },
        },
        border: { base: { shadow: "lg" } },
      }),
    ],
  } as never);

  // Layer order: dim scrim on top of the photo, photo on top of the gradient.
  const expectedImage =
    'background-image:linear-gradient(color-mix(in srgb,#000000 40%,transparent),color-mix(in srgb,#000000 40%,transparent)),' +
    'url("https://example.test/hero.jpg"),linear-gradient(160deg,var(--indigo),#101418)';
  assert.ok(css.includes(expectedImage), css);
  assert.ok(css.includes("background-color:var(--canvas)"), css);
  assert.ok(css.includes("box-shadow:0 8px 24px rgb(0 0 0 / 0.14)"), css);

  // Unsafe gradient colors drop the whole layer; zero opacity drops the scrim;
  // unknown shadow presets emit nothing.
  const refused = compileDocumentCss({
    root: {},
    content: [
      headingBlock({
        background: {
          base: {
            gradient: { from: { source: "raw", value: "url(//evil)" as never }, to: { source: "token", value: "ink" }, angle: 90 },
            overlayColor: { source: "token", value: "ink" },
            overlayOpacity: 0,
          },
        },
        border: { base: { shadow: "url(//evil)" as never } },
      }),
    ],
  } as never);
  assert.ok(!refused.includes("linear-gradient"), refused);
  assert.ok(!refused.includes("box-shadow"), refused);
});

test("style schema accepts % spacing and refuses gradient angles out of range", () => {
  assert.equal(
    blockStyleSchema.safeParse({ spacing: { base: { paddingTop: { value: 50, unit: "%" } } } }).success,
    true,
  );
  assert.equal(
    blockStyleSchema.safeParse({
      background: { base: { gradient: { from: { source: "token", value: "indigo" }, to: { source: "token", value: "ink" }, angle: 400 } } },
    }).success,
    false,
  );
  assert.equal(
    blockStyleSchema.safeParse({ background: { base: { overlayOpacity: 1.5 } } }).success,
    false,
  );
  assert.equal(
    blockStyleSchema.safeParse({ border: { base: { shadow: "glow" } } }).success,
    false,
  );
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

test("compiler emits one disjoint media band per hidden device, last so they win", () => {
  const css = compileDocumentCss({
    root: {},
    content: [headingBlock({ visibility: { desktop: true, tablet: true, mobile: true } })],
  } as never);

  // Desktop: ≥901px; tablet: 621–900px; mobile: ≤620px — the site's breakpoints.
  assert.ok(css.includes(`@media (min-width: ${BREAKPOINT_WIDTHS.tablet + 1}px){[data-pb="hero"][data-pb]{display:none}}`), css);
  assert.ok(
    css.includes(
      `@media (min-width: ${BREAKPOINT_WIDTHS.mobile + 1}px) and (max-width: ${BREAKPOINT_WIDTHS.tablet}px){[data-pb="hero"][data-pb]{display:none}}`,
    ),
    css,
  );
  assert.ok(css.includes(`@media (max-width: ${BREAKPOINT_WIDTHS.mobile}px){[data-pb="hero"][data-pb]{display:none}}`), css);

  // Visibility bands come after the base/tablet/mobile layers so the cascade
  // cannot resurrect a hidden block.
  const lastLayer = css.lastIndexOf(`[data-pb="hero"][data-pb]{display:none}`);
  assert.ok(lastLayer > css.indexOf(`@media (${BREAKPOINTS.mobile})`), css);
});

test("compiler emits no visibility rules for visible blocks", () => {
  const css = compileDocumentCss({
    root: {},
    content: [headingBlock({ visibility: { desktop: false } })],
  } as never);
  assert.ok(!css.includes("display:none"), css);
});

test("compiler cannot let a background URL escape the style element (stored XSS)", () => {
  const attempts = [
    "https://example.test/</style><script>alert(1)</script>",
    'https://example.test/x");}body{background:red}//',
    "https://example.test/a\\0062 ackground",
    "https://example.test/`$(eval)//",
  ];
  for (const image of attempts) {
    const css = compileDocumentCss({
      root: {},
      content: [headingBlock({ background: { base: { image } } })],
    } as never);
    // The whole declaration must stay inside one quoted url token: no markup,
    // quotes, backslashes or template characters may survive encoding.
    const url = css.match(/url\("([^"]*)"\)/)?.[1] ?? "";
    assert.ok(url.length > 0, css);
    assert.ok(!/["<>\\`{}]/.test(url), css);
    assert.ok(!css.includes("<script"), css);
    assert.ok(!css.includes("</style"), css);
  }
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
