# Rick2 Engine architecture

## Purpose and scope

Rick2 Engine starts as an offline web editor for the canonical `rick2.level`
format consumed by the C++ game. Its first milestone is authoring levels, not
reimplementing gameplay. A browser runtime is added only after the editor can
round-trip real projects safely.

The editor must:

- run from static files opened through `file://`, with no server or CDN;
- preserve every supported value in an imported level;
- export a project that the C++ runtime can consume after extraction;
- keep assets inside a portable project instead of depending on repository
  paths;
- make invalid data visible before it reaches the game;
- leave gameplay simulation outside editing commands.

The editor does not synthesize graphics or audio. Its runtime has subsequently
grown into a playable preview; the boundary between reusable platformer rules
and the Rick profile is specified in `PLATFORMER_CORE.md`.

## Decisions

### One canonical level model

The in-memory document is the parsed `rick2.level` object. There is no separate
editor-only level representation and no conversion when saving. Temporary UI
state such as selection, zoom, open panels and undo history lives outside the
document and is never written into `level.json`.

All mutations are commands over the canonical document. Commands provide an
inverse operation for undo/redo and notify derived views. Rendering, property
inspectors and validation read the document but do not mutate it directly.

### Portable project container

The universal interchange format is a ZIP file with the `.rick2-project`
extension. ZIP is a container only; JSON remains the source of truth. Browsers
that implement the File System Access API may also open the extracted directory
directly. Import/export through ZIP and downloads remains the required fallback.

Archive layout:

```text
my-game.rick2-project
├── project.json
├── game.json
├── levels/
│   └── level1/
│       └── level.json
└── assets/
    ├── images/
    └── audio/
```

`project.json` is editor/project metadata:

```json
{
  "formatVersion": 1,
  "kind": "rick2.project",
  "id": "my-game",
  "name": "My game",
  "initialLevel": "levels/level1/level.json",
  "levels": ["levels/level1/level.json"]
}
```

Its machine-readable contract is `schema/project.schema.json`. The
`initialLevel` value must also occur in `levels`; this cross-field semantic rule
is checked by the editor because JSON Schema cannot express it portably here.

The `levels` array is ordered and is the editor's source of truth for the level
selector. Level documents live at `levels/<id>/level.json`, while reusable
assets remain under `assets/`; keeping every level at the same directory depth
makes shared relative references stable when levels are duplicated or renamed.
The editor can create, duplicate, rename, reorder, resize and remove levels, and updates
both `project.json` and the compatibility `game.json` entry point whenever the
initial level changes. Each declared level is schema- and semantically validated
under its own file path before the project can be exported. Resizing is anchored
at the top-left: it preserves overlapping cells, fills expansions with empty
tiles and crops the right and bottom edges when reducing a map.

`game.json` remains the runtime manifest. Level and asset paths are relative to
the JSON file that contains them and must remain inside the extracted project
root. Absolute paths, `..` traversal outside the root and URL assets are
rejected. The archive uses forward slashes and case-sensitive unique paths.

The current level 1 contains repository-relative `../../` asset paths. Task 18
must import it from the repository root, copy referenced files into `assets/`,
rewrite paths, and prove that the extracted result loads in C++. The canonical
level format itself does not change merely to support the archive.

### Technology baseline

- TypeScript with strict type checking for application code.
- DOM controls for toolbars, dialogs and property forms.
- Canvas 2D for the map, sprites and overlays.
- A small bundler producing local JavaScript/CSS with relative URLs and no
  runtime network requests. The release must work from `file://`.
- JSON Schema draft 2020-12 as the structural contract. A validator may be
  bundled, but generated inspector metadata must not become a competing schema.
- IndexedDB only for recovery snapshots and recent-project metadata. Exported
  files remain the durable source of truth.
- ZIP processing in the browser for the universal project workflow. Any chosen
  dependency must be bundled and its license recorded.

Framework choice is deliberately deferred to task 17. The domain, command and
validation modules may not depend on a UI framework, so that choice remains
replaceable. The initial preference is minimal TypeScript plus DOM/Canvas; a
framework is justified only if the first UI spike demonstrates a clear benefit.

## Module boundaries

```text
File/Directory or ZIP
        │
        ▼
 project-io ──► asset-store
        │             │
        ▼             ▼
 level-document ◄── asset URLs
        │
   ┌────┼───────────┐
   ▼    ▼           ▼
commands validation rendering
   │        │          │
   └────────┴────┬─────┘
                 ▼
              editor UI
                 │
                 ▼ (task 27+)
          preview/runtime adapter
```

- `project-io`: opens directories/archives, normalizes safe paths and exports
  deterministic packages. It knows containers, not gameplay.
- `asset-store`: owns imported bytes, MIME information, hashes and temporary
  object URLs. Canonical documents store paths, never object URLs.
- `level-document`: owns the canonical JSON plus dirty/revision state. It does
  not access browser storage or Canvas.
- `commands`: all edits, transactions, undo/redo and selection-safe ID changes.
- `validation`: schema errors plus semantic checks such as references, layer
  sizes, GID ranges, unique IDs and asset dimensions.
- `rendering`: pure projections of document/assets to Canvas. Editor overlays
  are independent from runtime rules.
- `editor UI`: tools, panels, keyboard routing and diagnostics.
- `preview`: clones a document revision into disposable simulation state. It
  never writes runtime state back into the authoring document.

Dependencies point inward toward the document contracts. Browser APIs are
wrapped by adapters so model and command tests run without a browser.

## Document lifecycle

1. Read files selected by the user; do not rely on ambient filesystem access.
2. Validate container paths and `project.json` before resolving any asset.
3. Parse and structurally validate every declared level.
4. Build the asset registry and report missing or unused assets.
5. Create an immutable baseline revision; UI state is initialized separately.
6. Apply edits only through commands and continuously run incremental checks.
7. On export, run full validation, clone data, normalize ordering/paths and
   serialize without mutating the open revision.
8. Generate `project.json`, `game.json`, levels and referenced assets. Reopen the
   generated package in a round-trip test before offering it as valid output.

Unknown properties are never silently discarded. With the current strict
schema they are errors; during a version migration they remain preserved until
the migration explicitly handles them.

## Compatibility contract

There are three independently versioned surfaces:

- `rick2.level` and `rick2.game`: runtime data versions;
- `rick2.project`: portable container version;
- Rick2 Engine application release.

The engine declares which data versions it can read and write. Reading a newer
version is blocked with a descriptive error. Older supported versions are
migrated on a copy and are not overwritten without user confirmation.

Changes to shared game capabilities follow the synchronization policy in
`DEVELOPMENT_PLAN.md`. Compatibility tests use at least the committed level 1,
an empty minimal project and malformed fixtures. A round trip compares semantic
JSON rather than whitespace, but paths, IDs, array order and numeric values must
remain stable unless a documented migration changes them.

## Security and offline constraints

- No network access is required or attempted at runtime.
- Archive paths are normalized before extraction; traversal, absolute paths,
  duplicate normalized names and oversized entries are rejected.
- Asset decoding uses browser APIs and failures become diagnostics.
- Object URLs are revoked when assets or projects close.
- Imported HTML, SVG scripts and executable content are never injected into the
  DOM. The initial supported image formats are browser-decoded raster assets.
- Export limits and progress reporting prevent a large project from freezing
  the UI without feedback.

## Delivery boundaries

Tasks 17-26 deliver a safe level editor for the C++ game. Task 27 introduces a
read-only preview simulation. Task 30 is the full JavaScript runtime. Task 31
extracts generic platform-engine concepts only after parity has been tested on
the real game.
