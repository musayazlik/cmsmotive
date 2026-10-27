import assert from "node:assert/strict";
import { test } from "node:test";
import { findBlockById, regenerateBlockIds, updateBlockById, type PageBuilderData } from "../lib/page-builder/data";
import { translateDocument } from "../lib/page-builder/ai";

/** A document with a nested Grid slot child, as the editor stores it. */
const doc = (): PageBuilderData => ({
  root: { props: {} },
  content: [
    {
      type: "GridBlock",
      props: {
        id: "grid",
        columns: "2",
        col1: [
          { type: "HeadingBlock", props: { id: "h", text: "Hello", level: "h2" } },
          { type: "TextBlock", props: { id: "t", content: "<p>World</p>" } },
        ],
      },
    },
    { type: "HeroBlock", props: { id: "hero", title: "Buy cars", subtitle: "Great deals" } },
    {
      type: "FAQBlock",
      props: {
        id: "faq",
        items: [
          { question: "Q1?", answer: "A1" },
          { question: "Q2?", answer: "A2" },
        ],
      },
    },
  ],
});

test("findBlockById reaches into slot children", () => {
  const found = findBlockById(doc(), "t");
  assert.ok(found);
  assert.equal(found.type, "TextBlock");
  assert.equal(findBlockById(doc(), "missing"), null);
});

test("updateBlockById replaces only the matching block and keeps the tree", () => {
  const next = updateBlockById(doc(), "h", (block) => ({
    ...block,
    props: { ...block.props, text: "Changed" },
  }));
  const grid = next.content[0] as { props: { col1: unknown[] } };
  const heading = grid.props.col1[0] as { props: { text: string } };
  assert.equal(heading.props.text, "Changed");
  assert.equal((next.content[1] as { props: { title: string } }).props.title, "Buy cars");
});

test("regenerateBlockIds gives every block a fresh unique id", () => {
  const collect = (data: PageBuilderData): string[] => {
    const ids: string[] = [];
    for (const block of data.content) {
      ids.push((block.props as { id: string }).id);
      const nested = (block.props as { col1?: unknown[] }).col1;
      for (const child of nested ?? []) ids.push((child as { props: { id: string } }).props.id);
    }
    return ids;
  };
  const cloneIds = collect(regenerateBlockIds(doc()));
  assert.equal(new Set(cloneIds).size, cloneIds.length);
  assert.deepEqual(
    cloneIds.every((id) => typeof id === "string" && id.length > 0),
    true,
  );
});

test("translateDocument rewrites whitelisted strings, shared values once, technical values never", async () => {
  const calls: string[][] = [];
  const result = await translateDocument(doc(), "de", async (values, language) => {
    calls.push([language, ...values]);
    return values.map((value) => `DE:${value}`);
  });
  // One call, deduplicated values, in document order.
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "de");
  assert.deepEqual(calls[0].slice(1), ["Hello", "<p>World</p>", "Buy cars", "Great deals", "Q1?", "A1", "Q2?", "A2"]);
  const hero = result.content[1] as { props: { title: string } };
  assert.equal(hero.props.title, "DE:Buy cars");
  const grid = result.content[0] as { props: { col1: Array<{ props: Record<string, unknown> }> } };
  assert.equal(grid.props.col1[1].props.content, "DE:<p>World</p>");
  const faq = result.content[2] as { props: { items: Array<{ question: string }> } };
  assert.equal(faq.props.items[1].question, "DE:Q2?");
  // Layout props never reach the translator.
  assert.ok(!JSON.stringify(calls).includes("h2"));
});

test("translateDocument refuses a translation with the wrong length", async () => {
  await assert.rejects(
    () => translateDocument(doc(), "de", async (values) => values.slice(1)),
    /wrong length/,
  );
});

test("translateDocument skips the model when there is nothing to translate", async () => {
  let called = false;
  const empty: PageBuilderData = { root: { props: {} }, content: [{ type: "SpacerBlock", props: { id: "s", height: "md" } }] };
  const result = await translateDocument(empty, "de", async () => {
    called = true;
    return [];
  });
  assert.equal(called, false);
  assert.deepEqual(result, empty);
});
