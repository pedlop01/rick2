import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { CharacterForms, validateCharacterForms } from "../test-dist/character-forms.mjs";

test("shared native/web character forms fixture transforms without moving its feet", async () => {
  const definition = JSON.parse(await readFile(new URL("../../tests/fixtures/character_forms.json", import.meta.url), "utf8"));
  const forms = new CharacterForms(definition); assert.equal(forms.active.visualScale, 4); const context = { input: { left: false, right: true, up: false, down: false, action: false }, signals: { grounded: true, onStairs: false, canDescendStairs: false, canStand: true, ceilingBlocked: false }, x: 10, y: 20 };
  forms.step(context); const result = forms.step({ ...context, x: 18 }); assert.equal(result.requestedForm, "frog"); assert.equal(forms.active.id, "frog"); assert.equal(forms.active.controller.standingHeight, 31);
});

const signals = { grounded: true, onStairs: false, canDescendStairs: false, canStand: true, ceilingBlocked: false }, idle = { left: false, right: false, up: false, down: false, action: false };
const formsDefinition = {
  initialForm: "warrior",
  forms: [
    { id: "warrior", controller: { collisionWidth: 15, standingHeight: 40, runSpeed: 2 }, stateMachine: { initialState: "idle", states: [{ id: "idle", transitions: [{ to: "idle", conditions: [{ type: "control", control: "action", pressed: true }], actions: [{ type: "setForm", form: "frog" }] }] }] } },
    { id: "frog", controller: { collisionWidth: 29, standingHeight: 31, runSpeed: 4 }, capabilities: { climb: false }, stateMachine: { initialState: "idle", states: [{ id: "idle", transitions: [] }] } },
  ],
};

test("forms switch controller profiles without losing position or facing", () => {
  const forms = new CharacterForms(formsDefinition, "left"); assert.equal(forms.active.id, "warrior"); assert.equal(forms.active.controller.standingHeight, 40);
  const transition = forms.step({ input: { ...idle, action: true }, signals, x: 50, y: 60 }); assert.equal(transition.requestedForm, "frog"); assert.equal(forms.active.id, "frog"); assert.equal(forms.active.controller.runSpeed, 4); assert.equal(forms.active.capabilities.climb, false); assert.equal(forms.state.facing, "left"); assert.equal(forms.state.originX, 50);
});

test("forcing current and previous states preserves facing and rejects unknown states", () => {
  const forms = new CharacterForms(formsDefinition, "left");
  forms.forceState("idle", "idle");
  assert.equal(forms.state.state, "idle"); assert.equal(forms.state.previousState, "idle"); assert.equal(forms.state.facing, "left");
  assert.throws(() => forms.forceState("missing", "idle"), /forced state/);
});

test("a declared gameplay event can switch form from any current state", () => {
  const definition = structuredClone(formsDefinition);
  for (const state of definition.forms[0].stateMachine.states) state.transitions.unshift({ to: state.id, conditions: [{ type: "event", event: "sceneComplete" }], actions: [{ type: "setForm", form: "frog" }] });
  const forms = new CharacterForms(definition); const context = { input: idle, signals, events: new Set(["sceneComplete"]), x: 50, y: 60 };
  forms.evaluate(context); assert.equal(forms.active.id, "frog"); assert.equal(forms.state.state, "idle"); assert.equal(forms.state.originX, 50); assert.equal(forms.state.originY, 60);
  forms.reset({ x: 10, y: 20 }, "left"); assert.equal(forms.active.id, "warrior"); assert.equal(forms.state.state, "idle"); assert.equal(forms.state.facing, "left"); assert.equal(forms.state.originX, 10); assert.equal(forms.state.originY, 20);
});

test("forms reject duplicates, missing initial forms and unknown form actions", () => {
  assert.throws(() => validateCharacterForms({ initialForm: "missing", forms: formsDefinition.forms }), /initial form/);
  assert.throws(() => validateCharacterForms({ initialForm: "warrior", forms: [formsDefinition.forms[0], formsDefinition.forms[0]] }), /duplicate form/);
  const invalid = structuredClone(formsDefinition); invalid.forms[0].stateMachine.states[0].transitions[0].actions[0].form = "dragon"; assert.throws(() => validateCharacterForms(invalid), /target/);
  const invalidScale = structuredClone(formsDefinition); invalidScale.forms[0].visualScale = 0; assert.throws(() => validateCharacterForms(invalidScale), /visualScale/);
});
