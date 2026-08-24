import type { EditableLevel, TileMapDocument } from "./level-document";

export interface PlayerInput { left: boolean; right: boolean; up: boolean; down: boolean; action: boolean; }
export interface PlayerPlatform { key: string; x: number; y: number; width: number; height: number; dx: number; dy: number; }
export interface PlayerObstacle { key: string; x: number; y: number; width: number; height: number; }
export type PlayerState = "stop" | "running" | "jumping" | "crouching" | "climbing" | "shooting" | "bombing" | "hitting" | "dead";
export interface PlayerSnapshot { x: number; y: number; state: PlayerState; face: "left" | "right"; verticalSpeed: number; collisionX: number; collisionY: number; collisionWidth: number; collisionHeight: number; }
interface Checkpoint { id: number; x: number; y: number; width: number; height: number; spawnX: number; spawnY: number; face: "left" | "right"; nextIds: number[]; }
type TileKind = "empty" | "solid" | "platform" | "stairs" | "stairsTop";
const SPRITE_WIDTH = 23, WIDTH = 13, HEIGHT = 21, BOX_X = 5, SPEED_X = 2, SPEED_Y_MAX = 3, SPEED_Y_MIN = 1, SPEED_Y_STEP = .1, CLIMB_SPEED = 2, DEATH_RISE = 80, DEATH_RESPAWN_TICKS = 70, HIT_HOLD_TICKS = 20;
const finite = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;

export class WebPlayer {
  readonly #map: TileMapDocument; readonly #checkpoints: Checkpoint[];
  #spawn: { x: number; y: number; face: "left" | "right" }; #activeCheckpoint = -1;
  #x = 0; #y = 0; #state: PlayerState = "stop"; #face: "left" | "right" = "right";
  #height = HEIGHT; #vy = SPEED_Y_MAX; #ascending = false; #jumpOrigin = 0; #deadTicks = 0; #deathOriginY = 0; #hitTicks = 0;
  constructor(level: EditableLevel) {
    this.#map = level.map;
    const raw = (level.entities as { checkpoints?: Array<Record<string, unknown>> }).checkpoints ?? [];
    this.#checkpoints = raw.map((checkpoint, index) => ({ id: finite(checkpoint.id, index), x: finite(checkpoint.chk_x), y: finite(checkpoint.chk_y), width: finite(checkpoint.chk_width, 8), height: finite(checkpoint.chk_height, 8), spawnX: finite(checkpoint.pl_x), spawnY: finite(checkpoint.pl_y), face: checkpoint.pl_face === "left" ? "left" : "right", nextIds: Array.isArray(checkpoint.nxt_chks) ? checkpoint.nxt_chks.map((id) => finite(id, Number.NaN)).filter(Number.isFinite) : [] }));
    const first = this.#checkpoints[0] ?? { spawnX: 0, spawnY: 0, face: "right" as const };
    this.#spawn = { x: first.spawnX, y: first.spawnY, face: first.face }; this.#activeCheckpoint = this.#checkpoints.length ? this.#checkpoints[0]!.id : -1; this.reset();
  }
  get snapshot(): PlayerSnapshot { return { x: this.#x, y: this.#y, state: this.#state, face: this.#face, verticalSpeed: this.#vy, collisionX: this.#x + BOX_X, collisionY: this.#y, collisionWidth: WIDTH, collisionHeight: this.#height }; }
  get deathScale(): number { return this.#state === "dead" ? 1 + this.#deadTicks * .1 : 1; }
  get activeCheckpoint(): number { return this.#activeCheckpoint; }
  kill(): void { if (this.#state !== "dead") { this.#height = HEIGHT; this.#state = "dead"; this.#deadTicks = 0; this.#deathOriginY = this.#y; this.#ascending = true; this.#vy = SPEED_Y_MAX * 2; } }
  placeAtFeet(worldX: number, worldY: number): void {
    const maxX = Math.max(0, this.#map.width * this.#map.tileWidth - BOX_X - WIDTH), maxY = Math.max(0, this.#map.height * this.#map.tileHeight - HEIGHT);
    this.#x = Math.min(maxX, Math.max(0, Math.round(worldX - BOX_X - WIDTH / 2))); this.#y = Math.min(maxY, Math.max(0, Math.round(worldY - HEIGHT)));
    this.#height = HEIGHT; this.#state = "stop"; this.#vy = SPEED_Y_MAX; this.#ascending = false; this.#jumpOrigin = this.#y; this.#deadTicks = 0; this.#hitTicks = 0;
  }
  reset(): void { this.#x = this.#spawn.x; this.#y = this.#spawn.y; this.#height = HEIGHT; this.#face = this.#spawn.face; this.#state = "stop"; this.#vy = SPEED_Y_MAX; this.#ascending = false; this.#jumpOrigin = this.#y; this.#deadTicks = 0; this.#hitTicks = 0; }
  step(input: PlayerInput, platforms: readonly PlayerPlatform[] = [], obstacles: readonly PlayerObstacle[] = [], deathBoundary?: number): void {
    if (this.#state === "dead") {
      this.#x += SPEED_X;
      if (this.#ascending) { this.#y -= this.#vy; this.#vy = Math.max(SPEED_Y_MIN * 2, this.#vy - SPEED_Y_STEP * 2); if (this.#deathOriginY - this.#y >= DEATH_RISE) this.#ascending = false; }
      else { this.#y += this.#vy; this.#vy = Math.min(SPEED_Y_MAX * 2, this.#vy + SPEED_Y_STEP * 2); }
      this.#deadTicks += 1; if ((!this.#ascending && deathBoundary !== undefined && this.#y >= deathBoundary) || (deathBoundary === undefined && this.#deadTicks >= DEATH_RESPAWN_TICKS)) this.reset(); return;
    }
    this.#carryWithPlatform(platforms, obstacles);
    if (this.#state === "crouching") {
      if (!this.#grounded(platforms, obstacles)) { this.#y -= HEIGHT - this.#height; this.#height = HEIGHT; this.#state = "jumping"; this.#ascending = false; this.#vy = SPEED_Y_MIN; }
      else if (!input.down && this.#canStand(obstacles)) { this.#y -= HEIGHT - this.#height; this.#height = HEIGHT; this.#state = "stop"; }
      else { const dx = input.right ? SPEED_X : input.left ? -SPEED_X : 0; if (dx) { this.#face = dx > 0 ? "right" : "left"; this.#moveX(dx, obstacles); } this.#activateCheckpoint(); return; }
    }
    if (this.#state === "hitting" && this.#hitTicks >= HIT_HOLD_TICKS) { this.#state = "stop"; this.#hitTicks = 0; this.#activateCheckpoint(); return; }
    const previousState = this.#state;
    const onStairs = this.#touchingStairs(), enteringDown = input.down && this.#canDescendStairs();
    const groundedNow = this.#grounded(platforms, obstacles), actionState = input.action && groundedNow && this.#state !== "jumping" && this.#state !== "climbing" ? input.up ? "shooting" : input.down ? "bombing" : input.left || input.right ? "hitting" : null : null;
    if (actionState) { this.#state = actionState; if (input.left || input.right) this.#face = input.left ? "left" : "right"; }
    else if ((this.#state === "climbing" && onStairs) || (input.up && onStairs) || enteringDown) {
      this.#state = "climbing"; this.#ascending = false; this.#vy = 0;
      if (input.up) this.#moveY(-CLIMB_SPEED, platforms, obstacles, true);
      else if (input.down) this.#moveY(CLIMB_SPEED, platforms, obstacles, true);
      const dx = actionState ? 0 : input.right ? SPEED_X : input.left ? -SPEED_X : 0; if (dx) { this.#face = dx > 0 ? "right" : "left"; this.#moveX(dx, obstacles); }
    } else {
      const grounded = groundedNow;
      if (this.#state === "climbing") this.#state = this.#grounded(platforms, obstacles) ? "stop" : "jumping";
      if (this.#state !== "jumping" && input.up && grounded) { this.#state = "jumping"; this.#ascending = true; this.#jumpOrigin = this.#y; this.#vy = SPEED_Y_MAX; }
      else if (this.#state !== "jumping") { if (input.down && grounded) { this.#height = 15; this.#y += HEIGHT - this.#height; this.#state = "crouching"; } else this.#state = input.left || input.right ? "running" : "stop"; }
      const dx = input.right ? SPEED_X : input.left ? -SPEED_X : 0; if (dx) { this.#face = dx > 0 ? "right" : "left"; this.#moveX(dx, obstacles); }
      if (this.#state === "jumping") {
        if (this.#ascending && (this.#jumpOrigin - this.#y >= 40 || !this.#moveY(-this.#vy, platforms, obstacles))) this.#ascending = false;
        if (!this.#ascending && !this.#moveY(this.#vy, platforms, obstacles)) this.#state = dx ? "running" : "stop";
        this.#vy = this.#ascending ? Math.max(SPEED_Y_MIN, this.#vy - SPEED_Y_STEP) : Math.min(SPEED_Y_MAX, this.#vy + SPEED_Y_STEP);
      } else if (!grounded) { this.#state = "jumping"; this.#ascending = false; this.#vy = SPEED_Y_MIN; }
    }
    this.#hitTicks = this.#state === "hitting" ? previousState === "hitting" ? this.#hitTicks + 1 : 0 : 0;
    this.#activateCheckpoint();
    if (this.#y > this.#map.height * this.#map.tileHeight + HEIGHT) this.kill();
  }
  #tileKindAt(x: number, y: number): TileKind {
    const tx = Math.floor(x / this.#map.tileWidth), ty = Math.floor(y / this.#map.tileHeight);
    if (tx < 0 || tx >= this.#map.width || ty < 0) return "solid"; if (ty >= this.#map.height) return "empty";
    const offset = (this.#map.layers.collisions[ty * this.#map.width + tx] ?? 0) - this.#map.tileset.tileCount;
    return (["empty", "solid", "platform", "stairs", "stairsTop"] as const)[offset] ?? "empty";
  }
  #grounded(platforms: readonly PlayerPlatform[], obstacles: readonly PlayerObstacle[] = []): boolean {
    const y = this.#y + this.#height + .5, tile = (x: number): boolean => ["solid", "platform", "stairsTop"].includes(this.#tileKindAt(x, y));
    if (tile(this.#x + BOX_X) || tile(this.#x + BOX_X + WIDTH - 1)) return true;
    if (platforms.some((platform) => this.#overlapsX(platform) && Math.abs(this.#y + this.#height - platform.y) <= 1)) return true;
    const bottom = this.#y + this.#height; return obstacles.some((obstacle) => this.#x + BOX_X < obstacle.x + obstacle.width && this.#x + BOX_X + WIDTH > obstacle.x && Math.abs(bottom - obstacle.y) <= 1);
  }
  #touchingStairs(): boolean {
    const xs = [this.#x + BOX_X, this.#x + BOX_X + WIDTH / 2, this.#x + BOX_X + WIDTH - 1];
    return xs.some((x) => [this.#y + 1, this.#y + this.#height / 2, this.#y + this.#height - 1].some((y) => ["stairs", "stairsTop"].includes(this.#tileKindAt(x, y))));
  }
  #canDescendStairs(): boolean {
    const y = this.#y + this.#height + 1;
    return ["stairs", "stairsTop"].includes(this.#tileKindAt(this.#x + BOX_X + WIDTH / 2, y));
  }
  #overlapsX(platform: PlayerPlatform): boolean { return this.#x + BOX_X < platform.x + platform.width && this.#x + BOX_X + WIDTH > platform.x; }
  #carryWithPlatform(platforms: readonly PlayerPlatform[], obstacles: readonly PlayerObstacle[]): void { const support = platforms.find((platform) => this.#overlapsX(platform) && Math.abs(this.#y + this.#height - (platform.y - platform.dy)) <= 1); if (support) { this.#moveX(support.dx, obstacles); this.#moveY(support.dy, [], obstacles, true); } }
  #overlapsObstacle(x: number, y: number, height: number, obstacles: readonly PlayerObstacle[]): PlayerObstacle | undefined { return obstacles.find((obstacle) => x < obstacle.x + obstacle.width && x + WIDTH > obstacle.x && y < obstacle.y + obstacle.height && y + height > obstacle.y); }
  #moveX(dx: number, obstacles: readonly PlayerObstacle[]): boolean { const next = this.#x + dx, collisionX = next + BOX_X, edge = dx > 0 ? collisionX + WIDTH - 1 : collisionX; if (this.#tileKindAt(edge, this.#y) === "solid" || this.#tileKindAt(edge, this.#y + this.#height - 1) === "solid" || this.#overlapsObstacle(collisionX, this.#y, this.#height, obstacles)) return false; this.#x = next; return true; }
  #moveY(dy: number, platforms: readonly PlayerPlatform[], obstacles: readonly PlayerObstacle[], climbing = false): boolean {
    const next = this.#y + dy, edge = dy > 0 ? next + this.#height : next;
    const kinds = [this.#tileKindAt(this.#x + BOX_X, edge), this.#tileKindAt(this.#x + BOX_X + WIDTH - 1, edge)];
    if (kinds.includes("solid")) { this.#y = dy > 0 ? Math.floor(edge / this.#map.tileHeight) * this.#map.tileHeight - this.#height : (Math.floor(edge / this.#map.tileHeight) + 1) * this.#map.tileHeight; return false; }
    const obstacle = this.#overlapsObstacle(this.#x + BOX_X, next, this.#height, obstacles); if (obstacle) { this.#y = dy > 0 ? obstacle.y - this.#height : obstacle.y + obstacle.height; return false; }
    const previousBottom = this.#y + this.#height, nextBottom = next + this.#height;
    if (dy > 0 && !climbing && kinds.some((kind) => kind === "platform" || kind === "stairsTop") && Math.floor(previousBottom / this.#map.tileHeight) < Math.floor(nextBottom / this.#map.tileHeight)) { this.#y = Math.floor(edge / this.#map.tileHeight) * this.#map.tileHeight - this.#height; return false; }
    if (dy > 0 && !climbing) for (const platform of platforms) if (this.#overlapsX(platform) && previousBottom <= platform.y && nextBottom >= platform.y) { this.#y = platform.y - this.#height; return false; }
    this.#y = next; return true;
  }
  #activateCheckpoint(): void {
    const current = this.#checkpoints.find((checkpoint) => checkpoint.id === this.#activeCheckpoint);
    if (!current?.nextIds.length) return;
    const eligible = new Set(current.nextIds), left = this.#x, right = left + SPRITE_WIDTH, top = this.#y, bottom = top + this.#height;
    for (const checkpoint of this.#checkpoints) if (eligible.has(checkpoint.id) && left < checkpoint.x + checkpoint.width && right > checkpoint.x && top < checkpoint.y + checkpoint.height && bottom > checkpoint.y) {
      this.#activeCheckpoint = checkpoint.id; this.#spawn = { x: checkpoint.spawnX, y: checkpoint.spawnY, face: checkpoint.face }; return;
    }
  }
  #canStand(obstacles: readonly PlayerObstacle[]): boolean { const top = this.#y - (HEIGHT - this.#height), x = this.#x + BOX_X; return [x, x + WIDTH - 1].every((pointX) => this.#tileKindAt(pointX, top) !== "solid" && this.#tileKindAt(pointX, this.#y - 1) !== "solid") && !this.#overlapsObstacle(x, top, HEIGHT, obstacles); }
}
