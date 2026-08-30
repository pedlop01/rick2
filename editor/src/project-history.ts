import type { Rick2Project } from "./project-io";

interface Entry { label: string; project: Rick2Project; }
function cloneProject(project: Rick2Project): Rick2Project { return { manifest: structuredClone(project.manifest), files: new Map([...project.files].map(([path, bytes]) => [path, bytes.slice()])) }; }

export class ProjectHistory {
  readonly #limit: number; #entries: Entry[] = []; #cursor = -1;
  #cleanCursor = -1;
  constructor(limit = 50) { this.#limit = limit; }
  get canUndo(): boolean { return this.#cursor > 0; }
  get canRedo(): boolean { return this.#cursor >= 0 && this.#cursor < this.#entries.length - 1; }
  get undoLabel(): string | null { return this.canUndo ? this.#entries[this.#cursor]!.label : null; }
  get redoLabel(): string | null { return this.canRedo ? this.#entries[this.#cursor + 1]!.label : null; }
  get isClean(): boolean { return this.#cursor === this.#cleanCursor; }
  reset(project: Rick2Project, clean = true): void { this.#entries = [{ label: "Initial state", project: cloneProject(project) }]; this.#cursor = 0; this.#cleanCursor = clean ? 0 : -1; }
  markClean(): void { this.#cleanCursor = this.#cursor; }
  record(project: Rick2Project, label: string): void {
    if (this.#cursor < 0) return this.reset(project, false); if (this.#cleanCursor > this.#cursor) this.#cleanCursor = -1; this.#entries.splice(this.#cursor + 1); this.#entries.push({ label, project: cloneProject(project) });
    if (this.#entries.length > this.#limit) { this.#entries.shift(); this.#cleanCursor -= 1; } else this.#cursor += 1;
  }
  undo(): Rick2Project | null { if (!this.canUndo) return null; this.#cursor -= 1; return cloneProject(this.#entries[this.#cursor]!.project); }
  redo(): Rick2Project | null { if (!this.canRedo) return null; this.#cursor += 1; return cloneProject(this.#entries[this.#cursor]!.project); }
}
