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

Current task-17 scope is the application shell: header, project toolbar, layer
panel, responsive Canvas workspace, property inspector, status/error regions and
an offline build. Project actions remain disabled until task 18 implements the
real file lifecycle.

## Commands

| Command | Purpose |
|---|---|
| `npm run build` | Recreate the static `dist/` release. |
| `npm run typecheck` | Check all TypeScript with strict settings. |
| `npm test` | Build and verify the offline artifact. |
| `npm run check` | Run type checking and all tests. |

## Dependencies and licenses

Runtime application code currently has no third-party dependencies. TypeScript
(Apache-2.0) and esbuild (MIT) are development-only build tools; their exact
versions are recorded in `package-lock.json`.
