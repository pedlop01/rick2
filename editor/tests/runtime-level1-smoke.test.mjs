import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PreviewRuntime } from "../test-dist/preview-runtime.mjs";

const level = JSON.parse(readFileSync(new URL("../../levels/level1/level.json", import.meta.url), "utf8"));
const idle = { left: false, right: false, up: false, down: false, action: false };
const values = (value) => Array.isArray(value) ? value : value === undefined ? [] : [value];

test("level 1 definitions cover every state their entities can emit", () => {
  const missing = [], requireStates = (definitionId, states) => { const available = new Set((level.definitions?.[definitionId]?.states ?? []).map((state) => state.name)); for (const state of states) if (!available.has(state)) missing.push(`${definitionId}:${state}`); };
  requireStates(level.player.definition, ["RICK_STATE_STOP", "RICK_STATE_JUMPING", "RICK_STATE_RUNNING", "RICK_STATE_CLIMBING", "RICK_STATE_CROUCHING", "RICK_STATE_SHOOTING", "RICK_STATE_BOMBING", "RICK_STATE_HITTING", "RICK_STATE_DYING"]);
  for (const entity of level.entities.platforms ?? []) requireStates(entity.attributes.definition, ["OBJ_STATE_STOP", "OBJ_STATE_MOVING"]);
  for (const entity of level.entities.hazards ?? []) { const directions = values(entity.actions?.action).map((action) => action.direction); requireStates(entity.attributes.definition, ["OBJ_STATE_STOP", ...(directions.some((direction) => !["stop", "deactivate"].includes(direction)) ? ["OBJ_STATE_MOVING"] : [])]); }
  for (const entity of level.entities.items ?? []) requireStates(entity.attributes.definition, ["OBJ_STATE_STOP", "OBJ_STATE_MOVING", "OBJ_STATE_DYING"]);
  for (const entity of level.entities.blocks ?? []) requireStates(entity.attributes.definition, ["OBJ_STATE_STOP", "OBJ_STATE_MOVING", "OBJ_STATE_DYING"]);
  for (const entity of level.entities.backgroundObjects ?? []) requireStates(entity.attributes.definition, ["OBJ_STATE_MOVING"]);
  for (const entity of level.entities.lasers ?? []) requireStates(entity.definition, ["OBJ_STATE_STOP", "OBJ_STATE_MOVING", "OBJ_STATE_DYING"]);
  for (const entity of level.entities.enemies ?? []) requireStates(entity.definition, ["CHAR_STATE_RUNNING", "CHAR_STATE_CLIMBING", "CHAR_STATE_DYING"]);
  requireStates(level.projectiles.shoot.definition, ["OBJ_STATE_MOVING"]); requireStates(level.projectiles.bomb.definition, ["OBJ_STATE_MOVING", "OBJ_STATE_DYING"]);
  assert.deepEqual([...new Set(missing)], []);
});

test("level 1 runs deterministically as a complete runtime smoke scenario", () => {
  const first = new PreviewRuntime(level), second = new PreviewRuntime(level);
  const unresolvedAnimations = new Set();
  first.setInvulnerable(true); second.setInvulnerable(true);
  for (let tick = 0; tick < 300; ++tick) {
    const input = { ...idle, right: tick < 180, up: tick === 25 || tick === 110 };
    first.step(input); second.step(input);
    for (const body of first.bodies) if (body.definition && body.state && !(level.definitions?.[body.definition]?.states ?? []).some((state) => state.name === body.state)) unresolvedAnimations.add(`${body.definition}:${body.state}`);
  }
  assert.deepEqual(first.player, second.player);
  assert.deepEqual(first.cameraFrame, second.cameraFrame);
  assert.deepEqual(first.bodies, second.bodies);
  assert.ok(first.bodies.length > 50);
  assert.deepEqual([...unresolvedAnimations], []);
  for (const body of first.bodies) for (const value of [body.x, body.y, body.width, body.height, body.frame]) assert.equal(Number.isFinite(value), true);
});

test("level 1 reset restores its initial player and camera snapshot", () => {
  const runtime = new PreviewRuntime(level), pristine = new PreviewRuntime(level);
  runtime.setInvulnerable(true);
  for (let tick = 0; tick < 120; ++tick) runtime.step({ ...idle, right: true, up: tick === 10 });
  runtime.reset();
  assert.deepEqual(runtime.player, pristine.player);
  assert.deepEqual(runtime.cameraFrame, pristine.cameraFrame);
  assert.equal(runtime.tick, 0);
});
