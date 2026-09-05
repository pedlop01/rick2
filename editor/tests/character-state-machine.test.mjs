import assert from "node:assert/strict";
import { test } from "node:test";
import { CharacterStateMachine, validateCharacterStateMachine } from "../test-dist/character-state-machine.mjs";

const idleInput = { left: false, right: false, up: false, down: false, action: false };
const signals = { grounded: true, onStairs: false, canDescendStairs: false, canStand: true, ceilingBlocked: false };
const context = (input = idleInput, x = 10, y = 20) => ({ input, signals, x, y });
const definition = {
  initialState: "idle",
  states: [
    { id: "idle", transitions: [{ to: "running", conditions: [{ type: "control", control: "right", pressed: true }], actions: [{ type: "setFacing", value: "input" }, { type: "capturePosition", axis: "both" }] }] },
    { id: "running", transitions: [{ to: "jumping", conditions: [{ type: "signal", signal: "grounded", value: false }] }, { to: "idle", conditions: [{ type: "distance", axis: "x", comparison: "greaterOrEqual", value: 8 }], actions: [{ type: "setForm", form: "frog" }] }] },
    { id: "jumping", transitions: [{ to: "idle", conditions: [{ type: "elapsedTicks", comparison: "greaterOrEqual", value: 2 }, { type: "previousState", comparison: "equal", state: "running" }] }] },
  ],
};

test("declarative state transitions are ordered and deterministic", () => {
  const machine = new CharacterStateMachine(definition); assert.equal(machine.snapshot.state, "idle");
  const running = machine.step(context({ ...idleInput, right: true })); assert.equal(running.state, "running"); assert.equal(running.facing, "right"); assert.equal(running.originX, 10);
  assert.equal(machine.step(context(idleInput, 17)).state, "running"); const transformed = machine.step(context(idleInput, 18)); assert.equal(transformed.state, "idle"); assert.equal(transformed.requestedForm, "frog");
});

test("elapsed and previous-state conditions use state-local history", () => {
  const machine = new CharacterStateMachine(definition); machine.step(context({ ...idleInput, right: true }));
  const air = { ...signals, grounded: false }; machine.step({ ...context(), signals: air }); assert.equal(machine.snapshot.state, "jumping");
  machine.step({ ...context(), signals: air }); machine.step({ ...context(), signals: air }); assert.equal(machine.snapshot.state, "jumping");
  machine.step({ ...context(), signals: air }); assert.equal(machine.snapshot.state, "idle");
});

test("invalid graphs are rejected before execution", () => {
  assert.throws(() => validateCharacterStateMachine({ initialState: "missing", states: [{ id: "idle", transitions: [] }] }), /initial state/);
  assert.throws(() => validateCharacterStateMachine({ initialState: "idle", states: [{ id: "idle", transitions: [{ to: "nowhere", conditions: [{ type: "control", control: "left", pressed: true }] }] }] }), /target/);
  assert.throws(() => validateCharacterStateMachine({ initialState: "idle", states: [{ id: "idle", transitions: [{ to: "idle", conditions: [] }] }] }), /at least one condition/);
});

test("semantic action conditions do not depend on physical input chords", () => {
  const machine = new CharacterStateMachine({ initialState: "idle", states: [{ id: "idle", transitions: [{ to: "attack", conditions: [{ type: "action", action: "melee", active: true }] }] }, { id: "attack", transitions: [] }] });
  assert.equal(machine.step({ ...context(), actions: new Set(["melee"]) }).state, "attack");
});
