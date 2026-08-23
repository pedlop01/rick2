export class WorkspacePreview {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #observer: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D no está disponible");
    this.#canvas = canvas;
    this.#context = context;
    this.#observer = new ResizeObserver(() => this.#resizeAndDraw());
  }

  start(): void {
    this.#observer.observe(this.#canvas);
    this.#resizeAndDraw();
  }

  stop(): void {
    this.#observer.disconnect();
  }

  #resizeAndDraw(): void {
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.#canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(this.#canvas.clientHeight * scale));
    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;
    }
    this.#context.setTransform(scale, 0, 0, scale, 0, 0);
    this.#drawGrid(this.#canvas.clientWidth, this.#canvas.clientHeight);
  }

  #drawGrid(width: number, height: number): void {
    const context = this.#context;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#111827";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(148, 163, 184, 0.09)";
    context.lineWidth = 1;
    const grid = 24;
    context.beginPath();
    for (let x = 0.5; x < width; x += grid) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (let y = 0.5; y < height; y += grid) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();
  }
}
