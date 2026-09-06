# Canonical level format

Rick2 levels use a single JSON package validated by
[`schema/level.schema.json`](../schema/level.schema.json). The top-level
`formatVersion` is mandatory; readers must reject versions they do not support.
Version 1 contains:

- `units`: the gameplay unit contract. Simulation runs at 50 ticks per second
  (20 ms per tick), distances use pixels, durations use ticks and movement
  speeds use pixels per tick. Rendering frequency never changes these units.
- `display` and `camera`: output resolution and the initial logical viewport.
- `map`: dimensions, tileset and the `tiles`, `frontTiles` and `collisions`
  layers. Every layer contains exactly `width * height` GIDs.
- `entities`: all level instances, grouped by gameplay type.
- `player`: the player definition used by the level.
- `projectiles`: definitions, dimensions, offsets and optional collision boxes
  used for dynamically created bombs and shots.
- `definitions`: animation and sprite definitions indexed by stable JSON IDs.
- `audio`: pista inicial, listas ordenadas de música/efectos y política opcional
  `playback`. `initialLoop` controla la repetición inicial; `followUpMusic`
  puede ser `null` o el índice de una segunda pista, cuyo bucle se decide con
  `followUpLoop`.
- `presentation` (opcional): planos de parallax, mensajes narrativos y efectos
  visuales registrados que las secuencias y triggers pueden activar.

Asset paths are relative to the package JSON, so levels can be loaded from a
different location without depending on the process working directory.
At runtime those resolved paths are also the stable keys of a session resource
cache: identical bitmap, sprite-region and audio requests share one Allegro
resource. A RAII guard empties the cache before Allegro shuts down.

Animation states are selected by their explicit numeric `id`, never by their
position in the `states` array. Both `id` and `name` must be unique within a
definition; duplicate values are rejected while loading. Consequently, editors
may reorder state declarations without changing runtime behaviour.

Each animation uses `frameDurationTicks`, the number of simulation ticks for
which a sprite remains visible. Entity action `wait`, trigger `delay` and enemy
AI `blockSteps` values are durations in ticks. Entity and action `speed` values
are pixels per tick. For example, `50` ticks is one second and a speed of `2`
moves an entity 100 pixels per second.

The committed level package is generated reproducibly:

```sh
python3 tools/convert_level.py
python3 tools/check_level_conversion.py
```

The TMX importer supports finite orthogonal maps with embedded tilesets and
uncompressed XML or CSV layer data. It requires `Tiles`, `FrontTiles` and
`Collisions` layers with the map dimensions, validates every GID and rejects
external TSX files, compression, flip flags and unsupported orientations with
an explicit error. GID `0` remains empty and GID `1` remains the first visual
tile; they are distinct in both the canonical package and the runtime.

The game uses `levels/level1/level.json` by default and accepts another package
as its single command-line argument. Entity instances, runtime configuration
and animation definitions are maintained as JSON files and assembled into that package. TMX
is retained only as a supported map-import format; no runtime class parses XML
and PugiXML is not part of the executable.

The default is not compiled into the executable: `game.json`, validated by
`schema/game.schema.json`, selects `initialLevel`. Its path is relative to the
game package itself.

Supported read/write versions for the native runtime and Rick2 Engine are
declared in `schema/format_versions.json`. Entity groups are fully typed in the
level schema, including their runtime enums and the version-1 singleton-or-array
representation used by actions and trigger targets. Future shape changes must
use a new format version and an explicit editor migration.
