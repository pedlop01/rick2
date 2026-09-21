import type { EditableLevel, TileMapDocument } from "./level-document";
import { CharacterForms, rickCharacterForms, type CharacterFormsDefinition } from "./character-forms";
import { groundActionForInput, type PlayerActionBindings, type PlayerCapabilities, type PlayerControllerConfig, type PlayerGroundAction } from "./platformer-core";

export interface PlayerInput { left: boolean; right: boolean; up: boolean; down: boolean; action: boolean; }
export interface PlayerPlatform { key: string; x: number; y: number; width: number; height: number; dx: number; dy: number; }
export interface PlayerObstacle { key: string; x: number; y: number; width: number; height: number; }
export type PlayerState = "stop" | "running" | "jumping" | "crouching" | "climbing" | "shooting" | "bombing" | "hitting" | "dead";
export interface PlayerSnapshot { x: number; y: number; state: PlayerState; face: "left" | "right"; verticalSpeed: number; collisionX: number; collisionY: number; collisionWidth: number; collisionHeight: number; }
interface Checkpoint { id: number; x: number; y: number; width: number; height: number; spawnX: number; spawnY: number; face: "left" | "right" | "preserve"; activation: "overlap" | "topLeft" | "disabled"; nextIds: number[]; }
type TileKind = "empty" | "solid" | "platform" | "stairs" | "stairsTop" | "slopeLeft" | "slopeRight";
const finite = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;

export class WebPlayer {
  readonly #map: TileMapDocument; readonly #checkpoints: Checkpoint[]; readonly #forms: CharacterForms; #config: Readonly<PlayerControllerConfig>; #capabilities: Readonly<PlayerCapabilities>; #bindings: Readonly<PlayerActionBindings>;
  #spawn: { x: number; y: number; face: "left" | "right" | "preserve" }; #activeCheckpoint = -1;
  #x = 0; #y = 0; #face: "left" | "right" = "right";
  #height = 0; #vy = 0; #ascending = false; #jumpOrigin = 0; #jumpOriginX = 0; #jumpDx = 0; #jumpAscentTicks = 0; #deadTicks = 0; #deathOriginY = 0; #forcedStatePending = false;
  #keepMoving = false;
  constructor(level: EditableLevel, config: Partial<PlayerControllerConfig> = {}, capabilities: Partial<PlayerCapabilities> = {}, bindings: Partial<PlayerActionBindings> = {}, forms?: CharacterFormsDefinition) {
    this.#map = level.map;
    this.#forms = new CharacterForms(forms ?? rickCharacterForms(config, capabilities, bindings), "right", { controller: config, capabilities, actionBindings: bindings }); const form = this.#forms.active;
    this.#config = form.controller;
    this.#capabilities = form.capabilities;
    this.#bindings = form.actionBindings;
    const raw = (level.entities as { checkpoints?: Array<Record<string, unknown>> }).checkpoints ?? [];
    this.#checkpoints = raw.map((checkpoint, index) => ({ id: finite(checkpoint.id, index), x: finite(checkpoint.chk_x), y: finite(checkpoint.chk_y), width: finite(checkpoint.chk_width, 8), height: finite(checkpoint.chk_height, 8), spawnX: finite(checkpoint.pl_x), spawnY: finite(checkpoint.pl_y), face: checkpoint.pl_face === "left" ? "left" : checkpoint.pl_face === "preserve" ? "preserve" : "right", activation: checkpoint.activation === "topLeft" ? "topLeft" : checkpoint.activation === "disabled" ? "disabled" : "overlap", nextIds: Array.isArray(checkpoint.nxt_chks) ? checkpoint.nxt_chks.map((id) => finite(id, Number.NaN)).filter(Number.isFinite) : [] }));
    const first = this.#checkpoints[0] ?? { spawnX: 0, spawnY: 0, face: "right" as const };
    this.#spawn = { x: first.spawnX, y: first.spawnY, face: first.face }; this.#activeCheckpoint = this.#checkpoints.length ? this.#checkpoints[0]!.id : -1; this.reset();
  }
  get snapshot(): PlayerSnapshot { const config = this.#config; return { x: this.#x, y: this.#y, state: this.#state, face: this.#face, verticalSpeed: this.#vy, collisionX: this.#x + config.collisionOffsetX, collisionY: this.#y, collisionWidth: config.collisionWidth, collisionHeight: this.#height }; }
  get activeForm(): string { return this.#forms.active.id; }
  get activeDefinition(): string | undefined { return this.#forms.active.definition; }
  get activeCombatProfile(): string | undefined { return this.#forms.active.combatProfile; }
  get activeSpriteWidth(): number { return this.#config.spriteWidth; }
  get activeSpriteHeight(): number { return this.#config.standingHeight; }
  get visualScale(): number { return this.#forms.active.visualScale; }
  get activeAnimation(): string | undefined { return this.#forms.activeState.animation; }
  get declaredState(): string { return this.#forms.state.state; }
  get declaredStateTicks(): number { return this.#forms.state.ticksInState; }
  get #state(): PlayerState { return (this.#forms.activeState.behavior ?? this.#forms.state.state) as PlayerState; }
  get deathScale(): number { return this.#state === "dead" ? 1 + this.#deadTicks * .1 : 1; }
  get activeCheckpoint(): number { return this.#activeCheckpoint; }
  applyKnockback(dx: number, dy: number): void { this.#x = Math.min(this.#map.width * this.#map.tileWidth - this.#config.spriteWidth, Math.max(0, this.#x + dx)); this.#y = Math.max(0, this.#y + dy); }
  keepMoving(): void { this.#keepMoving = true; }
  completeAnimationCycle(): void { this.#keepMoving = false; }
  kill(): void { const config = this.#config; if (this.#state !== "dead") { this.#height = config.standingHeight; this.#dispatchStateEvent("killed", { left: false, right: false, up: false, down: false, action: false }); this.#deadTicks = 0; this.#deathOriginY = this.#y; this.#ascending = true; this.#vy = config.maximumVerticalSpeed * config.deathSpeedMultiplier; } }
  placeAtFeet(worldX: number, worldY: number): void {
    const config = this.#config, maxX = Math.max(0, this.#map.width * this.#map.tileWidth - config.collisionOffsetX - config.collisionWidth), maxY = Math.max(0, this.#map.height * this.#map.tileHeight - config.standingHeight);
    this.#x = Math.min(maxX, Math.max(0, Math.round(worldX - config.collisionOffsetX - config.collisionWidth / 2))); this.#y = Math.min(maxY, Math.max(0, Math.round(worldY - config.standingHeight)));
    this.#height = config.standingHeight; this.#forms.resetState({ x: this.#x, y: this.#y }, this.#face); this.#forcedStatePending = false; this.#keepMoving = false; this.#vy = config.maximumVerticalSpeed; this.#ascending = false; this.#jumpOrigin = this.#y; this.#deadTicks = 0;
  }
  reset(): void { this.#forcedStatePending = false; this.#keepMoving = false; this.#x = this.#spawn.x; this.#y = this.#spawn.y; if (this.#spawn.face !== "preserve") this.#face = this.#spawn.face; this.#forms.reset({ x: this.#x, y: this.#y }, this.#face); const form = this.#forms.active; this.#config = form.controller; this.#capabilities = form.capabilities; this.#bindings = form.actionBindings; this.#height = this.#config.standingHeight; this.#vy = this.#config.maximumVerticalSpeed; this.#ascending = false; this.#jumpOrigin = this.#y; this.#deadTicks = 0; }
  restart(): void { const first = this.#checkpoints[0]; if (first) { this.#activeCheckpoint = first.id; this.#spawn = { x: first.spawnX, y: first.spawnY, face: first.face }; } this.reset(); }
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
    if (this.#keepMoving && !Object.values(input).some(Boolean) && this.#grounded(platforms, obstacles)) input = { ...input, [this.#face]: true };
    const previousState = this.#state;
    const groundedForState = this.#grounded(platforms, obstacles), onStairsForState = this.#capabilities.climb && this.#touchingStairs(), canDescendForState = this.#capabilities.climb && this.#canDescendStairs(), canStandForState = this.#canStand(obstacles), requestedAction = groundedForState && this.#state !== "jumping" && this.#state !== "climbing" ? groundActionForInput(input, this.#capabilities, this.#bindings) : null;
    const formBefore = this.#forms.active.id, heightBefore = this.#height;
    if (this.#forcedStatePending) this.#forcedStatePending = false; else this.#forms.step({ input, signals: { grounded: groundedForState, onStairs: onStairsForState, canDescendStairs: canDescendForState, canStand: canStandForState, ceilingBlocked: !canStandForState, descending: this.#state === "jumping" && !this.#ascending }, actions: new Set(requestedAction ? [requestedAction] : []), x: this.#x, y: this.#y });
    if (this.#forms.active.id !== formBefore) { const next = this.#forms.active; this.#x += (this.#config.spriteWidth - next.controller.spriteWidth) / 2; this.#config = next.controller; this.#capabilities = next.capabilities; this.#bindings = next.actionBindings; this.#height = next.controller.standingHeight; this.#y += heightBefore - this.#height; }
    if (previousState !== "crouching" && this.#state === "crouching") { this.#height = config.crouchingHeight; this.#y += config.standingHeight - this.#height; }
    else if (previousState === "crouching" && this.#state !== "crouching") { this.#y -= config.standingHeight - this.#height; this.#height = config.standingHeight; }
    if (previousState !== "climbing" && this.#state === "climbing") { this.#ascending = false; this.#vy = 0; }
    if (previousState !== "jumping" && this.#state === "jumping") { this.#ascending = groundedForState; this.#jumpOrigin = this.#y; this.#jumpOriginX = this.#x; this.#jumpAscentTicks = 0; this.#vy = this.#ascending ? config.maximumVerticalSpeed : config.minimumVerticalSpeed; this.#jumpDx = config.airControl ? input.right ? config.runSpeed : input.left ? -config.runSpeed : 0 : groundedForState ? this.#face === "right" ? config.runSpeed : -config.runSpeed : 0; }
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
      const dx = this.#state === "jumping" && !config.airControl ? this.#jumpDx : input.right ? config.runSpeed : input.left ? -config.runSpeed : 0; if (dx) { if (config.airControl || this.#state !== "jumping") this.#face = dx > 0 ? "right" : "left"; const moved = this.#moveX(dx, obstacles); if (moved && this.#state !== "jumping") this.#snapToSlope(Math.abs(dx) + 1); }
      if (this.#state === "jumping") {
        if (this.#ascending) {
          this.#jumpAscentTicks += 1;
          const reachedLimit = this.#jumpOrigin - this.#y >= config.jumpHeight || (config.jumpDistanceX !== undefined && Math.abs(this.#x - this.#jumpOriginX) > config.jumpDistanceX) || (config.jumpAscentTicks !== undefined && this.#jumpAscentTicks >= config.jumpAscentTicks);
          const movedUp = reachedLimit ? true : this.#moveY(-this.#vy, platforms, obstacles);
          if (reachedLimit || (!movedUp && config.ceilingEndsAscent)) this.#ascending = false;
        }
        if (!this.#ascending && !this.#moveY(this.#vy, platforms, obstacles) && this.declaredState !== "falling") this.#dispatchStateEvent("landed", input, platforms, obstacles);
        this.#vy = this.#ascending ? Math.max(config.minimumVerticalSpeed, this.#vy - config.verticalAcceleration) : Math.min(config.maximumVerticalSpeed, this.#vy + config.verticalAcceleration);
      }
    }
    this.#activateCheckpoint();
    if (this.#y > this.#map.height * this.#map.tileHeight + config.standingHeight) this.kill();
  }
  dispatchGameplayEvent(event: string): void { this.#dispatchStateEvent(event, { left: false, right: false, up: false, down: false, action: false }); }
  forceState(state: string, previousState: string): void { this.#forms.forceState(state, previousState); this.#forcedStatePending = true; if (this.#state === "jumping") { this.#ascending = false; this.#jumpOrigin = this.#y; this.#jumpDx = 0; this.#vy = this.#config.minimumVerticalSpeed; } }
  #dispatchStateEvent(event: string, input: PlayerInput = { left: false, right: false, up: false, down: false, action: false }, platforms: readonly PlayerPlatform[] = [], obstacles: readonly PlayerObstacle[] = []): void {
    const grounded = this.#grounded(platforms, obstacles), onStairs = this.#capabilities.climb && this.#touchingStairs(), canDescend = this.#capabilities.climb && this.#canDescendStairs(), canStand = this.#canStand(obstacles);
    this.#forms.evaluate({ input, signals: { grounded, onStairs, canDescendStairs: canDescend, canStand, ceilingBlocked: !canStand, descending: this.#state === "jumping" && !this.#ascending }, events: new Set([event]), x: this.#x, y: this.#y });
  }
  #tileKindAt(x: number, y: number): TileKind {
    const tx = Math.floor(x / this.#map.tileWidth), ty = Math.floor(y / this.#map.tileHeight);
    if (tx < 0 || tx >= this.#map.width || ty < 0) return "solid"; if (ty >= this.#map.height) return "empty";
    const offset = (this.#map.layers.collisions[ty * this.#map.width + tx] ?? 0) - this.#map.tileset.tileCount;
    return (["empty", "solid", "platform", "stairs", "stairsTop", "slopeLeft", "slopeRight"] as const)[offset] ?? "empty";
  }
  #edgeKinds(start: number, end: number, tileSize: number, sample: (coordinate: number) => TileKind): TileKind[] {
    const kinds: TileKind[] = [];
    for (let tile = Math.floor(start / tileSize); tile <= Math.floor(end / tileSize); tile++) kinds.push(sample(tile * tileSize));
    return kinds;
  }
  #grounded(platforms: readonly PlayerPlatform[], obstacles: readonly PlayerObstacle[] = []): boolean {
    const config = this.#config, left = this.#x + config.collisionOffsetX;
    const y = this.#y + this.#height + .5;
    if (this.#edgeKinds(left, left + config.collisionWidth - 1, this.#map.tileWidth, (x) => this.#tileKindAt(x, y)).some((kind) => ["solid", "platform", "stairsTop"].includes(kind))) return true;
    if (this.#slopeStandingY(this.#x, this.#y, 1) !== null) return true;
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
  #slopeStandingY(atX: number, atY: number, tolerance: number): number | null {
    const config = this.#config, bottom = atY + this.#height;
    const feet = [atX + config.collisionOffsetX, atX + config.collisionOffsetX + config.collisionWidth - 1];
    let closest: number | null = null;
    feet.forEach((footX, side) => {
      const tx = Math.floor(footX / this.#map.tileWidth);
      for (const ty of new Set([Math.floor(bottom / this.#map.tileHeight), Math.floor((bottom - 1) / this.#map.tileHeight), Math.floor((bottom + tolerance) / this.#map.tileHeight)])) {
        if (tx < 0 || tx >= this.#map.width || ty < 0 || ty >= this.#map.height) continue;
        const kind = this.#tileKindAt(footX, ty * this.#map.tileHeight + .5);
        if ((side === 0 && kind !== "slopeLeft") || (side === 1 && kind !== "slopeRight")) continue;
        let localX = Math.max(0, Math.min(this.#map.tileWidth - 1, footX - tx * this.#map.tileWidth));
        if (kind === "slopeRight") localX = this.#map.tileWidth - 1 - localX;
        const surface = ty * this.#map.tileHeight + Math.floor(localX * (this.#map.tileHeight - 1) / (this.#map.tileWidth - 1));
        const candidate = surface - this.#height;
        if (Math.abs(candidate - atY) <= tolerance && (closest === null || Math.abs(candidate - atY) < Math.abs(closest - atY))) closest = candidate;
      }
    });
    return closest;
  }
  #snapToSlope(tolerance: number): boolean { const standingY = this.#slopeStandingY(this.#x, this.#y, tolerance); if (standingY === null) return false; this.#y = standingY; return true; }
  #moveX(dx: number, obstacles: readonly PlayerObstacle[]): boolean { const config = this.#config, next = this.#x + dx, collisionX = next + config.collisionOffsetX, edge = dx > 0 ? collisionX + config.collisionWidth - 1 : collisionX; if (this.#edgeKinds(this.#y, this.#y + this.#height - 1, this.#map.tileHeight, (y) => this.#tileKindAt(edge, y)).includes("solid") || this.#overlapsObstacle(collisionX, this.#y, this.#height, obstacles)) return false; this.#x = next; return true; }
  #moveY(dy: number, platforms: readonly PlayerPlatform[], obstacles: readonly PlayerObstacle[], climbing = false): boolean {
    const next = this.#y + dy, edge = dy > 0 ? next + this.#height : next;
    const config = this.#config, kinds = this.#edgeKinds(this.#x + config.collisionOffsetX, this.#x + config.collisionOffsetX + config.collisionWidth - 1, this.#map.tileWidth, (x) => this.#tileKindAt(x, edge));
    if (kinds.includes("solid")) { this.#y = dy > 0 ? Math.floor(edge / this.#map.tileHeight) * this.#map.tileHeight - this.#height : (Math.floor(edge / this.#map.tileHeight) + 1) * this.#map.tileHeight; return false; }
    const obstacle = this.#overlapsObstacle(this.#x + config.collisionOffsetX, next, this.#height, obstacles); if (obstacle) { this.#y = dy > 0 ? obstacle.y - this.#height : obstacle.y + obstacle.height; return false; }
    const previousBottom = this.#y + this.#height, nextBottom = next + this.#height;
    if (dy > 0 && !climbing) { const slopeY = this.#slopeStandingY(this.#x, next, dy + 1); if (slopeY !== null && slopeY >= this.#y && slopeY <= next) { this.#y = slopeY; return false; } }
    if (dy > 0 && !climbing && kinds.some((kind) => kind === "platform" || kind === "stairsTop") && Math.floor(previousBottom / this.#map.tileHeight) < Math.floor(nextBottom / this.#map.tileHeight)) { this.#y = Math.floor(edge / this.#map.tileHeight) * this.#map.tileHeight - this.#height; return false; }
    if (dy > 0 && !climbing) for (const platform of platforms) if (this.#overlapsX(platform) && previousBottom <= platform.y && nextBottom >= platform.y) { this.#y = platform.y - this.#height; return false; }
    this.#y = next; return true;
  }
  #activateCheckpoint(): void {
    const current = this.#checkpoints.find((checkpoint) => checkpoint.id === this.#activeCheckpoint);
    if (!current?.nextIds.length) return;
    const eligible = new Set(current.nextIds), left = this.#x, right = left + this.#config.spriteWidth, top = this.#y, bottom = top + this.#height;
    for (const checkpoint of this.#checkpoints) if (eligible.has(checkpoint.id) && checkpoint.activation !== "disabled" && (checkpoint.activation === "topLeft" ? left >= checkpoint.x && left < checkpoint.x + checkpoint.width && top >= checkpoint.y && top < checkpoint.y + checkpoint.height : left < checkpoint.x + checkpoint.width && right > checkpoint.x && top < checkpoint.y + checkpoint.height && bottom > checkpoint.y)) {
      this.#activeCheckpoint = checkpoint.id; this.#spawn = { x: checkpoint.spawnX, y: checkpoint.spawnY, face: checkpoint.face }; return;
    }
  }
  #canStand(obstacles: readonly PlayerObstacle[]): boolean { const config = this.#config, top = this.#y - (config.standingHeight - this.#height), x = this.#x + config.collisionOffsetX; return !this.#edgeKinds(x, x + config.collisionWidth - 1, this.#map.tileWidth, (pointX) => this.#tileKindAt(pointX, top)).includes("solid") && !this.#edgeKinds(x, x + config.collisionWidth - 1, this.#map.tileWidth, (pointX) => this.#tileKindAt(pointX, this.#y - 1)).includes("solid") && !this.#overlapsObstacle(x, top, config.standingHeight, obstacles); }
}
