import { CharacterStateMachine, validateCharacterStateMachine, type CharacterStateContext, type CharacterStateMachineDefinition, type CharacterStateStep, type StateTransitionDefinition } from "./character-state-machine";
import { playerActionBindings, playerCapabilities, playerControllerConfig, type PlayerActionBindings, type PlayerCapabilities, type PlayerControllerConfig, type PlayerGroundAction } from "./platformer-core";

export interface CharacterFormDefinition {
  id: string;
  definition?: string;
  combatProfile?: string;
  controller?: Partial<PlayerControllerConfig>;
  capabilities?: Partial<PlayerCapabilities>;
  actionBindings?: Partial<PlayerActionBindings>;
  stateMachine: CharacterStateMachineDefinition;
}
export interface CharacterFormsDefinition { initialForm: string; forms: CharacterFormDefinition[]; }
export interface ActiveCharacterForm {
  id: string;
  definition?: string;
  combatProfile?: string;
  controller: Readonly<PlayerControllerConfig>;
  capabilities: Readonly<PlayerCapabilities>;
  actionBindings: Readonly<PlayerActionBindings>;
}

const RICK_STATES = ["stop", "running", "jumping", "crouching", "climbing", "shooting", "bombing", "hitting", "dead"] as const;
export function rickCharacterForms(controller: Partial<PlayerControllerConfig> = {}, capabilities: Partial<PlayerCapabilities> = {}, actionBindings: Partial<PlayerActionBindings> = {}): CharacterFormsDefinition {
  const resolvedController = playerControllerConfig(controller), resolvedCapabilities = playerCapabilities(capabilities), resolvedBindings = playerActionBindings(actionBindings);
  const enabled = (action: PlayerGroundAction): boolean => action === "shooting" ? resolvedCapabilities.shoot : action === "bombing" ? resolvedCapabilities.bomb : resolvedCapabilities.hit;
  const configuredActions = new Set(Object.values(resolvedBindings).filter((action): action is PlayerGroundAction => action !== null && enabled(action)));
  const actionEntries: StateTransitionDefinition[] = [...configuredActions].map((action) => ({ to: action, conditions: [{ type: "action", action, active: true }] }));
  const grounded = { type: "signal" as const, signal: "grounded" as const, value: true };
  const enterClimbing: StateTransitionDefinition[] = resolvedCapabilities.climb ? [{ to: "climbing", conditions: [{ type: "control", control: "up", pressed: true }, { type: "signal", signal: "onStairs", value: true }] }, { to: "climbing", conditions: [{ type: "control", control: "down", pressed: true }, { type: "signal", signal: "canDescendStairs", value: true }] }] : [];
  const enterCrouching: StateTransitionDefinition[] = resolvedCapabilities.crouch ? [{ to: "crouching", conditions: [grounded, { type: "control", control: "down", pressed: true }, { type: "signal", signal: "canDescendStairs", value: false }] }] : [];
  const enterJumping: StateTransitionDefinition[] = [...(resolvedCapabilities.jump ? [{ to: "jumping", conditions: [grounded, { type: "control" as const, control: "up" as const, pressed: true }, { type: "signal" as const, signal: "onStairs" as const, value: false }] }] : []), { to: "jumping", conditions: [{ type: "signal", signal: "grounded", value: false }] }];
  const enterRunning: StateTransitionDefinition[] = [
    { to: "running", conditions: [grounded, { type: "control", control: "right", pressed: true }] },
    { to: "running", conditions: [grounded, { type: "control", control: "left", pressed: true }] },
  ];
  const enterStop: StateTransitionDefinition[] = [{ to: "stop", conditions: [grounded, { type: "control", control: "left", pressed: false }, { type: "control", control: "right", pressed: false }] }];
  const groundTransitions = [...enterClimbing, ...enterCrouching, ...enterJumping];
  const leaveAction = (id: PlayerGroundAction): StateTransitionDefinition[] => [...actionEntries.filter((entry) => entry.to !== id), ...[...groundTransitions, ...enterRunning, ...enterStop].map((entry) => ({ ...entry, conditions: [{ type: "action" as const, action: id, active: false }, ...entry.conditions] }))];
  const transitionsFor = (id: typeof RICK_STATES[number]): StateTransitionDefinition[] => {
    if (id === "dead") return [];
    const killed: StateTransitionDefinition = { to: "dead", conditions: [{ type: "event", event: "killed" }] };
    let transitions: StateTransitionDefinition[] = [];
    if (id === "stop") transitions = [...actionEntries, ...groundTransitions, ...enterRunning];
    else if (id === "running") transitions = [...actionEntries, ...groundTransitions, ...enterStop];
    else if (id === "crouching") transitions = [{ to: "jumping", conditions: [{ type: "signal", signal: "grounded", value: false }] }, { to: "stop", conditions: [{ type: "control", control: "down", pressed: false }, { type: "signal", signal: "canStand", value: true }] }];
    else if (id === "climbing") transitions = [{ to: "stop", conditions: [{ type: "signal", signal: "onStairs", value: false }, { type: "signal", signal: "canDescendStairs", value: false }, grounded] }, { to: "jumping", conditions: [{ type: "signal", signal: "onStairs", value: false }, { type: "signal", signal: "canDescendStairs", value: false }, { type: "signal", signal: "grounded", value: false }] }];
    else if (id === "jumping") transitions = [{ to: "running", conditions: [{ type: "event", event: "landed" }, { type: "control", control: "right", pressed: true }] }, { to: "running", conditions: [{ type: "event", event: "landed" }, { type: "control", control: "left", pressed: true }] }, { to: "stop", conditions: [{ type: "event", event: "landed" }] }];
    else if (id === "hitting" && configuredActions.has("hitting")) transitions = [{ to: "stop", conditions: [{ type: "elapsedTicks", comparison: "greaterOrEqual", value: resolvedController.hitHoldTicks }] }, ...leaveAction("hitting")];
    else if (configuredActions.has(id as PlayerGroundAction)) transitions = leaveAction(id as PlayerGroundAction);
    return [killed, ...transitions];
  };
  return { initialForm: "rick", forms: [{ id: "rick", controller, capabilities, actionBindings, stateMachine: { initialState: "stop", states: RICK_STATES.map((id) => ({ id, behavior: id, transitions: transitionsFor(id) })) } }] };
}

const nonEmpty = (value: string, path: string): void => { if (!value.trim()) throw new Error(`${path} cannot be empty`); };

export function validateCharacterForms(definition: CharacterFormsDefinition): void {
  nonEmpty(definition.initialForm, "initialForm"); if (!definition.forms.length) throw new Error("forms cannot be empty");
  const ids = new Set<string>();
  for (const [index, form] of definition.forms.entries()) { nonEmpty(form.id, `forms[${index}].id`); if (ids.has(form.id)) throw new Error(`duplicate form: ${form.id}`); ids.add(form.id); validateCharacterStateMachine(form.stateMachine); playerControllerConfig(form.controller); playerCapabilities(form.capabilities); playerActionBindings(form.actionBindings); }
  if (!ids.has(definition.initialForm)) throw new Error(`initial form does not exist: ${definition.initialForm}`);
  for (const form of definition.forms) for (const state of form.stateMachine.states) for (const transition of state.transitions) for (const action of transition.actions ?? []) if (action.type === "setForm" && !ids.has(action.form)) throw new Error(`form transition target does not exist: ${action.form}`);
}

export class CharacterForms {
  readonly #forms: ReadonlyMap<string, CharacterFormDefinition>; #active: CharacterFormDefinition; #machine: CharacterStateMachine;
  constructor(definition: CharacterFormsDefinition, facing: "left" | "right" = "right") { validateCharacterForms(definition); const clone = structuredClone(definition); this.#forms = new Map(clone.forms.map((form) => [form.id, form])); this.#active = this.#forms.get(clone.initialForm)!; this.#machine = new CharacterStateMachine(this.#active.stateMachine, facing); }
  get active(): ActiveCharacterForm { return { id: this.#active.id, definition: this.#active.definition, combatProfile: this.#active.combatProfile, controller: playerControllerConfig(this.#active.controller), capabilities: playerCapabilities(this.#active.capabilities), actionBindings: playerActionBindings(this.#active.actionBindings) }; }
  get state(): CharacterStateMachine["snapshot"] { return this.#machine.snapshot; }
  get activeState(): Readonly<import("./character-state-machine").CharacterStateDefinition> { return this.#machine.activeDefinition; }
  activate(id: string, context: Pick<CharacterStateContext, "x" | "y">): ActiveCharacterForm { const next = this.#forms.get(id); if (!next) throw new Error(`form does not exist: ${id}`); const facing = this.#machine.snapshot.facing; this.#active = next; this.#machine = new CharacterStateMachine(next.stateMachine, facing); this.#machine.reset(context); return this.active; }
  resetState(context: Pick<CharacterStateContext, "x" | "y">, facing?: "left" | "right"): void { this.#machine.reset(context, facing); }
  advanceStateTick(): void { this.#machine.advanceTick(); }
  evaluate(context: CharacterStateContext): CharacterStateStep { const result = this.#machine.evaluate(context); if (result.requestedForm) this.activate(result.requestedForm, context); return result; }
  step(context: CharacterStateContext): CharacterStateStep { const result = this.#machine.step(context); if (result.requestedForm) this.activate(result.requestedForm, context); return result; }
}
