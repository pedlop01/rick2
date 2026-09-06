import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeProjectArchive, encodeProjectArchive, createEmptyProject } from "../test-dist/project-io.mjs";
import { createLevel, duplicateLevel, levelId, moveLevel, removeLevel, renameLevel, resizeLevelMap, setInitialLevel } from "../test-dist/project-levels.mjs";
import { validateProject } from "../test-dist/validation.mjs";

test("levels can be created, duplicated, renamed and ordered", () => {
  const project = createEmptyProject();
  const original = JSON.parse(new TextDecoder().decode(project.files.get(project.manifest.initialLevel)));
  original.map.layers.tiles[0] = 1;
  original.entities.enemies.push({ id: 7 });
  original.objective = { type: "reachZone", x: 0, y: 0, width: 1, height: 1 };
  project.files.set(project.manifest.initialLevel, new TextEncoder().encode(JSON.stringify(original)));
  const second = createLevel(project, "caves");
  assert.equal(levelId(project, second), "caves");
  const blank = JSON.parse(new TextDecoder().decode(project.files.get(second)));
  assert.equal(blank.map.layers.tiles.every((gid) => gid === 0), true);
  assert.deepEqual(blank.entities.enemies, []);
  assert.equal(blank.entities.checkpoints.length, 1);
  assert.equal("objective" in blank, false);
  const third = duplicateLevel(project, second, "tower");
  assert.deepEqual(project.manifest.levels, ["levels/level1/level.json", second, third]);
  const renamed = renameLevel(project, second, "deep-caves");
  assert.equal(project.files.has(second), false);
  assert.equal(levelId(project, renamed), "deep-caves");
  assert.equal(moveLevel(project, third, -1), true);
  assert.deepEqual(project.manifest.levels, ["levels/level1/level.json", third, renamed]);
});

test("initial level remains valid through rename and removal and is synced to game.json", () => {
  const project = createEmptyProject();
  const second = createLevel(project, "second");
  setInitialLevel(project, second);
  const renamed = renameLevel(project, second, "opening");
  assert.equal(project.manifest.initialLevel, renamed);
  removeLevel(project, renamed);
  assert.equal(project.manifest.initialLevel, project.manifest.levels[0]);
  const game = JSON.parse(new TextDecoder().decode(project.files.get("game.json")));
  assert.equal(game.initialLevel, project.manifest.initialLevel);
  assert.throws(() => removeLevel(project, project.manifest.initialLevel), /at least one/);
});

test("shared asset references survive a multi-level archive round trip", () => {
  const project = createEmptyProject();
  const second = duplicateLevel(project, project.manifest.initialLevel, "second");
  setInitialLevel(project, second);
  const reopened = decodeProjectArchive(encodeProjectArchive(project));
  assert.deepEqual(reopened.manifest.levels, project.manifest.levels);
  const level = JSON.parse(new TextDecoder().decode(reopened.files.get(second)));
  assert.equal(level.map.tileset.image, "../../assets/images/placeholder.png");
  assert.ok(reopened.files.has("assets/images/placeholder.png"));
});

test("validation attributes failures to each level independently", () => {
  const project = createEmptyProject();
  const second = duplicateLevel(project, project.manifest.initialLevel, "broken");
  const level = JSON.parse(new TextDecoder().decode(project.files.get(second)));
  level.map.layers.tiles.pop();
  project.files.set(second, new TextEncoder().encode(JSON.stringify(level)));
  const diagnostics = validateProject(project);
  assert.ok(diagnostics.some((item) => item.file === second && item.severity === "error"));
  assert.equal(diagnostics.some((item) => item.file === project.manifest.initialLevel && item.severity === "error"), false);
});

test("map resizing preserves the top-left overlap and initializes new cells", () => {
  const project = createEmptyProject(), path = project.manifest.initialLevel;
  const level = JSON.parse(new TextDecoder().decode(project.files.get(path)));
  level.map.layers.tiles[0] = 1;
  level.map.layers.tiles[31 + 24 * 32] = 1;
  project.files.set(path, new TextEncoder().encode(JSON.stringify(level)));
  resizeLevelMap(project, path, 34, 27);
  let resized = JSON.parse(new TextDecoder().decode(project.files.get(path))).map;
  assert.equal(resized.layers.tiles[0], 1);
  assert.equal(resized.layers.tiles[31 + 24 * 34], 1);
  assert.equal(resized.layers.tiles[33 + 26 * 34], 0);
  for (const cells of Object.values(resized.layers)) assert.equal(cells.length, 34 * 27);
  resizeLevelMap(project, path, 2, 2);
  resized = JSON.parse(new TextDecoder().decode(project.files.get(path))).map;
  assert.deepEqual([resized.width, resized.height, resized.layers.tiles], [2, 2, [1, 0, 0, 0]]);
  assert.throws(() => resizeLevelMap(project, path, 0, 2), /positive whole numbers/);
});
