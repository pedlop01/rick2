import assert from "node:assert/strict";
import { test } from "node:test";
import { LevelDocumentModel } from "../test-dist/level-document.mjs";
import { createEmptyProject } from "../test-dist/project-io.mjs";

test("paint and flood fill stay inside map and validate layer GIDs", () => {
  const model = new LevelDocumentModel(createEmptyProject());
  assert.equal(model.setCell("tiles", 0, 0, 1), true);
  assert.equal(model.setCell("tiles", -1, 0, 1), false);
  assert.equal(model.setCell("tiles", 0, 0, 2), false);
  assert.equal(model.setCell("collisions", 0, 0, 2), true);
  assert.equal(model.setCell("collisions", 0, 0, 6), true);
  assert.equal(model.setCell("collisions", 0, 0, 7), true);
  assert.equal(model.setCell("collisions", 0, 0, 8), false);
  assert.equal(model.floodFill("frontTiles", 0, 0, 1), true);
  assert.ok(model.map.layers.frontTiles.every((gid) => gid === 1));
});

test("line painting does not leave gaps", () => {
  const model = new LevelDocumentModel(createEmptyProject());
  model.paintLine("tiles", 0, 0, 5, 3, 1);
  const painted = model.map.layers.tiles.filter((gid) => gid === 1).length;
  assert.ok(painted >= 6);
});

test("copy cut and clipped paste never corrupt map dimensions", () => {
  const model = new LevelDocumentModel(createEmptyProject());
  model.setCell("tiles", 0, 0, 1);
  model.setCell("tiles", 1, 0, 1);
  const selection = { x: 0, y: 0, width: 2, height: 1 };
  const clipboard = model.copy("tiles", selection);
  assert.deepEqual(clipboard, { width: 2, height: 1, cells: [1, 1] });
  assert.equal(model.clear("tiles", selection), true);
  assert.equal(model.paste("tiles", model.map.width - 1, model.map.height - 1, clipboard), true);
  assert.equal(model.map.layers.tiles.length, model.map.width * model.map.height);
  assert.equal(model.map.layers.tiles.at(-1), 1);
});
