import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { strFromU8, strToU8 } from "fflate";
import { createEmptyProject } from "../test-dist/project-io.mjs";
import { prepareLevelForEditing } from "../test-dist/migrations.mjs";
import { hasValidationErrors, validateProject } from "../test-dist/validation.mjs";

function readLevel(project) {
  return JSON.parse(strFromU8(project.files.get(project.manifest.initialLevel)));
}

function writeLevel(project, level) {
  project.files.set(project.manifest.initialLevel, strToU8(`${JSON.stringify(level)}\n`));
}

test("new project satisfies structural and semantic contracts", () => {
  const diagnostics = validateProject(createEmptyProject());
  assert.deepEqual(diagnostics, []);
  assert.equal(hasValidationErrors(diagnostics), false);
});

test("committed level 1 satisfies the same bundled contract", async () => {
  const project = createEmptyProject("level-one", "Level one");
  project.files.set(
    project.manifest.initialLevel,
    new Uint8Array(await readFile(new URL("../../levels/level1/level.json", import.meta.url))),
  );
  assert.deepEqual(validateProject(project), []);
});

test("schema diagnostics include the JSON location", () => {
  const project = createEmptyProject();
  const level = readLevel(project);
  level.entities.enemies.push({ id: 1, direction: "sideways" });
  writeLevel(project, level);
  const diagnostics = validateProject(project);
  assert.ok(hasValidationErrors(diagnostics));
  assert.ok(diagnostics.some((item) => item.path.includes("/entities/enemies/0")));
});

test("semantic validation rejects duplicate IDs and broken references", () => {
  const project = createEmptyProject();
  const level = readLevel(project);
  const checkpoint = level.entities.checkpoints[0];
  level.entities.checkpoints.push({ ...checkpoint, nxt_chks: [99] });
  writeLevel(project, level);
  const diagnostics = validateProject(project);
  assert.ok(diagnostics.some((item) => item.message.includes("ID duplicado")));
  assert.ok(diagnostics.some((item) => item.message.includes("Checkpoint inexistente")));
});

test("migration registry accepts v1 clones and rejects future versions", () => {
  const level = readLevel(createEmptyProject());
  const prepared = prepareLevelForEditing(level);
  assert.equal(prepared.migratedFrom, null);
  assert.notEqual(prepared.document, level);
  assert.throws(
    () => prepareLevelForEditing({ ...level, formatVersion: 999 }),
    /futura no soportada/,
  );
});
