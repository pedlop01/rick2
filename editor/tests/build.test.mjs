import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";

for (const file of ["index.html", "app.js", "app.js.map", "styles.css"]) {
  test(`build emits ${file}`, async () => {
    assert.ok((await stat(new URL(`../dist/${file}`, import.meta.url))).size > 0);
  });
}

test("release uses only relative local assets", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /type="module"/);
});

test("bundle contains the offline shell and visible startup failure", async () => {
  const bundle = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");
  assert.match(bundle, /Rick2 Engine/);
  assert.match(bundle, /Rick2 Engine could not start/);
});

test("schemas and validator are bundled for fully offline checks", async () => {
  const bundle = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");
  assert.match(bundle, /rick2\.level/);
  assert.match(bundle, /additionalProperties/);
  assert.doesNotMatch(bundle, /fetch\(/);
});
