import { normalizeProjectPath, resolveProjectReference, type Rick2Project } from "./project-io";
import type { EditableLevel, LevelDocumentModel } from "./level-document";

export interface SpriteRect { x: number; y: number; width: number; height: number; }
export interface AnimationState { name: string; id: number; animation: { bitmap: string; frameDurationTicks: number; sprites: SpriteRect[] }; }
export interface AnimationDefinition { kind: "object" | "character"; name: string; states: AnimationState[]; }

function safeFilename(name: string): string {
  const normalized = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  if (!normalized || normalized === "." || normalized === "..") throw new Error("El nombre del asset no es válido");
  return normalized;
}

export class AssetDocumentModel {
  readonly #levelModel: LevelDocumentModel;
  constructor(levelModel: LevelDocumentModel) { this.#levelModel = levelModel; }
  get project(): Rick2Project { return this.#levelModel.project; }
  get level(): EditableLevel { return this.#levelModel.level; }
  get definitions(): Record<string, AnimationDefinition> { return this.level.definitions as Record<string, AnimationDefinition>; }
  get audio(): { initialMusic: number; music: string[]; effects: string[] } { return this.level.audio as { initialMusic: number; music: string[]; effects: string[] }; }
  flush(): void { this.#levelModel.flush(); }

  addDefinition(id: string, kind: "object" | "character", bitmap: string): void {
    if (!id.trim() || this.definitions[id]) throw new Error(`Definición duplicada o vacía: ${id}`);
    this.definitions[id] = { kind, name: id.split("/").at(-1)!, states: [{ name: "stop", id: 0, animation: { bitmap, frameDurationTicks: 1, sprites: [{ x: 0, y: 0, width: 1, height: 1 }] } }] };
  }
  addState(definitionId: string): number {
    const definition = this.definitions[definitionId]; if (!definition) throw new Error(`Definición inexistente: ${definitionId}`);
    const id = Math.max(-1, ...definition.states.map((state) => state.id)) + 1;
    const source = definition.states.at(-1)!; definition.states.push({ name: `state-${id}`, id, animation: structuredClone(source.animation) }); return definition.states.length - 1;
  }
  addFrame(definitionId: string, stateIndex: number): number {
    const state = this.definitions[definitionId]?.states[stateIndex]; if (!state) throw new Error("Estado inexistente");
    state.animation.sprites.push(structuredClone(state.animation.sprites.at(-1)!)); return state.animation.sprites.length - 1;
  }
  importAsset(fileName: string, bytes: Uint8Array, category: "images" | "audio"): { path: string; reference: string } {
    const base = safeFilename(fileName); const dot = base.lastIndexOf("."); const stem = dot > 0 ? base.slice(0, dot) : base; const extension = dot > 0 ? base.slice(dot) : "";
    let candidate = `assets/${category}/${base}`; let suffix = 2;
    while (this.project.files.has(candidate)) candidate = `assets/${category}/${stem}-${suffix++}${extension}`;
    const path = normalizeProjectPath(candidate); this.project.files.set(path, bytes.slice());
    const levelParts = this.#levelModel.path.split("/"); levelParts.pop(); const depth = levelParts.length;
    return { path, reference: `${"../".repeat(depth)}${path}` };
  }
  resolvedAsset(reference: string): string { return resolveProjectReference(this.#levelModel.path, reference); }
}
