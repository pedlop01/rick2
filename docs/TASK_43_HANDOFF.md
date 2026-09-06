# Task 43 handoff: generic combat and enemy AI

## Purpose

Continue task 43 from `DEVELOPMENT_PLAN.md` without needing the previous chat.
The objective is to make combat and enemy movement reusable by Rick Dangerous,
Camelot Warriors and other simple platform games, with equivalent behaviour in
the web preview and native C++ runtime.

Do not commit the task until the user has tested and approved it. The working
tree deliberately contains an incomplete first block.

## Repository state

- Repository: `/home/plopez/proj/rick2`
- Branch: `master`
- Last commit: `4398b52 feat: generalize level presentation`
- Task 43 is marked `En curso`.
- The worktree has only task-43 changes; there are no known unrelated edits.
- `git diff --check` passes.

Modified files:

- `DEVELOPMENT_PLAN.md`
- `editor/scripts/build.mjs`
- `editor/src/validation.ts`
- `schema/level.schema.json`

New files:

- `docs/COMBAT_AND_AI.md`
- `editor/src/combat.ts`
- `editor/tests/combat.test.mjs`

## Decisions already made

Combat is a top-level optional `combat` catalog, independent from animation
assets and AI. It contains declared damage types and reusable combat profiles.
A profile owns:

- `faction`, `maxHealth` and optional `invulnerabilityTicks`;
- state/frame-sensitive `hurtboxes`;
- state/frame-sensitive `attacks`, damage, damage type, knockback and
  once-per-activation behaviour;
- state/frame-sensitive `guards`, optional accepted damage types and an option
  to guard only towards the facing direction.

All combat rectangles are authored for a right-facing sprite and mirrored by
the runtime when facing left. Profiles are referenced by
`player.combatProfile`, character-form `combatProfile`, or enemy
`combatProfile`. A form change can therefore change combat capabilities without
special-casing warrior, frog or Rick.

Enemy decisions use a closed discriminated `behavior` registry. The first
contract includes:

- `patrol`
- `chase`
- `flyPatrol`
- `verticalPatrol`
- `jumper`
- `bossSequence`

The existing `ia_type: walker/chaser` remains a version-1 compatibility path.
Do not remove or silently rewrite it. At present the schema still requires the
legacy IA fields, so a new enemy cannot yet be authored with only `behavior`.
Resolve this deliberately: either allow the legacy field group or a complete
new behavior branch with JSON Schema `oneOf`, while continuing to accept level
1 unchanged.

No schema or runtime discriminator may contain `rick`, `camelot`, `warrior`,
`frog`, or a concrete level ID. Do not port the old Camelot C++ classes. They
are behavioural evidence only.

## Implemented first block

`editor/src/combat.ts` currently provides:

- typed combat definitions and poses;
- structural and semantic validation;
- facing-aware world box calculation;
- active hit/hurt/guard boxes selected by state and frame;
- `CombatantState` health, invulnerability and hit activation memory;
- deterministic `resolveCombat` with factions, guarding, damage and knockback.

The level schema contains the corresponding optional catalogs and references,
plus the six typed enemy behaviors. Editor project validation checks the combat
catalog and missing player/form/enemy profile references.

`docs/COMBAT_AND_AI.md` documents the intended contract. Treat it as a draft
that must stay synchronized with the final implementation.

## Verification already completed

After the current edits:

```sh
cd /home/plopez/proj/rick2/editor
npm run check
```

passes all 18 Node test files, including `combat.test.mjs`.

```sh
cd /home/plopez/proj/rick2
python3 tests/level_schema_test.py
```

passes all six schema tests. Existing level 1 remains valid.

## Completed block: web preview integration

Start by reading only these relevant sections:

- `editor/src/combat.ts`
- the top-level types, constructor, `reset`, `step`, `bodies`, enemy contact and
  enemy-kill methods in `editor/src/preview-runtime.ts`;
- `#drawRuntimeBodies` in `editor/src/workspace-preview.ts`;
- `CharacterFormDefinition`/`ActiveCharacterForm` in
  `editor/src/character-forms.ts`.

Implemented:

1. Preserve `combatProfile` through active character forms and expose the
   current form profile from `WebPlayer` or `CharacterForms`.
2. In `PreviewRuntime`, construct combatants only when the level declares a
   valid combat profile. With no `combat` block, keep every existing Rick rule
   byte-for-byte equivalent in behaviour.
3. Resolve player↔enemy attacks after movement using the displayed animation
   state and frame. Use a stable activation counter that changes when an attack
   state is entered; do not use the global tick as activation identity.
4. Apply health, invulnerability, death and knockback. Dispatch existing
   `killed` semantics instead of inventing a Camelot-only event.
5. Extend `RuntimeBody` with optional combat diagnostics: health and arrays of
   world-space hurt, attack and guard boxes.
6. Render these boxes in `WorkspacePreview` only when bounds/debug overlays are
   enabled. Suggested colors: hurt cyan, attack red, guard blue. Keep ordinary
   collision boxes visible.
7. Add integration tests to `preview-runtime.test.mjs` for sword damage,
   guarding, one hit per activation, death and form-specific profiles. Add a
   regression asserting a level without `combat` retains Rick's current enemy
   contact/hit behaviour.

Be careful that `RuntimeBody.frame` is an elapsed animation tick, while combat
`frames` are visual frame indices. Convert using the selected animation's
`frameDurationTicks`, as the renderer already does, rather than comparing the
raw elapsed tick directly.

The web runtime preserves form-specific profiles, resolves displayed animation
states and visual frame indices after movement, applies health, guarding,
invulnerability, death and knockback, and exposes combat boxes through
`RuntimeBody`. Bounds overlays draw hurt, attack and guard boxes. Levels without
`combat` continue through the legacy Rick contact/freeze path.

`preview-runtime.test.mjs` covers sword damage, guarding, one hit per activation,
death, form-specific profiles and the existing legacy Rick contact semantics.

## Next block: editor authoring

1. Add human-friendly editor panels for damage types, profiles and their boxes.
   State selectors must come from the selected character definition/form.
   Geometry should be editable numerically and visually over the sprite.
2. Add toggles/legend entries for hurt, attack and guard boxes.
3. Implement the same combat data model and resolver in C++, with focused native
   tests before connecting it to `World`, `Player`, `Enemy` and `Camera` debug
   rendering.
4. Replace the web enemy `walker/chaser` dispatch with an adapter into the new
   behavior registry, then add deterministic implementations for flight,
   vertical patrol and jumping. Preserve all existing chaser staircase tests.
5. Add equivalent native C++ behavior dispatch and tests.
6. Express boss behavior as registered deterministic actions/sequences. It must
   not be a hard-coded dragon class.
7. Add generic and Camelot-derived fixtures covering at least one grounded and
   one airborne enemy, sword and guard. Keep legacy Camelot outside the build:
   `/home/plopez/proj/camelot/game` is read-only reference material.
8. Update data catalog/runtime documentation, run `./tools/check_all.sh`, mark
   task 43 complete, ask the user to test, and stop before committing.

## Acceptance sources

Use `docs/CAMELOT_VALIDATION.md`, especially C3 and C10:

- sword, guard and melee damage use active boxes by frame and can be inspected;
- at least one grounded and one airborne phase-1-style enemy use registered
  behaviors.

The historical evidence is mainly:

- `/home/plopez/proj/camelot/game/character.cpp`
- `/home/plopez/proj/camelot/game/enemigo.cpp`
- `/home/plopez/proj/camelot/game/data/characters/warrior_def_states.txt`
- `/home/plopez/proj/camelot/game/data/levels/phase1.txt`

Read narrow ranges or use targeted `rg`; do not dump entire files. This handoff
exists specifically to avoid carrying or reconstructing the very large prior
conversation.

## Token and tool-output discipline

- Use targeted `rg`, `sed` ranges and focused tests during implementation.
- Set conservative output limits and suppress successful test detail when the
  exit code is sufficient.
- Run `npm run typecheck` or a single Node test while iterating.
- Reserve the complete web suite and `tools/check_all.sh` for coherent block or
  task boundaries.
- Summarize changes in commentary instead of pasting long diffs or test lists.
