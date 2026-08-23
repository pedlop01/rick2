import { getProjectAsset, type Rick2Project } from "./project-io";
import { tileSource, visibleTileBounds } from "./map-view";

export type MapLayerName = "tiles" | "frontTiles" | "collisions";

interface MapDocument {
  width: number; height: number; tileWidth: number; tileHeight: number;
  tileset: { image: string; tileCount: number; columns: number };
  layers: Record<MapLayerName, number[]>;
}

interface LevelDocument { map: MapDocument; }

export class WorkspacePreview {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #observer: ResizeObserver;
  readonly #events = new AbortController();
  readonly #visibleLayers: Record<MapLayerName, boolean> = { tiles: true, frontTiles: true, collisions: true };
  #map: MapDocument | null = null;
  #tileset: ImageBitmap | null = null;
  #zoom = 1;
  #offsetX = 0;
  #offsetY = 0;
  #grid = true;
  #drag: { x: number; y: number; offsetX: number; offsetY: number } | null = null;
  #frame = 0;
  #onZoomChange: (zoom: number) => void = () => undefined;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D no está disponible");
    this.#canvas = canvas;
    this.#context = context;
    this.#observer = new ResizeObserver(() => this.#resizeAndDraw());
  }

  start(): void {
    this.#observer.observe(this.#canvas);
    const signal = this.#events.signal;
    this.#canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.zoomAt(event.deltaY < 0 ? 1.2 : 1 / 1.2, event.offsetX, event.offsetY);
    }, { passive: false, signal });
    this.#canvas.addEventListener("pointerdown", (event) => {
      this.#canvas.setPointerCapture(event.pointerId);
      this.#drag = { x: event.clientX, y: event.clientY, offsetX: this.#offsetX, offsetY: this.#offsetY };
      this.#canvas.classList.add("is-panning");
    }, { signal });
    this.#canvas.addEventListener("pointermove", (event) => {
      if (!this.#drag) return;
      this.#offsetX = this.#drag.offsetX + event.clientX - this.#drag.x;
      this.#offsetY = this.#drag.offsetY + event.clientY - this.#drag.y;
      this.#scheduleDraw();
    }, { signal });
    const stopDrag = (): void => {
      this.#drag = null;
      this.#canvas.classList.remove("is-panning");
    };
    this.#canvas.addEventListener("pointerup", stopDrag, { signal });
    this.#canvas.addEventListener("pointercancel", stopDrag, { signal });
    this.#resizeAndDraw();
  }

  stop(): void {
    this.#observer.disconnect();
    this.#events.abort();
    this.#tileset?.close();
    if (this.#frame) cancelAnimationFrame(this.#frame);
  }

  async load(project: Rick2Project): Promise<void> {
    const levelPath = project.manifest.initialLevel;
    const bytes = project.files.get(levelPath);
    if (!bytes) throw new Error(`No se encuentra ${levelPath}`);
    const level = JSON.parse(new TextDecoder().decode(bytes)) as LevelDocument;
    const asset = getProjectAsset(project, levelPath, level.map.tileset.image);
    const extension = level.map.tileset.image.split(".").pop()?.toLowerCase();
    const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "image/png";
    const bitmap = await createImageBitmap(new Blob([asset.slice().buffer], { type: mime }));
    this.#tileset?.close();
    this.#tileset = bitmap;
    this.#map = level.map;
    this.fit();
  }

  clear(): void {
    this.#tileset?.close();
    this.#tileset = null;
    this.#map = null;
    this.#scheduleDraw();
  }

  setLayerVisible(layer: MapLayerName, visible: boolean): void {
    this.#visibleLayers[layer] = visible;
    this.#scheduleDraw();
  }

  setGridVisible(visible: boolean): void {
    this.#grid = visible;
    this.#scheduleDraw();
  }

  setZoomListener(listener: (zoom: number) => void): void {
    this.#onZoomChange = listener;
    listener(this.#zoom);
  }

  zoomBy(factor: number): void {
    this.zoomAt(factor, this.#canvas.clientWidth / 2, this.#canvas.clientHeight / 2);
  }

  zoomAt(factor: number, screenX: number, screenY: number): void {
    const next = Math.min(12, Math.max(0.1, this.#zoom * factor));
    const worldX = (screenX - this.#offsetX) / this.#zoom;
    const worldY = (screenY - this.#offsetY) / this.#zoom;
    this.#zoom = next;
    this.#offsetX = screenX - worldX * next;
    this.#offsetY = screenY - worldY * next;
    this.#onZoomChange(this.#zoom);
    this.#scheduleDraw();
  }

  fit(): void {
    if (!this.#map) return;
    const worldWidth = this.#map.width * this.#map.tileWidth;
    const worldHeight = this.#map.height * this.#map.tileHeight;
    const padding = 32;
    this.#zoom = Math.min(8, Math.max(0.1, Math.min(
      (this.#canvas.clientWidth - padding * 2) / worldWidth,
      (this.#canvas.clientHeight - padding * 2) / worldHeight,
    )));
    this.#offsetX = (this.#canvas.clientWidth - worldWidth * this.#zoom) / 2;
    this.#offsetY = (this.#canvas.clientHeight - worldHeight * this.#zoom) / 2;
    this.#onZoomChange(this.#zoom);
    this.#scheduleDraw();
  }

  #resizeAndDraw(): void {
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.#canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(this.#canvas.clientHeight * scale));
    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;
    }
    this.#scheduleDraw();
  }

  #scheduleDraw(): void {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => { this.#frame = 0; this.#draw(); });
  }

  #draw(): void {
    const context = this.#context;
    const dpr = window.devicePixelRatio || 1;
    const width = this.#canvas.clientWidth;
    const height = this.#canvas.clientHeight;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#090e18";
    context.fillRect(0, 0, width, height);
    if (!this.#map || !this.#tileset) { this.#drawEmptyGrid(width, height); return; }
    context.setTransform(dpr * this.#zoom, 0, 0, dpr * this.#zoom, dpr * this.#offsetX, dpr * this.#offsetY);
    context.imageSmoothingEnabled = false;
    const map = this.#map;
    context.fillStyle = "#000";
    context.fillRect(0, 0, map.width * map.tileWidth, map.height * map.tileHeight);
    if (this.#visibleLayers.tiles) this.#drawTileLayer(map.layers.tiles);
    if (this.#visibleLayers.frontTiles) this.#drawTileLayer(map.layers.frontTiles);
    if (this.#visibleLayers.collisions) this.#drawCollisionLayer(map.layers.collisions);
    if (this.#grid && this.#zoom * map.tileWidth >= 4) this.#drawMapGrid();
  }

  #visibleBounds(): { left: number; top: number; right: number; bottom: number } {
    const map = this.#map!;
    return visibleTileBounds(map, this.#canvas.clientWidth, this.#canvas.clientHeight,
                             this.#offsetX, this.#offsetY, this.#zoom);
  }

  #drawTileLayer(layer: number[]): void {
    const map = this.#map!;
    const bounds = this.#visibleBounds();
    for (let y = bounds.top; y < bounds.bottom; ++y) for (let x = bounds.left; x < bounds.right; ++x) {
      const gid = layer[y * map.width + x] ?? 0;
      if (gid <= 0 || gid > map.tileset.tileCount) continue;
      const [sourceX, sourceY] = tileSource(gid, map.tileset.columns, map.tileWidth, map.tileHeight);
      this.#context.drawImage(
        this.#tileset!, sourceX, sourceY, map.tileWidth, map.tileHeight,
        x * map.tileWidth, y * map.tileHeight, map.tileWidth, map.tileHeight,
      );
    }
  }

  #drawCollisionLayer(layer: number[]): void {
    const map = this.#map!;
    const bounds = this.#visibleBounds();
    const colors: Record<number, string> = {
      309: "rgba(244, 63, 94, .48)", 310: "rgba(251, 191, 36, .48)",
      311: "rgba(96, 165, 250, .48)", 312: "rgba(45, 212, 191, .48)",
    };
    for (let y = bounds.top; y < bounds.bottom; ++y) for (let x = bounds.left; x < bounds.right; ++x) {
      const gid = layer[y * map.width + x] ?? 0;
      if (!gid) continue;
      this.#context.fillStyle = colors[gid] ?? "rgba(192, 132, 252, .48)";
      this.#context.fillRect(x * map.tileWidth, y * map.tileHeight, map.tileWidth, map.tileHeight);
    }
  }

  #drawMapGrid(): void {
    const map = this.#map!;
    const bounds = this.#visibleBounds();
    const context = this.#context;
    context.strokeStyle = "rgba(226, 232, 240, .16)";
    context.lineWidth = 1 / this.#zoom;
    context.beginPath();
    for (let x = bounds.left; x <= bounds.right; ++x) {
      const px = x * map.tileWidth; context.moveTo(px, bounds.top * map.tileHeight); context.lineTo(px, bounds.bottom * map.tileHeight);
    }
    for (let y = bounds.top; y <= bounds.bottom; ++y) {
      const py = y * map.tileHeight; context.moveTo(bounds.left * map.tileWidth, py); context.lineTo(bounds.right * map.tileWidth, py);
    }
    context.stroke();
  }

  #drawEmptyGrid(width: number, height: number): void {
    const context = this.#context;
    context.strokeStyle = "rgba(148, 163, 184, .09)";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 0.5; x < width; x += 24) { context.moveTo(x, 0); context.lineTo(x, height); }
    for (let y = 0.5; y < height; y += 24) { context.moveTo(0, y); context.lineTo(width, y); }
    context.stroke();
  }
}
