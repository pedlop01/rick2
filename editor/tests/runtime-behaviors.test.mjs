import assert from "node:assert/strict";
import { test } from "node:test";
import { RuntimeBehaviorRegistry } from "../test-dist/runtime-behaviors.mjs";

test("runtime behaviors dispatch by semantic kind instead of entity key", () => {
  const registry = new RuntimeBehaviorRegistry();
  registry.register("moving", (body) => { body.x += body.speed; });
  const body = { key: "an-id-with-no-prefix", x: 3, speed: 2 };
  registry.run("moving", body);
  assert.equal(body.x, 5);
});

test("runtime behavior registration rejects ambiguity and missing handlers", () => {
  const registry = new RuntimeBehaviorRegistry().register("solid", () => undefined);
  assert.equal(registry.has("solid"), true);
  assert.throws(() => registry.register("solid", () => undefined), /Duplicate/);
  assert.throws(() => registry.run("unknown", {}), /Unregistered/);
});
