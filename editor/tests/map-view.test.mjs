import assert from "node:assert/strict";
import { test } from "node:test";
import { tileSource, visibleTileBounds } from "../test-dist/map-view.mjs";

const level1 = { width: 160, height: 255, tileWidth: 8, tileHeight: 8 };

test("visible bounds cull a level-1-sized map to the viewport", () => {
  const bounds = visibleTileBounds(level1, 800, 600, -320, -640, 2);
  assert.deepEqual(bounds, { left: 20, top: 40, right: 70, bottom: 78 });
  const visibleCells = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
  assert.ok(visibleCells < level1.width * level1.height / 10);
});

test("visible bounds remain inside every map edge", () => {
  assert.deepEqual(
    visibleTileBounds(level1, 5000, 5000, 100, 100, 1),
    { left: 0, top: 0, right: 160, bottom: 255 },
  );
});

test("GID one addresses the first tile and rows follow tileset columns", () => {
  assert.deepEqual(tileSource(1, 22, 8, 8), [0, 0]);
  assert.deepEqual(tileSource(23, 22, 8, 8), [0, 8]);
});
