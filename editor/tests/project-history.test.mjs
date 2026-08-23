import assert from "node:assert/strict";
import { test } from "node:test";
import { ProjectHistory } from "../test-dist/project-history.mjs";
import { createEmptyProject } from "../test-dist/project-io.mjs";

test("history restores JSON and imported files without sharing bytes", () => {
  const project = createEmptyProject(); const history = new ProjectHistory(); history.reset(project);
  project.files.set("assets/images/new.png", new Uint8Array([1, 2])); history.record(project, "import"); project.files.get("assets/images/new.png")[0] = 9;
  assert.equal(history.undo().files.has("assets/images/new.png"), false); const restored = history.redo(); assert.deepEqual(restored.files.get("assets/images/new.png"), new Uint8Array([1, 2]));
});
test("recording after undo discards redo and respects the limit", () => {
  const project = createEmptyProject(); const history = new ProjectHistory(3); history.reset(project);
  for (let index = 0; index < 4; ++index) { project.manifest.name = String(index); history.record(project, String(index)); }
  assert.equal(history.undo().manifest.name, "2"); history.record(project, "branch"); assert.equal(history.canRedo, false);
});
test("saved state becomes clean again when reached through history", () => {
  const project = createEmptyProject(); const history = new ProjectHistory(); history.reset(project); project.manifest.name = "edited"; history.record(project, "edit"); history.markClean(); project.manifest.name = "again"; history.record(project, "edit 2"); assert.equal(history.isClean, false); history.undo(); assert.equal(history.isClean, true);
});
