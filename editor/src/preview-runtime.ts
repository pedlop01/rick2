import type { EditableLevel } from "./level-document";
import { WebPlayer, type PlayerInput, type PlayerPlatform, type PlayerSnapshot } from "./web-player";

export interface RuntimeBody { key: string; x: number; y: number; width: number; height: number; frame: number; }
interface LaserMotion { startX: number; startY: number; dx: number; dy: number; defaultActive: boolean; }
interface MovingBody extends RuntimeBody { actions: Array<Record<string, unknown>>; action: number; progress: number; wait: number; recursive: boolean; visible: boolean; active: boolean; lethal: boolean; condActions: boolean; laser?: LaserMotion; }
interface RuntimeTarget { key: string; delay: number; trigger: boolean; triggerCond: boolean; completed: boolean; }
interface RuntimeTrigger { x: number; y: number; width: number; height: number; action: string; face: string; recursive: boolean; wasIn: boolean; alreadyTriggered: boolean; firing: boolean; steps: number; previousAction: boolean; targets: RuntimeTarget[]; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function number(value: unknown, fallback = 0): number { return typeof value === "number" ? value : fallback; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : value === undefined ? [] : [value]; }

const NO_INPUT: PlayerInput = { left: false, right: false, up: false, down: false, action: false };
export class PreviewRuntime {
  readonly #source: EditableLevel; readonly #player: WebPlayer; #tick = 0; #bodies: MovingBody[] = []; #triggers: RuntimeTrigger[] = []; #invulnerable = false; #dangerContact = false;
  constructor(level: EditableLevel) { this.#source = structuredClone(level); this.#player = new WebPlayer(this.#source); this.reset(); }
  get tick(): number { return this.#tick; }
  get player(): PlayerSnapshot { return this.#player.snapshot; }
  get invulnerable(): boolean { return this.#invulnerable; }
  get dangerContact(): boolean { return this.#dangerContact; }
  setInvulnerable(enabled: boolean): void { this.#invulnerable = enabled; }
  placePlayerAt(worldX: number, worldY: number): void { this.#player.placeAtFeet(worldX, worldY); this.#dangerContact = false; }
  get bodies(): readonly RuntimeBody[] { const player = this.#player.snapshot; return [...this.#bodies.filter((body) => body.visible), { key: "player", x: player.x, y: player.y, width: 23, height: 21, frame: this.#tick }]; }
  reset(): void {
    this.#tick = 0; this.#player.reset(); this.#dangerContact = false; this.#bodies = []; this.#triggers = []; const entities = record(this.#source.entities);
    for (const group of ["platforms", "hazards"]) for (const raw of list(entities[group])) { const entity = record(raw); const attributes = record(entity.attributes); const actions = list(record(entity.actions).action).map(record); const active = group === "hazards" ? Boolean(attributes.trigger) : attributes.ini_state === undefined || attributes.ini_state === "moving"; this.#bodies.push({ key: `${group}:${String(entity.id)}`, x: number(attributes.ini_x), y: number(attributes.ini_y), width: number(attributes.width, 8), height: number(attributes.height, 8), frame: 0, actions, action: 0, progress: 0, wait: 0, recursive: group === "hazards" ? Boolean(attributes.trigger) : Boolean(attributes.recursive), visible: group === "platforms" ? attributes.visible !== 0 : active || !Boolean(attributes.stop_inactive), active, lethal: group === "hazards", condActions: false }); }
    for (const raw of list(entities.lasers)) {
      const laser = record(raw), startX = number(laser.x) + number(laser.bb_x), startY = number(laser.y) + number(laser.bb_y), speed = Math.max(0, number(laser.speed));
      const horizontal = laser.type === "vertical" ? 0 : laser.direction === "left" ? -speed : speed;
      const vertical = laser.type === "horizontal" ? 0 : speed;
      const defaultActive = Boolean(laser.default_trigger);
      this.#bodies.push({ key: `lasers:${String(laser.id)}`, x: startX, y: startY, width: number(laser.bb_width, 8), height: number(laser.bb_height, 8), frame: 0, actions: [], action: 0, progress: 0, wait: 0, recursive: Boolean(laser.recursive), visible: defaultActive, active: defaultActive, lethal: true, condActions: false, laser: { startX, startY, dx: horizontal, dy: vertical, defaultActive } });
    }
    for (const raw of list(entities.triggers)) { const trigger = record(raw), attributes = record(trigger.attributes); const targets = list(record(trigger.targets).target).map((rawTarget) => { const target = record(rawTarget); const group = target.type === "platform" ? "platforms" : target.type === "hazard" ? "hazards" : "lasers"; return { key: `${group}:${String(target.id)}`, delay: Math.max(0, number(target.delay)), trigger: Boolean(target.trigger), triggerCond: Boolean(target.trigger_cond), completed: false }; }); this.#triggers.push({ x: number(attributes.x), y: number(attributes.y), width: number(attributes.width, 8), height: number(attributes.height, 8), action: String(attributes.action ?? "enters"), face: String(attributes.face ?? "any"), recursive: Boolean(attributes.recursive), wasIn: false, alreadyTriggered: false, firing: false, steps: 0, previousAction: false, targets }); }
  }
  step(input: PlayerInput = NO_INPUT): void {
    this.#tick += 1;
    const previous = new Map(this.#bodies.map((body) => [body.key, { x: body.x, y: body.y }]));
    for (const body of this.#bodies) this.#stepBody(body);
    const platforms: PlayerPlatform[] = this.#bodies.filter((body) => body.key.startsWith("platforms:")).map((body) => { const old = previous.get(body.key)!; return { key: body.key, x: body.x, y: body.y, width: body.width, height: body.height, dx: body.x - old.x, dy: body.y - old.y }; });
    this.#player.step(input, platforms);
    this.#stepTriggers(input);
    const player = this.#player.snapshot, left = player.x + 5, right = left + 13, top = player.y, bottom = top + 21;
    this.#dangerContact = player.state !== "dead" && this.#bodies.some((body) => body.visible && body.lethal && left < body.x + body.width && right > body.x && top < body.y + body.height && bottom > body.y);
    if (this.#dangerContact && !this.#invulnerable) { this.#player.kill(); this.#resetTriggersAndLasers(); }
  }
  #stepBody(body: MovingBody): void {
    if (!body.active) return;
    if (body.laser) { this.#stepLaser(body); return; }
    while (body.action < body.actions.length) { const condition = number(body.actions[body.action]?.cond); if (condition === 0 || (condition === 1 && body.condActions) || (condition === 2 && !body.condActions)) break; body.action += 1; body.progress = 0; body.wait = 0; }
    const action = body.actions[body.action]; if (!action) return; if (body.wait > 0) { body.wait -= 1; return; }
    const distance = Math.max(0, number(action.desp)); const speed = Math.max(0, number(action.speed)); const remaining = Math.max(0, distance - body.progress); const movement = Math.min(speed, remaining); const direction = action.direction;
    if (body.key.startsWith("hazards:")) body.visible = direction !== "deactivate";
    if (direction === "left") body.x -= movement; if (direction === "right") body.x += movement; if (direction === "up") body.y -= movement; if (direction === "down") body.y += movement; body.progress += movement;
    if (direction === "stop" || direction === "deactivate" || body.progress >= distance) { body.wait = Math.max(0, number(action.wait)); body.progress = 0; body.action += 1; if (body.action >= body.actions.length) { body.action = body.recursive ? 0 : body.actions.length; if (!body.recursive) body.active = false; } }
    body.frame = this.#tick;
  }
  #stepLaser(body: MovingBody): void {
    const laser = body.laser!;
    if (!body.visible) { if (body.wait > 0) { body.wait -= 1; return; } if (!laser.defaultActive) return; body.x = laser.startX; body.y = laser.startY; body.visible = true; }
    const nextX = body.x + laser.dx, nextY = body.y + laser.dy;
    if (this.#mapCollision(nextX, nextY, body.width, body.height)) { body.visible = false; body.active = laser.defaultActive; body.wait = 1; body.x = laser.startX; body.y = laser.startY; return; }
    body.x = nextX; body.y = nextY; body.frame = this.#tick;
  }
  #mapCollision(x: number, y: number, width: number, height: number): boolean {
    const map = this.#source.map;
    const points: Array<readonly [number, number]> = [[x, y], [x + width - 1, y], [x, y + height - 1], [x + width - 1, y + height - 1]];
    for (const [px, py] of points) {
      const tx = Math.floor(px / map.tileWidth), ty = Math.floor(py / map.tileHeight);
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || (map.layers.collisions[ty * map.width + tx] ?? 0) !== 0) return true;
    }
    return false;
  }
  #stepTriggers(input: PlayerInput): void {
    const player = this.#player.snapshot, playerLeft = player.x, playerRight = player.x + 23, playerTop = player.y, playerBottom = player.y + 21;
    for (const trigger of this.#triggers) {
      if (trigger.firing) {
        for (const target of trigger.targets) if (!target.completed && trigger.steps >= target.delay) { this.#setTarget(target); target.completed = true; }
        if (trigger.targets.every((target) => target.completed)) { trigger.alreadyTriggered = true; trigger.firing = false; trigger.steps = 0; for (const target of trigger.targets) target.completed = false; }
        else trigger.steps += 1;
        trigger.previousAction = input.action; continue;
      }
      if (trigger.recursive && trigger.alreadyTriggered) { trigger.firing = true; trigger.steps = 0; trigger.previousAction = input.action; continue; }
      const inside = playerLeft < trigger.x + trigger.width && playerRight > trigger.x && playerTop < trigger.y + trigger.height && playerBottom > trigger.y;
      const enters = inside && !trigger.wasIn, stays = inside && trigger.wasIn, exits = !inside && trigger.wasIn;
      const event = trigger.action === "enters" ? enters : trigger.action === "stays" ? stays : trigger.action === "exits" ? exits : trigger.action === "hits" ? stays && input.action && !trigger.previousAction : false;
      const face = trigger.face === "any" || trigger.face === player.face;
      trigger.wasIn = inside; trigger.previousAction = input.action;
      if (event && face) { trigger.firing = true; trigger.steps = 0; }
    }
  }
  #setTarget(target: RuntimeTarget): void {
    const body = this.#bodies.find((candidate) => candidate.key === target.key); if (!body) return;
    body.condActions = target.triggerCond && !body.condActions;
    if (!target.trigger) { body.active = false; if (body.laser) body.visible = false; return; }
    if (body.active) return;
    body.active = true; body.action = 0; body.progress = 0; body.wait = 0;
    if (body.laser) { body.visible = true; body.x = body.laser.startX; body.y = body.laser.startY; }
    else if (body.key.startsWith("hazards:")) body.visible = true;
  }
  #resetTriggersAndLasers(): void {
    for (const trigger of this.#triggers) { trigger.wasIn = false; trigger.alreadyTriggered = false; trigger.firing = false; trigger.steps = 0; trigger.previousAction = false; for (const target of trigger.targets) target.completed = false; }
    for (const body of this.#bodies) if (body.laser) { body.x = body.laser.startX; body.y = body.laser.startY; body.active = body.laser.defaultActive; body.visible = body.laser.defaultActive; body.wait = 0; }
  }
}
