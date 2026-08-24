import { WorkspacePreview, type MapLayerName, type PointerPosition, type ViewState } from "./workspace-preview";
import {
  createEmptyProject,
  downloadProject,
  getProjectAsset,
  pickProjectDirectory,
  readProjectDirectory,
  readProjectFile,
  supportsDirectoryAccess,
  writeProjectDirectory,
} from "./project-io";
import { ProjectSession } from "./project-session";
import { hasValidationErrors, validateProject, type Diagnostic } from "./validation";
import { LevelDocumentModel, type TileClipboard, type TileRect } from "./level-document";
import { TilePalette } from "./tile-palette";
import { EntityDocumentModel, ENTITY_COLORS, ENTITY_GROUPS, type EntityGroup, type EntityRecord, type EntityRef } from "./entity-document";
import { AssetDocumentModel } from "./asset-document";
import { AssetEditor } from "./asset-editor";
import { ProjectHistory } from "./project-history";
import { clearRecovery, loadRecovery, saveRecovery } from "./recovery-store";
import { PreviewRuntime } from "./preview-runtime";
import type { PlayerInput } from "./web-player";

const LAYERS = [
  ["tiles", "Tiles"],
  ["frontTiles", "Front tiles"],
  ["collisions", "Colisiones"],
] as const;
type EditTool = "pencil" | "eraser" | "fill" | "select" | "entity" | "asset";

function button(label: string, title?: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  if (title) element.title = title;
  return element;
}

function requiredElement<T extends Element>(host: ParentNode, selector: string): T {
  const element = host.querySelector<T>(selector);
  if (!element) throw new Error(`La plantilla no contiene ${selector}`);
  return element;
}

export function createEditorShell(host: HTMLElement): void {
  host.className = "editor-shell";
  host.innerHTML = `
    <header class="app-header">
      <div class="brand"><span class="brand-mark">R2</span><div><h1>Rick2 Engine</h1><p>Editor offline de niveles</p></div></div>
      <div class="document-title" aria-live="polite">Sin proyecto</div>
    </header>
    <nav class="toolbar" aria-label="Herramientas del proyecto"></nav>
    <div class="notification" role="alert" hidden></div>
    <aside class="panel layers-panel" aria-labelledby="layers-title">
      <div class="panel-heading"><h2 id="layers-title">Capas</h2></div>
      <div class="panel-content" id="layer-list"></div><div class="entity-controls" id="entity-controls" hidden></div><div class="asset-controls" id="asset-controls" hidden></div><div class="tile-palette" id="tile-palette"></div>
    </aside>
    <main class="workspace" aria-label="Lienzo del nivel">
      <canvas tabindex="0" aria-label="Vista previa vacía del mapa"></canvas>
      <div class="canvas-hint">Crea o abre un proyecto para comenzar</div>
    </main>
    <aside class="panel inspector-panel" aria-labelledby="inspector-title">
      <div class="panel-heading"><h2 id="inspector-title">Inspector</h2></div>
      <div class="panel-content empty-inspector"><span aria-hidden="true">◇</span><p>No hay ninguna selección</p></div>
    </aside>
    <footer class="statusbar"><span id="status" role="status">Rick2 Engine preparado</span><span>100%</span></footer>
  `;

  const toolbar = requiredElement<HTMLElement>(host, ".toolbar");
  const layerList = requiredElement<HTMLElement>(host, "#layer-list");
  const canvas = requiredElement<HTMLCanvasElement>(host, "canvas");
  const status = requiredElement<HTMLElement>(host, "#status");
  const documentTitle = requiredElement<HTMLElement>(host, ".document-title");
  const hint = requiredElement<HTMLElement>(host, ".canvas-hint");
  const notification = requiredElement<HTMLElement>(host, ".notification");
  const inspector = requiredElement<HTMLElement>(host, ".inspector-panel .panel-content");
  const paletteHost = requiredElement<HTMLElement>(host, "#tile-palette");
  const entityControls = requiredElement<HTMLElement>(host, "#entity-controls");
  const assetControls = requiredElement<HTMLElement>(host, "#asset-controls");

  const session = new ProjectSession();
  const history = new ProjectHistory();
  let recoveryWrite = Promise.resolve();
  const persistRecovery = (): void => { if (session.project) recoveryWrite = recoveryWrite.then(() => saveRecovery(session.project!)).catch(() => undefined); };
  const discardRecovery = (): void => { recoveryWrite = recoveryWrite.then(() => clearRecovery()).catch(() => undefined); };
  const layerCheckboxes = new Map<MapLayerName, HTMLInputElement>();
  const layerRows = new Map<MapLayerName, HTMLElement>();
  let activeLayer: MapLayerName = "tiles";
  let activeTool: EditTool = "pencil";
  let levelModel: LevelDocumentModel | null = null;
  let entityModel: EntityDocumentModel | null = null;
  let assetModel: AssetDocumentModel | null = null;
  let runtime: PreviewRuntime | null = null;
  let runtimePlaying = false; let runtimePreviewActive = false; let runtimeFrame = 0; let runtimeLastTime = 0; let runtimeAccumulator = 0; let runtimeInvulnerable = true; let runtimeCameraViewsEnabled = true; let runtimeSpritesVisible = true; let runtimeBoundsVisible = true; let runtimeAudioEnabled = true; let placingPlayer = false;
  let runtimeMusic: HTMLAudioElement | null = null; let runtimeEffectUrls: string[] = []; let runtimeAudioUrls: string[] = [];
  const runtimeInput: PlayerInput = { left: false, right: false, up: false, down: false, action: false };
  let runtimeEditorView: ViewState | null = null;
  let entityGroup: EntityGroup = "items";
  let showAllEntities = false; let showRelations = true; let showRoutes = true; let showZones = true; let selectedGuidesOnly = false;
  let selectedEntity: EntityRef | null = null;
  let selection: TileRect | null = null;
  let clipboard: TileClipboard | null = null;
  let lastPointerTile: PointerPosition | null = null;
  let directoryHandle: FileSystemDirectoryHandle | null = null;
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".rick2-project,.zip,application/zip";
  fileInput.hidden = true;
  host.append(fileInput);

  function showError(error: unknown): void {
    notification.textContent = error instanceof Error ? error.message : String(error);
    notification.hidden = false;
  }

  function clearError(): void {
    notification.hidden = true;
    notification.textContent = "";
  }

  function configureRuntimeAudio(project: ReturnType<typeof createEmptyProject>, level: Record<string, unknown>): void {
    runtimeMusic?.pause(); runtimeMusic = null; for (const url of runtimeAudioUrls) URL.revokeObjectURL(url); runtimeAudioUrls = []; runtimeEffectUrls = [];
    const audio = level.audio && typeof level.audio === "object" ? level.audio as { initialMusic?: number; music?: string[]; effects?: string[]; playback?: { initialLoop?: boolean; followUpMusic?: number | null; followUpLoop?: boolean } } : {};
    const urlFor = (reference: string): string => { const bytes = getProjectAsset(project, project.manifest.initialLevel, reference); const url = URL.createObjectURL(new Blob([bytes.slice().buffer])); runtimeAudioUrls.push(url); return url; };
    try { const musicUrls = (audio.music ?? []).map((item) => urlFor(item)), initial = audio.initialMusic ?? 0, playback = audio.playback ?? {}; const reference = musicUrls[initial]; if (reference) { runtimeMusic = new Audio(reference); runtimeMusic.loop = playback.initialLoop ?? false; const followUp = playback.followUpMusic; if (!runtimeMusic.loop && typeof followUp === "number" && musicUrls[followUp]) runtimeMusic.addEventListener("ended", () => { if (!runtimeMusic) return; runtimeMusic.src = musicUrls[followUp]!; runtimeMusic.loop = playback.followUpLoop ?? true; if (runtimeAudioEnabled && runtimePlaying) void runtimeMusic.play().catch(() => undefined); }, { once: true }); } runtimeEffectUrls = (audio.effects ?? []).map((item) => urlFor(item)); } catch { runtimeMusic = null; runtimeEffectUrls = []; }
  }

  function refreshProjectState(message: string): void {
    const project = session.project;
    const diagnostics = project ? validateProject(project) : [];
    const invalid = hasValidationErrors(diagnostics);
    documentTitle.textContent = project
        ? `${project.manifest.name}${session.dirty ? " •" : ""}`
        : "Sin proyecto";
    hint.textContent = project
        ? `${project.manifest.levels.length} nivel(es) · ${project.files.size} archivo(s)`
        : "Crea o abre un proyecto para comenzar";
    saveProject.disabled = !project || invalid;
    saveDirectory.disabled = !project || invalid || !supportsDirectoryAccess();
    renderDiagnostics(diagnostics);
    status.textContent = invalid
        ? `${message} · ${diagnostics.length} error(es) de validación`
        : message;
  }

  async function activateProject(
    project: ReturnType<typeof createEmptyProject>,
    dirty: boolean,
    message: string,
    resetHistory = true,
  ): Promise<void> {
    session.replace(project, dirty);
    levelModel = new LevelDocumentModel(project);
    entityModel = new EntityDocumentModel(levelModel);
    assetModel = new AssetDocumentModel(levelModel);
    stopRuntime(); runtimePreviewActive = false; placingPlayer = false; runtimeEditorView = null; runtime = new PreviewRuntime(levelModel.level); runtime.setInvulnerable(runtimeInvulnerable); runtime.setCameraViewsEnabled(runtimeCameraViewsEnabled); configureRuntimeAudio(project, levelModel.level); preview.setRuntimeBodies([]);
    play.disabled = false; pause.disabled = true; step.disabled = false; resetPreview.disabled = true;
    selectedEntity = null;
    for (const checkbox of layerCheckboxes.values()) checkbox.disabled = false;
    refreshProjectState(message);
    await preview.load(project, levelModel.map, resetHistory);
    await palette.load(project, levelModel);
    assetEditor.load(assetModel);
    refreshEntityOverlay();
    if (resetHistory) history.reset(project, !dirty);
    refreshHistoryControls();
    if (resetHistory) { if (dirty) persistRecovery(); else discardRecovery(); }
    hint.hidden = true;
  }

  function renderDiagnostics(diagnostics: readonly Diagnostic[]): void {
    if (selectedEntity && entityModel?.entity(selectedEntity)) { renderEntityInspector(); return; }
    inspector.innerHTML = "";
    inspector.classList.toggle("empty-inspector", diagnostics.length === 0);
    if (!diagnostics.length) {
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "✓";
      const text = document.createElement("p");
      text.textContent = session.project ? "Proyecto válido" : "No hay ninguna selección";
      inspector.append(icon, text);
      return;
    }
    const title = document.createElement("p");
    title.className = "diagnostic-summary";
    title.textContent = `${diagnostics.length} problema(s)`;
    const list = document.createElement("ol");
    list.className = "diagnostic-list";
    for (const diagnostic of diagnostics) {
      const item = document.createElement("li");
      item.classList.add(`diagnostic-${diagnostic.severity}`); item.tabIndex = 0; item.title = "Ir al elemento";
      const location = document.createElement("code");
      location.textContent = `${diagnostic.file}${diagnostic.path}`;
      const message = document.createElement("span");
      message.textContent = diagnostic.message;
      item.append(location, message);
      item.addEventListener("click", () => navigateDiagnostic(diagnostic)); item.addEventListener("keydown", (event) => { if (event.key === "Enter") navigateDiagnostic(diagnostic); });
      list.append(item);
    }
    inspector.append(title, list);
  }

  function navigateDiagnostic(diagnostic: Diagnostic): void {
    const tile = diagnostic.path.match(/^\/map\/layers\/(tiles|frontTiles|collisions)\/(\d+)/);
    if (tile && levelModel) { const layer = tile[1] as MapLayerName; const index = Number(tile[2]); activeLayer = layer; toolButtons.get("select")?.click(); selection = { x: index % levelModel.map.width, y: Math.floor(index / levelModel.map.width), width: 1, height: 1 }; preview.setSelection(selection); status.textContent = `Diagnóstico en ${layer}, celda ${index}`; return; }
    const entity = diagnostic.path.match(/^\/entities\/([^/]+)\/(\d+)/);
    if (entity && ENTITY_GROUPS.includes(entity[1] as EntityGroup)) { entityGroup = entity[1] as EntityGroup; selectedEntity = { group: entityGroup, index: Number(entity[2]) }; groupSelect.value = entityGroup; toolButtons.get("entity")?.click(); refreshEntityOverlay(); renderEntityInspector(); return; }
    if (diagnostic.path.startsWith("/definitions/") || diagnostic.path.startsWith("/audio/") || diagnostic.path.startsWith("/map/tileset")) toolButtons.get("asset")?.click();
  }

  function primitiveFields(value: EntityRecord, prefix: string[] = []): Array<{ path: string[]; value: string | number }> {
    const fields: Array<{ path: string[]; value: string | number }> = [];
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === "string" || typeof child === "number") fields.push({ path: [...prefix, key], value: child });
      else if (child && typeof child === "object") fields.push(...primitiveFields(child as EntityRecord, [...prefix, key]));
    }
    return fields;
  }

  function renderEntityInspector(): void {
    const entity = selectedEntity && entityModel?.entity(selectedEntity); if (!entity || !selectedEntity) return;
    inspector.innerHTML = ""; inspector.classList.remove("empty-inspector");
    const title = document.createElement("h3"); title.textContent = `${selectedEntity.group} · ${String(entity.id ?? selectedEntity.index)}`; inspector.append(title);
    for (const field of primitiveFields(entity)) {
      const label = document.createElement("label"); label.className = "property-field"; const caption = document.createElement("span"); caption.textContent = field.path.join(".");
      const enumValues: Record<string, string[]> = { ini_state: ["stop", "moving"], pl_face: ["left", "right"], action: ["enters", "stays", "exits", "hits"], face: ["any", "left", "right"], ia_type: ["walker", "chaser"] };
      const key = field.path.at(-1)!; let choices = enumValues[key];
      if (key === "type") choices = field.path.includes("targets") ? ["platform", "laser", "hazard"] : ["horizontal", "vertical", "diagonal"];
      if (key === "direction") choices = field.path.includes("actions") ? ["stop", "left", "right", "up", "down", ...(selectedEntity.group === "hazards" ? ["deactivate"] : [])] : ["left", "right"];
      if (["visible", "recursive", "one_use", "exploits", "trigger", "stop_inactive", "onehot", "default_trigger", "ia_random", "trigger_cond"].includes(key)) choices = ["0", "1"];
      const input = choices ? document.createElement("select") : document.createElement("input");
      if (input instanceof HTMLSelectElement) for (const choice of choices!) { const option = document.createElement("option"); option.value = choice; option.textContent = choice; input.append(option); }
      else { input.type = typeof field.value === "number" ? "number" : "text"; if (typeof field.value === "number") input.step = "any"; }
      input.value = String(field.value);
      input.addEventListener("change", () => {
        const value = typeof field.value === "number" ? Number(input.value) : input.value; if (typeof value === "number" && !Number.isFinite(value)) return;
        entityModel!.setPrimitive(selectedEntity!, field.path, value); commitEntityChange("Propiedad de entidad modificada"); renderEntityInspector();
      });
      label.append(caption, input); inspector.append(label);
    }
  }

  function canReplaceProject(): boolean {
    return session.canDiscard(() => window.confirm(
      "El proyecto tiene cambios sin guardar. ¿Quieres descartarlos?",
    ));
  }

  async function run(action: () => Promise<void>): Promise<void> {
    clearError();
    try { status.textContent = "Procesando…"; await new Promise(requestAnimationFrame); await action(); }
    catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showError(error);
      status.textContent = "La operación no se ha completado";
    }
  }

  const newProject = button("Nuevo");
  const openProject = button("Abrir ZIP");
  const openDirectory = button("Abrir carpeta");
  const saveProject = button("Guardar ZIP");
  const saveDirectory = button("Guardar carpeta");
  openDirectory.hidden = !supportsDirectoryAccess();
  saveDirectory.hidden = !supportsDirectoryAccess();
  saveProject.disabled = true;
  saveDirectory.disabled = true;

  newProject.addEventListener("click", () => void run(async () => {
    if (!canReplaceProject()) return;
    directoryHandle = null;
    clearError();
    await activateProject(createEmptyProject(), true,
                          "Proyecto vacío creado; todavía no se ha guardado");
  }));
  openProject.addEventListener("click", () => {
    if (canReplaceProject()) fileInput.click();
  });
  fileInput.addEventListener("change", () => void run(async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    const project = await readProjectFile(file);
    directoryHandle = null;
    await activateProject(project, false, `Proyecto abierto desde ${file.name}`);
  }));
  openDirectory.addEventListener("click", () => void run(async () => {
    if (!canReplaceProject()) return;
    const handle = await pickProjectDirectory();
    const project = await readProjectDirectory(handle);
    directoryHandle = handle;
    await activateProject(project, false, `Proyecto abierto desde la carpeta ${handle.name}`);
  }));
  saveProject.addEventListener("click", () => void run(async () => {
    const project = session.project;
    if (!project) return;
    if (hasValidationErrors(validateProject(project))) {
      throw new Error("Corrige los errores de validación antes de exportar");
    }
    downloadProject(project);
    session.markSaved();
    history.markClean();
    discardRecovery();
    refreshProjectState("Proyecto exportado como ZIP");
  }));
  saveDirectory.addEventListener("click", () => void run(async () => {
    const project = session.project;
    if (!project) return;
    if (hasValidationErrors(validateProject(project))) {
      throw new Error("Corrige los errores de validación antes de guardar");
    }
    directoryHandle ??= await pickProjectDirectory();
    await writeProjectDirectory(project, directoryHandle);
    session.markSaved();
    history.markClean();
    discardRecovery();
    refreshProjectState(`Proyecto guardado en la carpeta ${directoryHandle.name}`);
  }));
  const separator = document.createElement("span");
  separator.className = "toolbar-separator";
  separator.setAttribute("aria-hidden", "true");
  const undo = button("Deshacer", "El historial se implementará en la tarea 25");
  const redo = button("Rehacer", "El historial se implementará en la tarea 25");
  undo.disabled = true; redo.disabled = true;
  function refreshHistoryControls(): void { undo.disabled = !history.canUndo; redo.disabled = !history.canRedo; undo.title = history.undoLabel ? `Deshacer: ${history.undoLabel}` : "Nada que deshacer"; redo.title = history.redoLabel ? `Rehacer: ${history.redoLabel}` : "Nada que rehacer"; }
  async function restoreHistory(project: ReturnType<ProjectHistory["undo"]>, message: string): Promise<void> { if (!project) return; await activateProject(project, !history.isClean, message, false); if (history.isClean) discardRecovery(); else persistRecovery(); }
  undo.addEventListener("click", () => void restoreHistory(history.undo(), "Cambio deshecho"));
  redo.addEventListener("click", () => void restoreHistory(history.redo(), "Cambio rehecho"));
  const zoomOut = button("−", "Alejar");
  const zoomIn = button("+", "Acercar");
  const fit = button("Encajar", "Mostrar el mapa completo");
  const gameScreen = button("Pantalla de juego", "Ajustar el zoom a una pantalla del juego centrada en Rick");
  const grid = button("Rejilla: sí", "Mostrar u ocultar la rejilla");
  const play = button("Play", "Ejecutar preview a 50 Hz"); const pause = button("Pause"); const step = button("Step", "Avanzar un tick"); const resetPreview = button("Reset", "Reiniciar preview"); const invulnerable = button("Invulnerable: sí", "Ignorar daño durante la previsualización"); const cameraViews = button("Vistas cámara: sí", "Aplicar o ignorar los límites cameraViews durante el preview"); const sprites = button("Sprites: sí", "Mostrar u ocultar sprites animados"); const bounds = button("Cajas: sí", "Mostrar u ocultar bounding boxes del runtime"); const audio = button("Audio: sí", "Activar o silenciar música y efectos"); const placePlayer = button("Colocar Rick", "El siguiente clic en el mapa indica dónde apoya los pies Rick");
  invulnerable.setAttribute("aria-pressed", "true");
  invulnerable.addEventListener("click", () => { runtimeInvulnerable = !runtimeInvulnerable; runtime?.setInvulnerable(runtimeInvulnerable); invulnerable.textContent = `Invulnerable: ${runtimeInvulnerable ? "sí" : "no"}`; invulnerable.setAttribute("aria-pressed", String(runtimeInvulnerable)); renderRuntime(); });
  cameraViews.setAttribute("aria-pressed", "true");
  cameraViews.addEventListener("click", () => { runtimeCameraViewsEnabled = !runtimeCameraViewsEnabled; runtime?.setCameraViewsEnabled(runtimeCameraViewsEnabled); cameraViews.textContent = `Vistas cámara: ${runtimeCameraViewsEnabled ? "sí" : "no"}`; cameraViews.setAttribute("aria-pressed", String(runtimeCameraViewsEnabled)); renderRuntime(); });
  sprites.setAttribute("aria-pressed", "true"); bounds.setAttribute("aria-pressed", "true");
  sprites.addEventListener("click", () => { runtimeSpritesVisible = !runtimeSpritesVisible; sprites.textContent = `Sprites: ${runtimeSpritesVisible ? "sí" : "no"}`; sprites.setAttribute("aria-pressed", String(runtimeSpritesVisible)); preview.setRuntimeSpritesVisible(runtimeSpritesVisible); });
  bounds.addEventListener("click", () => { runtimeBoundsVisible = !runtimeBoundsVisible; bounds.textContent = `Cajas: ${runtimeBoundsVisible ? "sí" : "no"}`; bounds.setAttribute("aria-pressed", String(runtimeBoundsVisible)); preview.setRuntimeBoundsVisible(runtimeBoundsVisible); });
  audio.setAttribute("aria-pressed", "true"); audio.addEventListener("click", () => { runtimeAudioEnabled = !runtimeAudioEnabled; audio.textContent = `Audio: ${runtimeAudioEnabled ? "sí" : "no"}`; audio.setAttribute("aria-pressed", String(runtimeAudioEnabled)); if (!runtimeAudioEnabled) runtimeMusic?.pause(); else if (runtimePlaying) void runtimeMusic?.play().catch(() => undefined); });
  placePlayer.addEventListener("click", () => { if (!runtime) return; placingPlayer = !placingPlayer; placePlayer.setAttribute("aria-pressed", String(placingPlayer)); status.textContent = placingPlayer ? "Haz clic en el punto donde Rick debe apoyar los pies" : "Colocación de Rick cancelada"; canvas.focus(); });
  play.disabled = true; pause.disabled = true; step.disabled = true; resetPreview.disabled = true;
  const renderRuntime = (): void => { preview.setRuntimeBodies(runtime?.bodies ?? []); for (const slot of runtime?.drainAudioEvents() ?? []) if (runtimeAudioEnabled && runtimeEffectUrls[slot]) void new Audio(runtimeEffectUrls[slot]).play().catch(() => undefined); const guides = entityModel?.gameplayGuides(); preview.setGameplayGuides(guides?.lines ?? [], guides?.zones ?? []); if (runtimePreviewActive && runtime) { const camera = runtime.cameraFrame; preview.centerOnWorld(camera.x + camera.width / 2, camera.y + camera.height / 2); } status.textContent = `Preview · tick ${runtime?.tick ?? 0} · vidas ${runtime?.lives ?? 0}${runtime?.gameOver ? " · GAME OVER" : runtimePlaying ? " · reproduciendo" : " · pausa"}${runtime?.invulnerable ? " · invulnerable" : ""}${runtime?.dangerContact ? " · contacto peligroso" : ""}`; };
  const runtimeLoop = (time: number): void => { if (!runtimePlaying || !runtime) return; if (!runtimeLastTime) runtimeLastTime = time; runtimeAccumulator += Math.min(100, time - runtimeLastTime); runtimeLastTime = time; while (runtimeAccumulator >= 20) { runtime.step(runtimeInput); runtimeAccumulator -= 20; } renderRuntime(); runtimeFrame = requestAnimationFrame(runtimeLoop); };
  function stopRuntime(): void { runtimePlaying = false; runtimeMusic?.pause(); if (runtimeFrame) cancelAnimationFrame(runtimeFrame); runtimeFrame = 0; runtimeLastTime = 0; runtimeAccumulator = 0; }
  play.addEventListener("click", () => { if (!runtime) return; canvas.focus(); if (!runtimePreviewActive) runtimeEditorView = preview.getViewState(); runtimePreviewActive = true; runtimePlaying = true; if (runtimeAudioEnabled) void runtimeMusic?.play().catch(() => undefined); play.disabled = true; pause.disabled = false; step.disabled = true; resetPreview.disabled = false; runtimeFrame = requestAnimationFrame(runtimeLoop); });
  pause.addEventListener("click", () => { stopRuntime(); play.disabled = false; pause.disabled = true; step.disabled = false; renderRuntime(); });
  step.addEventListener("click", () => { if (!runtimePreviewActive) runtimeEditorView = preview.getViewState(); runtimePreviewActive = true; runtime?.step(runtimeInput); resetPreview.disabled = false; renderRuntime(); });
  resetPreview.addEventListener("click", () => { stopRuntime(); if (runtimeMusic) runtimeMusic.currentTime = 0; runtimePreviewActive = false; placingPlayer = false; placePlayer.setAttribute("aria-pressed", "false"); for (const key of Object.keys(runtimeInput) as Array<keyof PlayerInput>) runtimeInput[key] = false; runtime?.reset(); preview.setRuntimeBodies([]); if (runtimeEditorView) preview.setViewState(runtimeEditorView); runtimeEditorView = null; refreshEntityOverlay(); play.disabled = false; pause.disabled = true; step.disabled = false; resetPreview.disabled = true; status.textContent = "Preview reiniciado"; });
  const toolButtons = new Map<EditTool, HTMLButtonElement>();
  const setTool = (tool: EditTool): void => {
    activeTool = tool;
    for (const [id, control] of toolButtons) control.setAttribute("aria-pressed", String(id === tool));
    status.textContent = `Herramienta: ${tool}`;
  };
  for (const [id, label, shortcut] of [["pencil", "Lápiz", "P"], ["eraser", "Borrador", "E"], ["fill", "Relleno", "F"], ["select", "Selección", "S"], ["entity", "Entidades", "O"], ["asset", "Assets", "A"]] as const) {
    const control = button(label, `Atajo: ${shortcut}`); control.setAttribute("aria-keyshortcuts", shortcut);
    control.addEventListener("click", () => { setTool(id); entityControls.hidden = id !== "entity"; layerList.hidden = id === "asset"; paletteHost.hidden = id === "entity" || id === "asset"; if (id === "asset") assetEditor.show(); else assetEditor.hide(); preview.setSelection(id === "select" ? selection : null); refreshEntityOverlay(); });
    toolButtons.set(id, control);
  }
  zoomOut.addEventListener("click", () => preview.zoomBy(1 / 1.25));
  zoomIn.addEventListener("click", () => preview.zoomBy(1.25));
  fit.addEventListener("click", () => preview.fit());
  gameScreen.addEventListener("click", () => {
    if (!runtime || !levelModel) return;
    const camera = levelModel.level.camera as { width?: unknown; height?: unknown } | undefined;
    const width = typeof camera?.width === "number" && camera.width > 0 ? camera.width : 256;
    const height = typeof camera?.height === "number" && camera.height > 0 ? camera.height : 200;
    preview.focusWorldViewport(runtime.player.x + 12, runtime.player.y + 10, width, height);
    status.textContent = `Encuadre de juego: ${width}×${height}`;
  });
  let gridVisible = true;
  grid.addEventListener("click", () => {
    gridVisible = !gridVisible;
    grid.textContent = `Rejilla: ${gridVisible ? "sí" : "no"}`;
    grid.setAttribute("aria-pressed", String(gridVisible));
    preview.setGridVisible(gridVisible);
  });
  toolbar.append(newProject, openProject, openDirectory, saveProject,
                 saveDirectory, separator, undo, redo, separator.cloneNode(),
                 ...toolButtons.values(), separator.cloneNode(), play, pause, step, resetPreview, invulnerable, cameraViews, sprites, bounds, audio, placePlayer, separator.cloneNode(), zoomOut, zoomIn, fit, gameScreen, grid);
  setTool("pencil");

  for (const [id, label] of LAYERS) {
    const row = document.createElement("div");
    row.className = "layer-row";
    layerRows.set(id, row);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.disabled = true;
    checkbox.dataset.layer = id;
    layerCheckboxes.set(id, checkbox);
    checkbox.addEventListener("change", () => preview.setLayerVisible(id, checkbox.checked));
    const name = document.createElement("button");
    name.type = "button";
    name.textContent = label;
    name.addEventListener("click", () => {
      activeLayer = id;
      for (const [layer, layerRow] of layerRows) layerRow.classList.toggle("active", layer === id);
      palette.setLayer(id);
      status.textContent = `Capa activa: ${label}`;
    });
    row.append(checkbox, name);
    layerList.append(row);
  }

  const preview = new WorkspacePreview(canvas);
  const palette = new TilePalette(paletteHost);
  const assetEditor = new AssetEditor(assetControls, inspector);
  assetEditor.setChangeListener((message, reloadMap) => { session.markDirty(); if (session.project) history.record(session.project, message); persistRecovery(); refreshHistoryControls(); refreshProjectState(message); if (reloadMap && session.project && levelModel) void preview.load(session.project, levelModel.map, false).then(() => palette.load(session.project!, levelModel!)); });
  palette.setSelectListener((gid) => { status.textContent = `GID seleccionado: ${gid}`; });
  preview.start();
  layerRows.get(activeLayer)?.classList.add("active");

  const groupSelect = document.createElement("select");
  for (const group of ENTITY_GROUPS) { const option = document.createElement("option"); option.value = group; option.textContent = group; groupSelect.append(option); }
  groupSelect.value = entityGroup;
  groupSelect.addEventListener("change", () => { entityGroup = groupSelect.value as EntityGroup; selectedEntity = null; refreshEntityOverlay(); refreshProjectState(`Grupo de entidades: ${entityGroup}`); });
  const newEntity = button("Nueva"); const duplicateEntity = button("Duplicar seleccionada", "Ctrl+D"); const deleteEntity = button("Eliminar seleccionada", "Supr"); const centerEntity = button("Centrar seleccionada", "C");
  newEntity.addEventListener("click", () => { if (!entityModel || !entityModel.groups[entityGroup].length) { status.textContent = `No hay un modelo de ${entityGroup} que clonar`; return; } selectedEntity = entityModel.duplicate({ group: entityGroup, index: 0 }); if (selectedEntity && lastPointerTile) entityModel.move(selectedEntity, lastPointerTile.worldX, lastPointerTile.worldY); commitEntityChange(lastPointerTile ? "Entidad creada en la posición del cursor" : "Entidad creada desde el modelo del grupo"); });
  duplicateEntity.addEventListener("click", () => { if (!selectedEntity || !entityModel) return; selectedEntity = entityModel.duplicate(selectedEntity); commitEntityChange("Entidad duplicada"); });
  deleteEntity.addEventListener("click", () => { if (!selectedEntity || !entityModel) return; entityModel.remove(selectedEntity); selectedEntity = null; commitEntityChange("Entidad eliminada"); });
  centerEntity.addEventListener("click", () => { if (!selectedEntity || !entityModel) return; const box = entityModel.box(selectedEntity); if (box) { preview.centerOnWorld(box.x + box.width / 2, box.y + box.height / 2); status.textContent = "Entidad centrada"; } });
  const filterControl = (label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement => { const row = document.createElement("label"); row.className = "entity-filter"; const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = checked; checkbox.addEventListener("change", () => onChange(checkbox.checked)); row.append(checkbox, document.createTextNode(label)); return row; };
  const showAllControl = filterControl("Mostrar todos los grupos", false, (checked) => { showAllEntities = checked; refreshEntityOverlay(); });
  const relationsControl = filterControl("Relaciones", true, (checked) => { showRelations = checked; refreshEntityOverlay(); });
  const routesControl = filterControl("Rutas", true, (checked) => { showRoutes = checked; refreshEntityOverlay(); });
  const zonesControl = filterControl("Zonas", true, (checked) => { showZones = checked; refreshEntityOverlay(); });
  const selectedGuidesControl = filterControl("Solo guías de la selección", false, (checked) => { selectedGuidesOnly = checked; refreshEntityOverlay(); });
  const legend = document.createElement("div"); legend.className = "entity-legend"; legend.setAttribute("aria-label", "Leyenda de entidades");
  for (const group of ENTITY_GROUPS) { const item = document.createElement("span"); const swatch = document.createElement("i"); swatch.style.background = ENTITY_COLORS[group]; item.append(swatch, document.createTextNode(group)); legend.append(item); }
  const entitySearch = document.createElement("input"); entitySearch.type = "search"; entitySearch.placeholder = "Buscar grupo, ID o definición"; entitySearch.setAttribute("aria-label", "Buscar entidad");
  const entityResults = document.createElement("select"); entityResults.size = 4; entityResults.setAttribute("aria-label", "Resultados de entidades");
  entitySearch.addEventListener("input", () => refreshEntityFinder());
  entityResults.addEventListener("change", () => { const [group, index] = entityResults.value.split(":"); if (!group || index === undefined || !entityModel) return; selectedEntity = { group: group as EntityGroup, index: Number(index) }; entityGroup = selectedEntity.group; groupSelect.value = entityGroup; const box = entityModel.box(selectedEntity); if (box) preview.centerOnWorld(box.x + box.width / 2, box.y + box.height / 2); refreshEntityOverlay(); renderDiagnostics([]); });
  entityControls.append(groupSelect, showAllControl, relationsControl, routesControl, zonesControl, selectedGuidesControl, legend, entitySearch, entityResults, newEntity, duplicateEntity, centerEntity, deleteEntity);

  function refreshEntityFinder(): void {
    entityResults.innerHTML = ""; if (!entityModel) return; const query = entitySearch.value.trim().toLowerCase();
    for (const item of entityModel.all()) { const id = String(item.entity.id ?? item.ref.index); const definition = String((item.entity.attributes as Record<string, unknown> | undefined)?.definition ?? item.entity.definition ?? ""); const text = `${item.ref.group} ${id} ${definition}`; if (query && !text.toLowerCase().includes(query)) continue; const option = document.createElement("option"); option.value = `${item.ref.group}:${item.ref.index}`; option.textContent = `${item.ref.group} #${id}${definition ? ` · ${definition.split("/").at(-1)}` : ""}`; entityResults.append(option); }
  }

  function refreshEntityOverlay(): void {
    preview.setEntities(activeTool === "entity" ? (entityModel?.all().filter((item) => showAllEntities || item.ref.group === entityGroup).map((item) => ({ ...item, label: `${item.ref.group} #${String(item.entity.id ?? item.ref.index)}` })) ?? []) : [], selectedEntity);
    const guides = activeTool === "entity" ? entityModel?.gameplayGuides() : null;
    const selectedRecord = selectedEntity ? entityModel?.entity(selectedEntity) : null; const selectedKey = selectedEntity && selectedRecord ? `${selectedEntity.group}:${String(selectedRecord.id)}` : null;
    preview.setGameplayGuides(guides?.lines.filter((line) => (line.kind === "route" ? showRoutes : showRelations) && (!selectedGuidesOnly || !selectedKey || line.from === selectedKey || line.to === selectedKey)) ?? [], showZones ? (guides?.zones.filter((zone) => !selectedGuidesOnly || !selectedKey || zone.owner === selectedKey) ?? []) : []);
    refreshEntityFinder();
  }
  function commitEntityChange(message: string): void { if (!entityModel) return; entityModel.flush(); session.markDirty(); if (session.project) history.record(session.project, message); persistRecovery(); refreshHistoryControls(); refreshEntityOverlay(); refreshProjectState(message); }

  let gestureStart: PointerPosition | null = null;
  let gestureLast: PointerPosition | null = null;
  let gestureChanged = false;
  const finishEdit = (message: string): void => {
    if (!gestureChanged || !levelModel) return;
    levelModel.flush(); session.markDirty(); if (session.project) history.record(session.project, message); persistRecovery(); refreshHistoryControls(); preview.refresh(); refreshProjectState(message);
  };
  preview.setEditHandlers({
    down(tile) {
      if (!levelModel) return;
      if (placingPlayer && runtime) { if (!runtimePreviewActive) runtimeEditorView = preview.getViewState(); runtimePreviewActive = true; resetPreview.disabled = false; runtime.placePlayerAt(tile.worldX, tile.worldY); placingPlayer = false; placePlayer.setAttribute("aria-pressed", "false"); renderRuntime(); status.textContent = `Rick colocado en ${Math.round(tile.worldX)}, ${Math.round(tile.worldY)}`; return; }
      if (runtimePreviewActive) return;
      canvas.focus(); gestureStart = tile; gestureLast = tile; lastPointerTile = tile; gestureChanged = false;
      if (activeTool === "entity") {
        const hits = entityModel?.hitTestAll(tile.worldX, tile.worldY, showAllEntities ? undefined : entityGroup) ?? [];
        const current = selectedEntity ? hits.findIndex((ref) => ref.group === selectedEntity!.group && ref.index === selectedEntity!.index) : -1;
        selectedEntity = hits.length ? hits[(current + 1) % hits.length]! : null; refreshEntityOverlay(); renderDiagnostics([]);
        status.textContent = hits.length > 1 ? `Entidad solapada ${((current + 1) % hits.length) + 1}/${hits.length}; vuelve a pulsar para recorrerlas` : selectedEntity ? "Entidad seleccionada" : "No hay entidades en este punto"; return;
      }
      if (activeTool === "pencil") gestureChanged = levelModel.setCell(activeLayer, tile.x, tile.y, palette.selectedGid);
      if (activeTool === "eraser") gestureChanged = levelModel.setCell(activeLayer, tile.x, tile.y, 0);
      if (activeTool === "fill") gestureChanged = levelModel.floodFill(activeLayer, tile.x, tile.y, palette.selectedGid);
      if (activeTool === "select") { selection = { x: tile.x, y: tile.y, width: 1, height: 1 }; preview.setSelection(selection); }
      preview.refresh();
    },
    move(tile) {
      if (!levelModel || !gestureStart || !gestureLast) return;
      lastPointerTile = tile;
      if (activeTool === "entity" && selectedEntity && entityModel) { entityModel.translate(selectedEntity, tile.worldX - gestureLast.worldX, tile.worldY - gestureLast.worldY); gestureChanged = true; refreshEntityOverlay(); gestureLast = tile; return; }
      if (activeTool === "pencil" || activeTool === "eraser") {
        const gid = activeTool === "eraser" ? 0 : palette.selectedGid;
        gestureChanged = levelModel.paintLine(activeLayer, gestureLast.x, gestureLast.y, tile.x, tile.y, gid) || gestureChanged;
      } else if (activeTool === "select") {
        selection = levelModel.normalizedRect(gestureStart.x, gestureStart.y, tile.x, tile.y);
        preview.setSelection(selection);
      }
      gestureLast = tile; preview.refresh();
    },
    up() {
      if (activeTool === "entity" && gestureChanged) commitEntityChange("Entidad movida");
      else finishEdit(activeTool === "fill" ? "Zona rellenada" : "Tiles modificados");
      gestureStart = null; gestureLast = null; gestureChanged = false;
    },
  });

  canvas.addEventListener("pointermove", (event) => {
    const tile = preview.tileAtClient(event.clientX, event.clientY);
    if (tile) { lastPointerTile = tile; status.textContent = `${activeLayer} · x ${tile.x}, y ${tile.y} · GID ${palette.selectedGid}`; }
  });
  canvas.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); void restoreHistory(event.shiftKey ? history.redo() : history.undo(), event.shiftKey ? "Cambio rehecho" : "Cambio deshecho"); return; }
    if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); void restoreHistory(history.redo(), "Cambio rehecho"); return; }
    if (activeTool === "entity" && selectedEntity && entityModel && !runtimePreviewActive) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { duplicateEntity.click(); event.preventDefault(); return; }
      if (event.key === "Delete" || event.key === "Backspace") { deleteEntity.click(); event.preventDefault(); return; }
      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "c") { centerEntity.click(); event.preventDefault(); return; }
      const movement: Partial<Record<string, readonly [number, number]>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }, delta = movement[event.key];
      if (delta) { const step = event.shiftKey ? 8 : 1; entityModel.translate(selectedEntity, delta[0] * step, delta[1] * step); commitEntityChange(`Entidad desplazada ${step} px`); event.preventDefault(); return; }
    }
    if (!levelModel || !event.ctrlKey || !["c", "x", "v"].includes(event.key.toLowerCase())) return;
    const key = event.key.toLowerCase();
    if ((key === "c" || key === "x") && selection) {
      clipboard = levelModel.copy(activeLayer, selection);
      if (key === "x") { gestureChanged = levelModel.clear(activeLayer, selection); finishEdit("Selección cortada"); gestureChanged = false; }
      status.textContent = key === "c" ? "Selección copiada" : "Selección cortada";
      event.preventDefault(); preview.refresh();
    } else if (key === "v" && clipboard) {
      const target = lastPointerTile ?? (selection ? { x: selection.x, y: selection.y } : { x: 0, y: 0 });
      gestureChanged = levelModel.paste(activeLayer, target.x, target.y, clipboard);
      finishEdit("Selección pegada respetando los límites del mapa"); gestureChanged = false;
      selection = { x: target.x, y: target.y, width: Math.min(clipboard.width, levelModel.map.width - target.x), height: Math.min(clipboard.height, levelModel.map.height - target.y) };
      preview.setSelection(selection); event.preventDefault();
    }
  });
  const zoomStatus = requiredElement<HTMLElement>(host, ".statusbar span:last-child");
  preview.setZoomListener((zoom) => { zoomStatus.textContent = `${Math.round(zoom * 100)}%`; });
  const gameKey = (event: KeyboardEvent): keyof PlayerInput | null => ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Space: "action" } as const)[event.code] ?? null;
  window.addEventListener("keydown", (event) => { if (!runtimePreviewActive) return; const key = gameKey(event); if (key) { runtimeInput[key] = true; event.preventDefault(); } });
  window.addEventListener("keyup", (event) => { const key = gameKey(event); if (key) runtimeInput[key] = false; });
  window.addEventListener("blur", () => { for (const key of Object.keys(runtimeInput) as Array<keyof PlayerInput>) runtimeInput[key] = false; });
  window.addEventListener("keydown", (event) => {
    if (runtimePreviewActive) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement || event.ctrlKey || event.metaKey || event.altKey) return;
    const shortcuts: Record<string, EditTool> = { p: "pencil", e: "eraser", f: "fill", s: "select", o: "entity", a: "asset" }; const tool = shortcuts[event.key.toLowerCase()];
    if (tool) { toolButtons.get(tool)?.click(); event.preventDefault(); return; }
    if (event.key.toLowerCase() === "g") { grid.click(); event.preventDefault(); }
    if (event.key === "0") { fit.click(); event.preventDefault(); }
  });
  window.addEventListener("beforeunload", (event) => {
    stopRuntime();
    for (const url of runtimeAudioUrls) URL.revokeObjectURL(url);
    preview.stop();
    if (session.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  refreshProjectState("Aplicación offline cargada; esperando un proyecto");
  void loadRecovery().then((project) => { if (project && !session.project && window.confirm("Hay un proyecto sin guardar de una sesión anterior. ¿Quieres recuperarlo?")) void activateProject(project, true, "Proyecto recuperado desde el almacenamiento local"); }).catch(() => undefined);
}
