import assert from "node:assert/strict";
import { test } from "node:test";
import { EntityDocumentModel } from "../test-dist/entity-document.mjs";
import { LevelDocumentModel } from "../test-dist/level-document.mjs";
import { createEmptyProject } from "../test-dist/project-io.mjs";
import { validateProject } from "../test-dist/validation.mjs";
import { PreviewRuntime } from "../test-dist/preview-runtime.mjs";

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
test("optional primitive properties can be added and removed", () => {
  const model = modelWithItem(), ref = { group: "items", index: 0 }; assert.equal(model.entity(ref).attributes.visualScale, undefined); assert.equal(model.setPrimitive(ref, ["attributes", "visualScale"], 4), true); assert.equal(model.entity(ref).attributes.visualScale, 4); assert.equal(model.deletePrimitive(ref, ["attributes", "visualScale"]), true); assert.equal(model.entity(ref).attributes.visualScale, undefined); assert.equal(model.deletePrimitive(ref, ["attributes", "visualScale"]), false);
});
test("camera geometry uses canonical corner fields", () => {
  const level = new LevelDocumentModel(createEmptyProject()); level.level.entities.cameraViews.push({ id: 0, left_up_x: 10, left_up_y: 20, right_down_x: 50, right_down_y: 70 });
  const model = new EntityDocumentModel(level); const ref = { group: "cameraViews", index: 0 };
  assert.deepEqual(model.box(ref), { x: 10, y: 20, width: 40, height: 50 }); model.translate(ref, 5, 7);
  assert.deepEqual(model.entity(ref), { id: 0, left_up_x: 15, left_up_y: 27, right_down_x: 55, right_down_y: 77 });
  model.resize(ref, 64, 32); assert.deepEqual(model.box(ref), { x: 15, y: 27, width: 64, height: 32 });
});
test("trigger zones and laser bounds resize through their canonical fields", () => {
  const level = new LevelDocumentModel(createEmptyProject()); const model = new EntityDocumentModel(level);
  level.level.entities.triggers.push({ id: 0, attributes: { x: 0, y: 0, width: 8, height: 8 }, targets: { target: [] } });
  const trigger = { group: "triggers", index: 0 }; model.resize(trigger, 24, 30); assert.deepEqual(model.box(trigger), { x: 0, y: 0, width: 24, height: 30 });
  level.level.entities.lasers.push({ id: 1, x: 10, y: 20, bb_x: 2, bb_y: 3, bb_width: 8, bb_height: 4 }); const laser = { group: "lasers", index: 0 };
  model.setBox(laser, { x: 30, y: 40, width: 16, height: 12 }); assert.deepEqual(model.box(laser), { x: 30, y: 40, width: 16, height: 12 }); assert.equal(model.entity(laser).x, 28); assert.equal(model.entity(laser).y, 37);
});
test("moving a laser updates both its functional origin and rebuilt runtime sprite", () => {
  const level = new LevelDocumentModel(createEmptyProject());
  level.level.entities.lasers.push({ id: 7, x: 10, y: 20, bb_x: 2, bb_y: 3, bb_width: 8, bb_height: 4, speed: 1, type: "horizontal", direction: "right", default_trigger: 1, definition: "objects/shoot" });
  const model = new EntityDocumentModel(level); const ref = { group: "lasers", index: 0 };
  model.translate(ref, 5, 7); model.flush();
  assert.deepEqual(model.box(ref), { x: 17, y: 30, width: 8, height: 4 });
  const runtime = new PreviewRuntime(level.level); const body = runtime.bodies.find((candidate) => candidate.key === "lasers:7");
  assert.equal(body.spriteX, 15); assert.equal(body.spriteY, 27); assert.equal(body.x, 17); assert.equal(body.y, 30);
  assert.equal(runtime.moveEntity("lasers", 7, 40, 50), true);
  const moved = runtime.bodies.find((candidate) => candidate.key === "lasers:7"); assert.equal(moved.x, 40); assert.equal(moved.y, 50); assert.equal(moved.spriteX, 38); assert.equal(moved.spriteY, 47);
  assert.equal(runtime.resizeEntity("lasers", 7, 18, 9), true); const resized = runtime.bodies.find((candidate) => candidate.key === "lasers:7"); assert.equal(resized.width, 18); assert.equal(resized.height, 9);
  runtime.reset(); const reset = runtime.bodies.find((candidate) => candidate.key === "lasers:7"); assert.equal(reset.x, 40); assert.equal(reset.width, 18); assert.equal(reset.height, 9);
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
  assert.ok(validateProject(level.project).some((diagnostic) => diagnostic.message.includes("cycle")));
});
