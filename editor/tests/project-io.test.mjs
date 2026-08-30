import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createEmptyProject,
  createPlatformerDemoProject,
  decodeProjectArchive,
  encodeProjectArchive,
  getProjectAsset,
  loadProjectFiles,
  normalizeProjectPath,
  resolveProjectReference,
} from "../test-dist/project-io.mjs";

test("empty project survives a ZIP round trip without losing files", () => {
  const project = createEmptyProject("round-trip", "Round trip");
  project.files.set("assets/images/raw.bin", new Uint8Array([0, 255, 17, 42]));
  const reopened = decodeProjectArchive(encodeProjectArchive(project));
  assert.deepEqual(reopened.manifest, project.manifest);
  assert.deepEqual([...reopened.files.keys()].sort(), [...project.files.keys()].sort());
  for (const [path, bytes] of project.files) {
    assert.deepEqual(reopened.files.get(path), bytes, path);
  }
});

test("project paths reject traversal, absolute and duplicate normalized names", () => {
  for (const path of ["../outside.json", "/root.json", "C:/root.json", "a//b.json", "a/./b.json"]) {
    assert.throws(() => normalizeProjectPath(path), /not allowed/);
  }
  assert.throws(
    () => loadProjectFiles(new Map([
      ["project.json", new Uint8Array()],
      ["folder\\file.json", new Uint8Array()],
      ["folder/file.json", new Uint8Array()],
    ])),
    /Duplicate/,
  );
});

test("asset references resolve relative to their JSON without escaping the project", () => {
  const project = createEmptyProject();
  const bytes = new Uint8Array([1, 2, 3]);
  project.files.set("assets/images/tileset.png", bytes);
  assert.equal(
    resolveProjectReference("levels/level1/level.json", "../../assets/images/tileset.png"),
    "assets/images/tileset.png",
  );
  assert.deepEqual(
    getProjectAsset(project, "levels/level1/level.json", "../../assets/images/tileset.png"),
    bytes,
  );
  assert.throws(
    () => resolveProjectReference("levels/level1/level.json", "../../../outside.png"),
    /outside the project/,
  );
});

test("project requires its manifests and every declared level", () => {
  assert.throws(() => loadProjectFiles(new Map()), /project\.json/);
  const project = createEmptyProject();
  project.files.delete(project.manifest.initialLevel);
  assert.throws(() => loadProjectFiles(project.files), /Declared level is missing/);
});

test("generic platformer demo survives the standard ZIP round trip", () => {
  const project = createPlatformerDemoProject();
  const reopened = decodeProjectArchive(encodeProjectArchive(project));
  assert.equal(reopened.manifest.id, "tiny-runner");
  assert.deepEqual([...reopened.files.keys()].sort(), [...project.files.keys()].sort());
});
