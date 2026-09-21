# Task 44: phase 1 conversion contract

## Historical input inventory

The converter reads only the following legacy files under a caller-supplied
`--legacy-root`. They are evidence at conversion time and are never runtime or
build dependencies.

| Input | Converted data |
|---|---|
| `data/levels/phase1.txt` | spawn, initial form and referenced resources |
| `data/maps/world1_transparencia.txt` | 128x48 tile, collision and front-tile layers; tileset and parallax metadata |
| `data/characters/warrior_def_states.txt` | state inventory used to check the explicit state-ID table |
| `data/characters/warrior.txt` | animation rectangles and timing |
| `data/scripts/phase1.txt` | pickup, transformation, form-sensitive hazard and exit zones |
| `data/machinimia/phase1.txt` | parallel light/ray, then explosion sequence |
| `data/objects/{bombilla,rayo,explosion}.{txt,bmp}` | collectible and scene object definitions, frames and portable bitmaps |
| `data/levels/scroll_zones_phase1.txt` | six camera regions |
| `data/checkpoints/checkpoint_fase1.txt` | eleven checkpoint activation regions, respawn positions and progression links |
| referenced BMP/WAV files | portable project assets |

The enemy file named by `phase1.txt` is inventoried and parsed. All 16 records
are converted: 1-3 are type-1 ground enemies, 4-7 horizontal flyers, 8-10
type-3 ground enemies, 11-12 static enemies, 13-15 independent XY patrols,
and 16 a repeating vertical enemy with a delayed return. The four phase object records are
translated; the explosion's 250 ms
frame duration still requires deterministic rounding to the 50 Hz timestep.

## Deterministic mapping

- Legacy paths are resolved relative to the legacy root and mapped through an
  explicit source-to-archive table. No absolute path is emitted.
- Map triples `(tile, collision, front)` become `tiles`, `collisions` and
  `frontTiles`; a front tile is removed from the back tile layer.
- Animation speeds divisible by the 20 ms timestep use integer ticks. Other
  player speeds retain their exact optional `frameDurationMs`; web and C++
  accumulate timestep milliseconds between frames. The phase-1 frog walk
  therefore keeps its authored 85 ms cadence without changing compatible
  tick-only projects. The explosion uses the same contract for its authored
  250 ms cadence; its five-frame scene branch waits 63 ticks, the first fixed
  update at or beyond the exact 1250 ms cycle duration.
- Historical movement runs four one-pixel simulation steps before each draw.
  The fixed-tick runtimes use 4-pixel visible steps to retain that smooth
  trajectory; converted jumps disable air control and retain the horizontal
  direction selected at grounded takeoff. Walking off a ledge instead starts a
  vertical fall, matching the historical walking-to-falling transition. Jump
  distances remain the authored 184/192 world pixels. The warrior crouch frame
  has the same 40-pixel source height
  as its standing frame, so conversion does not inherit Rick's shorter crouch
  collision box.
- State and form names are translated through explicit tables in the tool.
- Historical `NO_KEY` transitions require left, right, up, down and action to
  be released. In particular, pressing down while walking keeps the declared
  walking state instead of being mistaken for neutral input.
- The historical neutral FIRE input maps to the generic neutral action binding;
  Rick's directional action chords remain the compatible defaults.
- The composed striking sprite is materialized as a portable frame and its
  external attack box is authored in the combat catalog, so Assets, combat
  profile fields and preview overlays expose the same editable data.
- The historical tile ratio (`32 / 8`) becomes the generic per-form
  and per-object `visualScale`. Converted logical and collision dimensions use
  the same world scale, so bottom-centered sprites retain their authored
  top-left position and their physical bounds match the visible result.
- Historical collision values become collision-layer GIDs relative to the
  converted tileset rather than engine-internal constants: empty remains `0`,
  solid uses `tileCount + 1`, and slopes rising left/right use
  `tileCount + 5`/`tileCount + 6`. Phase 1 contains only empty and solid cells;
  the slope vocabulary preserves values used by later historical maps. Both
  runtimes resolve their 45-degree surface from the character's matching foot:
  a left-rising slope rises toward decreasing X and a right-rising slope is its
  mirror. Horizontal ground motion follows that surface, and descending motion
  lands on it. Vertical ladders retain their separate behavior. This motion is
  provisional: focused tests pass, but the ad-hoc editor review did not move
  the player over a painted slope. It remains unaccepted until a later phase
  supplies its real map layout, entry geometry and declared animation states.
- Camera rectangles preserve their source order and coordinates.
- All converted enemy families 1-3 retain authored position, direction,
  sprite/collision dimensions, visual scale and horizontal patrol distance.
  Their visible speed is the historical four global substeps multiplied by
  each record's inner velocity. Ground patrol uses collision and gravity;
  `flyPatrol` ignores gravity and declares its initial direction and phase.
- The static enemy uses generic `idle`: its initial stopped state loops two
  frames without gravity or displacement, while contact, death and reset use
  the common enemy combat lifecycle. Its full-body, all-facing guard prevents
  sword damage; passing it requires avoiding its contact, including by jumping
  in the alternate form. Enemy contact is repeatable across player respawns.
- The second static record uses the same generic `idle` contract at
  `(330, 1350)` with 150 ms two-frame animation, scale 4 and ordinary contact
  and sword combat; it does not inherit the first static enemy's guard.
- Historical checkpoint rectangles store inclusive left/top/right/bottom
  corners, so they become `x`, `y`, `right - left + 1` and
  `bottom - top + 1` with top-left activation. Each zero terminates its link
  list and is not an edge to checkpoint 0. Checkpoint 0 uses the phase's
  initial facing; later respawns preserve the facing held on death, matching
  the historical runtime. Links preserve the 4 to 5/6 branch, merge at 7 and
  terminal node 10. The historical handler excludes the final record from
  activation, so it is emitted as a disabled terminal and node 9 remains the
  last valid respawn.
- Back-scroll X divisors become parallax factors (`1 / divisor`), while front
  scroll velocities remain multipliers. Historical back planes deliberately
  ignore camera Y, so they use `factorY: 0`; the repeating front plane keeps
  its Y multiplier. Magenta Allegro mask pixels are materialized as alpha in
  deterministic PNG assets so web and native compose the same planes.
- Archive members are sorted and have a fixed timestamp and permissions.
- Seven historical effects fill the native runtime's fixed audio slots; the
  generic bindings identify the effects actually used by this phase.
- Typed `onCollect` item actions set the collected flag and show its 50-tick
  message only after physical pickup. A conditioned spatial trigger starts the light/ray parallel branches followed
  by the explosion through generic background-object visibility actions.
  Legacy repetition counts are converted to ticks using each object's complete
  animation-cycle duration. After the explosion, the sequence sets the declared
  alternate-form flag and emits an event consumed by priority `setForm`
  transitions in every state of the primary form. Both runtimes reset to the
  declared initial form. Both forms also declare a typed dead state. The
  historical danger rectangle emits the built-in `killed` event only while the
  alternate-form flag is false; the overlapping objective can consequently be
  completed only by the alternate form.
- The forced-state script zone uses top-left point testing with inclusive
  bounds after movement on every tick. A typed action sets the declared
  falling/previous-walking pair, begins descent without horizontal carry and
  preserves facing.
- Six keep-moving script zones use the same continuous top-left point test.
  Their typed action supplies the current facing direction only when no key is
  pressed and the player is grounded; the effect persists until an animation
  cycle finishes. Manual review accepted all six zones, so the script loss is removed.
- Each form declares an optional horizontal jump distance limit (`184` or
  `192` world pixels). Both runtimes start descending after the absolute X
  displacement from takeoff exceeds that limit. Omitted limits retain the
  existing Rick jump.
- After a declared fall lands, the primary form enters its historical
  crouching pause and returns to idle after five state ticks; the alternate
  form lands directly in idle. A primary crouch entered from another state
  still leads to a jump. Both forms now declare `jumping -> falling` when the
  generic controller reports that physical descent has begun; the transition
  preserves the existing jump trajectory and then uses each form's landing
  graph. Other legacy state transitions remain deferred.
- The complete 48-transition historical inventory is checked during
  conversion. Its only slope entry is `WARRIOR_CAMINANDO` to the left-slope
  moving state; the declared right-slope aliases have no incoming or outgoing
  transition. A generic `onSlopeLeft` signal drives the observable moving,
  idle and solid-ground exit states in web and C++, while the accepted 45°
  collision geometry remains unchanged. The loss report is therefore empty.
- `loss-report.json` is sorted and contains stable codes, source paths and
  details whenever a future input introduces an intentionally deferred or
  inexact conversion.

The output is valid only if `project.json` and its level satisfy the current
JSON Schemas and project references remain inside the archive.
