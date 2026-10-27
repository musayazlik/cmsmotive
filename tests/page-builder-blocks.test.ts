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
import {
  textPropsSchema,
} from "../lib/page-builder/blocks/text/schema";
import {
  gridPropsSchema,
} from "../lib/page-builder/blocks/grid/schema";
import { blockAttributes } from "../lib/page-builder/blocks/shared";

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

test("grid responsive columns accept band overrides only from the variant catalog", () => {
  const base = { variant: "3", gap: "md", col1: [], col2: [], col3: [], col4: [] };
  assert.equal(gridPropsSchema.safeParse({ ...base, columnsTablet: "2", columnsMobile: "1/3+2/3" }).success, true);
  assert.equal(gridPropsSchema.safeParse(base).success, true);
  assert.equal(gridPropsSchema.safeParse({ ...base, columnsTablet: "5" }).success, false);
  assert.equal(gridPropsSchema.safeParse({ ...base, columnsMobile: "repeat(2,1fr)" }).success, false);
});

test("advanced props: lang (BCP 47) and ariaLabel accepted, hostile values refused", () => {
  // Every block gained the same shared fragment; Text stands in for the rest.
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", lang: "de" }).success, true);
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", lang: "en-US" }).success, true);
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", lang: "zh-Hant" }).success, true);
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", ariaLabel: "Introduction" }).success, true);

  // Injection and garbage tags are refused.
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", lang: 'de"><script>alert(1)</script>' }).success, false);
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", lang: "de-defghijkl" }).success, false); // subtag > 8
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", lang: "d" }).success, false); // primary subtag < 2
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", lang: "x".repeat(33) }).success, false); // > max length
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", ariaLabel: "x".repeat(201) }).success, false);

  // strictObject still refuses unknown extras.
  assert.equal(textPropsSchema.safeParse({ content: "<p>Hi</p>", ariaHidden: true }).success, false);
});

test("blockAttributes renders anchor id, lang and aria-label only when set", () => {
  assert.deepEqual(blockAttributes({}), {});
  assert.deepEqual(blockAttributes({ id: "hero", lang: "de" }), { id: "hero", lang: "de" });
  assert.deepEqual(blockAttributes({ id: "hero", ariaLabel: "Services" }), { id: "hero", "aria-label": "Services" });
});

test("a11y audit warns when a block is hidden on every device", () => {
  const hidden = doc([
    block("HeadingBlock", {
      text: "Title",
      level: "h1",
      style: { visibility: { desktop: true, tablet: true, mobile: true } },
    }),
  ]);
  const audit = auditDocumentA11y(hidden as never);
  assert.ok(audit.warnings.some((message) => message.includes("hidden on every device")));

  const partial = doc([
    block("HeadingBlock", { text: "Title", level: "h1", style: { visibility: { mobile: true } } }),
  ]);
  const audit2 = auditDocumentA11y(partial as never);
  assert.ok(!audit2.warnings.some((message) => message.includes("hidden on every device")));
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

test("Faz 2 theme settings: validation and css custom properties output", () => {
  const { validateThemeSettings, DEFAULT_THEME_SETTINGS } = require("../lib/theme-settings-shared");
  const { themeToCssVariables } = require("../lib/page-builder/theme");

  const valid = validateThemeSettings(DEFAULT_THEME_SETTINGS);
  assert.equal(!("error" in valid) || !valid.error, true);

  const invalidColor = validateThemeSettings({ ...DEFAULT_THEME_SETTINGS, primaryColor: "red" });
  assert.equal(Boolean(invalidColor.error), true);

  const invalidRadius = validateThemeSettings({ ...DEFAULT_THEME_SETTINGS, radius: "14" });
  assert.equal(Boolean(invalidRadius.error), true);

  const css = themeToCssVariables({ primaryColor: "#123456", radius: "8px" });
  assert.ok(css.includes("--indigo:#123456"));
  assert.ok(css.includes("--radius:8px"));
  assert.ok(css.startsWith(":root{"));
});

test("Faz 2 live data and compound section schemas validate correctly", () => {
  const { productGridPropsSchema } = require("../lib/page-builder/blocks/product-grid/schema");
  const { heroPropsSchema } = require("../lib/page-builder/blocks/hero/schema");
  const { ctaPropsSchema } = require("../lib/page-builder/blocks/cta/schema");
  const { faqPropsSchema } = require("../lib/page-builder/blocks/faq/schema");
  const { newsletterPropsSchema } = require("../lib/page-builder/blocks/newsletter/schema");
  const { contactPropsSchema } = require("../lib/page-builder/blocks/contact/schema");

  assert.equal(productGridPropsSchema.safeParse({ category: "Themes", limit: 6, columns: 3 }).success, true);
  assert.equal(productGridPropsSchema.safeParse({ limit: 99 }).success, false); // limit max 24

  assert.equal(heroPropsSchema.safeParse({ title: "Hero Title", primaryButtonHref: "/buy", align: "center" }).success, true);
  assert.equal(heroPropsSchema.safeParse({ title: "", primaryButtonHref: "/buy" }).success, false);

  assert.equal(ctaPropsSchema.safeParse({ title: "CTA Title", buttonText: "Click", buttonHref: "/products", variant: "brand" }).success, true);
  assert.equal(ctaPropsSchema.safeParse({ title: "CTA Title", buttonText: "Click", buttonHref: "javascript:void(0)" }).success, false);

  assert.equal(faqPropsSchema.safeParse({ items: [{ question: "Q1", answer: "A1" }] }).success, true);
  assert.equal(newsletterPropsSchema.safeParse({ title: "Newsletter" }).success, true);
  assert.equal(contactPropsSchema.safeParse({ title: "Contact Us" }).success, true);
});

test("Faz 2 blocks validate inside a document and reject invalid data", () => {
  const faz2Doc = doc([
    block("HeadingBlock", { text: "Main Title", level: "h1" }),
    block("HeroBlock", { title: "Welcome Hero", primaryButtonHref: "/products", primaryButtonText: "Explore" }),
    block("ProductGridBlock", { limit: 6, columns: 3 }),
    block("ProductSpotlightBlock", { productSlug: "sample-theme", headline: "Spotlight" }),
    block("PricingTableBlock", { title: "Pricing", plans: [] }),
    block("ReviewListBlock", { limit: 3, columns: 3 }),
    block("LatestPostsBlock", { limit: 3, columns: 3 }),
    block("FeatureGridBlock", { title: "Features", columns: 3, items: [] }),
    block("StatsBlock", { items: [{ value: "100%", label: "Satisfaction" }] }),
    block("LogoCloudBlock", { title: "Clients", logos: [] }),
    block("TestimonialsBlock", { title: "Reviews", items: [] }),
    block("FAQBlock", { title: "FAQ", items: [] }),
    block("CTABlock", { title: "Call to Action", buttonText: "Start", buttonHref: "/signup" }),
    block("ComparisonTableBlock", { title: "Compare", columns: ["Feature", "Standard"], rows: [] }),
    block("StepsBlock", { title: "Workflow", steps: [] }),
    block("NewsletterBlock", { title: "Newsletter" }),
    block("ContactBlock", { title: "Contact" }),
  ]);

  const validation = validateDocument(faz2Doc);
  assert.equal(validation.ok, true);
});
