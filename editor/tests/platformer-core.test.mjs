import assert from "node:assert/strict";
import { test } from "node:test";
import { groundActionForInput, levelObjective, playerActionBindings, playerCapabilities, playerControllerConfig, RICK_PLAYER_CONTROLLER, RICK_RUNTIME_BINDINGS, RICK_SESSION_RULES, runtimeProfileBindings, sessionRules } from "../test-dist/platformer-core.mjs";

test("the default controller preserves the level-1 Rick profile", () => {
  const config = playerControllerConfig();
  assert.deepEqual(config, RICK_PLAYER_CONTROLLER);
  assert.equal(config.runSpeed, 2);
  assert.equal(config.standingHeight, 21);
  assert.equal(config.crouchingHeight, 15);
});

test("controller profiles are immutable, merge partial overrides and reject invalid geometry", () => {
  const config = playerControllerConfig({ runSpeed: 4, collisionWidth: 8 });
  assert.equal(config.runSpeed, 4);
  assert.equal(config.collisionWidth, 8);
  assert.equal(config.jumpHeight, RICK_PLAYER_CONTROLLER.jumpHeight);
  assert.equal(Object.isFrozen(config), true);
  assert.throws(() => playerControllerConfig({ crouchingHeight: 22 }), /crouchingHeight/);
  assert.throws(() => playerControllerConfig({ maximumVerticalSpeed: 0 }), /maximumVerticalSpeed/);
});

test("optional capabilities gate actions and bindings can remap their chord", () => {
  const input = { action: true, up: true, down: false, left: false, right: false };
  assert.equal(groundActionForInput(input, playerCapabilities(), playerActionBindings()), "shooting");
  assert.equal(groundActionForInput(input, playerCapabilities({ shoot: false }), playerActionBindings()), null);
  assert.equal(groundActionForInput(input, playerCapabilities(), playerActionBindings({ up: "hitting" })), "hitting");
  assert.equal(groundActionForInput({ ...input, action: false }, playerCapabilities(), playerActionBindings()), null);
});

test("session rules preserve Rick defaults and validate lives and audio slots", () => {
  assert.deepEqual(sessionRules(), RICK_SESSION_RULES);
  assert.equal(sessionRules({ initialLives: 5, respawn: "none" }).initialLives, 5);
  assert.throws(() => sessionRules({ initialLives: 0 }), /initialLives/);
  assert.throws(() => sessionRules({ deathAudioSlot: -1 }), /deathAudioSlot/);
});

test("runtime bindings replace animation states and audio slots independently", () => {
  assert.deepEqual(runtimeProfileBindings(), RICK_RUNTIME_BINDINGS);
  const bindings = runtimeProfileBindings({ playerStates: { running: "HERO_RUN" }, audio: { shot: 9 } });
  assert.equal(bindings.playerStates.running, "HERO_RUN");
  assert.equal(bindings.playerStates.stop, "RICK_STATE_STOP");
  assert.equal(bindings.audio.shot, 9);
  assert.throws(() => runtimeProfileBindings({ enemyStates: { dying: "" } }), /dying/);
  assert.throws(() => runtimeProfileBindings({ audio: { bomb: -1 } }), /bomb/);
});

test("level objectives default to none and validate reach zones", () => {
  assert.deepEqual(levelObjective(undefined), { type: "none" });
  assert.equal(levelObjective({ type: "reachZone", x: 1, y: 2, width: 8, height: 9, onComplete: "freeze" }).width, 8);
  assert.throws(() => levelObjective({ type: "reachZone", x: 1, y: 2, width: 0, height: 9, onComplete: "freeze" }), /width/);
});
