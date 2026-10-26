import assert from "node:assert/strict";
import { test } from "node:test";
import { auditDocumentA11y } from "../lib/page-builder/a11y";
import { validateDocument } from "../lib/page-builder/validate";
import {
  buttonPropsSchema,
} from "../lib/page-builder/blocks/button/schema";
import {
  imagePropsSchema,
} from "../lib/page-builder/blocks/image/schema";
import {
  videoPropsSchema,
} from "../lib/page-builder/blocks/video/schema";
import {
  listPropsSchema,
} from "../lib/page-builder/blocks/list/schema";
import {
  sectionPropsSchema,
} from "../lib/page-builder/blocks/section/schema";
import {
  stackPropsSchema,
} from "../lib/page-builder/blocks/stack/schema";

const doc = (content: unknown[]) => ({ root: { props: {} }, content, zones: {} });
const block = (type: string, props: Record<string, unknown>) => ({ type, props: { id: `${type}-id`, ...props } });

test("block schemas accept the panel's shapes and refuse hostile values", () => {
  assert.equal(buttonPropsSchema.safeParse({ text: "Buy", href: "/pricing", variant: "primary", size: "md" }).success, true);
  assert.equal(buttonPropsSchema.safeParse({ text: "x", href: "javascript:alert(1)", variant: "primary", size: "md" }).success, false);
  assert.equal(buttonPropsSchema.safeParse({ text: "x", href: "https://example.com", variant: "primary", size: "md" }).success, true);
  assert.equal(buttonPropsSchema.safeParse({ text: "x", href: "#anchor", variant: "primary", size: "md" }).success, true);
  assert.equal(imagePropsSchema.safeParse({ src: "https://example.com/a.png", alt: "A product" }).success, true);
  assert.equal(imagePropsSchema.safeParse({ src: "javascript:alert(1)", alt: "x" }).success, false);
  assert.equal(imagePropsSchema.safeParse({ src: "data:text/html,x", alt: "x" }).success, false);
  assert.equal(videoPropsSchema.safeParse({ provider: "youtube", videoId: "dQw4w9WgXcQ", title: "Video" }).success, true);
  assert.equal(videoPropsSchema.safeParse({ provider: "youtube", videoId: "", title: "Video" }).success, false);
  assert.equal(listPropsSchema.safeParse({ listStyle: "bullet", items: [{ text: "One" }] }).success, true);
  assert.equal(listPropsSchema.safeParse({ listStyle: "bullet", items: [{ text: "" }] }).success, false);
  assert.equal(sectionPropsSchema.safeParse({ variant: "plain", children: [] }).success, true);
  assert.equal(sectionPropsSchema.safeParse({ variant: "image", image: "https://x.com/a.png", children: [] }).success, true);
  assert.equal(sectionPropsSchema.safeParse({ variant: "image", image: "javascript:x", children: [] }).success, false);
  assert.equal(stackPropsSchema.safeParse({ direction: "vertical", gap: "md", align: "stretch", justify: "start", children: [] }).success, true);
});

test("new blocks validate inside a document and reject unknown props", () => {
  const valid = doc([
    block("HeadingBlock", { text: "Title", level: "h1" }),
    block("SectionBlock", { variant: "muted", children: [block("TextBlock", { content: "<p>Body</p>" })] }),
    block("StackBlock", { direction: "horizontal", gap: "sm", align: "center", justify: "between", children: [] }),
    block("SpacerBlock", { size: "md" }),
    block("DividerBlock", { variant: "dashed", spacing: "sm" }),
    block("ButtonBlock", { text: "Buy", href: "/pricing", variant: "primary", size: "md" }),
    block("ImageBlock", { src: "https://example.com/a.png", alt: "Product photo", width: 800, height: 600 }),
    block("VideoBlock", { provider: "youtube", videoId: "abc123", title: "Intro" }),
    block("IconBlock", { name: "check", size: "md" }),
    block("ListBlock", { listStyle: "check", items: [{ text: "Fast" }, { text: "Secure" }] }),
  ]);
  assert.equal(validateDocument(valid).ok, true);

  const hostile = doc([
    block("ButtonBlock", { text: "Buy", href: "javascript:alert(1)", variant: "primary", size: "md" }),
  ]);
  assert.equal(validateDocument(hostile).ok, false);

  const extraProp = doc([block("SpacerBlock", { size: "md", explode: true })]);
  assert.equal(validateDocument(extraProp).ok, false);
});

test("a11y audit: H1 rules, alt text, button labels and small text warnings", () => {
  // No H1 at all → blocker.
  const noH1 = doc([block("TextBlock", { content: "<p>Just text</p>" })]);
  let audit = auditDocumentA11y(noH1 as never);
  assert.ok(audit.blockers.some((message) => message.includes("page title")));

  // Two H1s → blocker.
  const twoH1 = doc([
    block("HeadingBlock", { text: "One", level: "h1" }),
    block("HeadingBlock", { text: "Two", level: "h1" }),
  ]);
  audit = auditDocumentA11y(twoH1 as never);
  assert.ok(audit.blockers.some((message) => message.includes("H1 titles")));

  // Skipped level → blocker.
  const skipped = doc([
    block("HeadingBlock", { text: "Title", level: "h1" }),
    block("HeadingBlock", { text: "Sub", level: "h3" }),
  ]);
  audit = auditDocumentA11y(skipped as never);
  assert.ok(audit.blockers.some((message) => message.includes("skips a level")));

  // Image without alt → blocker; decorative image → no blocker.
  const noAlt = doc([
    block("HeadingBlock", { text: "Title", level: "h1" }),
    block("ImageBlock", { src: "https://example.com/a.png", alt: "" }),
  ]);
  audit = auditDocumentA11y(noAlt as never);
  assert.ok(audit.blockers.some((message) => message.includes("alternative text")));

  const decorative = doc([
    block("HeadingBlock", { text: "Title", level: "h1" }),
    block("ImageBlock", { src: "https://example.com/a.png", alt: "", decorative: true }),
  ]);
  audit = auditDocumentA11y(decorative as never);
  assert.ok(!audit.blockers.some((message) => message.includes("alternative text")));

  // Button without label → blocker.
  const emptyButton = doc([
    block("HeadingBlock", { text: "Title", level: "h1" }),
    block("ButtonBlock", { text: "", href: "/buy", variant: "primary", size: "md" }),
  ]);
  audit = auditDocumentA11y(emptyButton as never);
  assert.ok(audit.blockers.some((message) => message.includes("button has no label")));

  // Small font → warning.
  const smallText = doc([
    block("HeadingBlock", { text: "Title", level: "h1" }),
    block("TextBlock", {
      content: "<p>Tiny</p>",
      style: { typography: { base: { fontSize: { value: 10, unit: "px" } } } },
    }),
  ]);
  audit = auditDocumentA11y(smallText as never);
  assert.ok(audit.warnings.some((message) => message.includes("smaller than 12 px")));
});

test("a11y audit reads rich text headings and image alts through the same rules", () => {
  const richText = doc([
    block("HeadingBlock", { text: "Title", level: "h1" }),
    block("TextBlock", { content: '<h3>Skipped to h3</h3><img src="https://example.com/x.png">' }),
  ]);
  const audit = auditDocumentA11y(richText as never);
  assert.ok(audit.blockers.some((message) => message.includes("skips a level")));
  assert.ok(audit.blockers.some((message) => message.includes("alternative text")));
});
