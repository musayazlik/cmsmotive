import assert from "node:assert/strict";
import { test } from "node:test";
import { activityStream } from "../lib/assistant-activity-stream";
import { effectiveActivityStatus, type AssistantActivity } from "../lib/assistant-activity-shared";

const activity: AssistantActivity = {
  id: "one", source: "chat", title: "Assistant reply", status: "running", detail: "Preparing a reply…",
  steps: [], createdAt: "2026-10-25T12:00:00.000Z", updatedAt: "2026-10-25T12:00:00.000Z", finishedAt: null,
};
const decode = (value: Uint8Array | undefined) => new TextDecoder().decode(value);

test("SSE sends initial state, deduplicates unchanged snapshots and carries updates", async () => {
  const abort = new AbortController();
  let reads = 0;
  const stream = activityStream(async () => {
    reads++;
    return [{ ...activity, status: reads >= 3 ? "completed" : "running" }];
  }, abort.signal, { pollMs: 5 });
  const reader = stream.getReader();
  try {
    assert.match(decode((await reader.read()).value), /retry: 3000/);
    const first = decode((await reader.read()).value);
    assert.match(first, /^event: activities\ndata: /);
    assert.match(first, /"status":"running"/);
    const second = decode((await reader.read()).value);
    assert.match(second, /"status":"completed"/);
    assert.ok(reads >= 3);
  } finally { abort.abort(); }
  assert.equal((await reader.read()).done, true);
});

test("SSE closes on cancellation and does not keep polling", async () => {
  let reads = 0;
  const reader = activityStream(async () => { reads++; return []; }, new AbortController().signal, { pollMs: 5 }).getReader();
  await reader.read();
  await reader.read();
  await reader.cancel();
  const stoppedAt = reads;
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(reads, stoppedAt);
});

test("SSE signals a safe failure without exposing database errors", async () => {
  const reader = activityStream(async () => { throw new Error("secret connection string"); }, new AbortController().signal).getReader();
  await reader.read();
  const frame = decode((await reader.read()).value);
  assert.match(frame, /event: unavailable/);
  assert.doesNotMatch(frame, /secret/);
  assert.equal((await reader.read()).done, true);
});

test("SSE rotates connections to refresh authentication and handles pre-aborted requests", async () => {
  const reader = activityStream(async () => [], new AbortController().signal, { lifetimeMs: 20, pollMs: 5 }).getReader();
  await reader.read();
  await reader.read();
  assert.equal((await reader.read()).done, true);
  const abort = new AbortController();
  abort.abort();
  const cancelled = activityStream(async () => { throw new Error("must not run"); }, abort.signal).getReader();
  assert.equal((await cancelled.read()).done, true);
});

test("stale running and waiting operations expire while terminal states remain unchanged", () => {
  const expired = new Date(100);
  assert.equal(effectiveActivityStatus("running", expired, 200), "expired");
  assert.equal(effectiveActivityStatus("waiting", expired, 200), "expired");
  assert.equal(effectiveActivityStatus("running", expired, 50), "running");
  assert.equal(effectiveActivityStatus("completed", expired, 200), "completed");
  assert.equal(effectiveActivityStatus("failed", expired, 200), "failed");
});
