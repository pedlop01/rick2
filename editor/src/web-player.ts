import type { EditableLevel, TileMapDocument } from "./level-document";
import { CharacterForms, rickCharacterForms, type CharacterFormsDefinition } from "./character-forms";
import { groundActionForInput, type PlayerActionBindings, type PlayerCapabilities, type PlayerControllerConfig, type PlayerGroundAction } from "./platformer-core";

export interface PlayerInput { left: boolean; right: boolean; up: boolean; down: boolean; action: boolean; }
export interface PlayerPlatform { key: string; x: number; y: number; width: number; height: number; dx: number; dy: number; }
export interface PlayerObstacle { key: string; x: number; y: number; width: number; height: number; }
export type PlayerState = "stop" | "running" | "jumping" | "crouching" | "climbing" | "shooting" | "bombing" | "hitting" | "dead";
export interface PlayerSnapshot { x: number; y: number; state: PlayerState; face: "left" | "right"; verticalSpeed: number; collisionX: number; collisionY: number; collisionWidth: number; collisionHeight: number; }
interface Checkpoint { id: number; x: number; y: number; width: number; height: number; spawnX: number; spawnY: number; face: "left" | "right"; nextIds: number[]; }
type TileKind = "empty" | "solid" | "platform" | "stairs" | "stairsTop";
const finite = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;

export class WebPlayer {
  readonly #map: TileMapDocument; readonly #checkpoints: Checkpoint[]; readonly #forms: CharacterForms; #config: Readonly<PlayerControllerConfig>; #capabilities: Readonly<PlayerCapabilities>; #bindings: Readonly<PlayerActionBindings>;
  #spawn: { x: number; y: number; face: "left" | "right" }; #activeCheckpoint = -1;
  #x = 0; #y = 0; #face: "left" | "right" = "right";
  #height = 0; #vy = 0; #ascending = false; #jumpOrigin = 0; #deadTicks = 0; #deathOriginY = 0;
  constructor(level: EditableLevel, config: Partial<PlayerControllerConfig> = {}, capabilities: Partial<PlayerCapabilities> = {}, bindings: Partial<PlayerActionBindings> = {}, forms?: CharacterFormsDefinition) {
    this.#map = level.map;
    this.#forms = new CharacterForms(forms ?? rickCharacterForms(config, capabilities, bindings)); const form = this.#forms.active;
    this.#config = form.controller;
    this.#capabilities = form.capabilities;
    this.#bindings = form.actionBindings;
    const raw = (level.entities as { checkpoints?: Array<Record<string, unknown>> }).checkpoints ?? [];
    this.#checkpoints = raw.map((checkpoint, index) => ({ id: finite(checkpoint.id, index), x: finite(checkpoint.chk_x), y: finite(checkpoint.chk_y), width: finite(checkpoint.chk_width, 8), height: finite(checkpoint.chk_height, 8), spawnX: finite(checkpoint.pl_x), spawnY: finite(checkpoint.pl_y), face: checkpoint.pl_face === "left" ? "left" : "right", nextIds: Array.isArray(checkpoint.nxt_chks) ? checkpoint.nxt_chks.map((id) => finite(id, Number.NaN)).filter(Number.isFinite) : [] }));
    const first = this.#checkpoints[0] ?? { spawnX: 0, spawnY: 0, face: "right" as const };
    this.#spawn = { x: first.spawnX, y: first.spawnY, face: first.face }; this.#activeCheckpoint = this.#checkpoints.length ? this.#checkpoints[0]!.id : -1; this.reset();
  }
  get snapshot(): PlayerSnapshot { const config = this.#config; return { x: this.#x, y: this.#y, state: this.#state, face: this.#face, verticalSpeed: this.#vy, collisionX: this.#x + config.collisionOffsetX, collisionY: this.#y, collisionWidth: config.collisionWidth, collisionHeight: this.#height }; }
  get activeForm(): string { return this.#forms.active.id; }
  get activeDefinition(): string | undefined { return this.#forms.active.definition; }
  get activeAnimation(): string | undefined { return this.#forms.activeState.animation; }
  get declaredState(): string { return this.#forms.state.state; }
  get declaredStateTicks(): number { return this.#forms.state.ticksInState; }
  get #state(): PlayerState { return (this.#forms.activeState.behavior ?? this.#forms.state.state) as PlayerState; }
  get deathScale(): number { return this.#state === "dead" ? 1 + this.#deadTicks * .1 : 1; }
  get activeCheckpoint(): number { return this.#activeCheckpoint; }
  kill(): void { const config = this.#config; if (this.#state !== "dead") { this.#height = config.standingHeight; this.#dispatchStateEvent("killed", { left: false, right: false, up: false, down: false, action: false }); this.#deadTicks = 0; this.#deathOriginY = this.#y; this.#ascending = true; this.#vy = config.maximumVerticalSpeed * config.deathSpeedMultiplier; } }
  placeAtFeet(worldX: number, worldY: number): void {
    const config = this.#config, maxX = Math.max(0, this.#map.width * this.#map.tileWidth - config.collisionOffsetX - config.collisionWidth), maxY = Math.max(0, this.#map.height * this.#map.tileHeight - config.standingHeight);
    this.#x = Math.min(maxX, Math.max(0, Math.round(worldX - config.collisionOffsetX - config.collisionWidth / 2))); this.#y = Math.min(maxY, Math.max(0, Math.round(worldY - config.standingHeight)));
    this.#height = config.standingHeight; this.#forms.resetState({ x: this.#x, y: this.#y }, this.#face); this.#vy = config.maximumVerticalSpeed; this.#ascending = false; this.#jumpOrigin = this.#y; this.#deadTicks = 0;
  }
  reset(): void { const config = this.#config; this.#x = this.#spawn.x; this.#y = this.#spawn.y; this.#height = config.standingHeight; this.#face = this.#spawn.face; this.#forms.resetState({ x: this.#x, y: this.#y }, this.#face); this.#vy = config.maximumVerticalSpeed; this.#ascending = false; this.#jumpOrigin = this.#y; this.#deadTicks = 0; }
  step(input: PlayerInput, platforms: readonly PlayerPlatform[] = [], obstacles: readonly PlayerObstacle[] = [], deathBoundary?: number): void {
    const config = this.#config;
    if (this.#state === "dead") {
      this.#forms.advanceStateTick();
      this.#x += config.runSpeed;
      if (this.#ascending) { this.#y -= this.#vy; this.#vy = Math.max(config.minimumVerticalSpeed * config.deathSpeedMultiplier, this.#vy - config.verticalAcceleration * config.deathSpeedMultiplier); if (this.#deathOriginY - this.#y >= config.deathRise) this.#ascending = false; }
      else { this.#y += this.#vy; this.#vy = Math.min(config.maximumVerticalSpeed * config.deathSpeedMultiplier, this.#vy + config.verticalAcceleration * config.deathSpeedMultiplier); }
      this.#deadTicks += 1; if ((!this.#ascending && deathBoundary !== undefined && this.#y >= deathBoundary) || (deathBoundary === undefined && this.#deadTicks >= config.deathRespawnTicks)) this.reset(); return;
    }
    this.#carryWithPlatform(platforms, obstacles);
    const previousState = this.#state;
    const groundedForState = this.#grounded(platforms, obstacles), onStairsForState = this.#capabilities.climb && this.#touchingStairs(), canDescendForState = this.#capabilities.climb && this.#canDescendStairs(), canStandForState = this.#canStand(obstacles), requestedAction = groundedForState && this.#state !== "jumping" && this.#state !== "climbing" ? groundActionForInput(input, this.#capabilities, this.#bindings) : null;
    const formBefore = this.#forms.active.id, heightBefore = this.#height;
    this.#forms.step({ input, signals: { grounded: groundedForState, onStairs: onStairsForState, canDescendStairs: canDescendForState, canStand: canStandForState, ceilingBlocked: !canStandForState }, actions: new Set(requestedAction ? [requestedAction] : []), x: this.#x, y: this.#y });
    if (this.#forms.active.id !== formBefore) { const next = this.#forms.active; this.#config = next.controller; this.#capabilities = next.capabilities; this.#bindings = next.actionBindings; this.#height = next.controller.standingHeight; this.#y += heightBefore - this.#height; }
    if (previousState !== "crouching" && this.#state === "crouching") { this.#height = config.crouchingHeight; this.#y += config.standingHeight - this.#height; }
    else if (previousState === "crouching" && this.#state !== "crouching") { this.#y -= config.standingHeight - this.#height; this.#height = config.standingHeight; if (this.#state === "jumping") { this.#ascending = false; this.#vy = config.minimumVerticalSpeed; } }
    if (previousState !== "climbing" && this.#state === "climbing") { this.#ascending = false; this.#vy = 0; }
    if (previousState !== "jumping" && this.#state === "jumping" && previousState !== "crouching") { this.#ascending = groundedForState && input.up; this.#jumpOrigin = this.#y; this.#vy = this.#ascending ? config.maximumVerticalSpeed : config.minimumVerticalSpeed; }
    if (this.#state === "crouching") {
      const dx = input.right ? config.runSpeed : input.left ? -config.runSpeed : 0; if (dx) { this.#face = dx > 0 ? "right" : "left"; this.#moveX(dx, obstacles); } this.#activateCheckpoint(); return;
    }
    if (previousState === "hitting" && this.#state === "stop" && requestedAction === "hitting") { this.#activateCheckpoint(); return; }
    const actionState = (["shooting", "bombing", "hitting"] as string[]).includes(this.#state) ? this.#state as PlayerGroundAction : null;
    if (actionState) { if (input.left || input.right) this.#face = input.left ? "left" : "right"; }
    else if (this.#state === "climbing") {
      if (input.up) this.#moveY(-config.climbSpeed, platforms, obstacles, true);
      else if (input.down) this.#moveY(config.climbSpeed, platforms, obstacles, true);
      const dx = actionState ? 0 : input.right ? config.runSpeed : input.left ? -config.runSpeed : 0; if (dx) { this.#face = dx > 0 ? "right" : "left"; this.#moveX(dx, obstacles); }
    } else {
      const dx = input.right ? config.runSpeed : input.left ? -config.runSpeed : 0; if (dx) { this.#face = dx > 0 ? "right" : "left"; this.#moveX(dx, obstacles); }
      if (this.#state === "jumping") {
        if (this.#ascending && (this.#jumpOrigin - this.#y >= config.jumpHeight || !this.#moveY(-this.#vy, platforms, obstacles))) this.#ascending = false;
        if (!this.#ascending && !this.#moveY(this.#vy, platforms, obstacles)) this.#dispatchStateEvent("landed", input, platforms, obstacles);
        this.#vy = this.#ascending ? Math.max(config.minimumVerticalSpeed, this.#vy - config.verticalAcceleration) : Math.min(config.maximumVerticalSpeed, this.#vy + config.verticalAcceleration);
      }
    }
    this.#activateCheckpoint();
    if (this.#y > this.#map.height * this.#map.tileHeight + config.standingHeight) this.kill();
  }
  #dispatchStateEvent(event: string, input: PlayerInput, platforms: readonly PlayerPlatform[] = [], obstacles: readonly PlayerObstacle[] = []): void {
    const grounded = this.#grounded(platforms, obstacles), onStairs = this.#capabilities.climb && this.#touchingStairs(), canDescend = this.#capabilities.climb && this.#canDescendStairs(), canStand = this.#canStand(obstacles);
    this.#forms.evaluate({ input, signals: { grounded, onStairs, canDescendStairs: canDescend, canStand, ceilingBlocked: !canStand }, events: new Set([event]), x: this.#x, y: this.#y });
  }
  #tileKindAt(x: number, y: number): TileKind {
    const tx = Math.floor(x / this.#map.tileWidth), ty = Math.floor(y / this.#map.tileHeight);
    if (tx < 0 || tx >= this.#map.width || ty < 0) return "solid"; if (ty >= this.#map.height) return "empty";
    const offset = (this.#map.layers.collisions[ty * this.#map.width + tx] ?? 0) - this.#map.tileset.tileCount;
    return (["empty", "solid", "platform", "stairs", "stairsTop"] as const)[offset] ?? "empty";
  }
  #grounded(platforms: readonly PlayerPlatform[], obstacles: readonly PlayerObstacle[] = []): boolean {
    const config = this.#config;
    const y = this.#y + this.#height + .5, tile = (x: number): boolean => ["solid", "platform", "stairsTop"].includes(this.#tileKindAt(x, y));
    if (tile(this.#x + config.collisionOffsetX) || tile(this.#x + config.collisionOffsetX + config.collisionWidth - 1)) return true;
    if (platforms.some((platform) => this.#overlapsX(platform) && Math.abs(this.#y + this.#height - platform.y) <= 1)) return true;
    const bottom = this.#y + this.#height; return obstacles.some((obstacle) => this.#x + config.collisionOffsetX < obstacle.x + obstacle.width && this.#x + config.collisionOffsetX + config.collisionWidth > obstacle.x && Math.abs(bottom - obstacle.y) <= 1);
  }
  #touchingStairs(): boolean {
    const config = this.#config, xs = [this.#x + config.collisionOffsetX, this.#x + config.collisionOffsetX + config.collisionWidth / 2, this.#x + config.collisionOffsetX + config.collisionWidth - 1];
    return xs.some((x) => [this.#y + 1, this.#y + this.#height / 2, this.#y + this.#height - 1].some((y) => ["stairs", "stairsTop"].includes(this.#tileKindAt(x, y))));
  }
  #canDescendStairs(): boolean {
    const y = this.#y + this.#height + 1;
    return ["stairs", "stairsTop"].includes(this.#tileKindAt(this.#x + this.#config.collisionOffsetX + this.#config.collisionWidth / 2, y));
  }
  #overlapsX(platform: PlayerPlatform): boolean { const config = this.#config; return this.#x + config.collisionOffsetX < platform.x + platform.width && this.#x + config.collisionOffsetX + config.collisionWidth > platform.x; }
  #carryWithPlatform(platforms: readonly PlayerPlatform[], obstacles: readonly PlayerObstacle[]): void { const support = platforms.find((platform) => this.#overlapsX(platform) && Math.abs(this.#y + this.#height - (platform.y - platform.dy)) <= 1); if (support) { this.#moveX(support.dx, obstacles); this.#moveY(support.dy, [], obstacles, true); } }
  #overlapsObstacle(x: number, y: number, height: number, obstacles: readonly PlayerObstacle[]): PlayerObstacle | undefined { return obstacles.find((obstacle) => x < obstacle.x + obstacle.width && x + this.#config.collisionWidth > obstacle.x && y < obstacle.y + obstacle.height && y + height > obstacle.y); }
  #moveX(dx: number, obstacles: readonly PlayerObstacle[]): boolean { const config = this.#config, next = this.#x + dx, collisionX = next + config.collisionOffsetX, edge = dx > 0 ? collisionX + config.collisionWidth - 1 : collisionX; if (this.#tileKindAt(edge, this.#y) === "solid" || this.#tileKindAt(edge, this.#y + this.#height - 1) === "solid" || this.#overlapsObstacle(collisionX, this.#y, this.#height, obstacles)) return false; this.#x = next; return true; }
  #moveY(dy: number, platforms: readonly PlayerPlatform[], obstacles: readonly PlayerObstacle[], climbing = false): boolean {
    const next = this.#y + dy, edge = dy > 0 ? next + this.#height : next;
    const config = this.#config, kinds = [this.#tileKindAt(this.#x + config.collisionOffsetX, edge), this.#tileKindAt(this.#x + config.collisionOffsetX + config.collisionWidth - 1, edge)];
    if (kinds.includes("solid")) { this.#y = dy > 0 ? Math.floor(edge / this.#map.tileHeight) * this.#map.tileHeight - this.#height : (Math.floor(edge / this.#map.tileHeight) + 1) * this.#map.tileHeight; return false; }
    const obstacle = this.#overlapsObstacle(this.#x + config.collisionOffsetX, next, this.#height, obstacles); if (obstacle) { this.#y = dy > 0 ? obstacle.y - this.#height : obstacle.y + obstacle.height; return false; }
    const previousBottom = this.#y + this.#height, nextBottom = next + this.#height;
    if (dy > 0 && !climbing && kinds.some((kind) => kind === "platform" || kind === "stairsTop") && Math.floor(previousBottom / this.#map.tileHeight) < Math.floor(nextBottom / this.#map.tileHeight)) { this.#y = Math.floor(edge / this.#map.tileHeight) * this.#map.tileHeight - this.#height; return false; }
    if (dy > 0 && !climbing) for (const platform of platforms) if (this.#overlapsX(platform) && previousBottom <= platform.y && nextBottom >= platform.y) { this.#y = platform.y - this.#height; return false; }
    this.#y = next; return true;
  }
  #activateCheckpoint(): void {
    const current = this.#checkpoints.find((checkpoint) => checkpoint.id === this.#activeCheckpoint);
    if (!current?.nextIds.length) return;
    const eligible = new Set(current.nextIds), left = this.#x, right = left + this.#config.spriteWidth, top = this.#y, bottom = top + this.#height;
    for (const checkpoint of this.#checkpoints) if (eligible.has(checkpoint.id) && left < checkpoint.x + checkpoint.width && right > checkpoint.x && top < checkpoint.y + checkpoint.height && bottom > checkpoint.y) {
      this.#activeCheckpoint = checkpoint.id; this.#spawn = { x: checkpoint.spawnX, y: checkpoint.spawnY, face: checkpoint.face }; return;
    }
  }
  #canStand(obstacles: readonly PlayerObstacle[]): boolean { const config = this.#config, top = this.#y - (config.standingHeight - this.#height), x = this.#x + config.collisionOffsetX; return [x, x + config.collisionWidth - 1].every((pointX) => this.#tileKindAt(pointX, top) !== "solid" && this.#tileKindAt(pointX, this.#y - 1) !== "solid") && !this.#overlapsObstacle(x, top, config.standingHeight, obstacles); }
}
