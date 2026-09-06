import { strFromU8, strToU8 } from "fflate";
import type { Rick2Project } from "./project-io";

const LEVEL_ID = /^[a-z0-9][a-z0-9._-]*$/;

function pathFor(id: string): string { return `levels/${id}/level.json`; }

function checkedId(id: string): string {
  const value = id.trim();
  if (!LEVEL_ID.test(value)) throw new Error("Level IDs use lowercase letters, numbers, dots, underscores, and hyphens");
  return value;
}

function levelAt(project: Rick2Project, path: string): Record<string, unknown> {
  const bytes = project.files.get(path);
  if (!bytes) throw new Error(`Declared level is missing: ${path}`);
  return JSON.parse(strFromU8(bytes)) as Record<string, unknown>;
}

function writeJson(project: Rick2Project, path: string, value: unknown): void {
  project.files.set(path, strToU8(`${JSON.stringify(value, null, 2)}\n`));
}

function syncManifest(project: Rick2Project): void {
  writeJson(project, "project.json", project.manifest);
  const game = levelAt(project, "game.json");
  game.initialLevel = project.manifest.initialLevel;
  writeJson(project, "game.json", game);
}

export function levelId(project: Rick2Project, path: string): string {
  const value = levelAt(project, path).id;
  return typeof value === "string" && value ? value : path.split("/").at(-2) ?? path;
}

export function duplicateLevel(project: Rick2Project, sourcePath: string, newId: string): string {
  const id = checkedId(newId), target = pathFor(id);
  if (!project.manifest.levels.includes(sourcePath)) throw new Error(`Level is not declared: ${sourcePath}`);
  if (project.files.has(target)) throw new Error(`A level named ${id} already exists`);
  const level = structuredClone(levelAt(project, sourcePath));
  level.id = id;
  writeJson(project, target, level);
  const sourceIndex = project.manifest.levels.indexOf(sourcePath);
  project.manifest.levels.splice(sourceIndex + 1, 0, target);
  syncManifest(project);
  return target;
}

export function createLevel(project: Rick2Project, newId: string): string {
  const target = duplicateLevel(project, project.manifest.initialLevel, newId);
  const level = levelAt(project, target);
  const map = level.map as { width?: number; height?: number; layers?: Record<string, unknown> } | undefined;
  const cellCount = Math.max(0, Number(map?.width ?? 0) * Number(map?.height ?? 0));
  if (map?.layers) for (const key of ["tiles", "frontTiles", "collisions"]) map.layers[key] = Array(cellCount).fill(0);
  const entities = level.entities as Record<string, unknown> | undefined;
  if (entities) {
    for (const key of Object.keys(entities)) entities[key] = [];
    entities.checkpoints = [{
      id: 0, chk_x: 0, chk_y: 0, chk_width: 16, chk_height: 16,
      pl_x: 0, pl_y: 0, pl_face: "right", nxt_chks: [],
    }];
  }
  delete level.objective;
  writeJson(project, target, level);
  return target;
}

export function renameLevel(project: Rick2Project, sourcePath: string, newId: string): string {
  const id = checkedId(newId), target = pathFor(id), index = project.manifest.levels.indexOf(sourcePath);
  if (index < 0) throw new Error(`Level is not declared: ${sourcePath}`);
  if (target !== sourcePath && project.files.has(target)) throw new Error(`A level named ${id} already exists`);
  const level = levelAt(project, sourcePath);
  level.id = id;
  if (target !== sourcePath) project.files.delete(sourcePath);
  writeJson(project, target, level);
  project.manifest.levels[index] = target;
  if (project.manifest.initialLevel === sourcePath) project.manifest.initialLevel = target;
  if (project.manifest.campaign) {
    project.manifest.campaign.order = project.manifest.campaign.order.map((path) => path === sourcePath ? target : path);
    for (const rule of project.manifest.campaign.unlockRules) {
      if (rule.level === sourcePath) rule.level = target;
      rule.requiresCompleted = rule.requiresCompleted.map((path) => path === sourcePath ? target : path);
    }
  }
  syncManifest(project);
  return target;
}

export function removeLevel(project: Rick2Project, path: string): string {
  const index = project.manifest.levels.indexOf(path);
  if (index < 0) throw new Error(`Level is not declared: ${path}`);
  if (project.manifest.levels.length === 1) throw new Error("A project must contain at least one level");
  if (project.manifest.campaign?.order.includes(path)) throw new Error("Remove the level from the campaign before deleting it");
  project.manifest.levels.splice(index, 1);
  project.files.delete(path);
  if (project.manifest.initialLevel === path) project.manifest.initialLevel = project.manifest.levels[Math.min(index, project.manifest.levels.length - 1)]!;
  syncManifest(project);
  return project.manifest.initialLevel;
}

export function moveLevel(project: Rick2Project, path: string, offset: -1 | 1): boolean {
  const index = project.manifest.levels.indexOf(path), target = index + offset;
  if (index < 0 || target < 0 || target >= project.manifest.levels.length) return false;
  [project.manifest.levels[index], project.manifest.levels[target]] = [project.manifest.levels[target]!, project.manifest.levels[index]!];
  syncManifest(project);
  return true;
}

export function setInitialLevel(project: Rick2Project, path: string): void {
  if (!project.manifest.levels.includes(path)) throw new Error(`Level is not declared: ${path}`);
  if (project.manifest.campaign && project.manifest.campaign.order[0] !== path) {
    throw new Error("The initial level must be the first campaign level");
  }
  project.manifest.initialLevel = path;
  syncManifest(project);
}

export function resizeLevelMap(project: Rick2Project, path: string, width: number, height: number): void {
  if (!project.manifest.levels.includes(path)) throw new Error(`Level is not declared: ${path}`);
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new Error("Map width and height must be positive whole numbers");
  }
  const cellCount = width * height;
  if (!Number.isSafeInteger(cellCount) || cellCount > 10_000_000) throw new Error("The requested map is too large");
  const level = levelAt(project, path);
  const map = level.map as { width: number; height: number; layers: Record<string, number[]> };
  const oldWidth = map.width, oldHeight = map.height;
  for (const key of ["tiles", "frontTiles", "collisions"]) {
    const source = map.layers[key] ?? [], resized = Array<number>(cellCount).fill(0);
    for (let y = 0; y < Math.min(oldHeight, height); ++y) {
      for (let x = 0; x < Math.min(oldWidth, width); ++x) resized[y * width + x] = source[y * oldWidth + x] ?? 0;
    }
    map.layers[key] = resized;
  }
  map.width = width;
  map.height = height;
  writeJson(project, path, level);
}
