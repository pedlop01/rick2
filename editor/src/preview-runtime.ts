import type { EditableLevel } from "./level-document";

export interface RuntimeBody { key: string; x: number; y: number; width: number; height: number; frame: number; }
interface MovingBody extends RuntimeBody { actions: Array<Record<string, unknown>>; action: number; progress: number; wait: number; recursive: boolean; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function number(value: unknown, fallback = 0): number { return typeof value === "number" ? value : fallback; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : value === undefined ? [] : [value]; }

export class PreviewRuntime {
  readonly #source: EditableLevel; #tick = 0; #bodies: MovingBody[] = [];
  constructor(level: EditableLevel) { this.#source = structuredClone(level); this.reset(); }
  get tick(): number { return this.#tick; }
  get bodies(): readonly RuntimeBody[] { return this.#bodies; }
  reset(): void {
    this.#tick = 0; this.#bodies = []; const entities = record(this.#source.entities);
    for (const group of ["platforms", "hazards"]) for (const raw of list(entities[group])) { const entity = record(raw); const attributes = record(entity.attributes); const actions = list(record(entity.actions).action).map(record); this.#bodies.push({ key: `${group}:${String(entity.id)}`, x: number(attributes.ini_x), y: number(attributes.ini_y), width: number(attributes.width, 8), height: number(attributes.height, 8), frame: 0, actions, action: 0, progress: 0, wait: 0, recursive: Boolean(attributes.recursive) }); }
  }
  step(): void { this.#tick += 1; for (const body of this.#bodies) this.#stepBody(body); }
  #stepBody(body: MovingBody): void {
    const action = body.actions[body.action]; if (!action) return; if (body.wait > 0) { body.wait -= 1; return; }
    const distance = Math.max(0, number(action.desp)); const speed = Math.max(0, number(action.speed)); const remaining = Math.max(0, distance - body.progress); const movement = Math.min(speed, remaining); const direction = action.direction;
    if (direction === "left") body.x -= movement; if (direction === "right") body.x += movement; if (direction === "up") body.y -= movement; if (direction === "down") body.y += movement; body.progress += movement;
    if (direction === "stop" || direction === "deactivate" || body.progress >= distance) { body.wait = Math.max(0, number(action.wait)); body.progress = 0; body.action += 1; if (body.action >= body.actions.length) body.action = body.recursive ? 0 : body.actions.length; }
    body.frame = this.#tick;
  }
}
