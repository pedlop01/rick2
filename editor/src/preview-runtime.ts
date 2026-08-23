import type { EditableLevel } from "./level-document";
import { WebPlayer, type PlayerInput, type PlayerPlatform, type PlayerSnapshot } from "./web-player";

export interface RuntimeBody { key: string; x: number; y: number; width: number; height: number; frame: number; }
interface MovingBody extends RuntimeBody { actions: Array<Record<string, unknown>>; action: number; progress: number; wait: number; recursive: boolean; visible: boolean; lethal: boolean; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function number(value: unknown, fallback = 0): number { return typeof value === "number" ? value : fallback; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : value === undefined ? [] : [value]; }

const NO_INPUT: PlayerInput = { left: false, right: false, up: false, down: false, action: false };
export class PreviewRuntime {
  readonly #source: EditableLevel; readonly #player: WebPlayer; #tick = 0; #bodies: MovingBody[] = []; #invulnerable = false; #dangerContact = false;
  constructor(level: EditableLevel) { this.#source = structuredClone(level); this.#player = new WebPlayer(this.#source); this.reset(); }
  get tick(): number { return this.#tick; }
  get player(): PlayerSnapshot { return this.#player.snapshot; }
  get invulnerable(): boolean { return this.#invulnerable; }
  get dangerContact(): boolean { return this.#dangerContact; }
  setInvulnerable(enabled: boolean): void { this.#invulnerable = enabled; }
  get bodies(): readonly RuntimeBody[] { const player = this.#player.snapshot; return [...this.#bodies.filter((body) => body.visible), { key: "player", x: player.x, y: player.y, width: 23, height: 21, frame: this.#tick }]; }
  reset(): void {
    this.#tick = 0; this.#player.reset(); this.#dangerContact = false; this.#bodies = []; const entities = record(this.#source.entities);
    for (const group of ["platforms", "hazards"]) for (const raw of list(entities[group])) { const entity = record(raw); const attributes = record(entity.attributes); const actions = list(record(entity.actions).action).map(record); this.#bodies.push({ key: `${group}:${String(entity.id)}`, x: number(attributes.ini_x), y: number(attributes.ini_y), width: number(attributes.width, 8), height: number(attributes.height, 8), frame: 0, actions, action: 0, progress: 0, wait: 0, recursive: group === "hazards" ? Boolean(attributes.trigger) : Boolean(attributes.recursive), visible: true, lethal: group === "hazards" }); }
    for (const raw of list(entities.lasers)) { const laser = record(raw); this.#bodies.push({ key: `lasers:${String(laser.id)}`, x: number(laser.x) + number(laser.bb_x), y: number(laser.y) + number(laser.bb_y), width: number(laser.bb_width, 8), height: number(laser.bb_height, 8), frame: 0, actions: [], action: 0, progress: 0, wait: 0, recursive: Boolean(laser.recursive), visible: Boolean(laser.default_trigger), lethal: true }); }
  }
  step(input: PlayerInput = NO_INPUT): void {
    this.#tick += 1;
    const previous = new Map(this.#bodies.map((body) => [body.key, { x: body.x, y: body.y }]));
    for (const body of this.#bodies) this.#stepBody(body);
    const platforms: PlayerPlatform[] = this.#bodies.filter((body) => body.key.startsWith("platforms:")).map((body) => { const old = previous.get(body.key)!; return { key: body.key, x: body.x, y: body.y, width: body.width, height: body.height, dx: body.x - old.x, dy: body.y - old.y }; });
    this.#player.step(input, platforms);
    const player = this.#player.snapshot, left = player.x + 5, right = left + 13, top = player.y, bottom = top + 21;
    this.#dangerContact = player.state !== "dead" && this.#bodies.some((body) => body.visible && body.lethal && left < body.x + body.width && right > body.x && top < body.y + body.height && bottom > body.y);
    if (this.#dangerContact && !this.#invulnerable) this.#player.kill();
  }
  #stepBody(body: MovingBody): void {
    const action = body.actions[body.action]; if (!action) return; if (body.wait > 0) { body.wait -= 1; return; }
    const distance = Math.max(0, number(action.desp)); const speed = Math.max(0, number(action.speed)); const remaining = Math.max(0, distance - body.progress); const movement = Math.min(speed, remaining); const direction = action.direction;
    if (body.key.startsWith("hazards:")) body.visible = direction !== "deactivate";
    if (direction === "left") body.x -= movement; if (direction === "right") body.x += movement; if (direction === "up") body.y -= movement; if (direction === "down") body.y += movement; body.progress += movement;
    if (direction === "stop" || direction === "deactivate" || body.progress >= distance) { body.wait = Math.max(0, number(action.wait)); body.progress = 0; body.action += 1; if (body.action >= body.actions.length) body.action = body.recursive ? 0 : body.actions.length; }
    body.frame = this.#tick;
  }
}
