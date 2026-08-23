import assert from "node:assert/strict";
import { test } from "node:test";
import { AssetDocumentModel } from "../test-dist/asset-document.mjs";
import { LevelDocumentModel } from "../test-dist/level-document.mjs";
import { createEmptyProject } from "../test-dist/project-io.mjs";

test("definitions, states and frames receive stable unique IDs", () => {
  const model = new AssetDocumentModel(new LevelDocumentModel(createEmptyProject()));
  model.addDefinition("objects/test", "object", "../../assets/images/placeholder.png"); assert.equal(model.addState("objects/test"), 1); assert.equal(model.addFrame("objects/test", 1), 1);
  assert.deepEqual(model.definitions["objects/test"].states.map((state) => state.id), [0, 1]);
  assert.throws(() => model.addDefinition("objects/test", "object", "x"), /duplicada/);
});
test("asset import sanitizes names, avoids overwrites and returns level-relative paths", () => {
  const model = new AssetDocumentModel(new LevelDocumentModel(createEmptyProject())); const bytes = new Uint8Array([1, 2, 3]);
  const first = model.importAsset("Mi Sprite.PNG", bytes, "images"); const second = model.importAsset("Mi Sprite.PNG", bytes, "images");
  assert.equal(first.reference, "../../assets/images/mi-sprite.png"); assert.equal(second.reference, "../../assets/images/mi-sprite-2.png"); assert.deepEqual(model.project.files.get(first.path), bytes);
});
