import { copyFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const testOutput = path.join(root, "test-dist");

await rm(output, { recursive: true, force: true });
await rm(testOutput, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(testOutput, { recursive: true });

await build({
  entryPoints: [path.join(root, "src/app.ts")],
  outfile: path.join(output, "app.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  sourcemap: true,
  legalComments: "eof",
});

await build({
  entryPoints: [path.join(root, "src/styles.css")],
  outfile: path.join(output, "styles.css"),
  bundle: true,
  minify: true,
  legalComments: "eof",
});

await copyFile(path.join(root, "src/index.html"), path.join(output, "index.html"));

await build({
  entryPoints: [path.join(root, "src/project-io.ts")],
  outfile: path.join(testOutput, "project-io.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node18"],
});
await build({
  entryPoints: [path.join(root, "src/validation.ts"), path.join(root, "src/migrations.ts"), path.join(root, "src/map-view.ts"), path.join(root, "src/level-document.ts"), path.join(root, "src/entity-document.ts"), path.join(root, "src/asset-document.ts"), path.join(root, "src/project-history.ts"), path.join(root, "src/preview-runtime.ts"), path.join(root, "src/platformer-core.ts"), path.join(root, "src/runtime-behaviors.ts"), path.join(root, "src/web-player.ts"), path.join(root, "src/character-state-machine.ts"), path.join(root, "src/character-forms.ts"), path.join(root, "src/gameplay-program.ts"), path.join(root, "src/presentation.ts")],
  outdir: testOutput,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node18"],
});
console.log(`Rick2 Engine built at ${output}`);
