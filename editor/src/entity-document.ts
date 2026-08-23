import type { EditableLevel, LevelDocumentModel } from "./level-document";

export const ENTITY_GROUPS = ["platforms", "items", "backgroundObjects", "blocks", "hazards", "checkpoints", "lasers", "triggers", "enemies", "cameraViews"] as const;
export type EntityGroup = typeof ENTITY_GROUPS[number];
export type EntityRecord = Record<string, unknown>;
export interface EntityRef { group: EntityGroup; index: number; }
export interface EntityBox { x: number; y: number; width: number; height: number; }
export interface GameplayLine { x1: number; y1: number; x2: number; y2: number; kind: "checkpoint" | "target" | "route"; }
export interface GameplayZone { box: EntityBox; kind: "ai"; }
const placedGroups: readonly EntityGroup[] = ["platforms", "items", "backgroundObjects", "blocks", "hazards"];
function record(value: unknown): EntityRecord { return value && typeof value === "object" ? value as EntityRecord : {}; }
function finite(value: unknown, fallback = 0): number { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : value === undefined ? [] : [value]; }

export class EntityDocumentModel {
  readonly #levelModel: LevelDocumentModel;
  constructor(levelModel: LevelDocumentModel) { this.#levelModel = levelModel; }
  get level(): EditableLevel { return this.#levelModel.level; }
  get project() { return this.#levelModel.project; }
  get groups(): Record<EntityGroup, EntityRecord[]> { return this.level.entities as Record<EntityGroup, EntityRecord[]>; }
  flush(): void { this.#levelModel.flush(); }
  entity(ref: EntityRef): EntityRecord | null { return this.groups[ref.group]?.[ref.index] ?? null; }

  box(ref: EntityRef): EntityBox | null {
    const entity = this.entity(ref); if (!entity) return null;
    if (placedGroups.includes(ref.group)) { const a = record(entity.attributes); return { x: finite(a.ini_x), y: finite(a.ini_y), width: finite(a.width, 8), height: finite(a.height, 8) }; }
    if (ref.group === "triggers") { const a = record(entity.attributes); return { x: finite(a.x), y: finite(a.y), width: finite(a.width, 8), height: finite(a.height, 8) }; }
    if (ref.group === "checkpoints") return { x: finite(entity.chk_x), y: finite(entity.chk_y), width: finite(entity.chk_width, 8), height: finite(entity.chk_height, 8) };
    if (ref.group === "cameraViews") return { x: finite(entity.left_up_x), y: finite(entity.left_up_y), width: finite(entity.right_down_x) - finite(entity.left_up_x), height: finite(entity.right_down_y) - finite(entity.left_up_y) };
    return { x: finite(entity.x) + finite(entity.bb_x), y: finite(entity.y) + finite(entity.bb_y), width: finite(entity.bb_width, 8), height: finite(entity.bb_height, 8) };
  }

  all(): Array<{ ref: EntityRef; entity: EntityRecord; box: EntityBox }> {
    const result: Array<{ ref: EntityRef; entity: EntityRecord; box: EntityBox }> = [];
    for (const group of ENTITY_GROUPS) this.groups[group].forEach((entity, index) => { const ref = { group, index }; const box = this.box(ref); if (box) result.push({ ref, entity, box }); });
    return result;
  }

  gameplayGuides(): { lines: GameplayLine[]; zones: GameplayZone[] } {
    const lines: GameplayLine[] = []; const zones: GameplayZone[] = []; const centers = new Map<string, { x: number; y: number }>();
    for (const item of this.all()) centers.set(`${item.ref.group}:${String(item.entity.id)}`, { x: item.box.x + item.box.width / 2, y: item.box.y + item.box.height / 2 });
    for (const checkpoint of this.groups.checkpoints) { const from = centers.get(`checkpoints:${String(checkpoint.id)}`); if (!from) continue; for (const id of list(checkpoint.nxt_chks)) { const to = centers.get(`checkpoints:${String(id)}`); if (to) lines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, kind: "checkpoint" }); } }
    const targetGroup: Record<string, EntityGroup> = { platform: "platforms", laser: "lasers", hazard: "hazards" };
    for (const trigger of this.groups.triggers) { const from = centers.get(`triggers:${String(trigger.id)}`); if (!from) continue; for (const raw of list(record(trigger.targets).target)) { const target = record(raw); const group = targetGroup[String(target.type)]; const to = group && centers.get(`${group}:${String(target.id)}`); if (to) lines.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, kind: "target" }); } }
    for (const group of ["platforms", "hazards"] as const) for (const entity of this.groups[group]) { const start = centers.get(`${group}:${String(entity.id)}`); if (!start) continue; let x = start.x; let y = start.y; for (const raw of list(record(entity.actions).action)) { const action = record(raw); const distance = finite(action.desp); let nx = x; let ny = y; if (action.direction === "left") nx -= distance; if (action.direction === "right") nx += distance; if (action.direction === "up") ny -= distance; if (action.direction === "down") ny += distance; if (nx !== x || ny !== y) lines.push({ x1: x, y1: y, x2: nx, y2: ny, kind: "route" }); x = nx; y = ny; } }
    for (const enemy of this.groups.enemies) zones.push({ box: { x: finite(enemy.ia_orig_x), y: finite(enemy.ia_orig_y), width: finite(enemy.ia_limit_x), height: finite(enemy.ia_limit_y) }, kind: "ai" });
    return { lines, zones };
  }

  hitTest(x: number, y: number, group?: EntityGroup): EntityRef | null {
    const candidates = this.all();
    for (let index = candidates.length - 1; index >= 0; --index) { const item = candidates[index]!; if (group && item.ref.group !== group) continue; if (x >= item.box.x && y >= item.box.y && x < item.box.x + Math.max(1, item.box.width) && y < item.box.y + Math.max(1, item.box.height)) return item.ref; }
    return null;
  }

  move(ref: EntityRef, x: number, y: number): boolean {
    const entity = this.entity(ref); if (!entity || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const nx = Math.max(0, Math.round(x)); const ny = Math.max(0, Math.round(y));
    if (placedGroups.includes(ref.group)) { const a = record(entity.attributes); a.ini_x = nx; a.ini_y = ny; return true; }
    if (ref.group === "triggers") { const a = record(entity.attributes); a.x = nx; a.y = ny; return true; }
    if (ref.group === "checkpoints") { const dx = nx - finite(entity.chk_x); const dy = ny - finite(entity.chk_y); entity.chk_x = nx; entity.chk_y = ny; entity.pl_x = finite(entity.pl_x) + dx; entity.pl_y = finite(entity.pl_y) + dy; return true; }
    if (ref.group === "cameraViews") { const width = finite(entity.right_down_x) - finite(entity.left_up_x); const height = finite(entity.right_down_y) - finite(entity.left_up_y); entity.left_up_x = nx; entity.left_up_y = ny; entity.right_down_x = nx + width; entity.right_down_y = ny + height; return true; }
    if (ref.group === "enemies") { const dx = nx - finite(entity.x); const dy = ny - finite(entity.y); entity.x = nx; entity.y = ny; if (typeof entity.ia_orig_x === "number") entity.ia_orig_x += dx; if (typeof entity.ia_orig_y === "number") entity.ia_orig_y += dy; return true; }
    entity.x = nx; entity.y = ny; return true;
  }

  translate(ref: EntityRef, dx: number, dy: number): boolean {
    const entity = this.entity(ref); if (!entity) return false;
    if (ref.group === "lasers" || ref.group === "enemies") return this.move(ref, finite(entity.x) + dx, finite(entity.y) + dy);
    const box = this.box(ref); return box ? this.move(ref, box.x + dx, box.y + dy) : false;
  }

  duplicate(ref: EntityRef): EntityRef | null {
    const source = this.entity(ref); if (!source) return null;
    const clone = structuredClone(source); const ids = this.groups[ref.group].map((item) => finite(item.id, -1)); clone.id = Math.max(-1, ...ids) + 1;
    this.groups[ref.group].push(clone); const result = { group: ref.group, index: this.groups[ref.group].length - 1 }; this.translate(result, 8, 8); return result;
  }
  remove(ref: EntityRef): boolean { return Boolean(this.groups[ref.group].splice(ref.index, 1).length); }
  setPrimitive(ref: EntityRef, path: readonly string[], value: string | number): boolean {
    const entity = this.entity(ref); if (!entity || !path.length) return false; let target: Record<string, unknown> | unknown[] = entity;
    for (const key of path.slice(0, -1)) { const next = target[key as keyof typeof target]; if (!next || typeof next !== "object") return false; target = next as Record<string, unknown> | unknown[]; }
    const last = path.at(-1)!; if (Array.isArray(target)) target[Number(last)] = value; else target[last] = value; return true;
  }
}
