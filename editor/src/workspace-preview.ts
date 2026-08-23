import { getProjectAsset, type Rick2Project } from "./project-io";
import { tileSource, visibleTileBounds } from "./map-view";
import type { TileMapDocument, TileRect } from "./level-document";
import type { EntityBox, EntityRef, GameplayLine, GameplayZone } from "./entity-document";
import type { RuntimeBody } from "./preview-runtime";

export type MapLayerName = "tiles" | "frontTiles" | "collisions";

interface LevelDocument { map: TileMapDocument; }
export interface TilePointerHandlers {
  down(tile: PointerPosition): void;
  move(tile: PointerPosition): void;
  up(): void;
}
export interface PointerPosition { x: number; y: number; worldX: number; worldY: number; }

export class WorkspacePreview {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #observer: ResizeObserver;
  readonly #events = new AbortController();
  readonly #visibleLayers: Record<MapLayerName, boolean> = { tiles: true, frontTiles: true, collisions: true };
  #map: TileMapDocument | null = null;
  #tileset: ImageBitmap | null = null;
  #zoom = 1;
  #offsetX = 0;
  #offsetY = 0;
  #grid = true;
  #drag: { x: number; y: number; offsetX: number; offsetY: number } | null = null;
  #frame = 0;
  #onZoomChange: (zoom: number) => void = () => undefined;
  #editHandlers: TilePointerHandlers | null = null;
  #selection: TileRect | null = null;
  #editingPointer: number | null = null;
  #entities: Array<{ ref: EntityRef; box: EntityBox }> = [];
  #selectedEntity: EntityRef | null = null;
  #gameplayLines: GameplayLine[] = [];
  #gameplayZones: GameplayZone[] = [];
  #runtimeBodies: readonly RuntimeBody[] = [];

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
      if (event.button === 0 && this.#editHandlers) {
        const tile = this.tileAtClient(event.clientX, event.clientY);
        if (!tile) return;
        this.#canvas.setPointerCapture(event.pointerId);
        this.#editingPointer = event.pointerId;
        this.#editHandlers.down(tile);
        return;
      }
      if (event.button !== 1) return;
      event.preventDefault();
      this.#canvas.setPointerCapture(event.pointerId);
      this.#drag = { x: event.clientX, y: event.clientY, offsetX: this.#offsetX, offsetY: this.#offsetY };
      this.#canvas.classList.add("is-panning");
    }, { signal });
    this.#canvas.addEventListener("pointermove", (event) => {
      if (this.#editingPointer === event.pointerId && this.#editHandlers) {
        const tile = this.tileAtClient(event.clientX, event.clientY);
        if (tile) this.#editHandlers.move(tile);
        return;
      }
      if (!this.#drag) return;
      this.#offsetX = this.#drag.offsetX + event.clientX - this.#drag.x;
      this.#offsetY = this.#drag.offsetY + event.clientY - this.#drag.y;
      this.#scheduleDraw();
    }, { signal });
    const stopDrag = (event: PointerEvent): void => {
      if (this.#editingPointer === event.pointerId) {
        this.#editingPointer = null;
        this.#editHandlers?.up();
      }
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

  async load(project: Rick2Project, editableMap?: TileMapDocument, fitView = true): Promise<void> {
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
    this.#map = editableMap ?? level.map;
    if (fitView) this.fit(); else this.#scheduleDraw();
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

  setEditHandlers(handlers: TilePointerHandlers): void { this.#editHandlers = handlers; }
  setSelection(selection: TileRect | null): void { this.#selection = selection; this.#scheduleDraw(); }
  setEntities(entities: Array<{ ref: EntityRef; box: EntityBox }>, selected: EntityRef | null): void { this.#entities = entities; this.#selectedEntity = selected; this.#scheduleDraw(); }
  setGameplayGuides(lines: GameplayLine[], zones: GameplayZone[]): void { this.#gameplayLines = lines; this.#gameplayZones = zones; this.#scheduleDraw(); }
  setRuntimeBodies(bodies: readonly RuntimeBody[]): void { this.#runtimeBodies = bodies; this.#scheduleDraw(); }
  refresh(): void { this.#scheduleDraw(); }

  tileAtClient(clientX: number, clientY: number): PointerPosition | null {
    if (!this.#map) return null;
    const bounds = this.#canvas.getBoundingClientRect();
    const worldX = ((clientX - bounds.left) - this.#offsetX) / this.#zoom;
    const worldY = ((clientY - bounds.top) - this.#offsetY) / this.#zoom;
    const x = Math.floor(worldX / this.#map.tileWidth); const y = Math.floor(worldY / this.#map.tileHeight);
    return x >= 0 && y >= 0 && x < this.#map.width && y < this.#map.height ? { x, y, worldX, worldY } : null;
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
    this.#drawGameplayGuides(); this.#drawEntities(); this.#drawRuntimeBodies();
    if (this.#grid && this.#zoom * map.tileWidth >= 4) this.#drawMapGrid();
    if (this.#selection) this.#drawSelection(this.#selection);
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
    const first = map.tileset.tileCount + 1;
    const colors: Record<number, string> = {
      [first]: "rgba(244, 63, 94, .48)", [first + 1]: "rgba(251, 191, 36, .48)",
      [first + 2]: "rgba(96, 165, 250, .48)", [first + 3]: "rgba(45, 212, 191, .48)",
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

  #drawSelection(rect: TileRect): void {
    const map = this.#map!;
    const context = this.#context;
    context.fillStyle = "rgba(87, 211, 255, .16)";
    context.strokeStyle = "#57d3ff";
    context.lineWidth = 2 / this.#zoom;
    context.setLineDash([4 / this.#zoom, 3 / this.#zoom]);
    context.fillRect(rect.x * map.tileWidth, rect.y * map.tileHeight, rect.width * map.tileWidth, rect.height * map.tileHeight);
    context.strokeRect(rect.x * map.tileWidth, rect.y * map.tileHeight, rect.width * map.tileWidth, rect.height * map.tileHeight);
    context.setLineDash([]);
  }

  #drawEntities(): void {
    const colors = ["#f472b6", "#fbbf24", "#a78bfa", "#fb7185", "#2dd4bf", "#60a5fa", "#f97316", "#e879f9", "#4ade80", "#94a3b8"];
    for (const item of this.#entities) {
      const selected = this.#selectedEntity?.group === item.ref.group && this.#selectedEntity.index === item.ref.index;
      this.#context.fillStyle = selected ? "rgba(87, 211, 255, .32)" : "rgba(15, 23, 42, .18)";
      this.#context.strokeStyle = selected ? "#57d3ff" : colors[item.ref.group.length % colors.length]!;
      this.#context.lineWidth = (selected ? 2 : 1) / this.#zoom;
      this.#context.fillRect(item.box.x, item.box.y, Math.max(1, item.box.width), Math.max(1, item.box.height));
      this.#context.strokeRect(item.box.x, item.box.y, Math.max(1, item.box.width), Math.max(1, item.box.height));
    }
  }

  #drawGameplayGuides(): void {
    const context = this.#context; const colors = { checkpoint: "#60a5fa", target: "#f97316", route: "#fbbf24" };
    context.lineWidth = 1.5 / this.#zoom; context.setLineDash([5 / this.#zoom, 3 / this.#zoom]);
    const zoneColors = { ai: ["rgba(74, 222, 128, .08)", "#4ade80"], camera: ["rgba(96, 165, 250, .06)", "#60a5fa"], trigger: ["rgba(249, 115, 22, .1)", "#f97316"] } as const;
    for (const zone of this.#gameplayZones) { const colors = zoneColors[zone.kind]; context.fillStyle = colors[0]; context.strokeStyle = colors[1]; context.fillRect(zone.box.x, zone.box.y, zone.box.width, zone.box.height); context.strokeRect(zone.box.x, zone.box.y, zone.box.width, zone.box.height); }
    for (const line of this.#gameplayLines) { context.strokeStyle = colors[line.kind]; context.beginPath(); context.moveTo(line.x1, line.y1); context.lineTo(line.x2, line.y2); context.stroke(); }
    context.setLineDash([]);
  }

  #drawRuntimeBodies(): void {
    if (!this.#runtimeBodies.length) return; const context = this.#context; context.lineWidth = 2 / this.#zoom;
    for (const body of this.#runtimeBodies) { context.fillStyle = "rgba(34, 211, 238, .3)"; context.strokeStyle = "#22d3ee"; context.fillRect(body.x, body.y, body.width, body.height); context.strokeRect(body.x, body.y, body.width, body.height); }
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
