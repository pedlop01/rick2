export interface EngineEventDefinition {
  id: string;
  category: "Character";
  description: string;
  emittedWhen: string;
}

export const BUILT_IN_CHARACTER_EVENTS: readonly EngineEventDefinition[] = Object.freeze([
  Object.freeze({ id: "killed", category: "Character", description: "Character receives lethal damage", emittedWhen: "Damage changes the character to its death flow." }),
  Object.freeze({ id: "landed", category: "Character", description: "Character touches the ground", emittedWhen: "A jump or fall ends on a solid surface." }),
]);

export function engineEvent(id: string): EngineEventDefinition | undefined {
  return BUILT_IN_CHARACTER_EVENTS.find((event) => event.id === id);
}

export function isKnownEngineEvent(id: string): boolean {
  return engineEvent(id) !== undefined;
}
