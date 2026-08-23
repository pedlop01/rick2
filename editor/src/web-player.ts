import type { EditableLevel, TileMapDocument } from "./level-document";

export interface PlayerInput { left: boolean; right: boolean; up: boolean; down: boolean; action: boolean; }
export interface PlayerPlatform { key: string; x: number; y: number; width: number; height: number; dx: number; dy: number; }
export type PlayerState = "stop" | "running" | "jumping" | "crouching" | "climbing" | "dead";
export interface PlayerSnapshot { x: number; y: number; state: PlayerState; face: "left" | "right"; verticalSpeed: number; }
interface Checkpoint { id: number; x: number; y: number; width: number; height: number; spawnX: number; spawnY: number; face: "left" | "right"; }
type TileKind = "empty" | "solid" | "platform" | "stairs" | "stairsTop";
const WIDTH = 13, HEIGHT = 21, BOX_X = 5, SPEED_X = 2, SPEED_Y_MAX = 3, SPEED_Y_MIN = 1, SPEED_Y_STEP = .1, CLIMB_SPEED = 2, RESPAWN_TICKS = 20;
const finite = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;

export class WebPlayer {
  readonly #map: TileMapDocument; readonly #checkpoints: Checkpoint[];
  #spawn: { x: number; y: number; face: "left" | "right" }; #activeCheckpoint = -1;
  #x = 0; #y = 0; #state: PlayerState = "stop"; #face: "left" | "right" = "right";
  #vy = SPEED_Y_MAX; #ascending = false; #jumpOrigin = 0; #deadTicks = 0;
  constructor(level: EditableLevel) {
    this.#map = level.map;
    const raw = (level.entities as { checkpoints?: Array<Record<string, unknown>> }).checkpoints ?? [];
    this.#checkpoints = raw.map((checkpoint, index) => ({ id: finite(checkpoint.id, index), x: finite(checkpoint.chk_x), y: finite(checkpoint.chk_y), width: finite(checkpoint.chk_width, 8), height: finite(checkpoint.chk_height, 8), spawnX: finite(checkpoint.pl_x), spawnY: finite(checkpoint.pl_y), face: checkpoint.pl_face === "left" ? "left" : "right" }));
    const first = this.#checkpoints[0] ?? { spawnX: 0, spawnY: 0, face: "right" as const };
    this.#spawn = { x: first.spawnX, y: first.spawnY, face: first.face }; this.#activeCheckpoint = this.#checkpoints.length ? this.#checkpoints[0]!.id : -1; this.reset();
  }
  get snapshot(): PlayerSnapshot { return { x: this.#x, y: this.#y, state: this.#state, face: this.#face, verticalSpeed: this.#vy }; }
  get activeCheckpoint(): number { return this.#activeCheckpoint; }
  reset(): void { this.#x = this.#spawn.x; this.#y = this.#spawn.y; this.#face = this.#spawn.face; this.#state = "stop"; this.#vy = SPEED_Y_MAX; this.#ascending = false; this.#jumpOrigin = this.#y; this.#deadTicks = 0; }
  step(input: PlayerInput, platforms: readonly PlayerPlatform[] = []): void {
    if (this.#state === "dead") { if (++this.#deadTicks >= RESPAWN_TICKS) this.reset(); return; }
    this.#carryWithPlatform(platforms);
    const onStairs = this.#touchingStairs(), enteringDown = input.down && this.#canDescendStairs();
    if ((this.#state === "climbing" && onStairs) || (input.up && onStairs) || enteringDown) {
      this.#state = "climbing"; this.#ascending = false; this.#vy = 0;
      if (input.up) this.#moveY(-CLIMB_SPEED, platforms, true);
      else if (input.down) this.#moveY(CLIMB_SPEED, platforms, true);
      const dx = input.right ? SPEED_X : input.left ? -SPEED_X : 0; if (dx) { this.#face = dx > 0 ? "right" : "left"; this.#moveX(dx); }
    } else {
      const grounded = this.#grounded(platforms);
      if (this.#state === "climbing") this.#state = this.#grounded(platforms) ? "stop" : "jumping";
      if (this.#state !== "jumping" && input.up && grounded) { this.#state = "jumping"; this.#ascending = true; this.#jumpOrigin = this.#y; this.#vy = SPEED_Y_MAX; }
      else if (this.#state !== "jumping") this.#state = input.down ? "crouching" : input.left || input.right ? "running" : "stop";
      const dx = input.right ? SPEED_X : input.left ? -SPEED_X : 0; if (dx) { this.#face = dx > 0 ? "right" : "left"; this.#moveX(dx); }
      if (this.#state === "jumping") {
        if (this.#ascending && (this.#jumpOrigin - this.#y >= 40 || !this.#moveY(-this.#vy, platforms))) this.#ascending = false;
        if (!this.#ascending && !this.#moveY(this.#vy, platforms)) this.#state = dx ? "running" : "stop";
        this.#vy = this.#ascending ? Math.max(SPEED_Y_MIN, this.#vy - SPEED_Y_STEP) : Math.min(SPEED_Y_MAX, this.#vy + SPEED_Y_STEP);
      } else if (!grounded) { this.#state = "jumping"; this.#ascending = false; this.#vy = SPEED_Y_MIN; }
    }
    this.#activateCheckpoint();
    if (this.#y > this.#map.height * this.#map.tileHeight + HEIGHT) { this.#state = "dead"; this.#deadTicks = 0; }
  }
  #tileKindAt(x: number, y: number): TileKind {
    const tx = Math.floor(x / this.#map.tileWidth), ty = Math.floor(y / this.#map.tileHeight);
    if (tx < 0 || tx >= this.#map.width || ty < 0) return "solid"; if (ty >= this.#map.height) return "empty";
    const offset = (this.#map.layers.collisions[ty * this.#map.width + tx] ?? 0) - this.#map.tileset.tileCount;
    return (["empty", "solid", "platform", "stairs", "stairsTop"] as const)[offset] ?? "empty";
  }
  #grounded(platforms: readonly PlayerPlatform[]): boolean {
    const y = this.#y + HEIGHT + .5, tile = (x: number): boolean => ["solid", "platform", "stairsTop"].includes(this.#tileKindAt(x, y));
    if (tile(this.#x + BOX_X) || tile(this.#x + BOX_X + WIDTH - 1)) return true;
    return platforms.some((platform) => this.#overlapsX(platform) && Math.abs(this.#y + HEIGHT - platform.y) <= 1);
  }
  #touchingStairs(): boolean {
    const xs = [this.#x + BOX_X, this.#x + BOX_X + WIDTH / 2, this.#x + BOX_X + WIDTH - 1];
    return xs.some((x) => [this.#y + 1, this.#y + HEIGHT / 2, this.#y + HEIGHT - 1].some((y) => ["stairs", "stairsTop"].includes(this.#tileKindAt(x, y))));
  }
  #canDescendStairs(): boolean {
    const y = this.#y + HEIGHT + 1;
    return [this.#x + BOX_X, this.#x + BOX_X + WIDTH / 2, this.#x + BOX_X + WIDTH - 1].some((x) => ["stairs", "stairsTop"].includes(this.#tileKindAt(x, y)));
  }
  #overlapsX(platform: PlayerPlatform): boolean { return this.#x + BOX_X < platform.x + platform.width && this.#x + BOX_X + WIDTH > platform.x; }
  #carryWithPlatform(platforms: readonly PlayerPlatform[]): void { const support = platforms.find((platform) => this.#overlapsX(platform) && Math.abs(this.#y + HEIGHT - (platform.y - platform.dy)) <= 1); if (support) { this.#moveX(support.dx); this.#y += support.dy; } }
  #moveX(dx: number): boolean { const next = this.#x + dx, edge = dx > 0 ? next + BOX_X + WIDTH - 1 : next + BOX_X; if (this.#tileKindAt(edge, this.#y) === "solid" || this.#tileKindAt(edge, this.#y + HEIGHT - 1) === "solid") return false; this.#x = next; return true; }
  #moveY(dy: number, platforms: readonly PlayerPlatform[], climbing = false): boolean {
    const next = this.#y + dy, edge = dy > 0 ? next + HEIGHT : next;
    const kinds = [this.#tileKindAt(this.#x + BOX_X, edge), this.#tileKindAt(this.#x + BOX_X + WIDTH - 1, edge)];
    if (kinds.includes("solid")) { if (dy > 0) this.#y = Math.floor(edge / this.#map.tileHeight) * this.#map.tileHeight - HEIGHT; return false; }
    const previousBottom = this.#y + HEIGHT, nextBottom = next + HEIGHT;
    if (dy > 0 && !climbing && kinds.some((kind) => kind === "platform" || kind === "stairsTop") && Math.floor(previousBottom / this.#map.tileHeight) < Math.floor(nextBottom / this.#map.tileHeight)) { this.#y = Math.floor(edge / this.#map.tileHeight) * this.#map.tileHeight - HEIGHT; return false; }
    if (dy > 0 && !climbing) for (const platform of platforms) if (this.#overlapsX(platform) && previousBottom <= platform.y && nextBottom >= platform.y) { this.#y = platform.y - HEIGHT; return false; }
    this.#y = next; return true;
  }
  #activateCheckpoint(): void {
    const left = this.#x + BOX_X, right = left + WIDTH, top = this.#y, bottom = top + HEIGHT;
    for (const checkpoint of this.#checkpoints) if (left < checkpoint.x + checkpoint.width && right > checkpoint.x && top < checkpoint.y + checkpoint.height && bottom > checkpoint.y) {
      if (checkpoint.id === this.#activeCheckpoint) return; this.#activeCheckpoint = checkpoint.id; this.#spawn = { x: checkpoint.spawnX, y: checkpoint.spawnY, face: checkpoint.face }; return;
    }
  }
}
