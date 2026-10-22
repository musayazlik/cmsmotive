import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCommentAiResult } from "../lib/comment-ai-result";

test("AI review accepts only an explicit verdict and a bounded explanation", () => {
  assert.deepEqual(parseCommentAiResult('{"status":"passed","note":" Respectful and relevant. "}'), { status: "passed", note: "Respectful and relevant." });
  assert.deepEqual(parseCommentAiResult('```json\n{"status":"flagged","note":"Unsolicited advertising."}\n```'), { status: "flagged", note: "Unsolicited advertising." });
  for (const value of ["approved", "{}", "[]", "null", '{"status":"approved","note":"Publish"}', '{"status":"passed","note":""}', '{"status":"passed","note":12}', JSON.stringify({ status: "passed", note: "x".repeat(601) }), 'Text before {"status":"passed","note":"OK"}']) {
    assert.equal(parseCommentAiResult(value), null, value);
  }
});
