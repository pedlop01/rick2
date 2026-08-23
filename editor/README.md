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
`tiles`, `frontTiles` and `collisions`. Use the middle mouse button to pan, the
mouse wheel or `+` / `-` to zoom, and `Encajar` to frame the complete map. Layer
checkboxes control visibility; clicking a layer name makes it active.

The tile palette and the pencil, eraser and fill tools edit the active layer.
The collision layer exposes its four semantic GIDs instead of graphic tiles.
Selection supports `Ctrl+C`, `Ctrl+X` and `Ctrl+V`; paste uses the last canvas
position and is clipped safely at map boundaries. Every edit immediately marks
the project as modified and is included in the next ZIP or directory save.

`Entidades` switches to object editing. Choose one of the ten entity groups,
click a bounding box to select it, drag it with pixel precision, or create,
duplicate and remove instances from the left panel. The inspector preserves
numeric and textual JSON types while editing the selected entity. `Nueva` uses
the first valid entity in that group as its schema-compatible template.

Gameplay relationships are drawn while editing entities: blue checkpoint
links, orange trigger targets, yellow movement routes and green AI limit zones.
Nested inspector fields include action sequences and targets; enum values use
bounded selectors, and invalid references or checkpoint cycles block export.

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
