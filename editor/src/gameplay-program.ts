import { isKnownEngineEvent } from "./engine-events";

export type GameplayFlagValue = boolean | number | string;
export interface GameplayFlagDefinition { id: string; type: "boolean" | "number" | "string"; initial: GameplayFlagValue; }
export interface GameplayEventDefinition { id: string; description?: string; }
export type GameplayComparison = "equal" | "notEqual" | "greater" | "greaterOrEqual" | "lower" | "lowerOrEqual";
export type GameplayCondition =
  | { type: "flag"; flag: string; comparison: GameplayComparison; value: GameplayFlagValue }
  | { type: "event"; event: string };
export type GameplayAction =
  | { type: "setFlag"; flag: string; value: GameplayFlagValue }
  | { type: "toggleFlag"; flag: string }
  | { type: "incrementFlag"; flag: string; amount: number }
  | { type: "emitEvent"; event: string }
  | { type: "setCamera"; mode: "follow" | "fixed"; x?: number; y?: number; durationTicks: number }
  | { type: "showMessage"; message: string }
  | { type: "hideMessage" }
  | { type: "playEffect"; effect: string }
  | { type: "setPlayerMode"; visible: boolean; controllable: boolean }
  | { type: "forcePlayerState"; state: string; previousState: string }
  | { type: "keepPlayerMoving" }
  | { type: "setEntityVisible"; entityType: "backgroundObject"; id: number; visible: boolean; restartAnimation?: boolean }
  | { type: "setEnemyActive"; id: number; active: boolean; reset?: boolean };
export type GameplaySequenceStep =
  | { type: "action"; action: GameplayAction }
  | { type: "wait"; ticks: number }
  | { type: "serial"; steps: GameplaySequenceStep[] }
  | { type: "parallel"; steps: GameplaySequenceStep[] };
export interface GameplaySequenceDefinition { id: string; steps: GameplaySequenceStep[]; }
export interface GameplayProgramDefinition { flags?: GameplayFlagDefinition[]; events?: GameplayEventDefinition[]; sequences?: GameplaySequenceDefinition[]; }

const nonEmpty = (value: string, path: string): void => { if (!value.trim()) throw new Error(`${path} cannot be empty`); };
const valueMatches = (type: GameplayFlagDefinition["type"], value: GameplayFlagValue): boolean => typeof value === type;
const compare = (left: GameplayFlagValue, operation: GameplayComparison, right: GameplayFlagValue): boolean => {
  if (operation === "equal") return left === right; if (operation === "notEqual") return left !== right;
  if (typeof left !== "number" || typeof right !== "number") return false;
  if (operation === "greater") return left > right; if (operation === "greaterOrEqual") return left >= right; if (operation === "lower") return left < right; return left <= right;
};

export function validateGameplayProgram(definition: GameplayProgramDefinition): void {
  const flags = new Map<string, GameplayFlagDefinition>(), events = new Set<string>(), sequences = new Set<string>();
  for (const [index, flag] of (definition.flags ?? []).entries()) { nonEmpty(flag.id, `flags[${index}].id`); if (flags.has(flag.id)) throw new Error(`duplicate flag: ${flag.id}`); if (!valueMatches(flag.type, flag.initial)) throw new Error(`flag ${flag.id} initial value must be ${flag.type}`); if (typeof flag.initial === "number" && !Number.isFinite(flag.initial)) throw new Error(`flag ${flag.id} initial value must be finite`); flags.set(flag.id, flag); }
  for (const [index, event] of (definition.events ?? []).entries()) { nonEmpty(event.id, `events[${index}].id`); if (events.has(event.id) || isKnownEngineEvent(event.id)) throw new Error(`duplicate or reserved event: ${event.id}`); events.add(event.id); }
  const knownEvent = (id: string): boolean => events.has(id) || isKnownEngineEvent(id);
  const action = (value: GameplayAction): void => {
    if (value.type === "keepPlayerMoving") return;
    if (value.type === "forcePlayerState") { nonEmpty(value.state, "forcePlayerState.state"); nonEmpty(value.previousState, "forcePlayerState.previousState"); return; }
    if (value.type === "setPlayerMode") { if (typeof value.visible !== "boolean" || typeof value.controllable !== "boolean") throw new Error("invalid player mode action"); return; }
    if (value.type === "setEntityVisible") { if (value.entityType !== "backgroundObject" || !Number.isInteger(value.id) || value.id < 0 || typeof value.visible !== "boolean" || (value.restartAnimation !== undefined && typeof value.restartAnimation !== "boolean")) throw new Error("invalid entity visibility action"); return; }
    if (value.type === "setEnemyActive") { if (!Number.isInteger(value.id) || value.id < 0 || typeof value.active !== "boolean" || (value.reset !== undefined && typeof value.reset !== "boolean")) throw new Error("invalid enemy activation action"); return; }
    if (value.type === "emitEvent") { if (!knownEvent(value.event)) throw new Error(`event does not exist: ${value.event}`); return; }
    if (value.type === "setCamera") { if (!Number.isInteger(value.durationTicks) || value.durationTicks < 0 || (value.mode === "fixed" && ![value.x, value.y].every(Number.isFinite))) throw new Error("invalid camera action"); return; }
    if (value.type === "showMessage" || value.type === "hideMessage" || value.type === "playEffect") return;
    const flag = flags.get(value.flag); if (!flag) throw new Error(`flag does not exist: ${value.flag}`); if (value.type === "toggleFlag" && flag.type !== "boolean") throw new Error(`flag ${value.flag} must be boolean`); if (value.type === "incrementFlag" && (flag.type !== "number" || !Number.isFinite(value.amount))) throw new Error(`flag ${value.flag} must be a finite number`); if (value.type === "setFlag" && !valueMatches(flag.type, value.value)) throw new Error(`flag ${value.flag} value must be ${flag.type}`);
  };
  const step = (value: GameplaySequenceStep): void => { if (value.type === "action") action(value.action); else if (value.type === "wait") { if (!Number.isInteger(value.ticks) || value.ticks < 1) throw new Error("wait ticks must be a positive integer"); } else { if (!value.steps.length) throw new Error(`${value.type} sequence cannot be empty`); value.steps.forEach(step); } };
  for (const sequence of definition.sequences ?? []) { nonEmpty(sequence.id, "sequence.id"); if (sequences.has(sequence.id)) throw new Error(`duplicate sequence: ${sequence.id}`); if (!sequence.steps.length) throw new Error(`sequence ${sequence.id} cannot be empty`); sequences.add(sequence.id); sequence.steps.forEach(step); }
}

export function validateGameplayTrigger(definition: GameplayProgramDefinition, conditions: GameplayCondition[] = [], actions: GameplayAction[] = [], sequence?: string): void {
  validateGameplayProgram(definition); const state = new GameplayState(definition), customEvents = new Set((definition.events ?? []).map((event) => event.id));
  for (const condition of conditions) { if (condition.type === "event") { if (!customEvents.has(condition.event) && !isKnownEngineEvent(condition.event)) throw new Error(`event does not exist: ${condition.event}`); } else { const current = state.flag(condition.flag); if ((condition.comparison !== "equal" && condition.comparison !== "notEqual") && (typeof current !== "number" || typeof condition.value !== "number")) throw new Error(`ordered comparison for flag ${condition.flag} requires numbers`); if (typeof current !== typeof condition.value) throw new Error(`condition value for flag ${condition.flag} has the wrong type`); } }
  if (actions.length) validateGameplayProgram({ ...definition, sequences: [...(definition.sequences ?? []), { id: "__trigger_validation__", steps: actions.map((action) => ({ type: "action", action })) }] });
  if (sequence && !(definition.sequences ?? []).some((candidate) => candidate.id === sequence)) throw new Error(`sequence does not exist: ${sequence}`);
}

export class GameplayState {
  readonly #definitions: ReadonlyMap<string, GameplayFlagDefinition>; readonly #flags = new Map<string, GameplayFlagValue>(); readonly #events = new Set<string>();
  constructor(readonly definition: GameplayProgramDefinition = {}, readonly onEvent: (event: string) => void = () => undefined, readonly onRegisteredAction: (action: GameplayAction) => void = () => undefined) { validateGameplayProgram(definition); this.#definitions = new Map((definition.flags ?? []).map((flag) => [flag.id, structuredClone(flag)])); this.reset(); }
  reset(): void { this.#flags.clear(); for (const flag of this.#definitions.values()) this.#flags.set(flag.id, flag.initial); this.#events.clear(); }
  beginTick(): void { this.#events.clear(); }
  flag(id: string): GameplayFlagValue { if (!this.#flags.has(id)) throw new Error(`flag does not exist: ${id}`); return this.#flags.get(id)!; }
  event(id: string): boolean { return this.#events.has(id); }
  matches(condition: GameplayCondition): boolean { return condition.type === "event" ? this.event(condition.event) : compare(this.flag(condition.flag), condition.comparison, condition.value); }
  execute(action: GameplayAction): void { if (action.type === "emitEvent") { this.#events.add(action.event); this.onEvent(action.event); return; } if (action.type === "setCamera" || action.type === "showMessage" || action.type === "hideMessage" || action.type === "playEffect" || action.type === "setEntityVisible" || action.type === "setEnemyActive" || action.type === "setPlayerMode" || action.type === "forcePlayerState" || action.type === "keepPlayerMoving") { this.onRegisteredAction(action); return; } const current = this.flag(action.flag); if (action.type === "setFlag") this.#flags.set(action.flag, action.value); else if (action.type === "toggleFlag") this.#flags.set(action.flag, !current); else this.#flags.set(action.flag, Number(current) + action.amount); }
  sequence(id: string): GameplaySequence { const definition = (this.definition.sequences ?? []).find((sequence) => sequence.id === id); if (!definition) throw new Error(`sequence does not exist: ${id}`); return new GameplaySequence(definition); }
}

interface RunningStep { definition: GameplaySequenceStep; remaining?: number; index?: number; children?: RunningStep[]; complete?: boolean; }
const running = (definition: GameplaySequenceStep): RunningStep => ({ definition, remaining: definition.type === "wait" ? definition.ticks : undefined, index: 0, children: definition.type === "parallel" ? definition.steps.map(running) : undefined });
function advance(step: RunningStep, state: GameplayState): boolean {
  if (step.complete) return true; const definition = step.definition;
  if (definition.type === "action") { state.execute(definition.action); return step.complete = true; }
  if (definition.type === "wait") { step.remaining!--; return step.complete = step.remaining === 0; }
  if (definition.type === "parallel") { for (const child of step.children!) advance(child, state); return step.complete = step.children!.every((child) => child.complete); }
  while ((step.index ?? 0) < definition.steps.length) { const child = step.children?.[step.index!] ?? running(definition.steps[step.index!]!); (step.children ??= [])[step.index!] = child; if (!advance(child, state)) return false; step.index! += 1; if (child.definition.type === "wait") return false; } return step.complete = true;
}
export class GameplaySequence {
  readonly #root: RunningStep; constructor(readonly definition: GameplaySequenceDefinition) { this.#root = running({ type: "serial", steps: definition.steps }); }
  get complete(): boolean { return Boolean(this.#root.complete); }
  step(state: GameplayState): boolean { if (!this.#root.complete) advance(this.#root, state); return this.complete; }
}
