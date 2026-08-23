import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import levelSchema from "../../schema/level.schema.json";
import projectSchema from "../../schema/project.schema.json";
import type { Rick2Project } from "./project-io";

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
    message: error.message ?? "Valor no válido",
    source: "schema",
  }));
}

function parseLevel(project: Rick2Project, path: string): unknown {
  const bytes = project.files.get(path);
  if (!bytes) throw new Error(`Falta el nivel declarado: ${path}`);
  return JSON.parse(decoder.decode(bytes)) as unknown;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : {};
}

function semanticLevelDiagnostics(file: string, value: unknown): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const level = object(value);
  const entities = object(level.entities);
  const definitions = object(level.definitions);
  const add = (path: string, message: string): void => {
    diagnostics.push({ severity: "error", file, path, message, source: "semantic" });
  };

  const map = object(level.map);
  const width = Number(map.width);
  const height = Number(map.height);
  const layers = object(map.layers);
  if (Number.isInteger(width) && Number.isInteger(height)) {
    for (const name of ["tiles", "frontTiles", "collisions"]) {
      const layer = layers[name];
      if (Array.isArray(layer) && layer.length !== width * height) {
        add(`/map/layers/${name}`, `La capa contiene ${layer.length} celdas; se esperaban ${width * height}`);
      }
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
        if (groupIds.has(id)) add(`/entities/${group}/${index}/id`, `ID duplicado en ${group}: ${id}`);
        groupIds.add(id);
      }
      const attrs = object(object(rawEntity).attributes);
      const definition = object(rawEntity).definition ?? attrs.definition;
      if (typeof definition === "string" && !(definition in definitions)) {
        add(`/entities/${group}/${index}`, `Definición inexistente: ${definition}`);
      }
    });
  }

  const playerDefinition = object(level.player).definition;
  if (typeof playerDefinition === "string" && !(playerDefinition in definitions)) {
    add("/player/definition", `Definición inexistente: ${playerDefinition}`);
  }
  for (const [name, rawProjectile] of Object.entries(object(level.projectiles))) {
    const definition = object(rawProjectile).definition;
    if (typeof definition === "string" && !(definition in definitions)) {
      add(`/projectiles/${name}/definition`, `Definición inexistente: ${definition}`);
    }
  }

  const checkpointIds = ids.get("checkpoints") ?? new Set<number>();
  const checkpoints = entities.checkpoints;
  if (Array.isArray(checkpoints)) checkpoints.forEach((rawCheckpoint, index) => {
    const next = object(rawCheckpoint).nxt_chks;
    if (Array.isArray(next)) next.forEach((id, nextIndex) => {
      if (typeof id === "number" && !checkpointIds.has(id)) {
        add(`/entities/checkpoints/${index}/nxt_chks/${nextIndex}`, `Checkpoint inexistente: ${id}`);
      }
    });
  });

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
        add(`/entities/triggers/${triggerIndex}/targets/${targetIndex}`, `${target.type} inexistente: ${target.id}`);
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
      diagnostics.push(...semanticLevelDiagnostics(path, level));
    }
  }
  return diagnostics;
}

export function hasValidationErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
