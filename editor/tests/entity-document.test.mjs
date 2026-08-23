import assert from "node:assert/strict";
import { test } from "node:test";
import { EntityDocumentModel } from "../test-dist/entity-document.mjs";
import { LevelDocumentModel } from "../test-dist/level-document.mjs";
import { createEmptyProject } from "../test-dist/project-io.mjs";
import { validateProject } from "../test-dist/validation.mjs";

function modelWithItem() {
  const level = new LevelDocumentModel(createEmptyProject());
  level.level.entities.items.push({ id: 0, attributes: { ini_x: 4, ini_y: 5, width: 8, height: 8, definition: "objects/bomb" } });
  return new EntityDocumentModel(level);
}
test("entities can be hit, moved, duplicated and deleted", () => {
  const model = modelWithItem(); assert.deepEqual(model.hitTest(6, 6, "items"), { group: "items", index: 0 });
  assert.equal(model.move({ group: "items", index: 0 }, 4, 4), true); assert.deepEqual(model.box({ group: "items", index: 0 }), { x: 4, y: 4, width: 8, height: 8 });
  const copy = model.duplicate({ group: "items", index: 0 }); assert.deepEqual(copy, { group: "items", index: 1 }); assert.equal(model.entity(copy).id, 1); model.flush(); assert.deepEqual(validateProject(model.project), []); assert.equal(model.remove(copy), true);
});
test("primitive edits preserve their JSON types", () => {
  const model = modelWithItem(); const ref = { group: "items", index: 0 }; model.setPrimitive(ref, ["attributes", "width"], 12); model.setPrimitive(ref, ["attributes", "definition"], "objects/shoot");
  assert.equal(model.entity(ref).attributes.width, 12); assert.equal(model.entity(ref).attributes.definition, "objects/shoot");
});
test("camera geometry uses canonical corner fields", () => {
  const level = new LevelDocumentModel(createEmptyProject()); level.level.entities.cameraViews.push({ id: 0, left_up_x: 10, left_up_y: 20, right_down_x: 50, right_down_y: 70 });
  const model = new EntityDocumentModel(level); const ref = { group: "cameraViews", index: 0 };
  assert.deepEqual(model.box(ref), { x: 10, y: 20, width: 40, height: 50 }); model.translate(ref, 5, 7);
  assert.deepEqual(model.entity(ref), { id: 0, left_up_x: 15, left_up_y: 27, right_down_x: 55, right_down_y: 77 });
});
test("gameplay guides expose checkpoint links, routes, targets and AI zones", () => {
  const level = new LevelDocumentModel(createEmptyProject()); const entities = level.level.entities;
  entities.checkpoints.push({ id: 1, chk_x: 40, chk_y: 0, chk_width: 8, chk_height: 8, pl_x: 40, pl_y: 0, pl_face: "right", nxt_chks: [] }); entities.checkpoints[0].nxt_chks = [1];
  entities.platforms.push({ id: 0, attributes: { ini_x: 0, ini_y: 20, width: 8, height: 8 }, actions: { action: { direction: "right", desp: 16 } } });
  entities.triggers.push({ id: 0, attributes: { x: 0, y: 20, width: 8, height: 8 }, targets: { target: { type: "platform", id: 0 } } });
  entities.enemies.push({ id: 0, x: 0, y: 0, bb_x: 0, bb_y: 0, bb_width: 8, bb_height: 8, ia_orig_x: 2, ia_orig_y: 3, ia_limit_x: 20, ia_limit_y: 30 });
  const guides = new EntityDocumentModel(level).gameplayGuides(); assert.ok(guides.lines.some((line) => line.kind === "checkpoint")); assert.ok(guides.lines.some((line) => line.kind === "target")); assert.ok(guides.lines.some((line) => line.kind === "route")); assert.deepEqual(guides.zones[0].box, { x: 2, y: 3, width: 20, height: 30 });
});
test("hitTestAll returns every overlapping entity in selectable order", () => { const model = modelWithItem(); model.groups.items.push({ id: 2, attributes: { ini_x: 4, ini_y: 5, width: 8, height: 8 } }); const hits = model.hitTestAll(6, 6, "items"); assert.equal(hits.length, 2); assert.equal(hits[0].group, "items"); assert.equal(hits[0].index, 1); });

test("checkpoint cycles are rejected before export", () => {
  const level = new LevelDocumentModel(createEmptyProject()); level.level.entities.checkpoints[0].nxt_chks = [0]; level.flush();
  assert.ok(validateProject(level.project).some((diagnostic) => diagnostic.message.includes("ciclo")));
});
