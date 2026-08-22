# Canonical level format

Rick2 levels use a single JSON package validated by
[`schema/level.schema.json`](../schema/level.schema.json). The top-level
`formatVersion` is mandatory; readers must reject versions they do not support.
Version 1 contains:

- `map`: dimensions, tileset and the `tiles`, `frontTiles` and `collisions`
  layers. Every layer contains exactly `width * height` GIDs.
- `entities`: all level instances, grouped by gameplay type.
- `player`: the player definition used by the level.
- `definitions`: animation and sprite definitions indexed by their legacy asset
  key. Keeping the key stable makes the migration lossless while XML support is
  phased out.
- `audio`: ordered music and effect asset lists.

Paths currently retain the historical convention of being relative to the
`bin` working directory. Removing that convention belongs to task 8.

The committed level package is generated reproducibly:

```sh
python3 tools/convert_level.py
python3 tools/check_level_conversion.py
```

The game now starts from `levels/level1/level.json`. Legacy XML/TMX remains in
the repository as converter input and temporary backwards compatibility, not as
the runtime source of truth for level 1.
