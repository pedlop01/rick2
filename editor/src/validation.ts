import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import levelSchema from "../../schema/level.schema.json";
import projectSchema from "../../schema/project.schema.json";
import type { Rick2Project } from "./project-io";
import { resolveProjectReference } from "./project-io";

export interface Diagnostic {
  severity: "error" | "warning";
  file: string;
  path: string;
  message: string;
  source: "schema" | "semantic";
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateLevel = ajv.compile(levelSchema) as ValidateFunction;
const validateManifest = ajv.compile(projectSchema) as ValidateFunction;
const decoder = new TextDecoder();

function schemaDiagnostics(file: string, errors: ErrorObject[] | null | undefined): Diagnostic[] {
  return (errors ?? []).map((error) => ({
    severity: "error",
    file,
    path: error.instancePath || "/",
    message: error.message ?? "Invalid value",
    source: "schema",
  }));
}

function parseLevel(project: Rick2Project, path: string): unknown {
  const bytes = project.files.get(path);
  if (!bytes) throw new Error(`Declared level is missing: ${path}`);
  return JSON.parse(decoder.decode(bytes)) as unknown;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : {};
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); return { width: view.getUint32(16), height: view.getUint32(20) };
}

function semanticLevelDiagnostics(project: Rick2Project, file: string, value: unknown): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const level = object(value);
  const entities = object(level.entities);
  const definitions = object(level.definitions);
  const add = (path: string, message: string): void => {
    diagnostics.push({ severity: "error", file, path, message, source: "semantic" });
  };
  const warn = (path: string, message: string): void => { diagnostics.push({ severity: "warning", file, path, message, source: "semantic" }); };
  const referencedDefinitions = new Set<string>();
  const enemyDefinitions = new Set<string>();
  const objectDefinitions = new Set<string>();
  const asset = (reference: unknown, path: string): Uint8Array | null => {
    if (typeof reference !== "string") return null;
    try { const resolved = resolveProjectReference(file, reference); const bytes = project.files.get(resolved); if (!bytes) add(path, `Asset not found: ${resolved}`); return bytes ?? null; }
    catch (error: unknown) { add(path, error instanceof Error ? error.message : String(error)); return null; }
  };

  const map = object(level.map);
  const width = Number(map.width);
  const height = Number(map.height);
  const tileWidth = Number(map.tileWidth); const tileHeight = Number(map.tileHeight);
  const layers = object(map.layers);
  if (Number.isInteger(width) && Number.isInteger(height)) {
    for (const name of ["tiles", "frontTiles", "collisions"]) {
      const layer = layers[name];
      if (Array.isArray(layer) && layer.length !== width * height) {
        add(`/map/layers/${name}`, `The layer contains ${layer.length} cells; ${width * height} were expected`);
      }
      if (Array.isArray(layer)) { const tileCount = Number(object(map.tileset).tileCount); layer.forEach((gid, index) => { const valid = name === "collisions" ? gid === 0 || (Number.isInteger(gid) && gid >= tileCount + 1 && gid <= tileCount + 4) : Number.isInteger(gid) && gid >= 0 && gid <= tileCount; if (!valid) add(`/map/layers/${name}/${index}`, `GID outside the allowed range: ${String(gid)}`); }); }
    }
  }

  const ids = new Map<string, Set<number>>();
  for (const [group, rawEntities] of Object.entries(entities)) {
    if (!Array.isArray(rawEntities)) continue;
    const groupIds = new Set<number>();
    ids.set(group, groupIds);
    rawEntities.forEach((rawEntity, index) => {
      const id = object(rawEntity).id;
      if (typeof id === "number") {
        if (groupIds.has(id)) add(`/entities/${group}/${index}/id`, `Duplicate ID in ${group}: ${id}`);
        groupIds.add(id);
      }
      const attrs = object(object(rawEntity).attributes);
      const definition = object(rawEntity).definition ?? attrs.definition;
      if (typeof definition === "string" && !(definition in definitions)) {
        add(`/entities/${group}/${index}`, `Definition not found: ${definition}`);
      }
      if (typeof definition === "string") referencedDefinitions.add(definition);
      if (typeof definition === "string" && group === "enemies") enemyDefinitions.add(definition);
      if (typeof definition === "string" && ["platforms", "items", "backgroundObjects", "blocks", "hazards", "lasers"].includes(group)) objectDefinitions.add(definition);
    });
  }

  for (const [definitionId, rawDefinition] of Object.entries(definitions)) {
    const definition = object(rawDefinition); const states = definition.states; if (!Array.isArray(states)) continue;
    const stateIds = new Set<number>(); const stateNames = new Set<string>();
    states.forEach((rawState, stateIndex) => { const state = object(rawState); if (typeof state.id === "number") { if (stateIds.has(state.id)) add(`/definitions/${definitionId}/states/${stateIndex}/id`, `Duplicate state ID: ${state.id}`); stateIds.add(state.id); } if (typeof state.name === "string") { if (stateNames.has(state.name)) add(`/definitions/${definitionId}/states/${stateIndex}/name`, `Duplicate state name: ${state.name}`); stateNames.add(state.name); }
      const animation = object(state.animation); const bitmap = asset(animation.bitmap, `/definitions/${definitionId}/states/${stateIndex}/animation/bitmap`); const dimensions = bitmap && pngDimensions(bitmap); const sprites = animation.sprites;
      if (dimensions && Array.isArray(sprites)) sprites.forEach((rawSprite, spriteIndex) => { const sprite = object(rawSprite); if (Number(sprite.x) + Number(sprite.width) > dimensions.width || Number(sprite.y) + Number(sprite.height) > dimensions.height) add(`/definitions/${definitionId}/states/${stateIndex}/animation/sprites/${spriteIndex}`, `The frame exceeds the ${dimensions.width}×${dimensions.height} bitmap`); });
    });
  }
  const tileset = object(map.tileset); const tilesetBytes = asset(tileset.image, "/map/tileset/image"); const tilesetDimensions = tilesetBytes && pngDimensions(tilesetBytes); if (tilesetDimensions && (tilesetDimensions.width !== tileset.imageWidth || tilesetDimensions.height !== tileset.imageHeight)) add("/map/tileset", `Declared dimensions ${String(tileset.imageWidth)}×${String(tileset.imageHeight)}; actual bitmap ${tilesetDimensions.width}×${tilesetDimensions.height}`);
  const audio = object(level.audio); if (Array.isArray(audio.music)) { audio.music.forEach((reference, index) => asset(reference, `/audio/music/${index}`)); if (Number(audio.initialMusic) < 0 || Number(audio.initialMusic) >= audio.music.length) add("/audio/initialMusic", "The initial music index does not exist"); const followUp = object(audio.playback).followUpMusic; if (followUp !== null && followUp !== undefined && (!Number.isInteger(followUp) || Number(followUp) < 0 || Number(followUp) >= audio.music.length)) add("/audio/playback/followUpMusic", "The follow-up music index does not exist"); } if (Array.isArray(audio.effects)) audio.effects.forEach((reference, index) => asset(reference, `/audio/effects/${index}`));
  const worldWidth = width * tileWidth; const worldHeight = height * tileHeight;
  if (Number.isFinite(worldWidth) && Number.isFinite(worldHeight)) for (const [group, rawEntities] of Object.entries(entities)) if (Array.isArray(rawEntities)) rawEntities.forEach((raw, index) => { const entity = object(raw); const attrs = object(entity.attributes); let x = Number(attrs.ini_x ?? attrs.x ?? entity.x ?? entity.chk_x ?? entity.left_up_x); let y = Number(attrs.ini_y ?? attrs.y ?? entity.y ?? entity.chk_y ?? entity.left_up_y); let w = Number(attrs.width ?? entity.bb_width ?? entity.chk_width ?? (Number(entity.right_down_x) - x)); let h = Number(attrs.height ?? entity.bb_height ?? entity.chk_height ?? (Number(entity.right_down_y) - y)); if (![x, y, w, h].every(Number.isFinite)) return; if (w <= 0 || h <= 0) add(`/entities/${group}/${index}`, "Geometry must have a positive area"); else if (x < 0 || y < 0 || x + w > worldWidth || y + h > worldHeight) add(`/entities/${group}/${index}`, "The entity extends beyond the map boundaries"); });

  const playerDefinition = object(level.player).definition;
  if (typeof playerDefinition === "string" && !(playerDefinition in definitions)) {
    add("/player/definition", `Definition not found: ${playerDefinition}`);
  }
  if (typeof playerDefinition === "string") referencedDefinitions.add(playerDefinition);
  const definitionStateNames = (definitionId: string): Set<string> => new Set(
    Array.isArray(object(definitions[definitionId]).states)
      ? (object(definitions[definitionId]).states as unknown[]).map((state) => object(state).name).filter((name): name is string => typeof name === "string")
      : [],
  );
  const profile = object(level.runtimeProfile); const bindings = object(profile.bindings);
  const controller = object(profile.controller);
  if ([controller.spriteWidth, controller.collisionWidth, controller.collisionOffsetX].every((part) => typeof part === "number") && Number(controller.collisionOffsetX) + Number(controller.collisionWidth) > Number(controller.spriteWidth)) add("/runtimeProfile/controller", "The player's horizontal bounding box exceeds its visual width");
  const playerStates = object(bindings.playerStates);
  if (typeof playerDefinition === "string") {
    const available = definitionStateNames(playerDefinition);
    for (const [semantic, stateName] of Object.entries(playerStates)) if (typeof stateName === "string" && !available.has(stateName)) add(`/runtimeProfile/bindings/playerStates/${semantic}`, `The player definition does not contain state ${stateName}`);
  }
  const validateFamilyStates = (family: "enemyStates" | "objectStates", definitionIds: ReadonlySet<string>): void => {
    for (const [semantic, stateName] of Object.entries(object(bindings[family]))) {
      if (typeof stateName !== "string") continue;
      if (![...definitionIds].some((definitionId) => definitionStateNames(definitionId).has(stateName))) add(`/runtimeProfile/bindings/${family}/${semantic}`, `None of the definitions in use contain state ${stateName}`);
    }
  };
  for (const rawProjectile of Object.values(object(level.projectiles))) { const definition = object(rawProjectile).definition; if (typeof definition === "string") objectDefinitions.add(definition); }
  validateFamilyStates("enemyStates", enemyDefinitions);
  validateFamilyStates("objectStates", objectDefinitions);
  const effects = Array.isArray(object(level.audio).effects) ? object(level.audio).effects as unknown[] : [];
  const validateAudioSlots = (slots: Record<string, unknown>, basePath: string): void => { for (const [name, slot] of Object.entries(slots)) if (slot !== null && slot !== undefined && Number.isInteger(slot) && Number(slot) >= effects.length) add(`${basePath}/${name}`, `Slot ${String(slot)} does not exist in audio.effects`); };
  validateAudioSlots(object(bindings.audio), "/runtimeProfile/bindings/audio");
  validateAudioSlots({ deathAudioSlot: object(profile.session).deathAudioSlot }, "/runtimeProfile/session");
  const capabilities = object(profile.capabilities); const actions = object(profile.actionBindings);
  for (const [chord, action] of Object.entries(actions)) if (typeof action === "string" && capabilities[action === "shooting" ? "shoot" : action === "bombing" ? "bomb" : "hit"] === false) warn(`/runtimeProfile/actionBindings/${chord}`, `Action ${action} is bound but its capability is disabled`);
  for (const [name, rawProjectile] of Object.entries(object(level.projectiles))) {
    const definition = object(rawProjectile).definition;
    if (typeof definition === "string" && !(definition in definitions)) {
      add(`/projectiles/${name}/definition`, `Definition not found: ${definition}`);
    }
    if (typeof definition === "string") { referencedDefinitions.add(definition); objectDefinitions.add(definition); }
  }
  const objective = object(level.objective);
  if (objective.type === "reachZone" && [objective.x, objective.y, objective.width, objective.height].every((part) => typeof part === "number")) {
    if (Number(objective.x) < 0 || Number(objective.y) < 0 || Number(objective.x) + Number(objective.width) > worldWidth || Number(objective.y) + Number(objective.height) > worldHeight) add("/objective", "The objective zone extends beyond the map boundaries");
  }
  for (const id of Object.keys(definitions)) if (!referencedDefinitions.has(id)) warn(`/definitions/${id}`, "Definition is not used by the level");

  const checkpointIds = ids.get("checkpoints") ?? new Set<number>();
  const checkpoints = entities.checkpoints;
  if (Array.isArray(checkpoints)) checkpoints.forEach((rawCheckpoint, index) => {
    const next = object(rawCheckpoint).nxt_chks;
    if (Array.isArray(next)) next.forEach((id, nextIndex) => {
      if (typeof id === "number" && !checkpointIds.has(id)) {
        add(`/entities/checkpoints/${index}/nxt_chks/${nextIndex}`, `Checkpoint not found: ${id}`);
      }
    });
  });
  if (Array.isArray(checkpoints)) {
    const graph = new Map<number, number[]>();
    checkpoints.forEach((raw) => { const checkpoint = object(raw); if (typeof checkpoint.id === "number") graph.set(checkpoint.id, Array.isArray(checkpoint.nxt_chks) ? checkpoint.nxt_chks.filter((id): id is number => typeof id === "number") : []); });
    const visiting = new Set<number>(); const visited = new Set<number>();
    const visit = (id: number): boolean => { if (visiting.has(id)) return true; if (visited.has(id)) return false; visiting.add(id); const cyclic = (graph.get(id) ?? []).some(visit); visiting.delete(id); visited.add(id); return cyclic; };
    for (const id of graph.keys()) if (visit(id)) { add("/entities/checkpoints", "Checkpoint relationships contain a cycle"); break; }
  }

  const targetGroups: Record<string, string> = {
    platform: "platforms", laser: "lasers", hazard: "hazards",
  };
  const triggers = entities.triggers;
  if (Array.isArray(triggers)) triggers.forEach((rawTrigger, triggerIndex) => {
    const rawTargets = object(object(rawTrigger).targets).target;
    const targets = Array.isArray(rawTargets) ? rawTargets : [rawTargets];
    targets.forEach((rawTarget, targetIndex) => {
      const target = object(rawTarget);
      const group = typeof target.type === "string" ? targetGroups[target.type] : undefined;
      if (group && typeof target.id === "number" && !ids.get(group)?.has(target.id)) {
        add(`/entities/triggers/${triggerIndex}/targets/${targetIndex}`, `${target.type} not found: ${target.id}`);
      }
    });
  });
  return diagnostics;
}

export function validateProject(project: Rick2Project): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!validateManifest(project.manifest)) {
    diagnostics.push(...schemaDiagnostics("project.json", validateManifest.errors));
  }
  for (const path of project.manifest.levels) {
    let level: unknown;
    try { level = parseLevel(project, path); }
    catch (error: unknown) {
      diagnostics.push({
        severity: "error", file: path, path: "/",
        message: error instanceof Error ? error.message : String(error), source: "schema",
      });
      continue;
    }
    if (!validateLevel(level)) {
      diagnostics.push(...schemaDiagnostics(path, validateLevel.errors));
    } else {
      diagnostics.push(...semanticLevelDiagnostics(project, path, level));
    }
  }
  return diagnostics;
}

export function hasValidationErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
