# Task 44 handoff: phase-1 vertical migration

## Repository state

- Repository: `/home/plopez/proj/rick2`
- Branch: `master`
- Base HEAD before this task: `c5624a7 feat: run exported projects natively`.
- The complete phase-1 vertical migration has been approved for commit.
- Generated `bin/rick2`, object files, `editor/dist`, `editor/test-dist` and the
  package under `/tmp` are ignored outputs and must not be committed.

## Acceptance and boundaries

`docs/CAMELOT_VALIDATION.md` remains the acceptance contract. Historical files
under `/home/plopez/proj/camelot/game` are read-only conversion evidence, never
build or runtime dependencies. Do not port the Allegro 4 runtime or its parsers.
Do not add game, character, form or level names as engine discriminators.

The current milestone is still the first complete vertical phase. This handoff
covers its deterministic conversion foundation, generic locomotion and scale,
pickup/transformation/death loop, complete 11-node checkpoint graph, historical
parallax, independent editor layer controls, all 16 phase-1 enemy records and
historical sword combat. All enemy blocks, including the delayed vertical
bubble and XY patrols 13-15, have now been manually accepted. Four declared
losses remain, including the forced-state and keep-moving script gaps. The
continuation prompt is `docs/TASK_44_NEXT_PROMPT.md`.

## Completed block 1: deterministic phase conversion

`tools/convert_camelot_phase1.py` now:

- reads a narrow, explicit phase-1 input inventory;
- converts the 128x48 legacy map triples into back tiles, collisions and front
  tiles;
- emits six camera regions, three parallax layers, player animations, two
  generic forms, combat profiles, audio, a serial/parallel scene skeleton and
  the exit objective;
- packages historical bitmap/WAV assets under stable generic destinations,
  materializing Allegro mask transparency as deterministic PNG for parallax;
- emits sorted JSON and a ZIP with fixed timestamp, permissions and member
  order;
- validates project and level schemas, layer sizes and every packaged asset
  reference;
- writes `loss-report.json` with stable codes and SHA-256 hashes for all 33
  inputs read by the converter.

The conversion contract and exact source inventory are documented in
`docs/TASK_44_PHASE1_CONVERSION.md`. The output is deliberately not checked in.
Generate it with:

```bash
python3 tools/convert_camelot_phase1.py \
  --output /tmp/camelot-phase-1.rick2-project
```

`tests/camelot_phase1_conversion_test.py` converts twice and checks byte-level
reproducibility, schemas, semantic invariants, camera count, composition order,
input inventory and the loss report.

Current reported losses are deferred enemy records,
incomplete historical state transitions and remaining script actions, plus
deterministic animation-time rounding for the player and explosion. Object
records, assets, initial visibility, fixed item physics and visual scaling are
now represented.

## Completed block 2: generic initial checkpoint spawn

The C++ player previously started at hard-coded `(264, 2000)` and only used
checkpoint spawn data after death. `Player::SpawnAtCheckpoint` now initializes
position, respawn position, facing and active-form state from the world's first
checkpoint whenever a level is loaded, including campaign transitions.

The pure mapping is in `src/player_spawn_rules.h` and is covered by
`tests/player_spawn_rules_test.cpp`. The canonical Rick level now also starts
from its authored initial checkpoint.

## Completed block 3: generic per-form visual scale

Character forms accept optional positive `visualScale`; omitted values retain
the compatible scale `1`. The property itself affects rendering only; the
converter separately emits world-scaled controller and collision dimensions
for historical sprites whose physical bounds were scaled by the old runtime.

- C++ multiplies the normal and dying sprite render scale by the active form's
  visual scale.
- Web preview exposes the same scale through `RuntimeBody.spriteScale`.
- Schema, C++ semantic validation and web validation reject zero or negative
  scale.
- The converter emits `visualScale: 4` for both phase-1 forms, derived from the
  historical `tiles_new_size / tiles_orig_size` ratio (`32 / 8`).
- Rick remains at implicit scale `1`.

## Manual validation

The generated project loads in both the web editor and C++. Manual review has
confirmed the bulb size and position, smooth converted movement, corrected
historical jump reach without Camelot air control, physical pickup and message,
effect ordering, transformation, form-sensitive death, native respawn, the
complete checkpoint progression, initial ground/flying enemies and parallax.
Rick starts after a clean rebuild, retains air control, and unscaled objects
retain their compatible top-left anchor. Manual review also confirms that a
Camelot character walking off a ledge falls vertically, while a jump begun on
the ground retains its horizontal takeoff direction through ascent and descent.

The native binary currently resolves `../fonts/verdana.ttf` relative to its
working directory and prints the wrong filename (`pirulen.ttf`) on failure.
Launch it from `bin/`:

```bash
cd /home/plopez/proj/rick2/bin
./rick2 /tmp/camelot-phase-1.rick2-project
```

The font-path issue predates this block and has not been changed.

## Verification completed

- `python3 tests/camelot_phase1_conversion_test.py`: 2 passed.
- `python3 tests/level_schema_test.py`: 8 passed.
- `tests/character_state_machine_test.cpp`: passed, including scale validation.
- `tests/player_spawn_rules_test.cpp`: passed.
- `tests/player_jump_rules_test.cpp`: passed.
- `tests/checkpoint_test.cpp`: passed.
- `tests/game_shell_test.cpp`: passed.
- `tests/native_project_archive_test.py`: passed.
- `tests/package_editor_project_test.py`: passed.
- `npm --prefix editor run check`: typecheck and all 20 web suites passed.
- clean `make -C bin -j2`: passed with generated header dependencies.
- `git diff --check`: passed.
- `tests/collision_gid_rules_test.cpp`: passed for Camelot and Rick mappings.

The full `tools/check_all.sh` reached and passed its Python/C++ stages and clean
native build, then its sandboxed `npm ci` failed with `EPERM` while validating
the esbuild binary. Dependencies were restored with an approved `npm ci`, and
`npm --prefix editor run check` subsequently passed in full. Focused schema,
conversion and native checks also passed after the pickup/editor blocks.

## Expected working-tree files

Task-44 conversion and documentation:

- `docs/TASK_44_HANDOFF.md`
- `docs/TASK_44_PHASE1_CONVERSION.md`
- `tools/convert_camelot_phase1.py`
- `tests/camelot_phase1_conversion_test.py`
- `tools/check_all.sh`

Generic initial spawn:

- `src/player_spawn_rules.h`
- `src/player_jump_rules.h`
- `tests/player_spawn_rules_test.cpp`
- `tests/player_jump_rules_test.cpp`
- `src/main.cpp`
- `src/player.{h,cpp}`
- `src/checkpoint.h`

Generic visual scale and parity tests:

- `schema/level.schema.json`
- `src/character.{h,cpp}`
- `src/camera.cpp`
- `src/character_state_machine.cpp`
- `editor/src/character-forms.ts`
- `editor/src/web-player.ts`
- `editor/src/preview-runtime.ts`
- `editor/src/platformer-core.ts`
- `editor/src/character-state-editor.ts`
- `editor/src/editor-shell.ts`
- `editor/src/entity-document.ts`
- `editor/src/ui-labels.ts`
- `editor/src/validation.ts`
- `editor/tests/character-forms.test.mjs`
- `editor/tests/build.test.mjs`
- `editor/tests/entity-document.test.mjs`
- `editor/tests/platformer-core.test.mjs`
- `editor/tests/preview-runtime.test.mjs`
- `editor/tests/validation.test.mjs`
- `tests/fixtures/character_forms.json`
- `tests/character_state_machine_test.cpp`
- `tests/level_schema_test.py`

Generic gameplay visibility, item physics, collision GIDs and render anchoring:

- `editor/src/gameplay-{program,editor}.ts`
- `editor/src/workspace-preview.ts`
- `editor/tests/gameplay-program.test.mjs`
- `src/gameplay_program.cpp`
- `tests/gameplay_program_test.cpp`
- `src/{object,item,static_object}.{h,cpp}`
- `src/world.cpp`
- `src/collision_gid_rules.h`
- `tests/collision_gid_rules_test.cpp`
- `src/sprite_anchor_rules.h`
- `tests/sprite_anchor_rules_test.cpp`

Native build and authored-ID stability:

- `bin/Makefile`
- `src/container_utils.h`
- `tests/container_utils_test.cpp`

## Completed review blocks and next work

1. **Movement and jump (accepted).** Converted `runSpeed: 8` looked abrupt.
   The historical runtime batched four one-pixel substeps before drawing, so
   the earlier nominal-rate conversion was not visually equivalent. Converted
   forms now use 4-pixel visible steps and generic `airControl: false`, while
   omission preserves Rick's controllable airborne path. Grounded transitions
   into a jump ascend even after releasing Up, including crouch-delayed jumps,
   and web/C++ retain the takeoff direction when air control is disabled. A
   walk-off fall starts vertically for Camelot; Rick keeps controllable air
   movement as its compatible default.
2. **Pickup and message (accepted).** Generic typed item
   `onCollect` actions now run only on physical pickup in web and C++. The
   converted bulb sets its flag, shows a 50-tick message and disappears through
   the existing item collection lifecycle; the former broad pickup trigger is
   no longer emitted.
3. **Editor controls (accepted for handoff).** Character forms and
   scalable item/background entities expose a positive numeric `Visual scale`
   field. Empty means implicit scale 1, so compatible projects remain sparse
   and an explicit scale can be removed again.
4. **Sequence replay (accepted).** Focused web/C++ traces confirm that bulb and
   ray start together, both finish before the authored explosion entity starts,
   animation restart is deterministic and reset/re-entry leaves no residual
   visibility, frames or parallel branches.
5. **Transformation (accepted).** The completed scene changes to the declared
   alternate form through a typed event/state transition. Web and C++ preserve
   position/facing and reset to the initial form consistently.
6. **Form-sensitive danger and respawn (accepted).** The initial form dies in
   the overlapping danger/exit area, consumes a life and respawns through the
   normal lifecycle. The alternate form may complete the objective. The
   phase-start-only respawn described here was superseded by block 7.
7. **Checkpoint graph (implemented and manually approved).** The converter
   preserves all 11 records, inclusive corner regions, zero link terminators,
   the 4 to 5/6 branch, merge at 7 and terminal node. Generic `topLeft`
   activation, a disabled terminal and `preserve` respawn facing reproduce the
   legacy semantics in web/C++; full preview reset returns to the initial node
   while death respawn retains the active node.
8. Preserve Rick defaults: implicit visual scale 1, top-left anchor at scale 1,
   controllable jump, falling items when `physics` is omitted, and collision
   GID 309 with tile count 308.
9. `DEFERRED_CHECKPOINT_GRAPH` has been removed after focused conversion and
   runtime coverage proved all records, links, activation areas and respawn
   data are represented. Five loss records remain. Stop before enemies and the
   remaining script gaps.

Do not commit until the user has visually reviewed and explicitly approved the
block.

## Completed review block 4: first interactive loop

- The converter now packages the collectible plus three scene objects and
  preserves their initial visibility.
- Generic typed item `onCollect` actions handle pickup/message; the remaining
  spatial trigger only starts the scene after checking the collected flag.
- Generic `setEntityVisible` actions address a background object by numeric ID,
  visibility and optional animation restart in web and C++.
- The scene runs light and ray branches in parallel, then the explosion.
- Object records, fixed/falling item physics and per-object visual scale are
  represented. The explosion's 250 ms frame duration remains reported because
  the 50 Hz runtime rounds it to 12 ticks; transformation and form-sensitive
  danger stay deferred.

## Visual-validation corrections

- Legacy collision bits are emitted as collision-layer GIDs relative to the
  converted tileset. Native loading normalizes those GIDs generically and the
  original Rick `309/308` mapping has a focused regression.
- Scaled player and object sprites are centered over their logical body and
  anchored at its bottom; the phase converter emits matching world-scaled
  collision geometry.
- Unscaled objects retain their original top-left draw position; this preserves
  Rick frames whose dimensions vary. Scaled converted objects use bottom-center
  anchoring over world-scaled logical geometry.
- The collectible is authored as a fixed item, while omitted item physics
  retains Rick's falling behavior.
- Converted forms now contain typed locomotion and sword-state transitions;
  they no longer remain forever in their initial walking state.

## Native build and scene-ID correction

- Native background visibility actions resolve the authored entity ID rather
  than the process-wide internal object instance ID. This fixes the exception
  raised when the phase-1 sequence reached its explosion.
- `bin/Makefile` now emits and includes compiler dependency files, so changes
  to shared headers rebuild derived objects instead of producing a mixed ABI.
- A clean native build restores the canonical Rick startup that previously
  failed while resolving trigger target 14.

## Latest generated package

- Path: `/tmp/camelot-phase-1.rick2-project`
- Current SHA-256 after the transformation block:
  `70229c51ccf796657c88a4f0bde44f34cf4a93196357616d28bb61da1594f9df`
- Regenerate rather than relying on the temporary file in a new session.

## Focused sequence replay validation

The light/ray/explosion contract has now been replayed with focused web and C++
regressions. No runtime or converter correction was needed: the existing
generic serial/parallel scheduler already keeps the light and ray visible for
their declared waits, hides both branches before the explosion action runs,
and restarts every revealed animation from frame zero.

- The converter regression fixes the authored background-object IDs at light
  `2`, ray `3` and explosion `0`, their 25/75/60-tick waits, the three animation
  restarts and the six-entry loss report.
- Matching gameplay-program tests record the same action/tick trace in web and
  C++, including a complete second run after reset.
- The web runtime regression first enters the trigger without the pickup flag,
  then performs a physical item pickup, leaves and re-enters the zone, checks
  parallel frame advancement and explosion ordering, resets mid-explosion and
  repeats from clean hidden/frame-zero state.
- `npm --prefix editor run check`, the focused native gameplay-program test,
  conversion/schema/Rick collision and jump regressions, the dependency-aware
  native build and `git diff --check` pass. The package remains byte-identical
  at `88976c1a311365659319bb2af727f7825df43e1f0cfe762b438912ac2fa69fae`.

This sequence block and the subsequent transformation block were visually
accepted.

## Completed review block 5: transformation

- The completed light/ray/explosion sequence now sets the declared alternate
  form flag and emits `scene-finished`.
- Every state in the primary converted form has a priority event transition
  using the existing typed `setForm` state action. The alternate form starts in
  its declared initial state; no game, character or form name is interpreted by
  either runtime.
- Focused web and C++ state-machine tests cover event-driven transformation,
  position/facing preservation and the new form's initial state.
- An end-to-end web runtime test found and fixed a genuine parity defect:
  preview reset retained the active transformed form while C++ restored the
  declared initial form. `CharacterForms.reset` now restores the initial form,
  controller, capabilities and action bindings.
- At this intermediate checkpoint the six-entry loss report remained intact
  and `SCRIPT_ACTION_GAPS` still reported the then-deferred form-sensitive
  death action. Block 6 below supersedes that status.
- Current generated package SHA-256:
  `70229c51ccf796657c88a4f0bde44f34cf4a93196357616d28bb61da1594f9df`.

This transformation block was visually accepted.

## Completed review block 6: form-sensitive danger and exit

- Both converted forms now declare a generic `dead` state and all non-dead
  states give the built-in `killed` event priority.
- A second data-driven trigger reproduces the historical rectangle at
  `(3744, 1350, 188, 182)`. It emits `killed` only while the declared
  `alternate-form` flag is false.
- The existing overlapping reach-zone objective therefore cannot complete for
  the initial form, because death is processed first, while the alternate form
  crosses the same area and completes the phase.
- An end-to-end web regression covers death, life consumption, blocked
  completion, reset, transformation and successful alternate-form completion.
  C++ state-machine coverage verifies the same typed death transition.
- This exposed and fixed a web-only integration gap: a `killed` event emitted
  by gameplay entered the dead state but did not consume a life. The registered
  event callback now applies the normal life-loss path exactly once.
- Manual native review then exposed the symmetric lifecycle gap: the same
  event entered the dying state directly and bypassed `SetKilled(World*)`, so
  the death arc had no valid origin/checkpoint setup and never respawned.
  Built-in `killed` events now use the normal native kill path shared by
  hazards, lasers, bombs and enemies; custom events still dispatch directly to
  the declarative state machine.
- The loss report remains at six entries. `SCRIPT_ACTION_GAPS` now lists only
  the still-deferred forced-state and keep-moving zones.
- Current generated package SHA-256:
  `170db5eb463d9e100178259eed39554ffd06992979f521d43c09d6f4df5f8686`.

Manual native review confirmed that death now consumes the normal lifecycle and
respawns. Reappearing at the phase beginning is expected because the full
checkpoint graph is still deferred.

## Completed block 7: historical checkpoint graph

The historical parser proves that each record stores inclusive
left/top/right/bottom corners followed by a respawn position and a zero-ended
list of successor indices. It begins with checkpoint 0's successors and
replaces the eligible list after every activation. The final record is excluded
from activation by the historical `< numCheckpoints - 1` guard. Death copies
only the checkpoint position; facing is not reset and therefore remains the
direction held when the character died.

The converter now emits all 11 records with generic `topLeft` activation,
generic `disabled` activation for terminal node 10 and `preserve` respawn
facing for nodes 1-10. Node 0 gets the phase-declared initial facing. Focused
conversion and web/C++ runtime tests cover the linear edges,
4 to 5/6 fork, merge at 7, terminal node, eligibility, inclusive bounds,
respawn position/facing and clean level restart. The checkpoint loss entry is
removed, leaving five losses.

This block was manually approved. Preserve it while continuing later blocks.

Latest generated package SHA-256:
`a0529bfe1a08713bb8cc0ba15af2ac01025a7653c4fc2007b42877e952e16b12`.
Conversion tests pass 3/3, schema tests 8/8, all 20 web suites pass, focused
checkpoint/spawn native tests pass, native archive and Rick collision/jump
regressions pass, the dependency-aware C++ build passes cleanly and
`git diff --check` is clean. A package-backed web trace covers both branches,
terminal behavior, death respawn and restart. Native visual review remains
blocked by the headless environment at `failed to create display`.

## Implemented block 8: first ground and flying enemies

The historical enemy parser reads 16 records containing ID, behavior type,
state, horizontal/vertical direction, position, X/Y patrol displacement,
inner velocity and animation definition. The global game loop runs four
substeps, each enemy runs its inner velocity count, and every substep moves one
pixel. Converted visible speed is therefore `4 * velocity`.

This bounded slice converts ground record 2 and flying record 4. Both package
their animation definitions and bitmaps, use scale 4 and typed enemy combat
profiles, and retain authored position, initial direction and patrol distance.
The ground enemy uses generic bounded `patrol`, gravity and collision; its
physical height excludes the last visual row to match the legacy collision
loop. The flying enemy uses generic horizontal `flyPatrol` without gravity.
Generic enemy `visualScale`, patrol `distance`, and flying
`initialDirection` remain optional so Rick and older projects keep their
existing behavior.

At this stage the remaining 14 enemy records stayed in
`DEFERRED_ENTITY_RECORDS` and the loss report remained at five entries. The
subsequent manual review and fixes recorded below approved this initial slice.

Latest generated package SHA-256:
`dfb07c0ac0f6475f2e421ac13b2a1068790a0fdf28f71ed01e1e89efe32d6272`.
Conversion tests pass 3/3, schema tests 8/8, all 20 web suites pass, the focused
native behavior test and dependency-aware clean C++ build pass, and
`git diff --check` is clean. A package-backed web trace confirms movement,
turning, scale and reset for both converted enemies. Native package validation
reaches the expected headless `failed to create display`; visual enemy review
therefore remains pending.

The first graphical launch exposed `Missing character animation for state 0`.
Enemy definitions had incorrectly labelled their movement animation as
`CHAR_STATE_RUNNING` with numeric ID 1 and did not declare the native initial
`CHAR_STATE_STOP` state. The converter now emits `STOP=0`, `RUNNING=2` and
`DYING=8`, reusing the historical movement animation for the initial stopped
state. A focused conversion assertion protects those exact generic runtime
state IDs, and the regenerated package again reaches display creation in the
headless native validation.

Manual review confirmed that both converted enemies are visible and follow
their intended routes, and that the ground enemy also turns visually. It then
exposed a native-only facing defect in `flyPatrol`: reversal updated movement
`direction`, while bitmap flipping still read the stale `face`. Generic enemy
initialization and each flying patrol step now keep both fields synchronized;
web already derived the rendered face from the current direction. A clean
native build, the focused behavior and conversion tests, package regeneration,
and `git diff --check` pass. Manual review confirmed the flying enemy flip;
the initial ground/flying enemy slice is approved.

Manual enemy review also revealed that the converted jump travelled less
horizontally than the historical jump. This is not visual scaling: Camelot
moves one pixel on both axes in each of four substeps, while the converter had
authored 4 px/tick horizontally but 8 px/tick vertically. Both converted forms
now use 4 px/tick for minimum and maximum vertical speed, so reaching the
historical 184/192 px apex takes the matching horizontal travel time. The web
ledge regression checks continued X movement for several ticks after the
player is already airborne; the native direction helper covers the same
takeoff preservation. Manual native review approved the corrected historical
jump reach. The specifically reported ledge-fall case was still pending at
that review and is superseded by completed block 13 below. Package SHA-256 at that review:
`da7e9caad65e313ed052f14b8718a1bdbc5962a230cb9f3ab9a9b8a454f295ec`.

## Implemented block 9: historical parallax coverage and transparency

Historical back-scroll drawing divides camera X by each velocity, but fixes Y
at screen coordinate zero; its commented-out Y correction proves that the
768-pixel image is intended to cover the complete 768-pixel viewport at every
world height. The front plane instead multiplies both camera coordinates and
repeats. The converter now emits those exact generic factors: back X values
`1/3` and `1/10` with `factorY: 0`, and front X/Y values `2` and `1`.

The web obstruction was not a layer-order defect: both runtimes already draw
back planes before tiles and the front plane after them. The historical BMPs
depend on Allegro's magenta color mask; C++ converts it to alpha when loading,
while browser `ImageBitmap` preserves opaque magenta. The converter now writes
deterministic RGBA PNG parallax assets with `(255, 0, 255)` made transparent,
keeping the legacy interpretation out of both runtimes. Tests inspect the PNG
structure and alpha plus all three factors. Conversion/schema tests pass
11/11, all 20 web suites pass, native archive loading passes, and
`git diff --check` is clean. The loss report remains at five entries.

Latest generated package SHA-256:
`c2d42c500074df1914adccea5ddc3585f268ca9791011873dd961701528a3a46`.
The editor layer panel now exposes `Background parallax` and `Foreground
parallax` independently from `Tiles`, `Front tiles` and `Collisions`. Parallax
visibility is editor-session state only: both controls start off so map tiles
remain unobstructed for editing, and either plane can be enabled with its
checkbox without changing exported data. Their labels are not editing targets;
parallax definitions remain managed by the presentation editor. TypeScript and
all 20 web suites pass; manual UI review is pending.

Manual review approved the parallax coverage, transparency and independent
editor visibility controls.

## Implemented block 10: remaining type-1 ground enemies

The converter now includes historical enemy records 1 and 3 alongside the
already approved record 2, completing the type-1 ground family. All three use
the existing generic bounded ground patrol, gravity, collision, visual scale
and typed contact-combat contracts. Records 1 and 3 preserve their exact
positions `(3020, 1049)` and `(1036, 1433)`, initial left/right directions,
1984-pixel patrol displacement and visible speed 24 derived from historical
inner velocity 6 across four global substeps. No runtime or schema change was
needed.

Focused conversion assertions cover record ordering and every authored motion
field. Conversion/schema tests pass 11/11, native archive loading passes,
`git diff --check` is clean, and native package loading reaches the expected
headless display failure. `DEFERRED_ENTITY_RECORDS` now truthfully reports 12
remaining enemies; the total loss count remains five.

Latest generated package SHA-256:
`b4fd977745c10f76e7f5cb1d92e85031fcc8331ebf64864cf0c06376e59d9750`.
Manual review confirmed the presence, position, movement, turning and
collisions of records 1 and 3, while also exposing that their contact did not
kill the player at the visible body. The enemy boxes were already faithful to
the complete scaled historical frames. The converted player combat profiles
now use the legacy inset formula: offset `(25, 25)`, primary `14 x 95` and
alternate `78 x 63`. Focused web/C++ combat tests prove contact against the
inset body, and conversion assertions fix both profiles. Manual review then
approved contact death, life consumption and checkpoint respawn, completing
the type-1 ground family.

## Implemented block 11: remaining type-2 horizontal flying enemies

The converter now includes records 5, 6 and 7 alongside the approved record 4,
completing this historical family without runtime or schema changes. All three
reuse the generic horizontal `flyPatrol`, visual scale, animation, typed combat
and reset contracts. They preserve these source fields:

- ID 5: `(3075, 200)`, right, distance 460, visible speed 8, phase 58 ticks;
- ID 6: `(960, 200)`, right, distance 2030, visible speed 24, phase 85 ticks;
- ID 7: `(3380, 1240)`, right, distance 340, visible speed 12, phase 29 ticks.

The conversion regression fixes ordering, positions, initial directions,
speeds, distances, phases, scale, animation definition and combat profiles.
The loss report remains at five entries while `DEFERRED_ENTITY_RECORDS` now
reports nine remaining records. Conversion/schema tests, all 20 web suites,
the focused C++ behavior test, native archive loading and `git diff --check`
pass.

Latest generated package SHA-256:
`4ec58beb958119e70ac3e2f1a5637afdfec96021967e53b7d6a7ed7a6693737a`.
This horizontal-flying completion was subsequently approved manually.

Manual review subsequently approved the complete type-2 horizontal flying
family. Block 12 now converts the three type-3 ground enemies, records 8-10,
using the existing patrol, collision, gravity, scale, animation, combat and
reset contracts. Their preserved fields are ID 8 `(3743, 688)`, left,
distance 246; ID 9 `(970, 336)`, right, distance 2020; and ID 10
`(571, 1456)`, right, distance 360. All use visible speed 4 and `96 x 48`
geometry. Five losses remain and six enemy records are deferred.

Latest package SHA-256:
`fef31da20a54a81d602cabc603e2e63ef758f88b514c6c3d3048a87264cf75dc`.
Conversion/schema, all 20 web suites, native archive loading and
`git diff --check` pass. Manual review approved this complete type-3 family.

That review exposed that the historical sword could not be triggered with its
original neutral FIRE input: conversion had approximated it as Action+Up.
The generic action-binding contract now accepts optional `neutral`; web, C++,
schema, editor and validation share it, while omission preserves Rick's
existing directional chords. Camelot binds neutral Action/Space to `hitting`.
Focused input tests, all web suites and the official clean native build pass.
Manual review approved the neutral sword input and its state transitions after
the history-sensitive correction described below.

Manual review then exposed that the historical striking frame's composed
sword component was neither rendered nor represented by the attack box. The
converter now materializes the body plus external component as a deterministic
transparent PNG with symmetric padding, so generic scaling/flip keeps the body
anchored and places the sword on the facing side in web and C++. The melee box
matches that external scaled component at `64 x 160`. The generated package
SHA-256 is now
`a426d8923f618779233e1e9b8cc5572b6868e531bc00a2852e1874324fe0ffea`.
Conversion/schema, all 20 web suites, native archive and headless package load,
and `git diff --check` pass. Manual review approved the composed sword sprite
and the visible external attack box.

The composed sword was then visually approved, but enemy damage was still
inactive because combat referenced declared state `striking` while both
runtimes expose the active animation name `golpear` to combat poses. The
converted melee window now uses `golpear`; focused web/C++ combat regressions
place an enemy in the external sword box and require lethal damage. The editor
already exposes the materialized frame through Assets, numeric combat-box
fields through Combat profiles and the independent red Attack overlay in
preview, so the same data remains authorable without sword-specific UI.

Latest generated package SHA-256:
`7e9883fdba8cfcea61a2187d3b8d814d021be669bc1730ae20d449045a30e33a`.
Manual review confirmed the editor-visible attack box and, after the native
priority correction below, lethal contact with enemies.

Native review showed the active sword box overlapping flying enemy 4 without
removing it. Combat correctly reduced its health to zero, but `flyPatrol`
returned before the native enemy processed its `killed` flag. Enemy death now
has priority before every behavior-specific early return; the web runtime
already followed that lifecycle. A focused rule regression, combat tests, all
20 web suites and the official clean native build pass. The package data is
unchanged at SHA-256
`7e9883fdba8cfcea61a2187d3b8d814d021be669bc1730ae20d449045a30e33a`.
Manual review confirmed flying-enemy death after this correction.

Manual review confirmed lethal sword contact but exposed looping enemy death
animation. Native enemies inherited the player's camera-bound death motion and
cyclic animation. `Enemy::CharacterStep` now gives `DYING` its own generic
lifecycle: advance the configured animation once, transition to `DEAD` at its
last frame and remain hidden until reset, matching web behavior. Focused
animation/enemy rules, all 20 web suites and the official clean native build
pass. Package data remains byte-identical at
`7e9883fdba8cfcea61a2187d3b8d814d021be669bc1730ae20d449045a30e33a`.
Manual review confirmed that the death animation finishes once and the enemy
remains removed until reset.

The first sword review exposed a release loop because the converted striking
state ignored the already-supported generic `previousState` condition. The
data graph now mirrors the legacy sequence: initial draw/strike enters guard;
releasing Action runs guard to strike to draw to idle. Conversion assertions
fix both history-sensitive branches, and focused web/C++ state-machine tests
plus all web suites pass. Manual release and repeat review approved the final
sword state graph.

## Completed block 13: vertical walk-off fall

The historical character update suppresses horizontal movement when the
current state is falling and the previous state was walking. This is distinct
from a grounded jump: a jump retains its takeoff direction through ascent and
descent when air control is disabled.

The generic web and C++ jump initialization now adds a facing component for a
no-air-control profile only when the transition began grounded. Walking off a
ledge therefore starts with downward movement alone. Rick remains compatible:
its default air control still accepts horizontal input after leaving a ledge.
Focused web regressions cover several airborne ticks for both profiles, and
the native direction helper fixes the grounded/airborne distinction.

Manual review approved both cases: Camelot falls vertically after walking off
an edge, while a real jump continues horizontally through its descending arc.
The regenerated package remains byte-identical because this is a generic
runtime correction:
`7e9883fdba8cfcea61a2187d3b8d814d021be669bc1730ae20d449045a30e33a`.

Final checks for this stopping point: the focused web and native jump tests,
all 20 web suites, `tests/native_project_archive_test.py`, the official clean
native build and `git diff --check` pass. The loss report still contains five
entries and `DEFERRED_ENTITY_RECORDS` truthfully retains records 11-16.

## Recommended next bounded block

Continue with exactly one remaining historical enemy family after inspecting
its source behavior. The narrowest next slice is static record 11 (type 4,
`planta`) at `(3362, 1377)`. Keep all historical parsing in the converter and
reuse or extend only generic behavior, animation, scale, combat and reset
contracts with web/C++ parity. Do not mix records 12-16, forced-state zones or
`keep-moving` script work into that review block. Regenerate before testing,
  stop for manual review, and do not reduce the five-loss report unless the
  selected family is completely represented and proven.

## Implemented block 14: static enemy ID 11 (awaiting manual review)

The historical type-4 record starts stopped at `(3362, 1377)`, facing right,
with no X/Y displacement. Its two 250 ms frames have source sizes `40x32` and
`39x32`; at scale 4 the initial physical and contact box is `160x128`.
Generic `idle` advances animation without gravity or motion in web and C++;
existing combat death and reset lifecycles apply. The converter packages the
animation and bitmap and includes both hashes in the 37-entry input inventory.
The five loss categories remain; only enemy IDs 12-16 are deferred. Do not
continue those records until ID 11 receives manual review. No commit created.

Manual visual review approved the plant's placement and animation but rejected
its sword death, and found that each enemy's contact killed the player only
once. The converter now gives the static plant a full-body, all-facing combat
guard against the sword's contact damage type. It remains a contact hazard;
the alternate form must jump over it. Converted enemy contact attacks declare
`hitOnce: false` so the same surviving enemy can damage the player after a
later respawn. Both mappings stay data-driven and apply in web and C++.

Manual review approved both corrections. The next bounded slice converts only
static enemy ID 12 (`bombolles`). Its historical type-5 record is initially
stopped, faces right, has no X/Y travel and uses two frames at 150 ms. It
reuses generic `idle` with ordinary sword vulnerability and repeatable contact.
Records 13-16 and their behavior families remain deferred; no script gaps were
mixed into this block. Stop for manual review of ID 12 before continuing.

Manual navigation support is now in place for reviewing the still-pending ID 12:
K toggles temporary invulnerability while playing natively.
The native override prevents both hazard death and typed combat damage without
changing project data; its window title reports the active mode. Web preview
retains its existing Invulnerable control, which starts on.
During web preview, Space is reserved for the player's Action input rather
than the editor canvas-pan shortcut; Space + drag remains available in edit
mode. No enemy records or loss categories were changed by these controls.

Follow-up web review exposed a separate action-binding inheritance gap: an
explicit `characterForms` catalog dropped the global `actionBindings` before
the `WebPlayer` consumed neutral Space. `CharacterForms` now merges global
controller, capability and action-binding defaults under each form's explicit
overrides, matching native semantics; focused web coverage checks both neutral
inheritance and an explicit per-form `null` override. No package data changed.
The debug screenshot's wide blue rectangle is checkpoint 2's authored
`723 x 89` activation region, not the player's collision box. The player uses
the full scaled controller box for terrain and the smaller inset hurtbox for
combat, matching the distinct historical routines. A reported trapped path
under a solid ceiling still needs a precise world-coordinate replay before
altering terrain geometry or the checkpoint graph.

## Latest continuation: XY-patrol enemies 13-15

After manual acceptance of the delayed repeating vertical bubble, the three
remaining phase-1 enemy records were converted as one bounded family. ID 13
is the fly at `(3800, 80)` with independent X/Y distances `124/240` and four
one-pixel substeps per tick. IDs 14 and 15 are owls at `(240, 300)` and
`(120, 900)`, with distances `184/240` and `200/310`, and eight substeps per
tick. All start right/down, use scale 4, historical movement and death
animations, contact combat, and a 251-tick respawn delay. Generic `xyPatrol`
turns each axis independently only after strictly exceeding its distance,
checks solid terrain across the whole box, and restores anchors and
directions on reset in web and C++.

The converter now packages all 16 phase-1 enemy records and both owl inputs;
`DEFERRED_ENTITY_RECORDS` is removed from the report, leaving four losses.
Automated conversion, schema, web trajectory/collision, and native behavior
rules passed. The user manually confirmed that the XY enemies work well; the
entire enemy block is complete. No commit was made. The next bounded block is
the historical forced-state script zone only, after diagnosing its exact
behavior in the read-only legacy source; keep-moving zones stay deferred.

## Handoff after XY manual acceptance

- Last verified branch and HEAD: `master` at `c5624a7`; Task 44 remains a
  deliberately broad dirty/untracked worktree. Preserve every existing change.
- Latest generated archive: `/tmp/camelot-phase-1.rick2-project`, SHA-256
  `0f3a5303a298cfa3fb21421f92fc597683864b36cb3a86b5aea9daff4323c688`.
  Regenerate before any new test; do not treat the hash as a fixed target.
- Loss report: four codes, `ANIMATION_ROUNDING`,
  `OBJECT_ANIMATION_ROUNDING`, `SCRIPT_ACTION_GAPS`, and
  `STATE_TRANSITIONS_DEFERRED`. No enemy records remain deferred.
- Last checks passed: conversion/reproducibility test, level schema test,
  `npm --prefix editor run check`, native archive test, native behavior-rule
  test, `git diff --check`, and `bin/Makefile` clean build. Native launch from
  `bin/` stopped at `failed to create display` in the headless environment.
- Do not commit without a separate explicit user authorization. Stop for
  manual review after one narrow next block.

## Forced-state zone implementation (approved)

The phase-1 script record at `(719, 751, 336, 16)` has no input conditions.
After four movement substeps, the historical loop tests the character's
top-left point against that rectangle with inclusive bounds and writes
`forceStateUpdate=1`, `previous_state=1` (walking), and `current_state=3`
(falling). It repeats this write on every frame inside the zone. On the next
character update, the state handler installs that exact current/previous pair
instead of evaluating normal transitions; `forceStateUpdate` is then cleared.
The falling-from-walking pair suppresses horizontal motion while normal falling
physics and the falling animation continue. Facing is not changed. The same
script can run again after re-entry; it has no one-shot flag.

The converter now reads the source record and emits an optional
`continuousPoint` trigger with a typed `forcePlayerState` action. Web and C++
test the player's top-left position at inclusive bounds after movement and
execute the action on every tick inside, without trigger rearming. The action
sets the current and previous declared states, skips the next ordinary state
evaluation, starts a downward arc without horizontal carry, and preserves
facing. These options are generic; existing triggers and Rick profiles keep
their previous behavior. The editor exposes the activation mode and both
state names. The four-loss report remains: `SCRIPT_ACTION_GAPS` now names only
the deferred keep-moving zones, and `STATE_TRANSITIONS_DEFERRED` still covers
the remaining historical grammar. Do not combine those gaps with this review.

Conversion and schema tests, all 20 web suites, focused C++ state/gameplay/
trigger-rule tests, native archive test, and the official clean native build
pass. Native launch reaches the expected headless `failed to create display`.
The regenerated archive SHA-256 is
`04c3e8ebfa4430fb01d70eef812878522f9c867e7eaecdef101f32d93d10dabd`.
The user accepted this block before authorizing the keep-moving continuation.
No commit has been created.

## Keep-moving zones (awaiting manual review)

The user approved the forced-state zone, so the next bounded block converts
only the six `keepMoving` phase-1 records. Their source rectangles, in order,
are `(960,960,74,64)`, `(960,224,74,62)`, `(3003,960,74,64)`,
`(3003,224,74,64)`, `(3003,1344,74,64)` and `(960,1344,74,64)`. All have no
input conditions and write `keepMoving=1` on every frame that the player's
top-left point is inside. The historical handler substitutes the current
facing direction only for `NO_KEY` while grounded; explicit input wins. The
flag persists after leaving the rectangle until the active animation closes
a complete cycle. A rectangle can set it again after that cycle.

The converter parses all six records and emits generic `continuousPoint`
triggers with typed `keepPlayerMoving` actions. Web and C++ apply the same
neutral-input rule and clear the flag at an animation-cycle boundary. Reset,
respawn and placement clear it. No game-specific names or script parsing were
added to either runtime. `SCRIPT_ACTION_GAPS` remains in the four-loss report
until the animation lifetime is accepted visually; its detail now says the
zones are converted and awaiting manual review. The remaining transition
grammar and other phases are outside this block.

Conversion reproducibility/schema, all 20 web suites, focused native gameplay
and movement-rule tests, native archive loading, `git diff --check`, and the
official clean native build pass. Native launch ends at the expected headless
`failed to create display`. The regenerated archive SHA-256 is
`b29a3638799511428d97f72ecfef3b8341ff5fe56ce7933e8807ce243694ef73`.
No commit has been created. Stop for manual review of entry, exit, facing,
explicit controls, animation-cycle expiry and re-entry at these six zones.

## Horizontal jump distance (awaiting manual review)

The user approved all six keep-moving zones, completing the twelve phase-1
script records. `SCRIPT_ACTION_GAPS` is removed; the report now has three
losses: `ANIMATION_ROUNDING`, `OBJECT_ANIMATION_ROUNDING`, and
`STATE_TRANSITIONS_DEFERRED`.

The historical state handler captures X and Y at takeoff, then uses absolute
displacement. Its horizontal jump transition requires strictly more than 184
pixels for the primary form or 192 for the alternate. The converter now emits
those values as optional `jumpDistanceX` controller data. Web and C++ begin
descent when horizontal travel exceeds it, while omitted data keeps Rick's
existing jump behavior. The remaining transition grammar stays deferred.

Conversion/reproducibility and schema tests, all 20 web suites (including an
observed early-descent test), native archive loading, `git diff --check`, and
the official clean native build pass. Native launch reaches the expected
headless `failed to create display`. The regenerated archive SHA-256 is
`09025a9e429cd17c438a3705198331c7745a516fb7bcb8c213e58b34c7f86add`.
No commit has been created. Review horizontal jump reach and the descent arc
in both forms before selecting another block.

## Declared-fall landing (awaiting manual review)

The user approved the horizontal jump distance block. This bounded transition
block maps the primary form's historical `falling -> crouching -> idle`
landing sequence. The pause uses the existing five-tick state timer and a
`previousState == falling` condition. The alternate form still lands directly
in idle. Crouching entered from another state still starts a jump. This covers
declared falls from walking off a ledge or the forced-state zone; the
`jumping -> falling` state transition at the apex remains deferred. Rick is
unchanged and `STATE_TRANSITIONS_DEFERRED` remains in the three-loss report.

Conversion/reproducibility and schema tests, all 20 web suites, the focused
native state-machine test, native archive loading, `git diff --check`, and
the official clean native build pass. Native launch reaches the expected
headless `failed to create display`. The regenerated archive SHA-256 is
`03917736b47a2e6f3a86fe854bb142b21dc05ed94fb26944ca30de38e01245ef`.
No commit has been created. Review the primary landing pause after walking off
a ledge or entering the forced-fall zone, and verify that the alternate form
lands without the pause.

## Jump-to-fall declared transition (awaiting manual review)

The user approved declared-fall landing. This block completes the jump arc's
declared state sequence in both forms. A generic `descending` state signal is
exposed by web and C++ and accepted by the schema and state editor. The
converter uses it for `jumping -> falling` at the first update after the
physical ascent ends. Both declared states share the existing jumping motion
behavior, so the transition does not reset velocity or horizontal carry.
The primary form subsequently uses its approved crouching landing pause; the
alternate form lands directly in idle. Rick's graph is unchanged.

Conversion/reproducibility and schema tests, all 20 web suites, the focused
native state-machine test, native archive loading, `git diff --check`, and the
official clean native build pass. Native launch reaches the expected headless
`failed to create display`. The regenerated archive SHA-256 is
`e31da1d0333d27729f87b6db2389ea849ab5597bb7984d85cbf7d2ec3963be66`.
The report still has three losses, including `STATE_TRANSITIONS_DEFERRED` for
the remaining historical graph. No commit has been created. Review a complete
jump in both forms, including the change to falling and the landing sequence.

## Exact player animation milliseconds (awaiting manual review)

The user approved the complete declared jump arc. Inspection of the remaining
transition gap found that phase 1 contains only empty/solid collision values;
its declared diagonal-slope states are unreachable in this map and remain
covered by `STATE_TRANSITIONS_DEFERRED` rather than being approximated with
Rick's vertical ladders.

This block removes the player `ANIMATION_ROUNDING` loss. Animation definitions
accept optional positive `frameDurationMs` alongside the compatible required
tick duration. Web rendering/combat frames and native animation accumulate the
20 ms timestep against the exact duration. The converter emits 85 ms for the
two-frame frog walk, producing exact long-run cadence instead of rounding each
frame to 80 ms. Existing tick-only projects and Rick are unchanged. The asset
editor displays and previews the optional millisecond value.

Conversion/reproducibility and schema tests, all 20 web suites, the focused
native 85 ms clock test, native archive loading, `git diff --check`, and the
official clean native build pass. Native launch reaches the expected headless
`failed to create display`. The regenerated archive SHA-256 is
`9426513a031c2ff0c0f21f704292e01fb3ca42fb6d5d64407195681d5538e6e6`.
Two losses remain: `OBJECT_ANIMATION_ROUNDING` and
`STATE_TRANSITIONS_DEFERRED`. No commit has been created. Review the frog walk
animation cadence in web and native before continuing.

## Exact explosion timing (awaiting manual review)

The user approved the frog's exact 85 ms cadence. The same optional
`frameDurationMs` contract now applies to native objects. The converter emits
250 ms for each of the explosion's five frames, and the scene waits 63 fixed
ticks: the first update at or beyond the exact 1250 ms cycle, instead of
hiding the object after the former rounded 1200 ms. Web preview and native use
the exact frame cadence, while tick-only object definitions remain compatible.
`OBJECT_ANIMATION_ROUNDING` is removed.

Conversion/reproducibility and schema tests, all 20 web suites, focused native
clock tests for 85 ms and 250 ms, native archive loading, `git diff --check`,
and the official clean native build pass. Native launch reaches the expected
headless `failed to create display`. The regenerated archive SHA-256 is
`8359282fe651c87e45b446923fa08822d0785dc55e087f857477517cd0e38fe7`.
Only `STATE_TRANSITIONS_DEFERRED` remains in the loss report. No commit has
been created. Review the complete explosion animation and the moment at which
the scene proceeds to transformation.

## Exact historical neutral input (awaiting manual review)

The user approved the exact explosion timing. The transition audit then found
one reachable mismatch: legacy `NO_KEY` is a dedicated input value, while the
converted idle transition only checked left, right and up. It now requires all
five generic controls—left, right, up, down and action—to be released. As a
result, pressing down while walking leaves the declared state as `walking`;
releasing every control changes it to `idle`, matching both primary and
alternate historical graphs. No runtime discriminator or new input type was
needed.

Conversion/reproducibility and schema tests, all 20 web suites, the focused
state-machine test, native archive loading, `git diff --check`, and the
official clean native build pass. Native launch reaches the expected headless
`failed to create display`. The regenerated archive SHA-256 is
`fcbe4d23e3f3c734bbe7fb761f69758797599efe6ce61335c6556513d5bd7981`.
`STATE_TRANSITIONS_DEFERRED` remains for the declared diagonal-slope states,
whose collision values 2/3 do not occur in the phase-1 map. No commit has been
created. Review walking with Down held and the transition to idle after all
controls are released in both forms.

## Generic slope collision vocabulary (awaiting manual review)

The user approved the exact historical neutral-input transition. A complete
map audit then found 81 right-rising slope cells in phase 3 and 23 left-rising
slope cells in phase 4, so the final transition loss cannot be closed as
irrelevant to the full migration.

This block adds the data foundation only. Collision offsets `tileCount + 5`
and `tileCount + 6` represent slopes rising left and right in the converter,
editor validation and palette, web decoding, and native collision constants.
They have distinct preview colors. Both web runtimes recognize the values but
do not yet treat them as floors, walls or stairs; diagonal movement remains the
next block. The phase-1 archive is unchanged because its map only contains
collision values 0/1. Native loading now validates all map GIDs against the
same six-type collision range used by the editor.

Conversion/reproducibility and schema tests, all 20 web suites, focused C++
collision-GID and JSON-loader tests, native archive loading, `git diff --check`,
and the official clean native build pass. Native launch reaches the expected
headless `failed to create display`. The regenerated archive SHA-256 is
`fcbe4d23e3f3c734bbe7fb761f69758797599efe6ce61335c6556513d5bd7981`.
`STATE_TRANSITIONS_DEFERRED` remains until generic slope motion and the
corresponding declared transitions are implemented. No commit has been
created. Review the two new collision choices and their distinct map overlays.

## Generic 45-degree slope motion (awaiting manual review)

The user approved the two collision choices and their overlays. This block
implements their geometry without reusing Rick's vertical-ladder behavior.
For `Slope rises left`, the surface runs from the tile's upper-left to its
lower-right; `Slope rises right` mirrors it. Web and native sample the matching
edge of the player's collision box, keep the feet on that surface during
horizontal movement, and allow a descending player to land on it. Four pixels
of horizontal movement therefore produce four pixels of vertical movement on
the converted 32x32 tiles, matching the historical four one-pixel substeps.

Synthetic web tests traverse both orientations in both directions. A focused
C++ rule test verifies both mirrored surfaces and standing-position tolerance.
The phase-1 archive remains unchanged because its map has no slope cells.
`STATE_TRANSITIONS_DEFERRED` remains: the next block must map the historical
slope animation states and their entry/exit conditions onto generic declared
signals, without treating the slopes as ladders or converting phases 3/4.

Conversion/reproducibility and schema tests, all 20 web suites, the focused
C++ slope test, native archive loading, `git diff --check`, and the official
clean native build pass. Native launch reaches the expected headless
`failed to create display`. The regenerated archive SHA-256 remains
`fcbe4d23e3f3c734bbe7fb761f69758797599efe6ce61335c6556513d5bd7981`.
No commit has been created. Review both orientations by painting a short
synthetic ramp and walking across it in both directions.

### Manual review result: accepted

The user later tested the generic slope motion with a modified phase-1 map and
accepted its behavior. The collision vocabulary and 45-degree traversal are
therefore accepted foundations. `STATE_TRANSITIONS_DEFERRED` still refers only
to the historical slope-specific animation states and their entry/exit graph;
revisit those with the real arrangements in phases 3 and 4.

## Pre-phase-2 regression corrections (accepted)

Three reported regressions now have generic, data-driven corrections. The
Camelot sword attack box covers only the visible blade (`x=64, y=24, w=64,
h=28`) instead of the whole character height. Enemy death motion now defaults
to Rick2's unscaled arc, while converted Camelot enemies explicitly request
`behavior.deathMotion: "stationary"`. Native music playback now honors
`audio.playback.initialLoop`; phase 1 already emits `true`.

The debug capture reproduced the frog lock as `rana-cayendo-derecha` at
`x=3140, y=1344`. The 128-pixel collision body had landed on a 64-pixel ledge
under its middle. Vertical collision scanned the complete lower edge and
stopped the fall, while the grounded check sampled only its two unsupported
corners. The player therefore remained in `falling`, where this form has no
air control. Web and native grounded checks now scan every tile spanned by the
lower collision edge, matching vertical collision. A regression test covers
a wide character supported only by a narrow central tile. The debug state and
position label remains useful for later runtime review.

The native performance report also remains observational. The audited render
path does not create resources per frame, the official build uses `-O3`, and
the simulation is fixed at 50 Hz. The current evidence is consistent with the
WSL display/audio backends, but no engine bottleneck has been established.
Compare a run without `--debug` and, when available, native Linux before making
a runtime optimization change.

Conversion tests, native archive loading, all 20 web suites, focused C++
combat and JSON-loader tests, and the official native build pass. The current
regenerated archive SHA-256 is
`9e844eff37790aa10ead2e8b0aa4662d764fdbe7bfadfff2de268e35d757b270`.
The frog correction was manually verified. The user also approved committing
the complete phase-1 migration block before beginning phase 2.

## Phase 2 complete conversion (implemented, awaiting final review)

`tools/convert_camelot.py` now packages phases 1 and 2 as one deterministic
campaign. Phase 2 preserves the historical 92x48 map, 453-tile aquatic
tileset, two masked water parallax planes, looping `roki.wav`, its single
2944x1536 camera region, four-node checkpoint chain and alternate-form spawn.

All 18 historical enemy records are converted. Static bubbles and sea urchin
use `idle`, ordinary swimming enemies use horizontal `flyPatrol`, and the two
records with independent X/Y displacement use `xyPatrol`. Definitions and
bitmaps are deduplicated by family; every enemy retains position, direction,
authored limits, fourfold visual scale, contact combat, stationary Camelot
death and delayed reset behavior.

The two television records implement the complete script flow. The active
television is a fixed pickup which sets `carrying-object`; entering the final
zone without it emits `killed`. Entering with it starts a typed 50-tick offer
sequence, shows the inactive television at its historical position, freezes
control, consumes the carried object, sets `offered-object`, hides the scene
object and restores control. The objective occupies the historical final zone
but requires `offered-object`, so the campaign cannot advance before the
delivery finishes. This optional generic objective condition is enforced in
both runtimes.

The first native review exposed two coupled startup symptoms. Phase 2's atlas
declares 501 pixels of tile-sheet width; the legacy runtime uses integer
division by the 32-pixel tile size, yielding 15 columns. Using 16 displaced
GIDs and produced the black/misaligned cells visible in the capture. The
converter now derives the same 15-column value. The frog was frozen because
the provisional objective began inside its 128-pixel spawn body and completed
on the first tick; the conditioned historical zone removes that accidental
completion while preserving the scripted delivery gate.

`tests/camelot_phase2_conversion_test.py` checks byte-for-byte reproducibility,
both schemas, campaign order, map dimensions and collision vocabulary,
parallax, alternate form, checkpoints, complete enemy inventory, objects,
sequence timing and objective. The combined loss report inventories every
phase-2 source and retains only the existing historical state-transition loss.
