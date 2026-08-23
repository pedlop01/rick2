import assert from "node:assert/strict";
import { test } from "node:test";
import { PreviewRuntime } from "../test-dist/preview-runtime.mjs";

const width = 20, height = 10, collisions = Array(width * height).fill(0); for (let x = 0; x < width; ++x) collisions[8 * width + x] = 2;
const level = { map: { width, height, tileWidth: 8, tileHeight: 8, tileset: { tileCount: 1, columns: 1, image: "x" }, layers: { tiles: Array(width * height).fill(0), frontTiles: Array(width * height).fill(0), collisions } }, entities: { checkpoints: [{ pl_x: 16, pl_y: 43, pl_face: "right" }], platforms: [{ id: 1, attributes: { ini_x: 0, ini_y: 0, width: 8, height: 8, recursive: 1 }, actions: { action: [{ direction: "right", desp: 3, speed: 1, wait: 2 }, { direction: "left", desp: 3, speed: 1, wait: 0 }] } }], hazards: [] } };
test("preview advances deterministically in fixed ticks and reset is exact", () => { const runtime = new PreviewRuntime(level); for (let i = 0; i < 3; ++i) runtime.step(); assert.equal(runtime.bodies[0].x, 3); for (let i = 0; i < 3; ++i) runtime.step(); assert.equal(runtime.bodies[0].x, 2); runtime.reset(); assert.equal(runtime.tick, 0); assert.equal(runtime.bodies[0].x, 0); });
test("two runtimes produce identical snapshots", () => { const a = new PreviewRuntime(level); const b = new PreviewRuntime(level); for (let i = 0; i < 100; ++i) { a.step(); b.step(); } assert.deepEqual(a.bodies, b.bodies); });
