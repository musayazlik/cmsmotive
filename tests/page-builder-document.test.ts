import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Render } from "@puckeditor/core";
import { serverConfig } from "../lib/page-builder/config.server";
import { walkBlocks } from "../lib/page-builder/data";
import { DEFAULT_PROTOTYPE_DOCUMENT } from "../lib/page-builder/default-document";
import { MAX_DOCUMENT_BYTES, prepareDocument, renderableDocument } from "../lib/page-builder/document";
import { sanitizeRichText } from "../lib/page-builder/sanitize";
import { BREAKPOINTS, BREAKPOINT_WIDTHS, EDITOR_VIEWPORTS, compileDocumentCss } from "../lib/page-builder/style/css";
import { deviceForViewport } from "../lib/page-builder/style/fields";
import { validateDocument } from "../lib/page-builder/validate";

const text = (id: string, content: string) => ({ type: "TextBlock", props: { id, content } });
const doc = (content: unknown[], extra: Record<string, unknown> = {}) => ({ root: { props: {} }, content, zones: {}, ...extra });

/* ------------------------------------------------------------------ breakpoints */

test("builder breakpoints are the site's own (site.css: 900px / 620px)", () => {
  assert.deepEqual(BREAKPOINT_WIDTHS, { tablet: 900, mobile: 620 });
  const css = compileDocumentCss(
    doc([
      {
        type: "HeadingBlock",
        props: {
          id: "h1",
          text: "Title",
          level: "h1",
          style: {
            typography: {
              base: { fontSize: { value: 56, unit: "px" } },
              tablet: { fontSize: { value: 40, unit: "px" } },
              mobile: { fontSize: { value: 30, unit: "px" } },
            },
          },
        },
      },
    ]) as never,
  );
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.doesNotMatch(css, /1023|767/);
  const blocks = readFileSync("public/assets/css/pb-blocks.css", "utf8");
  for (const query of blocks.match(/@media[^{]+/g) ?? []) assert.match(query, /\((max-width: (900|620)px)\)/, query);
  assert.equal(BREAKPOINTS.tablet, "max-width: 900px");
});

test("each editor viewport edits the device whose range it sits in", () => {
  assert.deepEqual(EDITOR_VIEWPORTS.map((viewport) => [viewport.device, deviceForViewport(viewport.width)]), [
    ["base", "base"],
    ["tablet", "tablet"],
    ["mobile", "mobile"],
  ]);
  assert.equal(deviceForViewport(901), "base");
  assert.equal(deviceForViewport(900), "tablet");
  assert.equal(deviceForViewport(621), "tablet");
  assert.equal(deviceForViewport(620), "mobile");
  assert.equal(deviceForViewport("100%"), "base");
});

/* ------------------------------------------------------------------ sanitizer */

test("rich text keeps valid language marks and drops invalid ones", () => {
  assert.equal(sanitizeRichText('<p>Hallo <span lang="en">world</span></p>'), '<p>Hallo <span lang="en">world</span></p>');
  assert.equal(sanitizeRichText('<p lang="de-AT">Servus</p>'), '<p lang="de-AT">Servus</p>');
  assert.equal(sanitizeRichText('<span lang="en&quot; onclick=&quot;x">a</span>'), "<span>a</span>");
  assert.equal(sanitizeRichText('<span lang="english-language-tag-too-long-x">a</span>'), "<span>a</span>");
  assert.equal(
    sanitizeRichText('<a href="https://example.test" lang="tr" target="_blank">x</a>'),
    '<a href="https://example.test" lang="tr" target="_blank" rel="noopener noreferrer">x</a>',
  );
});

test("rich text headings stay below the page's single H1, without losing text", () => {
  assert.equal(sanitizeRichText("<h1>Big</h1><h5>Small</h5><h6>Tiny</h6>"), "<h2>Big</h2><h4>Small</h4><h4>Tiny</h4>");
  assert.equal(sanitizeRichText('<center lang="en">Old</center>'), '<p lang="en">Old</p>');
});

test("rich text loses scripts, handlers, javascript and data links, styles and classes", () => {
  const cleaned = sanitizeRichText(
    '<p style="color:red" class="x" onclick="a()">ok</p><img src="x" onerror="alert(1)"><script>alert(2)</script>' +
      '<a href="javascript:alert(3)">j</a><a href="data:text/html,x">d</a><a href="//evil.test">p</a><img src="https://cdn.test/a.png" alt="a">',
  );
  assert.doesNotMatch(cleaned, /script|onerror|onclick|javascript:|data:|style=|class=|evil\.test/i);
  assert.match(cleaned, /<p>ok<\/p>/);
  assert.match(cleaned, /<img src="https:\/\/cdn\.test\/a\.png" alt="a" \/>/);
});

/* ------------------------------------------------------------------ validation */

test("only Puck's title may sit in root, and DropZone data is refused", () => {
  assert.equal(validateDocument(doc([], { root: { props: { title: "Home" } } })).ok, true);
  assert.equal(validateDocument(doc([], { root: {} })).ok, true);
  assert.equal(validateDocument(doc([], { root: { props: { title: "x", script: "<b>" } } })).ok, false);
  assert.equal(validateDocument(doc([], { root: { props: {}, extra: 1 } })).ok, false);
  assert.equal(validateDocument(doc([], { zones: { "ContainerBlock-1:children": [text("t", "<p>x</p>")] } })).ok, false);
  assert.equal(validateDocument({ content: [] }).ok, false, "root is required");
});

test("block ids must be unique across the whole tree", () => {
  const result = validateDocument(
    doc([
      text("same", "<p>a</p>"),
      { type: "ContainerBlock", props: { id: "c", width: "default", children: [text("same", "<p>b</p>")] } },
    ]),
  );
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /duplicate block id same/);
});

test("only declared slot props are walked; other arrays stay data", () => {
  const visited: string[] = [];
  walkBlocks(
    {
      content: [
        { type: "GridBlock", props: { id: "g", col1: [text("in-slot", "")], col2: [], col3: [], col4: [] } },
        // A non-slot array on a known block, and an unknown block's arrays, are never descended into.
        { type: "HeadingBlock", props: { id: "h", items: [text("not-a-slot", "")] } },
        { type: "Unknown", props: { children: [text("unknown-parent", "")] } },
      ],
    } as never,
    (block) => visited.push(String((block.props as { id?: string }).id)),
  );
  assert.deepEqual(visited, ["g", "in-slot", "h", "undefined"]);
});

/* ------------------------------------------------------------------ the one door */

test("prepareDocument validates and cleans a copy and refuses oversize input", () => {
  const input = doc([text("t", '<p>ok</p><script>x</script><img src="x" onerror="y">')]);
  const prepared = prepareDocument(input);
  assert.equal(prepared.ok, true);
  // Relative image paths (the media library's /api/media/...) stay; the handler goes.
  assert.equal(((prepared.ok ? prepared.data.content[0] : null)?.props as { content: string }).content, '<p>ok</p><img src="x" />');
  assert.match((input.content[0] as { props: { content: string } }).props.content, /script/, "input untouched");

  const huge = doc([text("t", "x".repeat(MAX_DOCUMENT_BYTES))]);
  assert.deepEqual(prepareDocument(huge), { ok: false, error: "Document exceeds the 1 MB limit." });
  assert.equal(prepareDocument(undefined).ok, false);
  assert.equal(renderableDocument({ content: "nope" }), null);
});

test("a hostile stored document never reaches the page through <Render>", () => {
  // Puck prints rich text exactly as stored, so cleaning before render is the defence.
  const hostile = doc([
    {
      type: "GridBlock",
      props: {
        id: "g",
        variant: "2",
        gap: "md",
        col1: [text("t1", '<p>safe</p><img src="x" onerror="alert(1)"><script>alert(2)</script>')],
        col2: [text("t2", '<a href="javascript:alert(3)">x</a><p>Hallo <span lang="en">world</span></p>')],
        col3: [],
        col4: [],
      },
    },
  ]);
  const unsafe = renderToStaticMarkup(createElement(Render, { config: serverConfig, data: hostile as never }));
  assert.match(unsafe, /onerror/, "baseline: Render alone prints stored HTML");

  const html = renderToStaticMarkup(createElement(Render, { config: serverConfig, data: renderableDocument(hostile)! }));
  assert.doesNotMatch(html, /onerror|<script|javascript:/i);
  assert.match(html, /<p>safe<\/p>/);
  assert.match(html, /<span lang="en">world<\/span>/);
});

test("the demo document passes the door unchanged", () => {
  const prepared = prepareDocument(structuredClone(DEFAULT_PROTOTYPE_DOCUMENT));
  assert.equal(prepared.ok, true);
});

/* ------------------------------------------------------------------ public bundle */

/**
 * The public page's import graph may not contain editor code (plan 5.16):
 * Next 16 ships the chunks of every client module a route references.
 */
test("the public route imports no editor or client module", () => {
  const root = process.cwd();
  const resolve = (from: string, specifier: string): string | null => {
    const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : specifier.startsWith(".") ? path.resolve(path.dirname(from), specifier) : null;
    if (!base) return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
      if (existsSync(candidate) && !candidate.endsWith(path.sep) && /\.(ts|tsx)$/.test(candidate)) return candidate;
    }
    return null;
  };
  const valueImports = (source: string) =>
    [...source.matchAll(/^import\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gm), ...source.matchAll(/^import\s+["']([^"']+)["']/gm)].map((match) =>
      match.length === 3 ? { names: match[1], specifier: match[2] } : { names: "", specifier: match[1] },
    );

  const seen = new Set<string>();
  const queue = [path.join(root, "app/[locale]/(pages)/[[...slug]]/page.tsx")];
  const packages = new Map<string, string>();
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    // Builder modules must stay server-side; the site chrome's own client
    // islands (language switcher etc.) already ship on every public page and
    // carry no editor code. `interactive/` is the allowed island directory.
    const inBuilder = file.includes(path.join("page-builder"));
    const isInteractiveIsland = file.includes(path.join("page-builder", "interactive"));
    if (inBuilder && !isInteractiveIsland) {
      assert.doesNotMatch(source.trimStart(), /^["']use client["']/, `${path.relative(root, file)} is a client module`);
    }
    for (const { names, specifier } of valueImports(source)) {
      const local = resolve(file, specifier);
      if (local) queue.push(local);
      else packages.set(`${specifier} (${path.relative(root, file)})`, names);
    }
  }
  for (const [where, names] of packages) {
    assert.doesNotMatch(where, /^(@tiptap|@dnd-kit|sanitize-html-client)/, where);
    if (where.startsWith("@puckeditor/core ")) assert.match(names, /^\{\s*Render\s*\}$/, `${where} may only import Render`);
  }
  assert.ok([...seen].some((file) => file.endsWith(path.join("page-builder", "config.server.tsx"))), "walk reached the server config");
});
