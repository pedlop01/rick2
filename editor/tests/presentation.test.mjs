import assert from "node:assert/strict";
import { test } from "node:test";
import { PresentationState, validatePresentation } from "../test-dist/presentation.mjs";

const definition = {
  parallaxLayers: [{ id: "stars", image: "stars.png", plane: "back", factorX: 0.25, factorY: 0.1, repeatX: true }],
  messages: [{ id: "warning", speaker: "HQ", text: "Danger ahead", durationTicks: 2 }],
  effects: [{ id: "white-flash", kind: "flash", color: "#ffffff", durationTicks: 4 }],
};

test("presentation definitions reject invalid typed values", () => {
  assert.throws(() => validatePresentation({ parallaxLayers: [{ id: "bad", image: "", plane: "middle", factorX: 0, factorY: 0 }] }), /invalid parallax layer/);
  assert.throws(() => validatePresentation({ effects: [{ id: "bad", kind: "flash", color: "white", durationTicks: 0 }] }), /invalid visual effect/);
});

test("camera, messages and effects advance deterministically", () => {
  const state = new PresentationState(definition);
  state.execute({ type: "setCamera", mode: "fixed", x: 100, y: 50, durationTicks: 2 }, 0, 0);
  assert.deepEqual(state.cameraPosition(9, 9), { x: 0, y: 0 });
  state.step(); assert.deepEqual(state.cameraPosition(9, 9), { x: 50, y: 25 });
  state.step(); assert.deepEqual(state.cameraPosition(9, 9), { x: 100, y: 50 });
  state.execute({ type: "showMessage", message: "warning" }); state.step(); assert.equal(state.snapshot.message?.text, "Danger ahead"); state.step(); assert.equal(state.snapshot.message, null);
  state.execute({ type: "playEffect", effect: "white-flash" }); state.step(); assert.equal(state.effectOpacity(), .5);
  state.execute({ type: "setCamera", mode: "follow", durationTicks: 0 }); assert.deepEqual(state.cameraPosition(7, 8), { x: 7, y: 8 });
  assert.throws(() => state.execute({ type: "showMessage", message: "missing" }), /does not exist/);
});
