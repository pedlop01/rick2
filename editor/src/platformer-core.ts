export interface PlayerControllerConfig {
  spriteWidth: number;
  collisionWidth: number;
  standingHeight: number;
  crouchingHeight: number;
  collisionOffsetX: number;
  runSpeed: number;
  airControl: boolean;
  minimumVerticalSpeed: number;
  maximumVerticalSpeed: number;
  verticalAcceleration: number;
  climbSpeed: number;
  jumpHeight: number;
  jumpDistanceX?: number;
  deathRise: number;
  deathSpeedMultiplier: number;
  deathRespawnTicks: number;
  hitHoldTicks: number;
}

export interface PlayerCapabilities {
  jump: boolean;
  crouch: boolean;
  climb: boolean;
  shoot: boolean;
  bomb: boolean;
  hit: boolean;
}

export type PlayerGroundAction = "shooting" | "bombing" | "hitting";
export interface PlayerActionBindings {
  neutral: PlayerGroundAction | null;
  up: PlayerGroundAction | null;
  down: PlayerGroundAction | null;
  horizontal: PlayerGroundAction | null;
}

export interface SessionRules {
  initialLives: number;
  damageEnabled: boolean;
  respawn: "checkpoint" | "none";
  resetTriggersOnDeath: boolean;
  deathAudioSlot: number | null;
}

export type PlayerAnimationState = "stop" | "running" | "jumping" | "crouching" | "climbing" | "shooting" | "bombing" | "hitting" | "dead";
export interface RuntimeProfileBindings {
  playerStates: Record<PlayerAnimationState, string>;
  enemyStates: { running: string; climbing: string; dying: string };
  objectStates: { stop: string; moving: string; dying: string };
  audio: { shot: number | null; bomb: number | null; explosion: number | null; bonusPickup: number | null; itemPickup: number | null };
}
export interface RuntimeProfileBindingOverrides {
  playerStates?: Partial<RuntimeProfileBindings["playerStates"]>;
  enemyStates?: Partial<RuntimeProfileBindings["enemyStates"]>;
  objectStates?: Partial<RuntimeProfileBindings["objectStates"]>;
  audio?: Partial<RuntimeProfileBindings["audio"]>;
}
export type LevelObjective = { type: "none" } | { type: "reachZone"; x: number; y: number; width: number; height: number; onComplete: "continue" | "freeze"; conditions: import("./gameplay-program").GameplayCondition[] };

export interface DirectionalActionInput {
  action: boolean;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export const RICK_PLAYER_CONTROLLER: Readonly<PlayerControllerConfig> = Object.freeze({
  spriteWidth: 23,
  collisionWidth: 13,
  standingHeight: 21,
  crouchingHeight: 15,
  collisionOffsetX: 5,
  runSpeed: 2,
  airControl: true,
  minimumVerticalSpeed: 1,
  maximumVerticalSpeed: 3,
  verticalAcceleration: 0.1,
  climbSpeed: 2,
  jumpHeight: 40,
  deathRise: 80,
  deathSpeedMultiplier: 2,
  deathRespawnTicks: 70,
  hitHoldTicks: 20,
});

export const RICK_PLAYER_CAPABILITIES: Readonly<PlayerCapabilities> = Object.freeze({
  jump: true,
  crouch: true,
  climb: true,
  shoot: true,
  bomb: true,
  hit: true,
});

export const RICK_ACTION_BINDINGS: Readonly<PlayerActionBindings> = Object.freeze({
  neutral: null,
  up: "shooting",
  down: "bombing",
  horizontal: "hitting",
});

export const RICK_SESSION_RULES: Readonly<SessionRules> = Object.freeze({
  initialLives: 3,
  damageEnabled: true,
  respawn: "checkpoint",
  resetTriggersOnDeath: true,
  deathAudioSlot: 3,
});

export const RICK_RUNTIME_BINDINGS: Readonly<RuntimeProfileBindings> = Object.freeze({
  playerStates: Object.freeze({ stop: "RICK_STATE_STOP", running: "RICK_STATE_RUNNING", jumping: "RICK_STATE_JUMPING", crouching: "RICK_STATE_CROUCHING", climbing: "RICK_STATE_CLIMBING", shooting: "RICK_STATE_SHOOTING", bombing: "RICK_STATE_BOMBING", hitting: "RICK_STATE_HITTING", dead: "RICK_STATE_DYING" }),
  enemyStates: Object.freeze({ running: "CHAR_STATE_RUNNING", climbing: "CHAR_STATE_CLIMBING", dying: "CHAR_STATE_DYING" }),
  objectStates: Object.freeze({ stop: "OBJ_STATE_STOP", moving: "OBJ_STATE_MOVING", dying: "OBJ_STATE_DYING" }),
  audio: Object.freeze({ shot: 1, bomb: 2, explosion: 6, bonusPickup: 4, itemPickup: 5 }),
});

const positive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero`);
  return value;
};

const nonNegative = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} cannot be negative`);
  return value;
};

export function playerControllerConfig(
  overrides: Partial<PlayerControllerConfig> = {},
): Readonly<PlayerControllerConfig> {
  const config = { ...RICK_PLAYER_CONTROLLER, ...overrides };
  positive(config.spriteWidth, "spriteWidth");
  positive(config.collisionWidth, "collisionWidth");
  positive(config.standingHeight, "standingHeight");
  positive(config.crouchingHeight, "crouchingHeight");
  nonNegative(config.collisionOffsetX, "collisionOffsetX");
  nonNegative(config.runSpeed, "runSpeed");
  if (typeof config.airControl !== "boolean") throw new Error("airControl must be a boolean");
  positive(config.minimumVerticalSpeed, "minimumVerticalSpeed");
  positive(config.maximumVerticalSpeed, "maximumVerticalSpeed");
  positive(config.verticalAcceleration, "verticalAcceleration");
  nonNegative(config.climbSpeed, "climbSpeed");
  nonNegative(config.jumpHeight, "jumpHeight");
  if (config.jumpDistanceX !== undefined) nonNegative(config.jumpDistanceX, "jumpDistanceX");
  nonNegative(config.deathRise, "deathRise");
  positive(config.deathSpeedMultiplier, "deathSpeedMultiplier");
  positive(config.deathRespawnTicks, "deathRespawnTicks");
  nonNegative(config.hitHoldTicks, "hitHoldTicks");
  if (config.crouchingHeight > config.standingHeight) {
    throw new Error("crouchingHeight cannot exceed standingHeight");
  }
  if (config.minimumVerticalSpeed > config.maximumVerticalSpeed) {
    throw new Error("minimumVerticalSpeed cannot exceed maximumVerticalSpeed");
  }
  return Object.freeze(config);
}

export function playerCapabilities(
  overrides: Partial<PlayerCapabilities> = {},
): Readonly<PlayerCapabilities> {
  return Object.freeze({ ...RICK_PLAYER_CAPABILITIES, ...overrides });
}

export function playerActionBindings(
  overrides: Partial<PlayerActionBindings> = {},
): Readonly<PlayerActionBindings> {
  return Object.freeze({ ...RICK_ACTION_BINDINGS, ...overrides });
}

export function sessionRules(
  overrides: Partial<SessionRules> = {},
): Readonly<SessionRules> {
  const config = { ...RICK_SESSION_RULES, ...overrides };
  positive(config.initialLives, "initialLives");
  if (!Number.isInteger(config.initialLives)) throw new Error("initialLives must be an integer");
  if (config.deathAudioSlot !== null) {
    nonNegative(config.deathAudioSlot, "deathAudioSlot");
    if (!Number.isInteger(config.deathAudioSlot)) throw new Error("deathAudioSlot must be an integer");
  }
  return Object.freeze(config);
}

export function runtimeProfileBindings(
  overrides: RuntimeProfileBindingOverrides = {},
): Readonly<RuntimeProfileBindings> {
  const bindings = {
    playerStates: { ...RICK_RUNTIME_BINDINGS.playerStates, ...overrides.playerStates },
    enemyStates: { ...RICK_RUNTIME_BINDINGS.enemyStates, ...overrides.enemyStates },
    objectStates: { ...RICK_RUNTIME_BINDINGS.objectStates, ...overrides.objectStates },
    audio: { ...RICK_RUNTIME_BINDINGS.audio, ...overrides.audio },
  };
  for (const [group, states] of Object.entries({ player: bindings.playerStates, enemy: bindings.enemyStates, object: bindings.objectStates })) {
    for (const [name, state] of Object.entries(states)) {
      if (typeof state !== "string" || state.length === 0) throw new Error(`${group}.${name} must reference a state`);
    }
  }
  for (const [name, slot] of Object.entries(bindings.audio)) {
    if (slot !== null && (!Number.isInteger(slot) || slot < 0)) throw new Error(`${name} must reference a valid audio slot`);
  }
  return Object.freeze({ playerStates: Object.freeze(bindings.playerStates), enemyStates: Object.freeze(bindings.enemyStates), objectStates: Object.freeze(bindings.objectStates), audio: Object.freeze(bindings.audio) });
}

export function levelObjective(value: unknown): Readonly<LevelObjective> {
  if (value === undefined) return Object.freeze({ type: "none" });
  if (!value || typeof value !== "object") throw new Error("objective must be an object");
  const objective = value as Record<string, unknown>;
  if (objective.type === "none") return Object.freeze({ type: "none" });
  if (objective.type !== "reachZone") throw new Error("objective.type is not supported");
  for (const coordinate of ["x", "y"] as const) if (!Number.isInteger(objective[coordinate])) throw new Error(`objective.${coordinate} must be an integer`);
  for (const dimension of ["width", "height"] as const) if (!Number.isInteger(objective[dimension]) || Number(objective[dimension]) <= 0) throw new Error(`objective.${dimension} must be a positive integer`);
  if (objective.onComplete !== "continue" && objective.onComplete !== "freeze") throw new Error("objective.onComplete is not supported");
  const conditions = Array.isArray(objective.conditions) ? structuredClone(objective.conditions) : [];
  return Object.freeze({ type: "reachZone", x: Number(objective.x), y: Number(objective.y), width: Number(objective.width), height: Number(objective.height), onComplete: objective.onComplete, conditions });
}

export function groundActionForInput(
  input: DirectionalActionInput,
  capabilities: Readonly<PlayerCapabilities>,
  bindings: Readonly<PlayerActionBindings>,
): PlayerGroundAction | null {
  if (!input.action) return null;
  const action = input.up ? bindings.up
    : input.down ? bindings.down
    : input.left || input.right ? bindings.horizontal
    : bindings.neutral;
  if (action === "shooting" && capabilities.shoot) return action;
  if (action === "bombing" && capabilities.bomb) return action;
  if (action === "hitting" && capabilities.hit) return action;
  return null;
}
