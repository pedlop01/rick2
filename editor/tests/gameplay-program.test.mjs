import assert from "node:assert/strict";
import { test } from "node:test";
import { GameplayState, validateGameplayProgram, validateGameplayTrigger } from "../test-dist/gameplay-program.mjs";

const program = {
  flags: [
    { id: "doorOpen", type: "boolean", initial: false },
    { id: "keys", type: "number", initial: 0 },
    { id: "area", type: "string", initial: "start" },
  ],
  events: [{ id: "doorOpened", description: "The exit door opens" }],
  sequences: [{ id: "unlockDoor", steps: [
    { type: "action", action: { type: "incrementFlag", flag: "keys", amount: 1 } },
    { type: "parallel", steps: [
      { type: "action", action: { type: "setFlag", flag: "doorOpen", value: true } },
      { type: "serial", steps: [{ type: "wait", ticks: 2 }, { type: "action", action: { type: "emitEvent", event: "doorOpened" } }] },
    ] },
  ] }],
};

test("typed flags reject invalid actions and undeclared events", () => {
  assert.throws(() => validateGameplayProgram({ flags: [{ id: "ready", type: "boolean", initial: false }], sequences: [{ id: "bad", steps: [{ type: "action", action: { type: "incrementFlag", flag: "ready", amount: 1 } }] }] }), /must be a finite number/);
  assert.throws(() => validateGameplayProgram({ sequences: [{ id: "bad", steps: [{ type: "action", action: { type: "emitEvent", event: "missing" } }] }] }), /event does not exist/);
  assert.throws(() => validateGameplayTrigger({ flags: [{ id: "count", type: "number", initial: 0 }] }, [], [{ type: "toggleFlag", flag: "count" }]), /must be boolean/);
});

test("flags, serial steps, parallel steps and custom events execute deterministically", () => {
  const state = new GameplayState(program), sequence = state.sequence("unlockDoor");
  assert.equal(state.flag("doorOpen"), false); assert.equal(state.flag("keys"), 0);
  assert.equal(sequence.step(state), false); assert.equal(state.flag("keys"), 1); assert.equal(state.flag("doorOpen"), true); assert.equal(state.event("doorOpened"), false);
  state.beginTick(); assert.equal(sequence.step(state), false); assert.equal(state.event("doorOpened"), false);
  state.beginTick(); assert.equal(sequence.step(state), true); assert.equal(state.event("doorOpened"), true);
  state.beginTick(); assert.equal(state.event("doorOpened"), false);
});

test("conditions query typed flags and tick-local events", () => {
  const state = new GameplayState(program); state.execute({ type: "incrementFlag", flag: "keys", amount: 2 }); state.execute({ type: "emitEvent", event: "killed" });
  assert.equal(state.matches({ type: "flag", flag: "keys", comparison: "greaterOrEqual", value: 2 }), true);
  assert.equal(state.matches({ type: "event", event: "killed" }), true);
});
