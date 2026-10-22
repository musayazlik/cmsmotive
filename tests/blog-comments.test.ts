import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCommentInput } from "../lib/blog-comments-shared";

const input = { postId: "cmtestpost123", name: "  Ada   Reader  ", email: "  ADA@example.com ", body: " A useful article. ", requestKey: "12345678-1234-4123-8123-123456789abc", locale: "tr" };

test("comment submissions normalize identities and keep only expected fields", () => {
  assert.deepEqual(parseCommentInput({ ...input, status: "approved", moderatedAt: "2026-01-01" }), { postId: "cmtestpost123", parentId: null, authorName: "Ada Reader", authorEmail: "ada@example.com", body: "A useful article.", requestKey: input.requestKey, locale: "tr" });
});

test("comments reject malformed identity, oversized messages, honeypots and invalid retry keys", () => {
  for (const changes of [
    { name: " " }, { name: "a".repeat(61) }, { name: "Ada\u0000Reader" },
    { email: "not-an-email" }, { email: `${"a".repeat(250)}@example.com` },
    { body: " " }, { body: "a".repeat(2001) }, { body: "hello\u0000world" },
    { website: "https://spam.example" }, { postId: "../private" }, { parentId: { id: "other" } },
    { requestKey: "reused-invalid-key" },
  ]) {
    assert.equal(parseCommentInput({ ...input, ...changes }), null, JSON.stringify(changes));
  }
  assert.equal(parseCommentInput(null), null);
  assert.equal(parseCommentInput([]), null);
});

test("unsupported locales fall back to English and valid reply identifiers are retained", () => {
  const parsed = parseCommentInput({ ...input, parentId: "cmparent123", locale: "xx" });
  assert.equal(parsed?.parentId, "cmparent123");
  assert.equal(parsed?.locale, "en");
});
