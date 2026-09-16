import test from "node:test";
import assert from "node:assert/strict";
import { localInputValue, inputTimestamp, assertUnchanged } from "../src/editing.js";
test("untouched timestamps preserve milliseconds", () => {
  const original = Date.UTC(2026, 8, 16, 9, 2, 3, 456);
  assert.equal(inputTimestamp(localInputValue(original), original), original);
});
test("stale and deleted edits are rejected", () => {
  assert.throws(() => assertUnchanged({text:"new"}, {text:"old"}), /another window/);
  assert.throws(() => assertUnchanged(undefined, {id:"deleted"}), /another window/);
});

