import { getProjectAsset, type Rick2Project } from "./project-io";
import { tileSource, visibleTileBounds } from "./map-view";
import type { TileMapDocument, TileRect } from "./level-document";
import { ENTITY_COLORS, type EntityBox, type EntityRef, type GameplayLine, type GameplayZone } from "./entity-document";
import type { RuntimeBody } from "./preview-runtime";
import type { ParallaxLayerDefinition, PresentationSnapshot } from "./presentation";

export type MapLayerName = "tiles" | "frontTiles" | "collisions";

interface LevelDocument { map: TileMapDocument; }
interface AnimationFrame { x: number; y: number; width: number; height: number; }
interface RuntimeAnimation { bitmap: ImageBitmap; duration: number; frames: AnimationFrame[]; }
export interface TilePointerHandlers {
  down(tile: PointerPosition): void;
  move(tile: PointerPosition): void;
  up(): void;
}
export interface PointerPosition { x: number; y: number; worldX: number; worldY: number; }
export interface ViewState { zoom: number; offsetX: number; offsetY: number; }

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
  #spacePressed = false;
  #entities: Array<{ ref: EntityRef; box: EntityBox; label?: string }> = [];
  #selectedEntity: EntityRef | null = null;
  #gameplayLines: GameplayLine[] = [];
  #gameplayZones: GameplayZone[] = [];
  #runtimeBodies: readonly RuntimeBody[] = [];
  #runtimeAnimations = new Map<string, RuntimeAnimation>();
  #runtimeSpritesVisible = true;
  #runtimeBoundsVisible = true;
  #combatBoxesVisible = { hurt: true, attack: true, guard: true };
  #presentation: PresentationSnapshot | null = null;
  #presentationCamera = { x: 0, y: 0, width: 256, height: 200 };
  #parallaxLayers: readonly ParallaxLayerDefinition[] = [];
  #parallaxImages = new Map<string, ImageBitmap>();

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    this.#canvas = canvas;
    this.#context = context;
    this.#observer = new ResizeObserver(() => this.#resizeAndDraw());
  }

  start(): void {
    this.#observer.observe(this.#canvas);
    const signal = this.#events.signal;
    this.#canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      if (event.shiftKey) { this.#offsetX -= event.deltaY; this.#scheduleDraw(); return; }
      this.zoomAt(event.deltaY < 0 ? 1.2 : 1 / 1.2, event.offsetX, event.offsetY);
    }, { passive: false, signal });
    this.#canvas.addEventListener("pointerdown", (event) => {
      if (event.button === 0 && this.#spacePressed) {
        event.preventDefault(); this.#canvas.setPointerCapture(event.pointerId); this.#drag = { x: event.clientX, y: event.clientY, offsetX: this.#offsetX, offsetY: this.#offsetY }; this.#canvas.classList.add("is-panning"); return;
      }
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
    window.addEventListener("keydown", (event) => { if (event.code === "Space" && (document.activeElement === this.#canvas || document.activeElement === document.body)) { event.preventDefault(); this.#spacePressed = true; this.#canvas.classList.add("is-pan-ready"); } }, { signal });
    window.addEventListener("keyup", (event) => { if (event.code === "Space") { this.#spacePressed = false; this.#canvas.classList.remove("is-pan-ready"); } }, { signal });
    window.addEventListener("blur", () => { this.#spacePressed = false; this.#canvas.classList.remove("is-pan-ready"); }, { signal });
    this.#resizeAndDraw();
  }

  stop(): void {
    this.#observer.disconnect();
    this.#events.abort();
    this.#tileset?.close();
    for (const animation of this.#runtimeAnimations.values()) animation.bitmap.close();
    for (const image of this.#parallaxImages.values()) image.close();
    if (this.#frame) cancelAnimationFrame(this.#frame);
  }

  async load(project: Rick2Project, editableMap?: TileMapDocument, fitView = true): Promise<void> {
    const levelPath = project.manifest.initialLevel;
    const bytes = project.files.get(levelPath);
    if (!bytes) throw new Error(`${levelPath} was not found`);
    const level = JSON.parse(new TextDecoder().decode(bytes)) as LevelDocument & { definitions?: Record<string, { states?: Array<{ name?: string; animation?: { bitmap?: string; frameDurationTicks?: number; sprites?: AnimationFrame[] } }> }>; presentation?: { parallaxLayers?: ParallaxLayerDefinition[] } };
    const asset = getProjectAsset(project, levelPath, level.map.tileset.image);
    const extension = level.map.tileset.image.split(".").pop()?.toLowerCase();
    const mime = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : "image/png";
    const bitmap = await createImageBitmap(new Blob([asset.slice().buffer], { type: mime }));
    this.#tileset?.close();
    this.#tileset = bitmap;
    for (const animation of this.#runtimeAnimations.values()) animation.bitmap.close(); this.#runtimeAnimations.clear();
    for (const image of this.#parallaxImages.values()) image.close(); this.#parallaxImages.clear();
    const bitmapCache = new Map<string, ImageBitmap>();
    for (const [definitionId, definition] of Object.entries(level.definitions ?? {})) for (const state of definition.states ?? []) {
      const animation = state.animation, reference = animation?.bitmap; if (!state.name || !reference || !animation?.sprites?.length) continue;
      try { let image = bitmapCache.get(reference); if (!image) { const imageBytes = getProjectAsset(project, levelPath, reference); image = await createImageBitmap(new Blob([imageBytes.slice().buffer])); bitmapCache.set(reference, image); } this.#runtimeAnimations.set(`${definitionId}:${state.name}`, { bitmap: image, duration: Math.max(1, animation.frameDurationTicks ?? 1), frames: animation.sprites }); } catch { /* Validation reports missing assets; the debug box remains visible. */ }
    }
    this.#parallaxLayers = level.presentation?.parallaxLayers ?? [];
    for (const layer of this.#parallaxLayers) try { const imageBytes = getProjectAsset(project, levelPath, layer.image); this.#parallaxImages.set(layer.id, await createImageBitmap(new Blob([imageBytes.slice().buffer]))); } catch { /* Validation reports missing presentation assets. */ }
    this.#map = editableMap ?? level.map;
    if (fitView) this.fit(); else this.#scheduleDraw();
  }

  clear(): void {
    this.#tileset?.close();
    this.#tileset = null;
    for (const animation of this.#runtimeAnimations.values()) animation.bitmap.close(); this.#runtimeAnimations.clear();
    for (const image of this.#parallaxImages.values()) image.close(); this.#parallaxImages.clear();
    this.#parallaxLayers = []; this.#presentation = null;
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
  setEntities(entities: Array<{ ref: EntityRef; box: EntityBox; label?: string }>, selected: EntityRef | null): void { this.#entities = entities; this.#selectedEntity = selected; this.#scheduleDraw(); }
  setGameplayGuides(lines: GameplayLine[], zones: GameplayZone[]): void { this.#gameplayLines = lines; this.#gameplayZones = zones; this.#scheduleDraw(); }
  setRuntimeBodies(bodies: readonly RuntimeBody[]): void { this.#runtimeBodies = bodies; this.#scheduleDraw(); }
  setRuntimeSpritesVisible(visible: boolean): void { this.#runtimeSpritesVisible = visible; this.#scheduleDraw(); }
  setRuntimeBoundsVisible(visible: boolean): void { this.#runtimeBoundsVisible = visible; this.#scheduleDraw(); }
  setCombatBoxesVisible(kind: "hurt" | "attack" | "guard", visible: boolean): void { this.#combatBoxesVisible[kind] = visible; this.#scheduleDraw(); }
  setPresentation(snapshot: PresentationSnapshot | null, layers: readonly ParallaxLayerDefinition[] = [], camera = { x: 0, y: 0, width: 256, height: 200 }): void { this.#presentation = snapshot; this.#parallaxLayers = layers; this.#presentationCamera = camera; this.#scheduleDraw(); }
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

  centerOnWorld(worldX: number, worldY: number): void { this.#offsetX = this.#canvas.clientWidth / 2 - worldX * this.#zoom; this.#offsetY = this.#canvas.clientHeight / 2 - worldY * this.#zoom; this.#scheduleDraw(); }
  focusWorldViewport(worldX: number, worldY: number, viewportWidth: number, viewportHeight: number): void {
    if (viewportWidth <= 0 || viewportHeight <= 0) return;
    this.#zoom = Math.min(12, Math.max(0.1, Math.min(this.#canvas.clientWidth / viewportWidth, this.#canvas.clientHeight / viewportHeight)));
    this.#offsetX = this.#canvas.clientWidth / 2 - worldX * this.#zoom;
    this.#offsetY = this.#canvas.clientHeight / 2 - worldY * this.#zoom;
    this.#onZoomChange(this.#zoom); this.#scheduleDraw();
  }
  getViewState(): ViewState { return { zoom: this.#zoom, offsetX: this.#offsetX, offsetY: this.#offsetY }; }
  setViewState(view: ViewState): void { this.#zoom = view.zoom; this.#offsetX = view.offsetX; this.#offsetY = view.offsetY; this.#onZoomChange(this.#zoom); this.#scheduleDraw(); }

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
    this.#drawParallax("back");
    if (this.#visibleLayers.tiles) this.#drawTileLayer(map.layers.tiles);
    if (this.#visibleLayers.frontTiles) this.#drawTileLayer(map.layers.frontTiles);
    if (this.#visibleLayers.collisions) this.#drawCollisionLayer(map.layers.collisions);
    this.#drawGameplayGuides(); this.#drawEntities(); this.#drawRuntimeBodies(); this.#drawParallax("front");
    if (this.#grid && this.#zoom * map.tileWidth >= 4) this.#drawMapGrid();
    if (this.#selection) this.#drawSelection(this.#selection);
    this.#drawPresentationOverlay();
  }

  #drawParallax(plane: "back" | "front"): void { const context = this.#context, camera = this.#presentationCamera; for (const layer of this.#parallaxLayers.filter((item) => item.plane === plane)) { const image = this.#parallaxImages.get(layer.id); if (!image) continue; const x = camera.x * (1 - layer.factorX) + (layer.offsetX ?? 0), y = camera.y * (1 - layer.factorY) + (layer.offsetY ?? 0); context.save(); context.globalAlpha = layer.opacity ?? 1; const startX = layer.repeatX ? x - Math.ceil((x + camera.width) / image.width) * image.width : x, startY = layer.repeatY ? y - Math.ceil((y + camera.height) / image.height) * image.height : y; const endX = layer.repeatX ? camera.x + camera.width + image.width : startX + 1, endY = layer.repeatY ? camera.y + camera.height + image.height : startY + 1; for (let py = startY; py < endY; py += image.height) for (let px = startX; px < endX; px += image.width) context.drawImage(image, px, py); context.restore(); } }
  #drawPresentationOverlay(): void { if (!this.#presentation) return; const context = this.#context, dpr = window.devicePixelRatio || 1, width = this.#canvas.clientWidth, height = this.#canvas.clientHeight; context.setTransform(dpr, 0, 0, dpr, 0, 0); const message = this.#presentation.message; if (message) { const boxHeight = 72; context.fillStyle = "rgba(4, 8, 15, .9)"; context.strokeStyle = "#57d3ff"; context.lineWidth = 2; context.fillRect(18, height - boxHeight - 18, width - 36, boxHeight); context.strokeRect(18, height - boxHeight - 18, width - 36, boxHeight); context.font = "bold 13px ui-sans-serif"; context.fillStyle = "#7dd3fc"; context.fillText(message.speaker || "", 30, height - boxHeight + 2); context.font = "14px ui-sans-serif"; context.fillStyle = "#f8fafc"; context.fillText(message.text, 30, height - 42, width - 60); } const effect = this.#presentation.effect; if (effect) { const progress = this.#presentation.effectTicks / effect.durationTicks, alpha = effect.kind === "fadeIn" ? 1 - progress : effect.kind === "fadeOut" ? progress : progress < .5 ? progress * 2 : (1 - progress) * 2; context.save(); context.globalAlpha = Math.max(0, Math.min(1, alpha)); context.fillStyle = effect.color; context.fillRect(0, 0, width, height); context.restore(); } }

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
    for (const item of this.#entities) {
      const selected = this.#selectedEntity?.group === item.ref.group && this.#selectedEntity.index === item.ref.index;
      const width = Math.max(1, item.box.width), height = Math.max(1, item.box.height), color = ENTITY_COLORS[item.ref.group];
      this.#context.fillStyle = selected ? "rgba(87, 211, 255, .34)" : `${color}24`;
      this.#context.strokeStyle = selected ? "#e0f2fe" : color;
      this.#context.lineWidth = (selected ? 2.5 : 1.25) / this.#zoom;
      this.#context.fillRect(item.box.x, item.box.y, width, height); this.#context.strokeRect(item.box.x, item.box.y, width, height);
      if (selected) { const size = 4 / this.#zoom; this.#context.fillStyle = "#e0f2fe"; for (const [x, y] of [[item.box.x, item.box.y], [item.box.x + width, item.box.y], [item.box.x, item.box.y + height], [item.box.x + width, item.box.y + height]] as const) this.#context.fillRect(x - size / 2, y - size / 2, size, size); }
      if (this.#zoom >= .75) { const label = item.label ?? `${item.ref.group} #${item.ref.index}`; this.#context.font = `${10 / this.#zoom}px ui-sans-serif`; this.#context.textBaseline = "bottom"; const textWidth = this.#context.measureText(label).width; this.#context.fillStyle = "rgba(8, 13, 22, .82)"; this.#context.fillRect(item.box.x, item.box.y - 13 / this.#zoom, textWidth + 5 / this.#zoom, 13 / this.#zoom); this.#context.fillStyle = selected ? "#e0f2fe" : color; this.#context.fillText(label, item.box.x + 2 / this.#zoom, item.box.y - 2 / this.#zoom); }
    }
  }

  #drawGameplayGuides(): void {
    const context = this.#context; const colors = { checkpoint: "#60a5fa", target: "#f97316", route: "#fbbf24" };
    context.lineWidth = 1.5 / this.#zoom; context.setLineDash([5 / this.#zoom, 3 / this.#zoom]);
    const zoneColors = { ai: ["rgba(74, 222, 128, .08)", "#4ade80"], camera: ["rgba(96, 165, 250, .06)", "#60a5fa"], trigger: ["rgba(249, 115, 22, .1)", "#f97316"], objective: ["rgba(192, 132, 252, .2)", "#c084fc"] } as const;
    for (const zone of this.#gameplayZones) { const colors = zoneColors[zone.kind]; context.fillStyle = colors[0]; context.strokeStyle = colors[1]; context.fillRect(zone.box.x, zone.box.y, zone.box.width, zone.box.height); context.strokeRect(zone.box.x, zone.box.y, zone.box.width, zone.box.height); if (zone.kind === "objective" && this.#zoom >= .75) { context.font = `bold ${9 / this.#zoom}px ui-sans-serif`; context.textBaseline = "top"; context.fillStyle = colors[1]; context.fillText("META", zone.box.x + 2 / this.#zoom, zone.box.y + 2 / this.#zoom); } }
    for (const line of this.#gameplayLines) {
      context.strokeStyle = colors[line.kind]; context.beginPath(); context.moveTo(line.x1, line.y1); context.lineTo(line.x2, line.y2); context.stroke();
      const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1), size = 6 / this.#zoom;
      if (Math.hypot(line.x2 - line.x1, line.y2 - line.y1) > size * 2) { context.setLineDash([]); context.beginPath(); context.moveTo(line.x2, line.y2); context.lineTo(line.x2 - Math.cos(angle - Math.PI / 6) * size, line.y2 - Math.sin(angle - Math.PI / 6) * size); context.moveTo(line.x2, line.y2); context.lineTo(line.x2 - Math.cos(angle + Math.PI / 6) * size, line.y2 - Math.sin(angle + Math.PI / 6) * size); context.stroke(); context.setLineDash([5 / this.#zoom, 3 / this.#zoom]); }
    }
    context.setLineDash([]);
  }

  #drawRuntimeBodies(): void {
    if (!this.#runtimeBodies.length) return; const context = this.#context;
    if (this.#runtimeSpritesVisible) for (const body of this.#runtimeBodies) {
      if (body.spriteVisible === false || !body.definition || !body.state) continue; const legacyState = body.state.startsWith("OBJ_STATE_") ? body.state.replace("OBJ_STATE_", "CHAR_STATE_") : body.state.startsWith("CHAR_STATE_") ? body.state.replace("CHAR_STATE_", "OBJ_STATE_") : body.state, animation = this.#runtimeAnimations.get(`${body.definition}:${body.state}`) ?? this.#runtimeAnimations.get(`${body.definition}:${legacyState}`); if (!animation) continue;
      const elapsedFrame = Math.floor(body.frame / animation.duration), frameIndex = body.animationOnce ? Math.min(animation.frames.length - 1, elapsedFrame) : elapsedFrame % animation.frames.length, frame = animation.frames[frameIndex]!; const x = body.spriteX ?? body.x, y = body.spriteY ?? body.y, scale = body.spriteScale ?? 1, width = frame.width * scale, height = frame.height * scale;
      if (body.face === "left") { context.save(); context.translate(x + width, y); context.scale(-1, 1); context.drawImage(animation.bitmap, frame.x, frame.y, frame.width, frame.height, 0, 0, width, height); context.restore(); }
      else context.drawImage(animation.bitmap, frame.x, frame.y, frame.width, frame.height, x, y, width, height);
    }
    if (!this.#runtimeBoundsVisible) return; context.lineWidth = 2 / this.#zoom;
    for (const body of this.#runtimeBodies) { const player = body.kind === "player", shoot = body.kind === "shoot", bomb = body.kind === "bomb", enemy = body.kind === "enemy"; context.fillStyle = player ? "rgba(250, 204, 21, .4)" : shoot ? "rgba(74, 222, 128, .4)" : bomb ? "rgba(232, 121, 249, .4)" : enemy ? "rgba(248, 113, 113, .35)" : "rgba(34, 211, 238, .3)"; context.strokeStyle = player ? "#facc15" : shoot ? "#4ade80" : bomb ? "#e879f9" : enemy ? "#f87171" : "#22d3ee"; context.fillRect(body.x, body.y, body.width, body.height); context.strokeRect(body.x, body.y, body.width, body.height); for (const [kind, boxes, color] of [["hurt", body.hurtboxes, "#22d3ee"], ["attack", body.attackboxes, "#ef4444"], ["guard", body.guardboxes, "#3b82f6"]] as const) { if (!this.#combatBoxesVisible[kind]) continue; context.strokeStyle = color; for (const box of boxes ?? []) context.strokeRect(box.x, box.y, box.width, box.height); } }
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
