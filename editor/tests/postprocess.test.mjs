import assert from "node:assert/strict";
import { test } from "node:test";
import { horizontalStripBaseOffset, horizontalStripOffset } from "../test-dist/postprocess.mjs";

const water = { id: "water", kind: "horizontalStripDisplacement", strips: 48, maxOffset: 4, periodMs: 25 };

test("horizontal strip displacement follows the deterministic triangular wave", () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, index) => horizontalStripBaseOffset(index, 4)), [0, 1, 2, 3, 4, 3, 2, 1, 0]);
  assert.equal(horizontalStripOffset(0, water, 24), 0);
  assert.equal(horizontalStripOffset(0, water, 25), 1);
  assert.equal(horizontalStripOffset(1, water, 25), 0);
  assert.equal(horizontalStripOffset(0, water, 50), 2);
});
