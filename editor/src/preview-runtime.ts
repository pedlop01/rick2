import type { EditableLevel } from "./level-document";
import { levelObjective, runtimeProfileBindings, sessionRules, type LevelObjective, type PlayerActionBindings, type PlayerCapabilities, type PlayerControllerConfig, type RuntimeProfileBindingOverrides, type RuntimeProfileBindings, type SessionRules } from "./platformer-core";
import { RuntimeBehaviorRegistry } from "./runtime-behaviors";
import { WebPlayer, type PlayerInput, type PlayerObstacle, type PlayerPlatform, type PlayerSnapshot } from "./web-player";

export type RuntimeBodyKind = "player" | "platform" | "hazard" | "item" | "block" | "background" | "laser" | "enemy" | "shoot" | "bomb";
export interface RuntimeBody { key: string; kind: RuntimeBodyKind; x: number; y: number; width: number; height: number; frame: number; definition?: string; state?: string; face?: "left" | "right"; spriteX?: number; spriteY?: number; animationOnce?: boolean; spriteScale?: number; spriteVisible?: boolean; }
export interface PreviewRuntimeOptions { playerController?: Partial<PlayerControllerConfig>; playerCapabilities?: Partial<PlayerCapabilities>; playerActionBindings?: Partial<PlayerActionBindings>; sessionRules?: Partial<SessionRules>; runtimeBindings?: RuntimeProfileBindingOverrides; }
interface LaserMotion { startX: number; startY: number; dx: number; dy: number; defaultActive: boolean; bbX: number; bbY: number; }
type MovingBodyKind = "platform" | "hazard" | "item" | "block" | "background" | "laser";
interface BodyTraits { solid: boolean; damaging: boolean; collectible: boolean; destructible: boolean; }
interface PickupBehavior { mode: "instant" | "rise"; audioSlot: number | null; durationTicks: number; riseSpeed: number; }
interface MovingBody extends RuntimeBody { kind: MovingBodyKind; traits: BodyTraits; actions: Array<Record<string, unknown>>; action: number; progress: number; wait: number; recursive: boolean; visible: boolean; active: boolean; condActions: boolean; oneUse?: boolean; used?: boolean; stopInactive?: boolean; destructionMode?: "instant" | "animated" | "escape"; pickup?: PickupBehavior; escapeRemaining?: number; fallSpeed?: number; laser?: LaserMotion; }
interface RuntimeTarget { key: string; delay: number; trigger: boolean; triggerCond: boolean; completed: boolean; }
interface RuntimeTrigger { key: string; x: number; y: number; width: number; height: number; action: string; face: string; recursive: boolean; wasIn: boolean; alreadyTriggered: boolean; firing: boolean; steps: number; previousAction: boolean; targets: RuntimeTarget[]; }
interface RuntimeCameraView { id: number; left: number; top: number; right: number; bottom: number; }
interface TransientBody extends RuntimeBody { kind: "shoot" | "bomb"; vx: number; vy: number; age: number; fuse: number; explosion: number; exploding: boolean; bbX: number; bbY: number; bbWidth: number; bbHeight: number; contactBlockKey?: string; }
type EnemyAIKind = "walker" | "chaser";
interface EnemyBody extends RuntimeBody { kind: "enemy"; spriteX: number; spriteY: number; bbX: number; bbY: number; direction: -1 | 1; speedX: number; speedY: number; verticalSpeed: number; iaType: EnemyAIKind; originX: number; originY: number; limitX: number; limitY: number; blockSteps: number; decisionLock: number; randomDecisions: boolean; randomness: number; randomState: number; climbing: boolean; animationState: "running" | "climbing" | "dying"; frozenTicks: number; dyingTicks: number; alive: boolean; }
interface EnemyStepContext { enemy: EnemyBody; player: PlayerSnapshot; spriteX: number; spriteY: number; insideChaseZone: boolean; decisionsBlocked: boolean; movementConsumed: boolean; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function number(value: unknown, fallback = 0): number { return typeof value === "number" ? value : fallback; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : value === undefined ? [] : [value]; }
const NO_TRAITS: BodyTraits = Object.freeze({ solid: false, damaging: false, collectible: false, destructible: false });

const NO_INPUT: PlayerInput = { left: false, right: false, up: false, down: false, action: false };
export class PreviewRuntime {
  readonly #source: EditableLevel; readonly #player: WebPlayer; readonly #sessionRules: Readonly<SessionRules>; readonly #bindings: Readonly<RuntimeProfileBindings>; readonly #objective: Readonly<LevelObjective>; readonly #bodyBehaviors: RuntimeBehaviorRegistry<MovingBodyKind, MovingBody>; readonly #enemyBehaviors: RuntimeBehaviorRegistry<EnemyAIKind, EnemyStepContext>; #tick = 0; #playerAnimationState = "stop"; #playerAnimationTicks = 0; #playerAnimationMoving = false; #bodies: MovingBody[] = []; #enemies: EnemyBody[] = []; #transients: TransientBody[] = []; #triggers: RuntimeTrigger[] = []; #cameraViews: RuntimeCameraView[] = []; #cameraViewsEnabled = true; #cameraFrame = { x: 0, y: 0, width: 256, height: 200, viewId: -1 }; #audioEvents: number[] = []; #invulnerable = false; #dangerContact = false; #lives = 3; #gameOver = false; #completed = false;
  constructor(level: EditableLevel, options: PreviewRuntimeOptions = {}) {
    this.#source = structuredClone(level);
    this.#objective = levelObjective(this.#source.objective);
    const profile = record(this.#source.runtimeProfile);
    const profileController = record(profile.controller) as Partial<PlayerControllerConfig>;
    const profileCapabilities = record(profile.capabilities) as Partial<PlayerCapabilities>;
    const profileActions = record(profile.actionBindings) as Partial<PlayerActionBindings>;
    this.#player = new WebPlayer(this.#source, { ...profileController, ...options.playerController }, { ...profileCapabilities, ...options.playerCapabilities }, { ...profileActions, ...options.playerActionBindings });
    const levelSession = record(this.#source.session);
    this.#sessionRules = sessionRules({ initialLives: number(levelSession.initialLives, 3), ...record(profile.session) as Partial<SessionRules>, ...options.sessionRules });
    const profileBindings = record(profile.bindings);
    this.#bindings = runtimeProfileBindings({
      playerStates: { ...record(profileBindings.playerStates), ...options.runtimeBindings?.playerStates },
      enemyStates: { ...record(profileBindings.enemyStates), ...options.runtimeBindings?.enemyStates },
      objectStates: { ...record(profileBindings.objectStates), ...options.runtimeBindings?.objectStates },
      audio: { ...record(profileBindings.audio), ...options.runtimeBindings?.audio },
    } as RuntimeProfileBindingOverrides);
    this.#bodyBehaviors = new RuntimeBehaviorRegistry<MovingBodyKind, MovingBody>()
      .register("platform", (body) => this.#stepMovingBody(body))
      .register("hazard", (body) => this.#stepMovingBody(body))
      .register("item", (body) => this.#stepItemBehavior(body))
      .register("block", (body) => this.#stepBlock(body))
      .register("background", (body) => { body.frame += 1; })
      .register("laser", (body) => this.#stepLaser(body));
    this.#enemyBehaviors = new RuntimeBehaviorRegistry<EnemyAIKind, EnemyStepContext>()
      .register("walker", (context) => this.#stepWalkerAI(context))
      .register("chaser", (context) => this.#stepChaserAI(context));
    this.reset();
  }
  get tick(): number { return this.#tick; }
  get player(): PlayerSnapshot { return this.#player.snapshot; }
  get invulnerable(): boolean { return this.#invulnerable; }
  get dangerContact(): boolean { return this.#dangerContact; }
  get lives(): number { return this.#lives; }
  get gameOver(): boolean { return this.#gameOver; }
  get completed(): boolean { return this.#completed; }
  get cameraViewsEnabled(): boolean { return this.#cameraViewsEnabled; }
  get cameraFrame(): Readonly<{ x: number; y: number; width: number; height: number; viewId: number }> { return this.#cameraFrame; }
  setInvulnerable(enabled: boolean): void { this.#invulnerable = enabled; }
  setCameraViewsEnabled(enabled: boolean): void { this.#cameraViewsEnabled = enabled; this.#updateCamera(true); }
  drainAudioEvents(): number[] { return this.#audioEvents.splice(0); }
  placePlayerAt(worldX: number, worldY: number): void { if (this.#gameOver) { this.#gameOver = false; this.#lives = 1; } this.#player.placeAtFeet(worldX, worldY); this.#playerAnimationState = this.#player.snapshot.state; this.#playerAnimationTicks = 0; this.#playerAnimationMoving = false; this.#dangerContact = false; this.#updateCamera(true); }
  moveEntity(group: string, id: unknown, x: number, y: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const key = `${group}:${String(id)}`, entities = record(this.#source.entities), source = list(entities[group]).map(record).find((entity) => String(entity.id) === String(id));
    if (!source) return false;
    if (["platforms", "items", "backgroundObjects", "blocks", "hazards"].includes(group)) { const attributes = record(source.attributes); attributes.ini_x = x; attributes.ini_y = y; const body = this.#bodies.find((candidate) => candidate.key === key); if (!body) return false; body.x = x; body.y = y; return true; }
    if (group === "lasers") { const bbX = number(source.bb_x), bbY = number(source.bb_y); source.x = x - bbX; source.y = y - bbY; const body = this.#bodies.find((candidate) => candidate.key === key); if (!body?.laser) return false; body.x = x; body.y = y; body.spriteX = x - bbX; body.spriteY = y - bbY; body.laser.startX = x; body.laser.startY = y; return true; }
    if (group === "enemies") { const body = this.#enemies.find((candidate) => candidate.key === key); if (!body) return false; const dx = x - body.x, dy = y - body.y; source.x = x - body.bbX; source.y = y - body.bbY; if (typeof source.ia_orig_x === "number") source.ia_orig_x += dx; if (typeof source.ia_orig_y === "number") source.ia_orig_y += dy; body.x = x; body.y = y; body.spriteX = x - body.bbX; body.spriteY = y - body.bbY; body.originX += dx; body.originY += dy; body.verticalSpeed = 0; body.climbing = false; return true; }
    if (group === "triggers") { const attributes = record(source.attributes), trigger = this.#triggers.find((candidate) => candidate.key === key); attributes.x = x; attributes.y = y; if (!trigger) return false; trigger.x = x; trigger.y = y; trigger.wasIn = false; return true; }
    if (group === "cameraViews") { const width = number(source.right_down_x) - number(source.left_up_x), height = number(source.right_down_y) - number(source.left_up_y); source.left_up_x = x; source.left_up_y = y; source.right_down_x = x + width; source.right_down_y = y + height; const view = this.#cameraViews.find((candidate) => candidate.id === number(id)); if (!view) return false; view.left = x; view.top = y; view.right = x + width; view.bottom = y + height; this.#updateCamera(true); return true; }
    return false;
  }
  resizeEntity(group: string, id: unknown, width: number, height: number): boolean {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
    const nextWidth = Math.max(1, Math.round(width)), nextHeight = Math.max(1, Math.round(height));
    const key = `${group}:${String(id)}`, entities = record(this.#source.entities), source = list(entities[group]).map(record).find((entity) => String(entity.id) === String(id));
    if (!source) return false;
    if (["platforms", "items", "backgroundObjects", "blocks", "hazards"].includes(group)) { const attributes = record(source.attributes); attributes.width = nextWidth; attributes.height = nextHeight; const body = this.#bodies.find((candidate) => candidate.key === key); if (!body) return false; body.width = nextWidth; body.height = nextHeight; return true; }
    if (group === "lasers") { source.bb_width = nextWidth; source.bb_height = nextHeight; const body = this.#bodies.find((candidate) => candidate.key === key); if (!body) return false; body.width = nextWidth; body.height = nextHeight; return true; }
    if (group === "enemies") { source.bb_width = nextWidth; source.bb_height = nextHeight; const body = this.#enemies.find((candidate) => candidate.key === key); if (!body) return false; body.width = nextWidth; body.height = nextHeight; return true; }
    if (group === "triggers") { const attributes = record(source.attributes), trigger = this.#triggers.find((candidate) => candidate.key === key); attributes.width = nextWidth; attributes.height = nextHeight; if (!trigger) return false; trigger.width = nextWidth; trigger.height = nextHeight; return true; }
    if (group === "cameraViews") { source.right_down_x = number(source.left_up_x) + nextWidth; source.right_down_y = number(source.left_up_y) + nextHeight; const view = this.#cameraViews.find((candidate) => candidate.id === number(id)); if (!view) return false; view.right = view.left + nextWidth; view.bottom = view.top + nextHeight; this.#updateCamera(true); return true; }
    return false;
  }
  get bodies(): readonly RuntimeBody[] { const player = this.#player.snapshot, playerDefinition = String(record(this.#source.player).definition ?? "characters/rick"), playerState = this.#bindings.playerStates[player.state]; return [...this.#bodies.filter((body) => body.visible), ...this.#enemies.filter((enemy) => enemy.alive).map((enemy) => ({ ...enemy, state: enemy.dyingTicks > 0 ? this.#bindings.enemyStates.dying : enemy.climbing ? this.#bindings.enemyStates.climbing : this.#bindings.enemyStates.running, face: enemy.direction > 0 ? "right" as const : "left" as const, animationOnce: enemy.dyingTicks > 0, spriteVisible: enemy.frozenTicks === 0 || Math.floor((100 - enemy.frozenTicks) / 4) % 2 === 0 })), ...this.#transients, { key: "player", kind: "player", x: player.collisionX, y: player.collisionY, width: player.collisionWidth, height: player.collisionHeight, frame: this.#playerAnimationTicks, definition: playerDefinition, state: playerState, face: player.face, spriteX: player.x, spriteY: player.y, animationOnce: player.state === "crouching" && !this.#playerAnimationMoving, spriteScale: this.#player.deathScale }]; }
  reset(): void {
    this.#tick = 0; this.#lives = this.#sessionRules.initialLives; this.#gameOver = false; this.#completed = false; this.#player.reset(); this.#playerAnimationState = this.#player.snapshot.state; this.#playerAnimationTicks = 0; this.#playerAnimationMoving = false; this.#dangerContact = false; this.#bodies = []; this.#enemies = []; this.#transients = []; this.#triggers = []; this.#cameraViews = []; this.#audioEvents = []; const entities = record(this.#source.entities);
    for (const group of ["platforms", "hazards"]) for (const raw of list(entities[group])) { const entity = record(raw); const attributes = record(entity.attributes); const actions = list(record(entity.actions).action).map(record); const active = group === "hazards" ? Boolean(attributes.trigger) : attributes.ini_state === undefined || attributes.ini_state === "moving"; this.#bodies.push({ key: `${group}:${String(entity.id)}`, kind: group === "hazards" ? "hazard" : "platform", traits: group === "hazards" ? { ...NO_TRAITS, damaging: true } : NO_TRAITS, x: number(attributes.ini_x), y: number(attributes.ini_y), width: number(attributes.width, 8), height: number(attributes.height, 8), frame: 0, definition: String(attributes.definition ?? ""), state: active ? "OBJ_STATE_MOVING" : "OBJ_STATE_STOP", actions, action: 0, progress: 0, wait: 0, recursive: group === "hazards" ? Boolean(attributes.trigger) : Boolean(attributes.recursive), visible: group === "platforms" ? attributes.visible !== 0 : active || !Boolean(attributes.stop_inactive), active, condActions: false, oneUse: group === "platforms" && Boolean(attributes.one_use), used: false, stopInactive: group === "hazards" && Boolean(attributes.stop_inactive) }); }
    for (const group of ["items", "blocks"]) for (const raw of list(entities[group])) { const entity = record(raw), attributes = record(entity.attributes), definition = String(attributes.definition ?? ""), definitionData = record(record(this.#source.definitions)[definition]), definitionName = String(definitionData.name ?? definition.split("/").pop() ?? ""), bonus = group === "items" && definitionName === "bonus", explosive = attributes.exploits === undefined || Boolean(attributes.exploits); this.#bodies.push({ key: `${group}:${String(entity.id)}`, kind: group === "items" ? "item" : "block", traits: group === "items" ? { ...NO_TRAITS, collectible: true, destructible: true } : { ...NO_TRAITS, solid: true, destructible: true }, x: number(attributes.ini_x), y: number(attributes.ini_y), width: number(attributes.width, 8), height: number(attributes.height, 8), frame: 0, definition, state: "OBJ_STATE_STOP", actions: [], action: 0, progress: 0, wait: 0, recursive: false, visible: true, active: false, condActions: false, destructionMode: group === "blocks" ? explosive ? "animated" : "escape" : bonus ? "instant" : "animated", pickup: group === "items" ? bonus ? { mode: "rise", audioSlot: 4, durationTicks: 30, riseSpeed: 3 } : { mode: "instant", audioSlot: 5, durationTicks: 0, riseSpeed: 0 } : undefined }); }
    for (const raw of list(entities.backgroundObjects)) { const entity = record(raw), attributes = record(entity.attributes); this.#bodies.push({ key: `backgroundObjects:${String(entity.id)}`, kind: "background", traits: NO_TRAITS, x: number(attributes.ini_x), y: number(attributes.ini_y), width: number(attributes.width, 8), height: number(attributes.height, 8), frame: Math.max(0, number(attributes.skip_num_anims)), definition: String(attributes.definition ?? ""), state: "OBJ_STATE_MOVING", actions: [], action: 0, progress: 0, wait: 0, recursive: false, visible: true, active: false, condActions: false }); }
    for (const raw of list(entities.enemies)) {
      const enemy = record(raw), spriteX = number(enemy.x), spriteY = number(enemy.y), bbX = number(enemy.bb_x), bbY = number(enemy.bb_y);
      const iaType = String(enemy.ia_type ?? "walker") as EnemyAIKind;
      if (!this.#enemyBehaviors.has(iaType)) throw new Error(`Unregistered enemy AI: ${iaType}`);
      this.#enemies.push({ key: `enemies:${String(enemy.id)}`, kind: "enemy", x: spriteX + bbX, y: spriteY + bbY, spriteX, spriteY, bbX, bbY, width: number(enemy.bb_width, 10), height: number(enemy.bb_height, 21), frame: 0, definition: String(enemy.definition ?? ""), direction: enemy.direction === "left" ? -1 : 1, speedX: Math.max(0, number(enemy.speed_x, 1)), speedY: Math.max(0, number(enemy.speed_y, 3)), verticalSpeed: 0, iaType, originX: number(enemy.ia_orig_x, spriteX), originY: number(enemy.ia_orig_y, spriteY), limitX: Math.max(0, number(enemy.ia_limit_x)), limitY: Math.max(0, number(enemy.ia_limit_y)), blockSteps: Math.max(1, number(enemy.ia_block_steps, 1)), decisionLock: 0, randomDecisions: Boolean(enemy.ia_random), randomness: Math.max(1, Math.floor(number(enemy.ia_randomness, 15))), randomState: (Math.imul(Math.floor(number(enemy.id)) + 1, 0x9e3779b1) >>> 0), climbing: false, animationState: "running", frozenTicks: 0, dyingTicks: 0, alive: true });
    }
    for (const raw of list(entities.lasers)) {
      const laser = record(raw), bbX = number(laser.bb_x), bbY = number(laser.bb_y), startX = number(laser.x) + bbX, startY = number(laser.y) + bbY, speed = Math.max(0, number(laser.speed));
      const horizontal = laser.type === "vertical" ? 0 : laser.direction === "left" ? -speed : speed;
      const vertical = laser.type === "horizontal" ? 0 : speed;
      const defaultActive = Boolean(laser.default_trigger);
      this.#bodies.push({ key: `lasers:${String(laser.id)}`, kind: "laser", traits: { ...NO_TRAITS, damaging: true }, x: startX, y: startY, width: number(laser.bb_width, 8), height: number(laser.bb_height, 8), frame: 0, definition: String(laser.definition ?? ""), state: "OBJ_STATE_MOVING", face: laser.direction === "left" ? "left" : "right", spriteX: number(laser.x), spriteY: number(laser.y), actions: [], action: 0, progress: 0, wait: 0, recursive: Boolean(laser.recursive), visible: defaultActive, active: defaultActive, condActions: false, laser: { startX, startY, dx: horizontal, dy: vertical, defaultActive, bbX, bbY } });
    }
    for (const raw of list(entities.triggers)) { const trigger = record(raw), attributes = record(trigger.attributes); const targets = list(record(trigger.targets).target).map((rawTarget) => { const target = record(rawTarget); const group = target.type === "platform" ? "platforms" : target.type === "hazard" ? "hazards" : "lasers"; return { key: `${group}:${String(target.id)}`, delay: Math.max(0, number(target.delay)), trigger: Boolean(target.trigger), triggerCond: Boolean(target.trigger_cond), completed: false }; }); this.#triggers.push({ key: `triggers:${String(trigger.id)}`, x: number(attributes.x), y: number(attributes.y), width: number(attributes.width, 8), height: number(attributes.height, 8), action: String(attributes.action ?? "enters"), face: String(attributes.face ?? "any"), recursive: Boolean(attributes.recursive), wasIn: false, alreadyTriggered: false, firing: false, steps: 0, previousAction: false, targets }); }
    for (const raw of list(entities.cameraViews)) { const view = record(raw); this.#cameraViews.push({ id: number(view.id), left: number(view.left_up_x), top: number(view.left_up_y), right: number(view.right_down_x), bottom: number(view.right_down_y) }); }
    // v1 adapter: translate Rick's legacy state/audio identifiers once. The
    // simulation below only consumes the selected runtime profile bindings.
    for (const body of this.#bodies) {
      if (body.state === "OBJ_STATE_STOP") body.state = this.#bindings.objectStates.stop;
      else if (body.state === "OBJ_STATE_MOVING") body.state = this.#bindings.objectStates.moving;
      if (body.pickup) body.pickup.audioSlot = body.pickup.mode === "rise" ? this.#bindings.audio.bonusPickup : this.#bindings.audio.itemPickup;
    }
    this.#updateCamera(true);
  }
  step(input: PlayerInput = NO_INPUT): void {
    if (this.#completed && this.#objective.type === "reachZone" && this.#objective.onComplete === "freeze") return;
    this.#tick += 1;
    const previous = new Map(this.#bodies.map((body) => [body.key, { x: body.x, y: body.y }]));
    for (const body of this.#bodies) this.#stepBody(body);
    this.#transients = this.#transients.filter((body) => this.#stepTransient(body, previous));
    for (const enemy of this.#enemies) this.#stepEnemy(enemy);
    const platforms: PlayerPlatform[] = this.#bodies.filter((body) => body.kind === "platform").map((body) => { const old = previous.get(body.key)!; return { key: body.key, x: body.x, y: body.y, width: body.width, height: body.height, dx: body.x - old.x, dy: body.y - old.y }; });
    const beforePlayer = this.#player.snapshot, wasDead = beforePlayer.state === "dead";
    const obstacles: PlayerObstacle[] = this.#invulnerable ? [] : this.#bodies.filter((body) => body.visible && body.state === this.#bindings.objectStates.stop && body.traits.solid).map((body) => ({ key: body.key, x: body.x, y: body.y, width: body.width, height: body.height }));
    if (!this.#gameOver) this.#player.step(input, platforms, obstacles, this.#cameraFrame.y + this.#cameraFrame.height);
    const afterPlayer = this.#player.snapshot, animationMoving = afterPlayer.x !== beforePlayer.x || (afterPlayer.state === "climbing" && afterPlayer.y !== beforePlayer.y), animationState = `${afterPlayer.state}:${animationMoving ? "moving" : "still"}`; if (afterPlayer.state === "climbing" && !animationMoving) this.#playerAnimationTicks = 0; else if (animationState === this.#playerAnimationState) this.#playerAnimationTicks += 1; else this.#playerAnimationTicks = 0; this.#playerAnimationState = animationState; this.#playerAnimationMoving = animationMoving;
    if (!wasDead && this.#player.snapshot.state === "dead") this.#loseLife();
    this.#createProjectile(input);
    this.#collectItems();
    if (!this.#gameOver && this.#player.snapshot.state !== "dead") this.#stepTriggers(input);
    const player = this.#player.snapshot, left = player.collisionX, right = left + player.collisionWidth, top = player.collisionY, bottom = top + player.collisionHeight;
    const worldDanger = this.#bodies.some((body) => body.visible && body.active && body.traits.damaging && left < body.x + body.width && right > body.x && top < body.y + body.height && bottom > body.y);
    const enemyDanger = this.#enemyContact(left, top, right - left, bottom - top);
    const bombDanger = this.#transients.some((body) => body.kind === "bomb" && body.exploding && left < body.x + body.bbX + body.bbWidth && right > body.x + body.bbX && top < body.y + body.bbY + body.bbHeight && bottom > body.y + body.bbY);
    this.#dangerContact = player.state !== "dead" && (worldDanger || enemyDanger || bombDanger);
    if (this.#dangerContact && this.#sessionRules.damageEnabled && !this.#invulnerable) { this.#player.kill(); this.#loseLife(); }
    this.#updateCamera(false);
    this.#updateObjective();
  }
  #updateObjective(): void { if (this.#completed || this.#objective.type === "none") return; const player = this.#player.snapshot, objective = this.#objective; this.#completed = player.state !== "dead" && player.collisionX < objective.x + objective.width && player.collisionX + player.collisionWidth > objective.x && player.collisionY < objective.y + objective.height && player.collisionY + player.collisionHeight > objective.y; }
  #updateCamera(force: boolean): void {
    const player = this.#player.snapshot; if (!force && player.state === "dead") return;
    const config = record(this.#source.camera), width = Math.max(1, number(config.width, 256)), height = Math.max(1, number(config.height, 200)), probeX = player.x + (player.face === "right" ? 23 : 0), probeY = player.y;
    const candidates = this.#cameraViewsEnabled ? this.#cameraViews.filter((view) => probeX >= view.left && probeX < view.right && probeY >= view.top && probeY < view.bottom) : []; let view = candidates[0]; for (const candidate of candidates.slice(1)) if ((player.face === "right" && candidate.left > view!.left) || (player.face === "left" && candidate.left < view!.left)) view = candidate;
    if (this.#cameraViewsEnabled && !view) view = this.#cameraViews.find((candidate) => candidate.id === this.#cameraFrame.viewId); const mapWidth = this.#source.map.width * this.#source.map.tileWidth, mapHeight = this.#source.map.height * this.#source.map.tileHeight, left = view?.left ?? 0, top = view?.top ?? 0, right = view?.right ?? mapWidth, bottom = view?.bottom ?? mapHeight, frameWidth = Math.min(width, right - left), frameHeight = Math.min(height, bottom - top), x = Math.min(right - frameWidth, Math.max(left, player.x - frameWidth / 2)), y = Math.min(bottom - frameHeight, Math.max(top, player.y - frameHeight / 2));
    this.#cameraFrame = { x, y, width: frameWidth, height: frameHeight, viewId: view?.id ?? -1 };
  }
  #stepBody(body: MovingBody): void {
    this.#bodyBehaviors.run(body.kind, body);
  }
  #stepDyingBody(body: MovingBody): boolean {
    if (body.state !== this.#bindings.objectStates.dying) return false;
    body.frame += 1; body.wait -= 1;
    if (body.pickup?.mode === "rise") body.y -= body.pickup.riseSpeed;
    if (body.wait <= 0) body.visible = false;
    return true;
  }
  #stepItemBehavior(body: MovingBody): void { if (!this.#stepDyingBody(body)) this.#stepItem(body); }
  #stepBlock(body: MovingBody): void {
    if (this.#stepDyingBody(body)) return;
    if (body.state === this.#bindings.objectStates.moving && body.escapeRemaining !== undefined) { const movement = Math.min(10, body.escapeRemaining); body.x -= movement; body.escapeRemaining -= movement; body.frame += 1; if (body.escapeRemaining <= 0) body.visible = false; return; }
    this.#stepMovingBody(body);
  }
  #stepMovingBody(body: MovingBody): void {
    if (!body.active) return;
    body.state = this.#bindings.objectStates.moving;
    while (body.action < body.actions.length) { const condition = number(body.actions[body.action]?.cond); if (condition === 0 || (condition === 1 && body.condActions) || (condition === 2 && !body.condActions)) break; body.action += 1; body.progress = 0; body.wait = 0; }
    if (body.wait > 0) { body.wait -= 1; if (body.wait === 0 && body.action >= body.actions.length) this.#finishBodySequence(body); return; } const action = body.actions[body.action]; if (!action) return;
    const distance = Math.max(0, number(action.desp)); const speed = Math.max(0, number(action.speed)); const remaining = Math.max(0, distance - body.progress); const movement = Math.min(speed, remaining); const direction = action.direction;
    if (body.kind === "hazard") { body.visible = direction !== "deactivate"; body.state = direction === "stop" || direction === "deactivate" ? this.#bindings.objectStates.stop : this.#bindings.objectStates.moving; }
    if (direction === "left") body.x -= movement; if (direction === "right") body.x += movement; if (direction === "up") body.y -= movement; if (direction === "down") body.y += movement; body.progress += movement;
    if (direction === "stop" || direction === "deactivate" || body.progress >= distance) { body.wait = distance === 0 ? Math.max(0, number(action.wait)) : 0; body.progress = 0; body.action += 1; if (body.action >= body.actions.length) { if (body.recursive) body.action = 0; else if (body.wait === 0) this.#finishBodySequence(body); } }
    body.frame = this.#tick;
  }
  #finishBodySequence(body: MovingBody): void { body.active = false; body.state = this.#bindings.objectStates.stop; if (body.oneUse) body.used = true; if (body.kind === "hazard") body.visible = !body.stopInactive; }
  #stepItem(body: MovingBody): void {
    const player = this.#player.snapshot, touchingPlayer = player.state !== "dead" && player.collisionX < body.x + body.width && player.collisionX + player.collisionWidth > body.x && player.collisionY < body.y + body.height && player.collisionY + player.collisionHeight > body.y; if (touchingPlayer) return;
    const supported = [body.x + 1, body.x + body.width - 1].some((x) => ["solid", "platform", "stairsTop"].includes(this.#tileKindAt(x, body.y + body.height + .5)));
    if (supported) { body.state = this.#bindings.objectStates.stop; body.fallSpeed = 0; return; }
    const speed = Math.min(3, body.fallSpeed && body.fallSpeed > 0 ? body.fallSpeed + .1 : 1), previousBottom = body.y + body.height, nextBottom = previousBottom + speed, tileHeight = this.#source.map.tileHeight, floorY = Math.floor(nextBottom / tileHeight) * tileHeight;
    const landing = previousBottom <= floorY && [body.x + 1, body.x + body.width - 1].some((x) => ["solid", "platform", "stairsTop"].includes(this.#tileKindAt(x, floorY + .5)));
    body.state = landing ? this.#bindings.objectStates.stop : this.#bindings.objectStates.moving; body.y = landing ? floorY - body.height : body.y + speed; body.fallSpeed = landing ? 0 : speed; body.frame += 1;
  }
  #stepLaser(body: MovingBody): void {
    const laser = body.laser!;
    if (body.state === this.#bindings.objectStates.dying) { body.frame += 1; body.wait -= 1; if (body.wait <= 0) { body.state = this.#bindings.objectStates.stop; body.visible = false; body.active = laser.defaultActive || body.recursive; body.x = laser.startX; body.y = laser.startY; body.spriteX = body.x - laser.bbX; body.spriteY = body.y - laser.bbY; } return; }
    if (!body.visible) { if (body.wait > 0) { body.wait -= 1; return; } if (!body.active) return; body.x = laser.startX; body.y = laser.startY; body.visible = true; body.state = this.#bindings.objectStates.moving; }
    const nextX = body.x + laser.dx, nextY = body.y + laser.dy;
    if (this.#mapCollision(nextX, nextY, body.width, body.height)) { body.state = this.#bindings.objectStates.dying; body.wait = this.#animationDuration(String(body.definition ?? ""), this.#bindings.objectStates.dying, 1); body.frame = 0; return; }
    const enemy = this.#enemyAt(nextX, nextY, body.width, body.height); if (enemy) this.#killEnemy(enemy);
    body.x = nextX; body.y = nextY; body.spriteX = body.x - laser.bbX; body.spriteY = body.y - laser.bbY; body.frame = this.#tick;
  }
  #stepEnemy(enemy: EnemyBody): void {
    if (!enemy.alive) return;
    if (enemy.dyingTicks > 0) { enemy.frame += 1; enemy.dyingTicks -= 1; if (enemy.dyingTicks === 0) enemy.alive = false; return; }
    if (enemy.frozenTicks > 0) { enemy.frozenTicks -= 1; return; }
    const player = this.#player.snapshot, spriteX = enemy.x - enemy.bbX, spriteY = enemy.y - enemy.bbY;
    const insideChaseZone = enemy.limitX > 0 && enemy.limitY > 0 && player.x >= enemy.originX && player.x < enemy.originX + enemy.limitX && player.y >= enemy.originY && player.y < enemy.originY + enemy.limitY;
    const decisionsBlocked = enemy.decisionLock > 0; if (decisionsBlocked) enemy.decisionLock -= 1;
    const context: EnemyStepContext = { enemy, player, spriteX, spriteY, insideChaseZone, decisionsBlocked, movementConsumed: false };
    this.#enemyBehaviors.run(enemy.iaType, context);
    if (context.movementConsumed) return;
    this.#stepEnemyHorizontalAndGravity(enemy);
  }
  #stepWalkerAI(context: EnemyStepContext): void { this.#stepEnemyRandomDecision(context); }
  #stepChaserAI(context: EnemyStepContext): void {
    const { enemy, player, spriteX, spriteY, insideChaseZone, decisionsBlocked } = context;
    if (!insideChaseZone) {
      this.#stepEnemyRandomDecision(context);
      if (enemy.climbing) { const landingY = this.#enemyStairsTopLandingY(enemy); if (landingY !== null) enemy.y = landingY; enemy.climbing = false; enemy.verticalSpeed = 0; }
      return;
    }
      const stairs = this.#enemyTouchesStairs(enemy), stairShaft = this.#enemyTouchesStairShaft(enemy), stairsBelow = this.#enemyHasStairsBelow(enemy), verticalDelta = player.y - spriteY;
      if (enemy.climbing && verticalDelta < -4 && !stairShaft) { const landingY = this.#enemyStairsTopLandingY(enemy); if (landingY !== null) enemy.y = landingY; }
      if (enemy.climbing && (Math.abs(verticalDelta) <= 4 || (verticalDelta < 0 ? !stairShaft : !(stairs || stairsBelow)))) enemy.climbing = false;
      const wantsDown = verticalDelta > 4 && stairsBelow, wantsUp = verticalDelta < -4 && stairShaft && (this.#enemyAlignedWithStairs(enemy) || this.#enemyGrounded(enemy));
      if (enemy.climbing || wantsDown || wantsUp) {
        const dy = verticalDelta > 0 ? Math.min(2, enemy.speedY) : verticalDelta < 0 ? -Math.min(2, enemy.speedY) : 0;
        const nextSpriteY = spriteY + dy, insideVerticalLimits = enemy.limitY === 0 || (nextSpriteY >= enemy.originY && nextSpriteY < enemy.originY + enemy.limitY);
        if (dy > 0 && insideVerticalLimits && this.#solidCollision(enemy.x, enemy.y + dy, enemy.width, enemy.height)) this.#alignEnemyToStairs(enemy);
        else if (dy < 0 && insideVerticalLimits && this.#solidCollision(enemy.x, enemy.y + dy, enemy.width, enemy.height)) { if (!this.#alignEnemyToStairs(enemy)) { enemy.climbing = false; enemy.direction = player.x > spriteX ? 1 : -1; const exitX = enemy.x + enemy.direction * enemy.speedX; if (!this.#solidCollision(exitX, enemy.y, enemy.width, enemy.height)) enemy.x = exitX; enemy.decisionLock = enemy.blockSteps; this.#finishEnemyAnimationTick(enemy); context.movementConsumed = true; return; } }
        else if (dy !== 0 && insideVerticalLimits && !this.#solidCollision(enemy.x, enemy.y + dy, enemy.width, enemy.height)) enemy.y += dy;
        const stillOnShaft = this.#enemyTouchesStairShaft(enemy); if (verticalDelta < 0 && !stillOnShaft) { const landingY = this.#enemyStairsTopLandingY(enemy); if (landingY !== null) enemy.y = landingY; }
        enemy.climbing = Math.abs(verticalDelta) > 4 && (verticalDelta < 0 ? stillOnShaft : this.#enemyTouchesStairs(enemy) || this.#enemyHasStairsBelow(enemy));
        enemy.verticalSpeed = 0; this.#finishEnemyAnimationTick(enemy);
        context.movementConsumed = true; return;
      }
      if (!decisionsBlocked) enemy.direction = player.x > spriteX ? 1 : -1;
  }
  #stepEnemyRandomDecision({ enemy, decisionsBlocked }: EnemyStepContext): void {
    if (enemy.randomDecisions && !decisionsBlocked && this.#randomEnemyDecision(enemy)) { enemy.direction = enemy.direction > 0 ? -1 : 1; enemy.decisionLock = enemy.blockSteps; }
  }
  #stepEnemyHorizontalAndGravity(enemy: EnemyBody): void {
    if (!this.#enemyWithinHorizontalLimits(enemy, enemy.direction) || !this.#enemyCanMoveHorizontally(enemy, enemy.direction)) {
      const reverse = enemy.direction > 0 ? -1 : 1; if (this.#enemyWithinHorizontalLimits(enemy, reverse) && this.#enemyCanMoveHorizontally(enemy, reverse)) { enemy.direction = reverse; enemy.x += reverse * enemy.speedX; } enemy.decisionLock = enemy.blockSteps;
    } else enemy.x += enemy.direction * enemy.speedX;
    if (!this.#enemyGrounded(enemy)) {
      const nextY = enemy.y + enemy.verticalSpeed, landingY = this.#enemyLandingY(enemy, nextY);
      if (landingY !== null) { enemy.y = landingY; enemy.verticalSpeed = 0; }
      else if (!this.#solidCollision(enemy.x, nextY, enemy.width, enemy.height)) { enemy.y = nextY; enemy.verticalSpeed = Math.min(enemy.speedY, enemy.verticalSpeed + .4); }
      else enemy.verticalSpeed = 0;
    }
    else enemy.verticalSpeed = 0;
    this.#finishEnemyAnimationTick(enemy);
  }
  #finishEnemyAnimationTick(enemy: EnemyBody): void { const state = enemy.climbing ? "climbing" : "running"; if (enemy.animationState === state) enemy.frame += 1; else { enemy.animationState = state; enemy.frame = 0; } enemy.spriteX = enemy.x - enemy.bbX; enemy.spriteY = enemy.y - enemy.bbY; }
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
      const hitting = player.state === "hitting";
      if (trigger.firing) {
        for (const target of trigger.targets) if (!target.completed && trigger.steps >= target.delay) { this.#setTarget(target); target.completed = true; }
        if (trigger.targets.every((target) => target.completed)) { trigger.alreadyTriggered = true; trigger.firing = false; trigger.steps = 0; for (const target of trigger.targets) target.completed = false; }
        else trigger.steps += 1;
        continue;
      }
      if (trigger.recursive && trigger.alreadyTriggered) { trigger.firing = true; trigger.steps = 0; trigger.previousAction = hitting; continue; }
      const inside = playerLeft < trigger.x + trigger.width && playerRight > trigger.x && playerTop < trigger.y + trigger.height && playerBottom > trigger.y;
      const enters = inside && !trigger.wasIn, stays = inside && trigger.wasIn, exits = !inside && trigger.wasIn;
      const event = trigger.action === "enters" ? enters : trigger.action === "stays" ? stays : trigger.action === "exits" ? exits : trigger.action === "hits" ? stays && hitting && !trigger.previousAction : false;
      const face = trigger.face === "any" || trigger.face === player.face;
      trigger.wasIn = inside; trigger.previousAction = hitting;
      if (event && face) { trigger.firing = true; trigger.steps = 0; }
    }
  }
  #setTarget(target: RuntimeTarget): void {
    const body = this.#bodies.find((candidate) => candidate.key === target.key); if (!body) return;
    body.condActions = target.triggerCond && !body.condActions;
    if (!target.trigger) { if (body.laser) { body.active = false; body.visible = false; } return; }
    if (body.active || body.used) return;
    body.active = true; body.state = this.#bindings.objectStates.moving; body.action = 0; body.progress = 0; body.wait = 0;
    if (body.laser) { body.visible = true; body.x = body.laser.startX; body.y = body.laser.startY; }
    else if (body.kind === "hazard") body.visible = true;
  }
  #resetTriggersAndLasers(): void {
    for (const trigger of this.#triggers) { trigger.wasIn = false; trigger.alreadyTriggered = false; trigger.firing = false; trigger.steps = 0; trigger.previousAction = false; for (const target of trigger.targets) target.completed = false; }
    for (const body of this.#bodies) if (body.laser) { body.x = body.laser.startX; body.y = body.laser.startY; body.spriteX = body.x - body.laser.bbX; body.spriteY = body.y - body.laser.bbY; body.active = body.laser.defaultActive; body.visible = body.laser.defaultActive; body.wait = 0; }
  }
  #loseLife(): void { this.#lives = Math.max(0, this.#lives - 1); this.#gameOver = this.#lives === 0 || this.#sessionRules.respawn === "none"; this.#emitAudio(this.#sessionRules.deathAudioSlot); if (this.#sessionRules.resetTriggersOnDeath) this.#resetTriggersAndLasers(); }
  #emitAudio(slot: number | null): void { if (slot !== null) this.#audioEvents.push(slot); }
  #createProjectile(input: PlayerInput): void {
    const player = this.#player.snapshot, config = record(this.#source.projectiles);
    if (player.state === "shooting" && !this.#transients.some((body) => body.kind === "shoot")) {
      const shoot = record(config.shoot), width = number(shoot.width, 12), height = number(shoot.height, 6), right = player.face === "right";
      this.#transients.push({ key: "shoot:0", kind: "shoot", x: right ? player.x + 23 : player.x - 10, y: player.y + 8 + number(shoot.yOffset), width, height, frame: this.#tick, definition: String(shoot.definition ?? ""), state: this.#bindings.objectStates.moving, face: player.face, vx: right ? 4 : -4, vy: 0, age: 0, fuse: 0, explosion: 0, exploding: false, bbX: 0, bbY: 0, bbWidth: width, bbHeight: height });
      this.#emitAudio(this.#bindings.audio.shot);
    }
    if (player.state === "bombing" && !this.#transients.some((body) => body.kind === "bomb")) {
      const bomb = record(config.bomb), bounds = record(bomb.boundingBox), width = number(bomb.width, 25), height = number(bomb.height, 22);
      this.#transients.push({ key: "bomb:0", kind: "bomb", x: player.x, y: player.y + number(bomb.yOffset, -1), width, height, frame: this.#tick, definition: String(bomb.definition ?? ""), state: this.#bindings.objectStates.moving, face: player.face, vx: input.left ? -1 : input.right ? 1 : 0, vy: 1, age: 0, fuse: this.#animationDuration(String(bomb.definition), this.#bindings.objectStates.moving, 72), explosion: this.#animationDuration(String(bomb.definition), this.#bindings.objectStates.dying, 25), exploding: false, bbX: Math.max(0, number(bounds.x, 8) - 1), bbY: Math.max(0, number(bounds.y, 10) - 1), bbWidth: number(bounds.width, 10), bbHeight: number(bounds.height, 13) });
      this.#emitAudio(this.#bindings.audio.bomb);
    }
  }
  #stepTransient(body: TransientBody, previous: ReadonlyMap<string, Readonly<{ x: number; y: number }>>): boolean {
    body.age += 1; body.frame = this.#tick;
    if (body.kind === "shoot") { const nextX = body.x + body.vx; if (this.#solidCollision(nextX, body.y, body.width, body.height)) return false; const enemy = this.#enemyAt(nextX, body.y, body.width, body.height); if (enemy) { this.#killEnemy(enemy); return false; } const hit = this.#bodyAt(nextX, body.y, body.width, body.height, "destructible"); if (hit) { if (!hit.traits.solid) this.#destroyBody(hit); return false; } body.x = nextX; return true; }
    if (!body.exploding && body.age >= body.fuse) { body.exploding = true; body.state = this.#bindings.objectStates.dying; body.age = 0; body.vx = 0; body.vy = 0; this.#emitAudio(this.#bindings.audio.explosion); this.#applyExplosion(body); return true; }
    if (body.exploding) { this.#applyExplosion(body); return body.age < body.explosion; }
    const supportY = body.y + body.bbY + body.bbHeight + 1, platform = this.#bodies.find((candidate) => candidate.visible && candidate.kind === "platform" && supportY >= candidate.y && supportY <= candidate.y + candidate.height && body.x + body.bbX <= candidate.x + candidate.width && body.x + body.bbX + body.bbWidth >= candidate.x);
    if (platform) { const old = previous.get(platform.key); body.y = platform.y - body.height; if (old && platform.x !== old.x) body.x += Math.sign(platform.x - old.x); body.vy = 0; }
    const nextX = body.x + body.vx, horizontalBlock = this.#restingBlockAt(nextX + body.bbX, body.y + body.bbY, body.bbWidth, body.bbHeight); if (!this.#solidCollision(nextX + body.bbX, body.y + body.bbY, body.bbWidth, body.bbHeight) && !horizontalBlock) body.x = nextX; else { body.vx = 0; if (horizontalBlock) body.contactBlockKey = horizontalBlock.key; }
    if (!platform) { const nextY = body.y + body.vy, landingY = this.#bombLandingY(body, nextY), verticalBlock = this.#restingBlockAt(body.x + body.bbX, nextY + body.bbY, body.bbWidth, body.bbHeight); if (landingY !== null) { body.y = landingY; body.vy = 0; } else if (!this.#solidCollision(body.x + body.bbX, nextY + body.bbY, body.bbWidth, body.bbHeight) && !verticalBlock) { body.y = nextY; body.vy = Math.min(5, body.vy + .4); } else { body.vy = 0; if (verticalBlock) body.contactBlockKey = verticalBlock.key; } }
    return true;
  }
  #bombLandingY(body: TransientBody, nextY: number): number | null {
    const map = this.#source.map, previousBottom = body.y + body.bbY + body.bbHeight, nextBottom = nextY + body.bbY + body.bbHeight; if (nextBottom < previousBottom) return null;
    const floorY = Math.floor(nextBottom / map.tileHeight) * map.tileHeight, supported = [body.x + body.bbX, body.x + body.bbX + body.bbWidth - 1].some((x) => ["solid", "platform", "stairsTop"].includes(this.#tileKindAt(x, floorY + .5)));
    return supported && previousBottom <= floorY && nextBottom >= floorY ? floorY - body.bbY - body.bbHeight : null;
  }
  #solidCollision(x: number, y: number, width: number, height: number): boolean {
    const map = this.#source.map, solid = map.tileset.tileCount + 1, points: Array<readonly [number, number]> = [[x, y], [x + width - 1, y], [x, y + height - 1], [x + width - 1, y + height - 1]];
    return points.some(([px, py]) => { const tx = Math.floor(px / map.tileWidth), ty = Math.floor(py / map.tileHeight); return tx < 0 || ty < 0 || tx >= map.width || ty >= map.height || (map.layers.collisions[ty * map.width + tx] ?? 0) === solid; });
  }
  #tileKindAt(x: number, y: number): "empty" | "solid" | "platform" | "stairs" | "stairsTop" {
    const map = this.#source.map, tx = Math.floor(x / map.tileWidth), ty = Math.floor(y / map.tileHeight);
    if (tx < 0 || tx >= map.width || ty < 0) return "solid"; if (ty >= map.height) return "empty";
    const offset = (map.layers.collisions[ty * map.width + tx] ?? 0) - map.tileset.tileCount;
    return (["empty", "solid", "platform", "stairs", "stairsTop"] as const)[offset] ?? "empty";
  }
  #enemyGrounded(enemy: EnemyBody): boolean { const y = enemy.y + enemy.height + .5; return [enemy.x, enemy.x + enemy.width - 1].some((x) => ["solid", "platform", "stairsTop"].includes(this.#tileKindAt(x, y))); }
  #enemyLandingY(enemy: EnemyBody, nextY: number): number | null {
    const map = this.#source.map, previousBottom = enemy.y + enemy.height, nextBottom = nextY + enemy.height;
    if (nextBottom < previousBottom) return null;
    let floorY: number | null = null;
    for (const x of [enemy.x, enemy.x + enemy.width - 1]) {
      const tileY = Math.floor(nextBottom / map.tileHeight) * map.tileHeight, kind = this.#tileKindAt(x, tileY + .5);
      if (["solid", "platform", "stairsTop"].includes(kind) && previousBottom <= tileY && nextBottom >= tileY) floorY = floorY === null ? tileY : Math.min(floorY, tileY);
    }
    return floorY === null ? null : floorY - enemy.height;
  }
  #enemyWithinHorizontalLimits(enemy: EnemyBody, direction: -1 | 1): boolean { if (enemy.limitX <= 0) return true; const nextSpriteX = enemy.x - enemy.bbX + direction * enemy.speedX; return nextSpriteX >= enemy.originX && nextSpriteX <= enemy.originX + enemy.limitX; }
  #enemyCanMoveHorizontally(enemy: EnemyBody, direction: -1 | 1): boolean { const nextX = enemy.x + direction * enemy.speedX; if (this.#solidCollision(nextX, enemy.y, enemy.width, enemy.height) || this.#restingBlockAt(nextX, enemy.y, enemy.width, enemy.height)) return false; if (!this.#enemyGrounded(enemy)) return true; const floorY = enemy.y + enemy.height + 1, left = this.#tileKindAt(nextX, floorY), right = this.#tileKindAt(nextX + enemy.width - 1, floorY), leading = direction > 0 ? right : left, trailing = direction > 0 ? left : right; return !(leading === "empty" && trailing !== "empty"); }
  #enemyTouchesStairs(enemy: EnemyBody): boolean { const x = enemy.x + enemy.width / 2; return [enemy.y + 1, enemy.y + enemy.height / 2, enemy.y + enemy.height - 1].some((y) => ["stairs", "stairsTop"].includes(this.#tileKindAt(x, y))); }
  #enemyTouchesStairShaft(enemy: EnemyBody): boolean { const x = enemy.x + enemy.width / 2; return [enemy.y + 1, enemy.y + enemy.height / 2, enemy.y + enemy.height - 1].some((y) => this.#tileKindAt(x, y) === "stairs"); }
  #enemyStairsTopLandingY(enemy: EnemyBody): number | null { const map = this.#source.map, footY = enemy.y + enemy.height - 1, x = enemy.x + enemy.width / 2; return this.#tileKindAt(x, footY) === "stairsTop" ? Math.floor(footY / map.tileHeight) * map.tileHeight - enemy.height : null; }
  #enemyAlignedWithStairs(enemy: EnemyBody): boolean { const ys = [enemy.y + 1, enemy.y + enemy.height / 2, enemy.y + enemy.height - 1]; return [enemy.x + .5, enemy.x + enemy.width - .5].every((x) => ys.some((y) => ["stairs", "stairsTop"].includes(this.#tileKindAt(x, y)))); }
  #enemyHasStairsBelow(enemy: EnemyBody): boolean { const x = enemy.x + enemy.width / 2, kind = this.#tileKindAt(x, enemy.y + enemy.height + 1); return kind === "stairs" || kind === "stairsTop"; }
  #alignEnemyToStairs(enemy: EnemyBody): boolean {
    const map = this.#source.map, centerX = enemy.x + enemy.width / 2; let row = -1, column = Math.floor(centerX / map.tileWidth);
    for (const y of [enemy.y + enemy.height / 2, enemy.y + enemy.height - 1, enemy.y + enemy.height + 1]) if (["stairs", "stairsTop"].includes(this.#tileKindAt(centerX, y))) { row = Math.floor(y / map.tileHeight); break; }
    if (row < 0) return false; const at = (x: number): boolean => ["stairs", "stairsTop"].includes(this.#tileKindAt(x * map.tileWidth + map.tileWidth / 2, row * map.tileHeight + map.tileHeight / 2));
    let left = column, right = column; while (left > 0 && at(left - 1)) left -= 1; while (right + 1 < map.width && at(right + 1)) right += 1;
    const minimum = left * map.tileWidth, maximum = (right + 1) * map.tileWidth - enemy.width, target = minimum <= maximum ? Math.min(maximum, Math.max(minimum, enemy.x)) : (minimum + (right + 1) * map.tileWidth - enemy.width) / 2;
    const dx = target - enemy.x; if (!dx || this.#solidCollision(target, enemy.y, enemy.width, enemy.height)) return false; enemy.x = target; return true;
  }
  #randomEnemyDecision(enemy: EnemyBody): boolean { enemy.randomState = (Math.imul(enemy.randomState, 1664525) + 1013904223) >>> 0; return enemy.randomState % enemy.randomness === 0; }
  #enemyAt(x: number, y: number, width: number, height: number): EnemyBody | undefined { return this.#enemies.find((enemy) => enemy.alive && enemy.dyingTicks === 0 && x < enemy.x + enemy.width && x + width > enemy.x && y < enemy.y + enemy.height && y + height > enemy.y); }
  #enemyContact(x: number, y: number, width: number, height: number): boolean {
    const enemy = this.#enemyAt(x, y, width, height); if (!enemy || enemy.frozenTicks > 0) return false;
    const player = this.#player.snapshot, facingEnemy = player.state === "hitting" && ((player.face === "right" && player.x < enemy.spriteX) || (player.face === "left" && player.x > enemy.spriteX));
    if (facingEnemy) { enemy.frozenTicks = 100; return false; }
    return true;
  }
  #animationDuration(definitionId: string, stateName: string, fallback: number): number {
    const definition = record(record(this.#source.definitions)[definitionId]), state = list(definition.states).map(record).find((candidate) => candidate.name === stateName), animation = record(state?.animation), frames = list(animation.sprites).length;
    return Math.max(1, number(animation.frameDurationTicks, 1) * Math.max(1, frames || Math.ceil(fallback / Math.max(1, number(animation.frameDurationTicks, 1)))));
  }
  #bodyAt(x: number, y: number, width: number, height: number, trait: keyof BodyTraits): MovingBody | undefined { return this.#bodies.find((body) => body.visible && body.traits[trait] && x < body.x + body.width && x + width > body.x && y < body.y + body.height && y + height > body.y); }
  #restingBlockAt(x: number, y: number, width: number, height: number): MovingBody | undefined { return this.#bodies.find((body) => body.visible && body.state === this.#bindings.objectStates.stop && body.traits.solid && x < body.x + body.width && x + width > body.x && y < body.y + body.height && y + height > body.y); }
  #applyExplosion(bomb: TransientBody): void { const x = bomb.x + bomb.bbX, y = bomb.y + bomb.bbY; for (const body of this.#bodies) if (body.visible && body.traits.destructible && ((body.traits.solid && body.key === bomb.contactBlockKey) || (x < body.x + body.width && x + bomb.bbWidth > body.x && y < body.y + body.height && y + bomb.bbHeight > body.y))) this.#destroyBody(body); const enemy = this.#enemyAt(x, y, bomb.bbWidth, bomb.bbHeight); if (enemy) this.#killEnemy(enemy); }
  #destroyBody(body: MovingBody): void { if (body.state !== this.#bindings.objectStates.stop || !body.traits.destructible) return; if (body.destructionMode === "escape") { body.state = this.#bindings.objectStates.moving; body.frame = 0; body.active = false; body.escapeRemaining = Math.max(1, number(record(this.#source.camera).width, 256)); return; } const duration = this.#animationDuration(String(body.definition ?? ""), this.#bindings.objectStates.dying, 1); if (body.destructionMode === "instant" || duration <= 1) { body.visible = false; return; } body.state = this.#bindings.objectStates.dying; body.frame = 0; body.active = false; body.wait = duration; }
  #killEnemy(enemy: EnemyBody): void { enemy.animationState = "dying"; enemy.frame = 0; enemy.dyingTicks = this.#animationDuration(String(enemy.definition ?? ""), this.#bindings.enemyStates.dying, 1); if (enemy.dyingTicks <= 1) enemy.alive = false; }
  #collectItems(): void { const player = this.#player.snapshot; if (player.state === "dead") return; const x = player.collisionX, y = player.collisionY; for (const body of this.#bodies) if (body.visible && body.state !== this.#bindings.objectStates.dying && body.traits.collectible && x < body.x + body.width && x + player.collisionWidth > body.x && y < body.y + body.height && y + player.collisionHeight > body.y) { const pickup = body.pickup ?? { mode: "instant", audioSlot: this.#bindings.audio.itemPickup, durationTicks: 0, riseSpeed: 0 }; this.#emitAudio(pickup.audioSlot); if (pickup.mode === "rise") { body.state = this.#bindings.objectStates.dying; body.frame = 0; body.active = false; body.wait = pickup.durationTicks; } else body.visible = false; } }
}
