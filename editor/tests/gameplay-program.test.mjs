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
test("player scene mode is a typed generic gameplay action", () => { const actions = []; const state = new GameplayState({}, () => undefined, (action) => actions.push(action)); state.execute({ type: "setPlayerMode", visible: false, controllable: false }); assert.deepEqual(actions, [{ type: "setPlayerMode", visible: false, controllable: false }]); assert.throws(() => validateGameplayProgram({ sequences: [{ id: "bad", steps: [{ type: "action", action: { type: "setPlayerMode", visible: 1, controllable: false } }] }] }), /invalid player mode/); });

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

test("entity visibility is a closed typed registered action", () => {
  const seen = [], state = new GameplayState({}, undefined, (action) => seen.push(action));
  state.execute({ type: "setEntityVisible", entityType: "backgroundObject", id: 7, visible: true, restartAnimation: true });
  assert.deepEqual(seen, [{ type: "setEntityVisible", entityType: "backgroundObject", id: 7, visible: true, restartAnimation: true }]);
  assert.throws(() => validateGameplayProgram({ sequences: [{ id: "bad", steps: [{ type: "action", action: { type: "setEntityVisible", entityType: "backgroundObject", id: -1, visible: true } }] }] }), /invalid entity visibility/);
  state.execute({ type: "setEnemyActive", id: 7, active: false, reset: true });
  assert.equal(seen.at(-1).type, "setEnemyActive");
});

test("parallel visibility branches finish before the following explosion and replay cleanly", () => {
  const scene = { sequences: [{ id: "scene", steps: [
    { type: "parallel", steps: [
      { type: "serial", steps: [
        { type: "action", action: { type: "setEntityVisible", entityType: "backgroundObject", id: 2, visible: true, restartAnimation: true } },
        { type: "wait", ticks: 2 },
        { type: "action", action: { type: "setEntityVisible", entityType: "backgroundObject", id: 2, visible: false } },
      ] },
      { type: "serial", steps: [
        { type: "action", action: { type: "setEntityVisible", entityType: "backgroundObject", id: 3, visible: true, restartAnimation: true } },
        { type: "wait", ticks: 4 },
        { type: "action", action: { type: "setEntityVisible", entityType: "backgroundObject", id: 3, visible: false } },
      ] },
    ] },
    { type: "serial", steps: [
      { type: "action", action: { type: "setEntityVisible", entityType: "backgroundObject", id: 0, visible: true, restartAnimation: true } },
      { type: "wait", ticks: 3 },
      { type: "action", action: { type: "setEntityVisible", entityType: "backgroundObject", id: 0, visible: false } },
    ] },
  ] }] };
  const trace = []; let tick = 0;
  const state = new GameplayState(scene, undefined, (action) => trace.push([tick, action.id, action.visible, Boolean(action.restartAnimation)]));
  const run = () => { const sequence = state.sequence("scene"); tick = 0; while (!sequence.step(state)) { state.beginTick(); tick += 1; } };
  run();
  const expected = [[0, 2, true, true], [0, 3, true, true], [2, 2, false, false], [4, 3, false, false], [4, 0, true, true], [7, 0, false, false]];
  assert.deepEqual(trace, expected);
  state.reset(); trace.length = 0; run();
  assert.deepEqual(trace, expected);
});
