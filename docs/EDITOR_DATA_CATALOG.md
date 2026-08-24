# Rick2 editor data catalog

This catalog records everything currently needed to reproduce level 1. The C++
loader is the behavioural authority and `schema/level.schema.json` is the
structural authority. Task 19 must replace the schema's generic entity objects
with typed definitions matching this catalog.

## Package-wide data

| Area | Editable data | Editor representation |
|---|---|---|
| Identity | `formatVersion`, `kind`, `id` | Version is read-only; project/level ID is validated text. |
| Units | 50 ticks/s, ticks, pixels, pixels/tick | Read-only for format version 1. Values shown with unit-aware labels. |
| Display | output `width`, `height` | Positive integer fields and aspect preview. |
| Session | `initialLives` | Positive number of lives restored when starting or resetting a preview. |
| Initial camera | `x`, `y`, `width`, `height` | Draggable viewport plus numeric inspector. |
| Map | width/height, 8×8 tile size in level 1 | Resize operation with explicit crop/expand confirmation. |
| Tileset | image, tile count, columns and image dimensions | Asset selector and tile palette; metadata checked against decoded image. |
| Layers | `tiles`, `frontTiles`, `collisions` | Three independently visible/lockable cell layers, each exactly width × height. |
| Player | character definition | Definition selector. Initial position and face come from checkpoints. |
| Projectiles | shoot/bomb definition, size, Y offset, optional bounding box | Typed forms with sprite/bounds overlay. |
| Definitions | object/character, name, numeric state IDs, state names, bitmap, frame duration and sprite rectangles | Definition library and animation timeline. IDs and names are unique per definition. |
| Audio | initial music index, music list, playback policy and seven ordered effects | Asset list with one-shot/loop and optional intro-to-loop chaining; the fixed effect ordering is a current runtime constraint. |

GID `0` is empty. Visual GIDs start at `1`. Collision-layer values also use the
runtime tile constants, so the editor must initially present named collision
tools rather than treating that layer as arbitrary art.

## Shared entity concepts

- Coordinates and sizes are world pixels; widths and heights must be positive.
- Every entity has an integer `id`, unique within its group. Cross-group trigger
  references use the pair `(type, id)`.
- Definition references address keys in top-level `definitions`.
- Current source data sometimes wraps geometry in `attributes`; the editor must
  preserve the canonical version-1 shape until an explicit migration changes it.
- Version 1 encodes many booleans as integer `0`/`1`. Inspectors display toggles
  but serialize the representation required by the current schema/runtime.

## Entity groups

| Group | Geometry and identity | Gameplay properties | Relations/enums |
|---|---|---|---|
| `platforms` | `id`; `attributes.ini_x`, `ini_y`, `width`, `height` | `visible`, `recursive`, `one_use`; initial state; ordered actions | definition; initial state `stop`/`moving`; action directions `stop/right/left/up/down` |
| `items` | `id`; `attributes.ini_x`, `ini_y`, `width`, `height` | Item behaviour currently follows the referenced definition/name | definition |
| `backgroundObjects` | `id`; `attributes.ini_x`, `ini_y`, `width`, `height` | `skip_num_anims` selects the starting animation offset | definition |
| `blocks` | `id`; `attributes.ini_x`, `ini_y`, `width`, `height` | `exploits` controls destruction/explosion behaviour | definition |
| `hazards` | `id`; `attributes.ini_x`, `ini_y`, `width`, `height` | `trigger`, `stop_inactive`; ordered actions | definition; action directions also allow `deactivate` |
| `checkpoints` | `id`; checkpoint rectangle; player respawn `pl_x`, `pl_y` | player face `left/right` | `nxt_chks` references checkpoint IDs; at least one checkpoint is required |
| `lasers` | `id`, `x`, `y`; bounding box offset and size | `speed`, `recursive`, `default_trigger` | definition; type `horizontal/vertical/diagonal`; direction `left/right` |
| `triggers` | `id`; `attributes.x`, `y`, `width`, `height` | `recursive`; legacy `onehot`; ordered targets | action `enters/stays/exits/hits`; face `any/right/left`; target type `platform/laser/hazard` |
| `enemies` | `id`, `x`, `y`; bounding box offset and size | X/Y speed; AI random flag, randomness and decision block duration | definition; direction `left/right`; AI `walker/chaser`; optional AI origin/limit rectangle |
| `cameraViews` | `id`; left/top and right/bottom bounds | Defines a camera region | Regions must have positive area and remain inside the map |

### Movement action

Platforms and hazards contain one or more actions. Each action has:

- `direction`: movement direction; hazard actions additionally accept
  `deactivate`;
- `desp`: displacement in pixels before advancing to the next action;
- `wait`: delay in simulation ticks;
- `speed`: pixels per simulation tick;
- `cond`: `0` always, `1` while conditional trigger is on, `2` while it is off.

The source JSON may encode a single action as an object and multiple actions as
an array. The editor normalizes this only in memory for controls and must write
the schema-approved canonical representation selected in task 19.

### Trigger target

Each target contains `type`, `id`, `delay`, `trigger` and `trigger_cond`.
`delay` is in ticks. `trigger` selects set/unset behaviour and `trigger_cond`
toggles conditional actions. Target IDs must resolve in the selected type.

## Assets used by a project

| Asset | Referenced from | Required metadata/behaviour |
|---|---|---|
| Tileset bitmap | `map.tileset.image` | Raster dimensions, columns, tile count and tile dimensions agree. |
| Sprite bitmap | every animation state | Every sprite rectangle lies inside the decoded bitmap. Shared paths remain shared. |
| Music | `audio.music`, `audio.playback` | Ordered list; initial track may be one-shot or loop and may chain to a second looping/one-shot track. |
| Sound effects | `audio.effects` | Exactly seven ordered slots in version 1. |

The committed level 1 baseline contains a 160×255 map of 8×8 tiles, 24 embedded
definitions and these entity counts:

| Platforms | Items | Background | Blocks | Hazards | Checkpoints | Lasers | Triggers | Enemies | Camera views |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 17 | 18 | 32 | 8 | 21 | 8 | 32 | 42 | 25 | 5 |

These counts are regression data, not engine limits.

## Known contract gaps to close

1. Singleton-or-array action/target shapes are now explicit in the version-1
   schema; a future canonical array-only shape requires a versioned migration.
2. Integer booleans remain compatible in version 1; a later version may
   migrate them to JSON booleans.
3. `onehot` is present on triggers but not consumed by the current loader; it
   must be either specified and implemented or removed through migration.
4. Collision GID meanings and the fixed seven audio effect slots need named,
   machine-readable contracts rather than implicit C++ constants/order.
5. JSON Schema cannot express uniqueness by entity `id`; Rick2 Engine now checks
   it semantically, and the equivalent native validation should be centralized.
6. Asset existence and decoded dimensions remain for the integral validation in
   task 26.
