import type { Rick2Project } from "./project-io";

export class ProjectSession {
  #project: Rick2Project | null = null;
  #dirty = false;

  get project(): Rick2Project | null { return this.#project; }
  get dirty(): boolean { return this.#dirty; }

  replace(project: Rick2Project, dirty: boolean): void {
    this.#project = project;
    this.#dirty = dirty;
  }

  markSaved(): void { this.#dirty = false; }
  markDirty(): void { if (this.#project) this.#dirty = true; }

  canDiscard(confirmDiscard: () => boolean): boolean {
    return !this.#dirty || confirmDiscard();
  }
}
