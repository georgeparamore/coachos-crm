import test from "node:test";
import assert from "node:assert/strict";
import { discoveryCallSegmentCount, workflowErrorMessage } from "./discovery-call-workflow-utils.ts";

test("splits a 65-minute recording into thirteen five-minute steps", () => {
  assert.equal(discoveryCallSegmentCount(65, 42_783_796, 300, 24 * 1024 * 1024), 13);
});

test("chunks a long compressed call even when its file is under the direct upload limit", () => {
  assert.equal(discoveryCallSegmentCount(45, 10_000_000, 300, 24 * 1024 * 1024), 9);
});

test("keeps a short recording in one transcription step", () => {
  assert.equal(discoveryCallSegmentCount(4, 2_000_000, 300, 24 * 1024 * 1024), 1);
});

test("preserves messages from serialized workflow errors", () => {
  assert.equal(workflowErrorMessage({ message: "Transcription timed out" }), "Transcription timed out");
});
