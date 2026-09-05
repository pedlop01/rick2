export type CharacterControl = "left" | "right" | "up" | "down" | "action";
export type CharacterSignal = "grounded" | "onStairs" | "canDescendStairs" | "canStand" | "ceilingBlocked";
export type Comparison = "equal" | "notEqual" | "greater" | "greaterOrEqual" | "lower" | "lowerOrEqual";

export type StateCondition =
  | { type: "control"; control: CharacterControl; pressed: boolean }
  | { type: "action"; action: string; active: boolean }
  | { type: "event"; event: string }
  | { type: "signal"; signal: CharacterSignal; value: boolean }
  | { type: "elapsedTicks"; comparison: Comparison; value: number }
  | { type: "distance"; axis: "x" | "y"; comparison: Comparison; value: number }
  | { type: "previousState"; comparison: "equal" | "notEqual"; state: string };

export type StateAction =
  | { type: "setFacing"; value: "left" | "right" | "input" }
  | { type: "capturePosition"; axis: "x" | "y" | "both" }
  | { type: "setForm"; form: string };

export interface StateTransitionDefinition { to: string; conditions: StateCondition[]; actions?: StateAction[]; }
export interface CharacterStateDefinition { id: string; behavior?: string; animation?: string; transitions: StateTransitionDefinition[]; }
export interface CharacterStateMachineDefinition { initialState: string; states: CharacterStateDefinition[]; }
export interface CharacterStateContext {
  input: Readonly<Record<CharacterControl, boolean>>;
  signals: Readonly<Record<CharacterSignal, boolean>>;
  actions?: ReadonlySet<string>;
  events?: ReadonlySet<string>;
  x: number;
  y: number;
}
export interface CharacterStateSnapshot { state: string; previousState: string | null; ticksInState: number; facing: "left" | "right"; originX: number; originY: number; }
export interface CharacterStateStep extends CharacterStateSnapshot { transitioned: boolean; requestedForm: string | null; }

const compare = (left: number, operation: Comparison, right: number): boolean => {
  if (operation === "equal") return left === right;
  if (operation === "notEqual") return left !== right;
  if (operation === "greater") return left > right;
  if (operation === "greaterOrEqual") return left >= right;
  if (operation === "lower") return left < right;
  return left <= right;
};

const nonEmpty = (value: string, path: string): void => { if (!value.trim()) throw new Error(`${path} cannot be empty`); };

export function validateCharacterStateMachine(definition: CharacterStateMachineDefinition): void {
  nonEmpty(definition.initialState, "initialState");
  if (!definition.states.length) throw new Error("states cannot be empty");
  const states = new Set<string>();
  for (const [index, state] of definition.states.entries()) { nonEmpty(state.id, `states[${index}].id`); if (states.has(state.id)) throw new Error(`duplicate state: ${state.id}`); states.add(state.id); }
  if (!states.has(definition.initialState)) throw new Error(`initial state does not exist: ${definition.initialState}`);
  for (const state of definition.states) for (const transition of state.transitions) {
    if (!states.has(transition.to)) throw new Error(`transition target does not exist: ${transition.to}`);
    if (!transition.conditions.length) throw new Error(`transition ${state.id} -> ${transition.to} must have at least one condition`);
    for (const condition of transition.conditions) {
      if ((condition.type === "elapsedTicks" || condition.type === "distance") && (!Number.isFinite(condition.value) || condition.value < 0)) throw new Error(`${condition.type}.value cannot be negative`);
      if (condition.type === "previousState") nonEmpty(condition.state, "previousState.state");
    }
    for (const action of transition.actions ?? []) if (action.type === "setForm") nonEmpty(action.form, "setForm.form");
  }
}

export class CharacterStateMachine {
  readonly #definition: CharacterStateMachineDefinition;
  readonly #states: ReadonlyMap<string, CharacterStateDefinition>;
  #state: string; #previousState: string | null = null; #ticksInState = 0; #facing: "left" | "right"; #originX = 0; #originY = 0;

  constructor(definition: CharacterStateMachineDefinition, facing: "left" | "right" = "right") {
    validateCharacterStateMachine(definition); this.#definition = structuredClone(definition); this.#states = new Map(this.#definition.states.map((state) => [state.id, state])); this.#state = definition.initialState; this.#facing = facing;
  }

  get snapshot(): CharacterStateSnapshot { return { state: this.#state, previousState: this.#previousState, ticksInState: this.#ticksInState, facing: this.#facing, originX: this.#originX, originY: this.#originY }; }
  get activeDefinition(): Readonly<CharacterStateDefinition> { return this.#states.get(this.#state)!; }

  reset(context?: Pick<CharacterStateContext, "x" | "y">, facing?: "left" | "right"): void { this.#state = this.#definition.initialState; this.#previousState = null; this.#ticksInState = 0; this.#originX = context?.x ?? 0; this.#originY = context?.y ?? 0; if (facing) this.#facing = facing; }

  enter(state: string, facing?: "left" | "right"): boolean { if (!this.#states.has(state)) throw new Error(`state does not exist: ${state}`); if (state === this.#state) { if (facing) this.#facing = facing; return false; } this.#previousState = this.#state; this.#state = state; this.#ticksInState = 0; if (facing) this.#facing = facing; return true; }
  advanceTick(): void { this.#ticksInState += 1; }

  step(context: CharacterStateContext): CharacterStateStep {
    return this.#evaluate(context, true);
  }

  evaluate(context: CharacterStateContext): CharacterStateStep {
    return this.#evaluate(context, false);
  }

  #evaluate(context: CharacterStateContext, advanceWhenIdle: boolean): CharacterStateStep {
    const state = this.#states.get(this.#state)!;
    const transition = state.transitions.find((candidate) => candidate.conditions.every((condition) => this.#matches(condition, context)));
    let requestedForm: string | null = null;
    if (transition) {
      const from = this.#state; this.#previousState = from; this.#state = transition.to; this.#ticksInState = 0;
      for (const action of transition.actions ?? []) {
        if (action.type === "setFacing") this.#facing = action.value === "input" ? context.input.left ? "left" : context.input.right ? "right" : this.#facing : action.value;
        else if (action.type === "capturePosition") { if (action.axis !== "y") this.#originX = context.x; if (action.axis !== "x") this.#originY = context.y; }
        else requestedForm = action.form;
      }
    } else if (advanceWhenIdle) this.#ticksInState += 1;
    return { ...this.snapshot, transitioned: Boolean(transition), requestedForm };
  }

  #matches(condition: StateCondition, context: CharacterStateContext): boolean {
    if (condition.type === "control") return context.input[condition.control] === condition.pressed;
    if (condition.type === "action") return Boolean(context.actions?.has(condition.action)) === condition.active;
    if (condition.type === "event") return Boolean(context.events?.has(condition.event));
    if (condition.type === "signal") return context.signals[condition.signal] === condition.value;
    if (condition.type === "elapsedTicks") return compare(this.#ticksInState, condition.comparison, condition.value);
    if (condition.type === "distance") return compare(Math.abs((condition.axis === "x" ? context.x - this.#originX : context.y - this.#originY)), condition.comparison, condition.value);
    return condition.comparison === "equal" ? this.#previousState === condition.state : this.#previousState !== condition.state;
  }
}
