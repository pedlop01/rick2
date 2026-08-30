export type RuntimeBehavior<Body> = (body: Body) => void;

export class RuntimeBehaviorRegistry<Kind extends string, Body> {
  readonly #handlers = new Map<Kind, RuntimeBehavior<Body>>();

  register(kind: Kind, behavior: RuntimeBehavior<Body>): this {
    if (this.#handlers.has(kind)) throw new Error(`Duplicate behavior: ${kind}`);
    this.#handlers.set(kind, behavior);
    return this;
  }

  run(kind: Kind, body: Body): void {
    const behavior = this.#handlers.get(kind);
    if (!behavior) throw new Error(`Unregistered behavior: ${kind}`);
    behavior(body);
  }

  has(kind: Kind): boolean { return this.#handlers.has(kind); }
}
