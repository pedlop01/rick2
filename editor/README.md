# Rick2 Engine web editor

## Requirements

- Node.js 22 or newer
- npm

Install the versions locked in `package-lock.json`, check types, build and run
the static-release tests:

```sh
cd editor
npm ci
npm run check
```

The release is generated in `editor/dist/`. Open `dist/index.html` directly in
a browser; no HTTP server is required. `dist/` and `node_modules/` are generated
locally and are intentionally not committed.

The application can create an empty project, open and export the universal
`.rick2-project` ZIP and, in browsers supporting the File System Access API,
open or write an extracted project directory. Unsaved projects are identified
in the header and protected before replacement or closing.

Project and level schemas are bundled into the release. Structural and semantic
diagnostics appear in the inspector with their file and JSON path; export is
disabled while errors remain. Version upgrades enter through the explicit
migration registry in `src/migrations.ts`.

When a project contains its tileset, the Canvas renders the visible portion of
`tiles`, `frontTiles` and `collisions`. Drag to pan, use the mouse wheel or `+` /
`-` to zoom, `Encajar` to frame the complete map, and the layer checkboxes or
`Rejilla` control to change overlays. Rendering is clipped to visible cells so
the complete level-1 map remains responsive.

Generate a portable level-1 project from the repository assets for manual
testing:

```sh
python3 tools/package_editor_project.py
```

Then open `build/rick2-level1.rick2-project` from the editor.

## Commands

| Command | Purpose |
|---|---|
| `npm run build` | Recreate the static `dist/` release. |
| `npm run typecheck` | Check all TypeScript with strict settings. |
| `npm test` | Build and verify the offline artifact. |
| `npm run check` | Run type checking and all tests. |

## Dependencies and licenses

The runtime bundle contains Ajv (MIT) for JSON Schema validation and fflate
(MIT) for offline ZIP processing. TypeScript (Apache-2.0) and esbuild (MIT) are
development-only build tools; exact versions are recorded in `package-lock.json`
and no dependency is fetched at runtime.
