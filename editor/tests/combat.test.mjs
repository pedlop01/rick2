import assert from "node:assert/strict";
import { test } from "node:test";
import { CombatantState, activeAttackboxes, resolveCombat, validateCombat } from "../test-dist/combat.mjs";

const definition = { damageTypes: [{ id: "physical" }], profiles: [
  { id: "warrior", faction: "heroes", maxHealth: 3, hurtboxes: [{ id: "body", x: 2, y: 1, width: 8, height: 15 }], attacks: [{ id: "sword", states: ["striking"], frames: [1, 2], x: 9, y: 3, width: 9, height: 5, damageType: "physical", damage: 1, hitOnce: true }] , guards: [{ id: "shield", states: ["guarding"], x: 8, y: 1, width: 4, height: 14, facingOnly: true }] },
  { id: "enemy", faction: "monsters", maxHealth: 2, invulnerabilityTicks: 2, hurtboxes: [{ id: "body", x: 0, y: 0, width: 10, height: 16 }] },
] };
const pose = (x, face, state, frame = 0, activation = 1) => ({ x, y: 0, width: 12, face, state, frame, activation });

test("combat profiles are closed, typed and validate references", () => { validateCombat(definition); assert.throws(() => validateCombat({ damageTypes: [{ id: "physical" }], profiles: [{ ...definition.profiles[0], attacks: [{ ...definition.profiles[0].attacks[0], damageType: "magic" }] }] }), /invalid attack/); });
test("frame windows and facing mirror attack boxes", () => { const warrior = definition.profiles[0]; assert.equal(activeAttackboxes(warrior, pose(10, "right", "striking", 0)).length, 0); assert.equal(activeAttackboxes(warrior, pose(10, "right", "striking", 1))[0].x, 19); assert.equal(activeAttackboxes(warrior, pose(10, "left", "striking", 1))[0].x, 4); });
test("hits damage once per activation and respect invulnerability", () => { const attacker = new CombatantState(definition.profiles[0]), defender = new CombatantState(definition.profiles[1]); const hit = resolveCombat(attacker, pose(0, "right", "striking", 1), defender, pose(12, "left", "walking")); assert.equal(hit?.blocked, false); assert.equal(defender.health, 1); assert.equal(resolveCombat(attacker, pose(0, "right", "striking", 2), defender, pose(12, "left", "walking")), null); attacker.step(); defender.step(); attacker.step(); defender.step(); resolveCombat(attacker, pose(0, "right", "striking", 1, 2), defender, pose(12, "left", "walking")); assert.equal(defender.alive, false); });
test("a facing guard blocks an overlapping attack", () => { const attacker = new CombatantState(definition.profiles[0]), defender = new CombatantState({ ...definition.profiles[0], faction: "guards" }); const hit = resolveCombat(attacker, pose(0, "right", "striking", 1), defender, pose(12, "left", "guarding")); assert.equal(hit?.blocked, true); assert.equal(defender.health, 3); });
