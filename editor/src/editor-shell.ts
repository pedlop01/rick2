import { WorkspacePreview, type MapLayerName, type PointerPosition, type ViewState } from "./workspace-preview";
import {
  createEmptyProject,
  createPlatformerDemoProject,
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
import { RICK_ACTION_BINDINGS, RICK_PLAYER_CAPABILITIES, RICK_PLAYER_CONTROLLER, RICK_RUNTIME_BINDINGS, RICK_SESSION_RULES } from "./platformer-core";
import { readableDataLabel, readableDataPath } from "./ui-labels";
import { createControlSection } from "./ui-controls";
import { CharacterStateEditor } from "./character-state-editor";
import { GameplayEditor } from "./gameplay-editor";

const LAYERS = [
  ["tiles", "Tiles"],
  ["frontTiles", "Front tiles"],
  ["collisions", "Collisions"],
] as const;
type EditTool = "pencil" | "eraser" | "fill" | "select" | "entity" | "asset" | "profile" | "states" | "gameplay";
type ResizeCorner = "nw" | "ne" | "sw" | "se";

function button(label: string, title?: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  if (title) element.title = title;
  return element;
}

function showShortcut(control: HTMLButtonElement, shortcut: string): void {
  control.dataset.shortcut = shortcut;
}

function requiredElement<T extends Element>(host: ParentNode, selector: string): T {
  const element = host.querySelector<T>(selector);
  if (!element) throw new Error(`The template does not contain ${selector}`);
  return element;
}

export function createEditorShell(host: HTMLElement): void {
  host.className = "editor-shell";
  host.innerHTML = `
    <header class="app-header">
      <div class="brand"><span class="brand-mark">R2</span><div><h1>Rick2 Engine</h1><p>Offline level editor</p></div></div>
      <div class="document-meta"><div class="document-title" aria-live="polite">No project</div><span class="project-state" data-state="empty">No project</span></div>
    </header>
    <nav class="toolbar" aria-label="Project tools"></nav>
    <div class="notification" role="alert" hidden></div>
    <aside class="panel layers-panel" aria-labelledby="layers-title">
      <div class="panel-heading"><h2 id="layers-title">Layers</h2></div>
      <div class="panel-content" id="layer-list"></div><div class="entity-controls" id="entity-controls" hidden></div><div class="asset-controls" id="asset-controls" hidden></div><div class="state-controls" id="state-controls" hidden></div><div class="gameplay-controls" id="gameplay-controls" hidden></div><div class="tile-palette" id="tile-palette"></div>
    </aside>
    <main class="workspace" aria-label="Level canvas">
      <canvas tabindex="0" aria-label="Empty map preview"></canvas>
      <div class="state-graph" hidden></div>
      <div class="gameplay-workspace" hidden></div>
      <div class="canvas-hint">Create or open a project to begin</div>
    </main>
    <aside class="panel inspector-panel" aria-labelledby="inspector-title">
      <div class="panel-heading"><h2 id="inspector-title">Inspector</h2></div>
      <div class="panel-content empty-inspector"><span aria-hidden="true">◇</span><p>Nothing selected</p></div>
    </aside>
    <footer class="statusbar"><span id="status" role="status">Rick2 Engine ready</span><span id="pointer-status" aria-live="off"></span><span id="zoom-status">100%</span></footer>
    <dialog class="project-dialog" aria-labelledby="new-project-title">
      <form>
        <header><h2 id="new-project-title">Create a new project</h2><p>Start with a blank, valid level. You can import or replace its assets later.</p></header>
        <label><span>Project name</span><input name="projectName" value="New game" required autocomplete="off"></label>
        <label><span>Project ID</span><input name="projectId" value="new-game" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" autocomplete="off"><small>Lowercase letters, numbers, and hyphens. Used in exported files.</small></label>
        <div class="dialog-actions"><button type="button" value="cancel">Cancel</button><button type="submit" class="primary">Create project</button></div>
      </form>
    </dialog>
    <dialog class="help-dialog" aria-labelledby="help-title">
      <article>
        <header><h2 id="help-title">Rick2 Engine quick guide</h2><p>A short path from opening a project to testing and saving it.</p></header>
        <ol class="workflow-guide">
          <li><strong>Open or create</strong><span>Use Project to open a ZIP or folder, create a blank level, or load the generic demo.</span></li>
          <li><strong>Edit</strong><span>Choose a tool from Edit. The left panel contains its resources and the inspector contains the selected properties.</span></li>
          <li><strong>Test and validate</strong><span>Use Test to run the level. Validation issues appear in the inspector and can be clicked to locate their source.</span></li>
          <li><strong>Save</strong><span>Export a portable ZIP or save back to an opened folder. Errors must be fixed before saving.</span></li>
        </ol>
        <h3>Canvas controls</h3>
        <dl class="shortcut-guide">
          <div><dt>Wheel</dt><dd>Zoom</dd></div><div><dt>Space + drag</dt><dd>Pan the map</dd></div>
          <div><dt>0</dt><dd>Fit map</dd></div><div><dt>G</dt><dd>Toggle grid</dd></div>
          <div><dt>Ctrl+Z / Ctrl+Y</dt><dd>Undo / redo</dd></div><div><dt>?</dt><dd>Open this guide</dd></div>
        </dl>
        <div class="dialog-actions"><button type="button" value="close">Close</button></div>
      </article>
    </dialog>
  `;

  const toolbar = requiredElement<HTMLElement>(host, ".toolbar");
  const leftPanelTitle = requiredElement<HTMLElement>(host, "#layers-title");
  const inspectorTitle = requiredElement<HTMLElement>(host, "#inspector-title");
  const layerList = requiredElement<HTMLElement>(host, "#layer-list");
  const canvas = requiredElement<HTMLCanvasElement>(host, "canvas");
  const status = requiredElement<HTMLElement>(host, "#status");
  const documentTitle = requiredElement<HTMLElement>(host, ".document-title");
  const projectState = requiredElement<HTMLElement>(host, ".project-state");
  const pointerStatus = requiredElement<HTMLElement>(host, "#pointer-status");
  const hint = requiredElement<HTMLElement>(host, ".canvas-hint");
  const notification = requiredElement<HTMLElement>(host, ".notification");
  const inspector = requiredElement<HTMLElement>(host, ".inspector-panel .panel-content");
  const paletteHost = requiredElement<HTMLElement>(host, "#tile-palette");
  const entityControls = requiredElement<HTMLElement>(host, "#entity-controls");
  const assetControls = requiredElement<HTMLElement>(host, "#asset-controls");
  const stateControls = requiredElement<HTMLElement>(host, "#state-controls");
  const stateGraph = requiredElement<HTMLElement>(host, ".state-graph");
  const gameplayControls = requiredElement<HTMLElement>(host, "#gameplay-controls");
  const gameplayWorkspace = requiredElement<HTMLElement>(host, ".gameplay-workspace");
  const projectDialog = requiredElement<HTMLDialogElement>(host, ".project-dialog");
  const projectForm = requiredElement<HTMLFormElement>(projectDialog, "form");
  const projectNameInput = requiredElement<HTMLInputElement>(projectForm, "[name=projectName]");
  const projectIdInput = requiredElement<HTMLInputElement>(projectForm, "[name=projectId]");
  const cancelProject = requiredElement<HTMLButtonElement>(projectForm, "[value=cancel]");
  const helpDialog = requiredElement<HTMLDialogElement>(host, ".help-dialog");
  const closeHelp = requiredElement<HTMLButtonElement>(helpDialog, "[value=close]");

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
  let runtimePlaying = false; let runtimePreviewActive = false; let runtimeFrame = 0; let runtimeLastTime = 0; let runtimeAccumulator = 0; let runtimeInvulnerable = true; let runtimeCameraViewsEnabled = true; let runtimeFollowPlayer = true; let runtimeLiveEdit = false; let runtimeSpritesVisible = true; let runtimeBoundsVisible = true; let runtimeAudioEnabled = true; let placingPlayer = false;
  let runtimeMusic: HTMLAudioElement | null = null; let runtimeEffectUrls: string[] = []; let runtimeAudioUrls: string[] = [];
  const runtimeInput: PlayerInput = { left: false, right: false, up: false, down: false, action: false };
  let runtimeEditorView: ViewState | null = null;
  let entityGroup: EntityGroup = "items";
  const visibleEntityGroups = new Set<EntityGroup>([entityGroup]); let showRelations = true; let showRoutes = true; let showZones = true; let selectedGuidesOnly = false;
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

  const objectiveZones = (): import("./entity-document").GameplayZone[] => {
    const objective = levelModel?.level.objective;
    if (!objective || typeof objective !== "object") return [];
    const value = objective as Record<string, unknown>;
    return value.type === "reachZone" && [value.x, value.y, value.width, value.height].every((part) => typeof part === "number")
      ? [{ box: { x: Number(value.x), y: Number(value.y), width: Number(value.width), height: Number(value.height) }, kind: "objective", owner: "objective" }]
      : [];
  };

  let notificationTimer = 0;
  function showNotice(message: string, kind: "success" | "error" | "info" = "info", timeout = 3200): void {
    if (notificationTimer) window.clearTimeout(notificationTimer);
    notification.textContent = message; notification.dataset.kind = kind; notification.setAttribute("role", kind === "error" ? "alert" : "status"); notification.hidden = false;
    if (timeout > 0) notificationTimer = window.setTimeout(() => { notification.hidden = true; notificationTimer = 0; }, timeout);
  }

  function showError(error: unknown): void {
    showNotice(error instanceof Error ? error.message : String(error), "error", 0);
  }

  function clearError(): void {
    if (notificationTimer) window.clearTimeout(notificationTimer); notificationTimer = 0;
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
    const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
    documentTitle.textContent = project
        ? `${project.manifest.name}${session.dirty ? " •" : ""}`
        : "No project";
    hint.textContent = project
        ? `${project.manifest.levels.length} level(s) · ${project.files.size} file(s)`
        : "Create or open a project to begin";
    saveProject.disabled = !project || invalid;
    saveDirectory.disabled = !project || invalid || !supportsDirectoryAccess();
    projectState.dataset.state = !project ? "empty" : invalid ? "error" : session.dirty ? "dirty" : warningCount ? "warning" : "saved";
    projectState.textContent = !project ? "No project" : invalid ? `${errorCount} error${errorCount === 1 ? "" : "s"}` : session.dirty ? "Unsaved" : warningCount ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : "Saved";
    renderDiagnostics(diagnostics);
    status.textContent = invalid
        ? `${message} · ${errorCount} validation error(s)`
        : warningCount ? `${message} · ${warningCount} warning(s)` : message;
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
    stateEditor.bind(levelModel.level, commitStateChange, () => ({ form: runtime?.playerForm, state: runtime?.playerDeclaredState }));
    gameplayEditor.bind(levelModel.level, commitStateChange);
    stopRuntime(); runtimePreviewActive = false; placingPlayer = false; runtimeEditorView = null; runtime = new PreviewRuntime(levelModel.level); runtime.setInvulnerable(runtimeInvulnerable); runtime.setCameraViewsEnabled(runtimeCameraViewsEnabled); configureRuntimeAudio(project, levelModel.level); preview.setRuntimeBodies([]); preview.setPresentation(null);
    play.disabled = false; pause.disabled = true; step.disabled = false; resetPreview.disabled = true;
    selectedEntity = null;
    for (const checkbox of layerCheckboxes.values()) checkbox.disabled = false;
    refreshProjectState(message);
    await preview.load(project, levelModel.map, resetHistory);
    await palette.load(project, levelModel);
    assetEditor.load(assetModel);
    if (activeTool === "profile") renderProfileInspector();
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
      text.textContent = session.project ? "Project is valid" : "Nothing selected";
      inspector.append(icon, text);
      return;
    }
    const title = document.createElement("p");
    title.className = "diagnostic-summary";
    title.textContent = `${diagnostics.length} issue(s)`;
    const list = document.createElement("ol");
    list.className = "diagnostic-list";
    for (const diagnostic of diagnostics) {
      const item = document.createElement("li");
      item.classList.add(`diagnostic-${diagnostic.severity}`); item.tabIndex = 0; item.title = "Go to item";
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
    if (tile && levelModel) { const layer = tile[1] as MapLayerName; const index = Number(tile[2]); activeLayer = layer; toolButtons.get("select")?.click(); selection = { x: index % levelModel.map.width, y: Math.floor(index / levelModel.map.width), width: 1, height: 1 }; preview.setSelection(selection); status.textContent = `Diagnostic at ${layer}, cell ${index}`; return; }
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
      const label = document.createElement("label"); label.className = "property-field"; label.title = field.path.join("."); const caption = document.createElement("span"); caption.textContent = readableDataPath(field.path);
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
        entityModel!.setPrimitive(selectedEntity!, field.path, value); commitEntityChange("Entity property changed"); renderEntityInspector();
      });
      label.append(caption, input); inspector.append(label);
    }
  }

  type ProfileValue = string | number | boolean | null;
  type ProfileField = { path: string[]; label: string; fallback: ProfileValue; kind: "number" | "boolean" | "text" | "choice" | "nullable-number"; choices?: readonly ProfileValue[] };
  const profileSections: ReadonlyArray<{ title: string; fields: readonly ProfileField[] }> = [
    { title: "Controller", fields: Object.entries(RICK_PLAYER_CONTROLLER).map(([key, fallback]) => ({ path: ["runtimeProfile", "controller", key], label: key, fallback, kind: "number" })) },
    { title: "Capabilities", fields: Object.entries(RICK_PLAYER_CAPABILITIES).map(([key, fallback]) => ({ path: ["runtimeProfile", "capabilities", key], label: key, fallback, kind: "boolean" })) },
    { title: "Actions", fields: Object.entries(RICK_ACTION_BINDINGS).map(([key, fallback]) => ({ path: ["runtimeProfile", "actionBindings", key], label: key, fallback, kind: "choice", choices: [null, "shooting", "bombing", "hitting"] })) },
    { title: "Session", fields: [
      { path: ["runtimeProfile", "session", "initialLives"], label: "initialLives", fallback: RICK_SESSION_RULES.initialLives, kind: "number" },
      { path: ["runtimeProfile", "session", "damageEnabled"], label: "damageEnabled", fallback: RICK_SESSION_RULES.damageEnabled, kind: "boolean" },
      { path: ["runtimeProfile", "session", "respawn"], label: "respawn", fallback: RICK_SESSION_RULES.respawn, kind: "choice", choices: ["checkpoint", "none"] },
      { path: ["runtimeProfile", "session", "resetTriggersOnDeath"], label: "resetTriggersOnDeath", fallback: RICK_SESSION_RULES.resetTriggersOnDeath, kind: "boolean" },
      { path: ["runtimeProfile", "session", "deathAudioSlot"], label: "deathAudioSlot", fallback: RICK_SESSION_RULES.deathAudioSlot, kind: "nullable-number" },
    ] },
    ...(["playerStates", "enemyStates", "objectStates", "audio"] as const).map((family) => ({ title: `Bindings · ${readableDataLabel(family)}`, fields: Object.entries(RICK_RUNTIME_BINDINGS[family]).map(([key, fallback]) => ({ path: ["runtimeProfile", "bindings", family, key], label: key, fallback, kind: family === "audio" ? "nullable-number" as const : "text" as const })) })),
  ];

  function valueAt(root: Record<string, unknown>, path: readonly string[]): unknown { let value: unknown = root; for (const key of path) { if (!value || typeof value !== "object") return undefined; value = (value as Record<string, unknown>)[key]; } return value; }
  function setValueAt(root: Record<string, unknown>, path: readonly string[], value: ProfileValue): void { let cursor = root; for (const key of path.slice(0, -1)) { const child = cursor[key]; if (!child || typeof child !== "object" || Array.isArray(child)) cursor[key] = {}; cursor = cursor[key] as Record<string, unknown>; } cursor[path.at(-1)!] = value; }
  function deleteValueAt(root: Record<string, unknown>, path: readonly string[]): void { const parents: Record<string, unknown>[] = [root]; let cursor = root; for (const key of path.slice(0, -1)) { const child = cursor[key]; if (!child || typeof child !== "object" || Array.isArray(child)) return; cursor = child as Record<string, unknown>; parents.push(cursor); } delete cursor[path.at(-1)!]; for (let index = parents.length - 1; index > 0; --index) { if (Object.keys(parents[index]!).length) break; delete parents[index - 1]![path[index - 1]!]; } }
  function commitProfileChange(message: string): void { if (!levelModel) return; levelModel.flush(); session.markDirty(); if (session.project) history.record(session.project, message); persistRecovery(); refreshHistoryControls(); runtime = new PreviewRuntime(levelModel.level); runtime.setInvulnerable(runtimeInvulnerable); runtime.setCameraViewsEnabled(runtimeCameraViewsEnabled); if (session.project) configureRuntimeAudio(session.project, levelModel.level); refreshProjectState(message); renderProfileInspector(); }

  function renderProfileInspector(): void {
    inspector.innerHTML = ""; inspector.classList.remove("empty-inspector");
    const heading = document.createElement("h3"); heading.textContent = "Runtime profile";
    const help = document.createElement("p"); help.className = "profile-help"; help.textContent = "Fields without an override inherit the Rick base profile."; inspector.append(heading, help);
    if (!levelModel) return;
    for (const section of profileSections) {
      const details = document.createElement("details"); details.className = "profile-section"; details.open = section.title === "Controller";
      const summary = document.createElement("summary"); summary.textContent = section.title; details.append(summary);
      for (const field of section.fields) {
        const stored = valueAt(levelModel.level, field.path); const effective = stored === undefined ? field.fallback : stored as ProfileValue;
        const row = document.createElement("div"); row.className = "profile-field"; const label = document.createElement("label"); label.title = field.path.join("."); const caption = document.createElement("span"); caption.textContent = readableDataLabel(field.label); label.append(caption);
        let control: HTMLInputElement | HTMLSelectElement;
        if (field.kind === "boolean" || field.kind === "choice" || field.kind === "nullable-number") {
          control = document.createElement("select"); const effectCount = (levelModel.level.audio as { effects?: unknown[] } | undefined)?.effects?.length ?? 0; const choices = field.kind === "boolean" ? [true, false] : field.kind === "nullable-number" ? [null, ...Array.from({ length: Math.max(8, effectCount) }, (_, index) => index)] : field.choices!;
          for (const choice of choices) { const option = document.createElement("option"); option.value = choice === null ? "__null" : String(choice); option.textContent = choice === null ? "None" : choice === true ? "On" : choice === false ? "Off" : readableDataLabel(String(choice)); control.append(option); }
          control.value = effective === null ? "__null" : String(effective);
        } else { control = document.createElement("input"); control.type = field.kind; control.value = String(effective); if (field.kind === "number") control.step = "any"; }
        control.addEventListener("change", () => { let value: ProfileValue = control.value; if (field.kind === "number") value = Number(control.value); else if (field.kind === "boolean") value = control.value === "true"; else if (field.kind === "nullable-number") value = control.value === "__null" ? null : Number(control.value); else if (field.kind === "choice" && control.value === "__null") value = null; if (typeof value === "number" && !Number.isFinite(value)) return; setValueAt(levelModel!.level, field.path, value); commitProfileChange(`${readableDataLabel(field.label)} configured`); });
        const reset = button("↺", `Reset ${field.label}`); reset.className = "profile-reset"; reset.disabled = stored === undefined; reset.addEventListener("click", () => { deleteValueAt(levelModel!.level, field.path); commitProfileChange(`${field.label} reset`); });
        label.append(control); row.append(label, reset); details.append(row);
      }
      inspector.append(details);
    }
    const objective = (levelModel.level.objective && typeof levelModel.level.objective === "object" ? levelModel.level.objective : { type: "none" }) as Record<string, unknown>;
    const details = document.createElement("details"); details.className = "profile-section"; details.open = true; const summary = document.createElement("summary"); summary.textContent = "Objective"; details.append(summary);
    const objectiveFields: ProfileField[] = [{ path: ["objective", "type"], label: "type", fallback: "none", kind: "choice", choices: ["none", "reachZone"] }];
    if (objective.type === "reachZone") objectiveFields.push(...["x", "y", "width", "height"].map((key) => ({ path: ["objective", key], label: key, fallback: key === "width" || key === "height" ? 16 : 0, kind: "number" as const })), { path: ["objective", "onComplete"], label: "onComplete", fallback: "freeze", kind: "choice", choices: ["freeze", "continue"] });
    for (const field of objectiveFields) { const label = document.createElement("label"); label.className = "property-field"; label.title = field.path.join("."); const caption = document.createElement("span"); caption.textContent = readableDataLabel(field.label); const control = field.kind === "choice" ? document.createElement("select") : document.createElement("input"); if (control instanceof HTMLSelectElement) for (const choice of field.choices!) { const option = document.createElement("option"); option.value = String(choice); option.textContent = readableDataLabel(String(choice)); control.append(option); } else { control.type = "number"; control.step = "1"; } control.value = String(valueAt(levelModel.level, field.path) ?? field.fallback); control.addEventListener("change", () => { if (field.label === "type") levelModel!.level.objective = control.value === "none" ? { type: "none" } : { type: "reachZone", x: 0, y: 0, width: 16, height: 16, onComplete: "freeze" }; else setValueAt(levelModel!.level, field.path, field.kind === "number" ? Number(control.value) : control.value); commitProfileChange(`Objective: ${readableDataLabel(field.label)} updated`); }); label.append(caption, control); details.append(label); }
    inspector.append(details);
  }

  function canReplaceProject(): boolean {
    return session.canDiscard(() => window.confirm(
      "The project has unsaved changes. Do you want to discard them?",
    ));
  }

  async function run(action: () => Promise<void>): Promise<void> {
    clearError();
    try { status.textContent = "Processing…"; await new Promise(requestAnimationFrame); await action(); }
    catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      showError(error);
      status.textContent = "The operation could not be completed";
    }
  }

  const newProject = button("New");
  const demoProject = button("Generic demo", "Create a minimal project that does not use the Rick profile");
  const openProject = button("Open ZIP");
  const openDirectory = button("Open folder");
  const saveProject = button("Save ZIP");
  const saveDirectory = button("Save folder");
  openDirectory.hidden = !supportsDirectoryAccess();
  saveDirectory.hidden = !supportsDirectoryAccess();
  saveProject.disabled = true;
  saveDirectory.disabled = true;

  let projectIdEdited = false;
  const projectSlug = (value: string): string => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "new-game";
  projectNameInput.addEventListener("input", () => { projectNameInput.setCustomValidity(""); if (!projectIdEdited) projectIdInput.value = projectSlug(projectNameInput.value); });
  projectIdInput.addEventListener("input", () => { projectIdEdited = true; projectIdInput.setCustomValidity(projectIdInput.validity.patternMismatch ? "Use lowercase letters, numbers, and single hyphens between words." : ""); });
  cancelProject.addEventListener("click", () => projectDialog.close());
  newProject.addEventListener("click", () => {
    if (!canReplaceProject()) return;
    projectNameInput.value = "New game"; projectIdInput.value = "new-game"; projectIdEdited = false; projectIdInput.setCustomValidity("");
    projectDialog.showModal(); projectNameInput.focus(); projectNameInput.select();
  });
  projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!projectNameInput.value.trim()) projectNameInput.setCustomValidity("Enter a project name.");
    if (!projectForm.reportValidity()) return;
    void run(async () => {
      directoryHandle = null;
      clearError();
      projectDialog.close();
      await activateProject(createEmptyProject(projectIdInput.value, projectNameInput.value.trim()), true,
                            "Empty project created; it has not been saved yet");
    });
  });
  demoProject.addEventListener("click", () => void run(async () => {
    if (!canReplaceProject()) return;
    directoryHandle = null;
    await activateProject(createPlatformerDemoProject(), true, "Generic demo created; reach the zone on the right");
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
    await activateProject(project, false, `Project opened from ${file.name}`);
  }));
  openDirectory.addEventListener("click", () => void run(async () => {
    if (!canReplaceProject()) return;
    const handle = await pickProjectDirectory();
    const project = await readProjectDirectory(handle);
    directoryHandle = handle;
    await activateProject(project, false, `Project opened from folder ${handle.name}`);
  }));
  saveProject.addEventListener("click", () => void run(async () => {
    const project = session.project;
    if (!project) return;
    if (hasValidationErrors(validateProject(project))) {
      throw new Error("Fix the validation errors before exporting");
    }
    downloadProject(project);
    session.markSaved();
    history.markClean();
    discardRecovery();
    refreshProjectState("Project exported as ZIP");
    showNotice("Project exported successfully", "success");
  }));
  saveDirectory.addEventListener("click", () => void run(async () => {
    const project = session.project;
    if (!project) return;
    if (hasValidationErrors(validateProject(project))) {
      throw new Error("Fix the validation errors before saving");
    }
    directoryHandle ??= await pickProjectDirectory();
    await writeProjectDirectory(project, directoryHandle);
    session.markSaved();
    history.markClean();
    discardRecovery();
    refreshProjectState(`Project saved to folder ${directoryHandle.name}`);
    showNotice(`Project saved to ${directoryHandle.name}`, "success");
  }));
  const undo = button("Undo", "Nothing to undo");
  const redo = button("Redo", "Nothing to redo");
  showShortcut(undo, "Ctrl+Z"); showShortcut(redo, "Ctrl+Y");
  undo.disabled = true; redo.disabled = true;
  function refreshHistoryControls(): void { undo.disabled = !history.canUndo; redo.disabled = !history.canRedo; undo.title = history.undoLabel ? `Undo: ${history.undoLabel}` : "Nothing to undo"; redo.title = history.redoLabel ? `Redo: ${history.redoLabel}` : "Nothing to redo"; }
  async function restoreHistory(project: ReturnType<ProjectHistory["undo"]>, message: string): Promise<void> { if (!project) return; await activateProject(project, !history.isClean, message, false); if (history.isClean) discardRecovery(); else persistRecovery(); }
  undo.addEventListener("click", () => void restoreHistory(history.undo(), "Change undone"));
  redo.addEventListener("click", () => void restoreHistory(history.redo(), "Change redone"));
  const zoomOut = button("Zoom −", "Zoom out");
  const zoomIn = button("Zoom +", "Zoom in");
  const fit = button("Fit", "Show the entire map");
  const gameScreen = button("Game screen", "Fit one game screen centered on the player");
  const grid = button("Grid: on", "Show or hide the grid");
  const quickGuide = button("Quick guide", "How to use the editor"); showShortcut(quickGuide, "?");
  showShortcut(fit, "0"); showShortcut(grid, "G");
  const play = button("Play", "Run the preview at 50 Hz"); const pause = button("Pause"); const step = button("Step", "Advance one tick"); const resetPreview = button("Reset", "Reset preview"); const invulnerable = button("Invulnerable: on", "Ignore damage during preview"); const cameraViews = button("Camera views: on", "Apply or ignore cameraViews boundaries during preview"); const followPlayer = button("Follow player: on", "Follow the player or leave the editor camera free"); const liveEdit = button("Live edit: off", "Select and move entities with the mouse while the preview runs"); const sprites = button("Sprites: on", "Show or hide animated sprites"); const bounds = button("Bounds: on", "Show or hide runtime bounding boxes"); const audio = button("Audio: on", "Enable or mute music and effects"); const placePlayer = button("Place player", "Click the map to choose where the player stands");
  invulnerable.setAttribute("aria-pressed", "true");
  invulnerable.addEventListener("click", () => { runtimeInvulnerable = !runtimeInvulnerable; runtime?.setInvulnerable(runtimeInvulnerable); invulnerable.textContent = `Invulnerable: ${runtimeInvulnerable ? "on" : "off"}`; invulnerable.setAttribute("aria-pressed", String(runtimeInvulnerable)); renderRuntime(); });
  cameraViews.setAttribute("aria-pressed", "true");
  cameraViews.addEventListener("click", () => { runtimeCameraViewsEnabled = !runtimeCameraViewsEnabled; runtime?.setCameraViewsEnabled(runtimeCameraViewsEnabled); cameraViews.textContent = `Camera views: ${runtimeCameraViewsEnabled ? "on" : "off"}`; cameraViews.setAttribute("aria-pressed", String(runtimeCameraViewsEnabled)); renderRuntime(); });
  followPlayer.setAttribute("aria-pressed", "true");
  followPlayer.addEventListener("click", () => { runtimeFollowPlayer = !runtimeFollowPlayer; followPlayer.textContent = `Follow player: ${runtimeFollowPlayer ? "on" : "off"}`; followPlayer.setAttribute("aria-pressed", String(runtimeFollowPlayer)); if (runtimeFollowPlayer && runtime) { const camera = runtime.cameraFrame; preview.centerOnWorld(camera.x + camera.width / 2, camera.y + camera.height / 2); } status.textContent = runtimeFollowPlayer ? "Camera follows the player" : "Free camera enabled · pan and zoom while the preview runs"; });
  liveEdit.setAttribute("aria-pressed", "false");
  liveEdit.addEventListener("click", () => { runtimeLiveEdit = !runtimeLiveEdit; liveEdit.textContent = `Live edit: ${runtimeLiveEdit ? "on" : "off"}`; liveEdit.setAttribute("aria-pressed", String(runtimeLiveEdit)); status.textContent = runtimeLiveEdit ? "Live edit enabled · use the Entities tool to select and drag" : "Live edit disabled"; });
  sprites.setAttribute("aria-pressed", "true"); bounds.setAttribute("aria-pressed", "true");
  sprites.addEventListener("click", () => { runtimeSpritesVisible = !runtimeSpritesVisible; sprites.textContent = `Sprites: ${runtimeSpritesVisible ? "on" : "off"}`; sprites.setAttribute("aria-pressed", String(runtimeSpritesVisible)); preview.setRuntimeSpritesVisible(runtimeSpritesVisible); });
  bounds.addEventListener("click", () => { runtimeBoundsVisible = !runtimeBoundsVisible; bounds.textContent = `Bounds: ${runtimeBoundsVisible ? "on" : "off"}`; bounds.setAttribute("aria-pressed", String(runtimeBoundsVisible)); preview.setRuntimeBoundsVisible(runtimeBoundsVisible); });
  audio.setAttribute("aria-pressed", "true"); audio.addEventListener("click", () => { runtimeAudioEnabled = !runtimeAudioEnabled; audio.textContent = `Audio: ${runtimeAudioEnabled ? "on" : "off"}`; audio.setAttribute("aria-pressed", String(runtimeAudioEnabled)); if (!runtimeAudioEnabled) runtimeMusic?.pause(); else if (runtimePlaying) void runtimeMusic?.play().catch(() => undefined); });
  placePlayer.addEventListener("click", () => { if (!runtime) return; placingPlayer = !placingPlayer; placePlayer.setAttribute("aria-pressed", String(placingPlayer)); status.textContent = placingPlayer ? "Click where the player should stand" : "Player placement cancelled"; canvas.focus(); });
  play.disabled = true; pause.disabled = true; step.disabled = true; resetPreview.disabled = true;
  const renderRuntime = (): void => { preview.setRuntimeBodies(runtime?.bodies ?? []); preview.setPresentation(runtime?.presentation ?? null, runtime?.parallaxLayers ?? [], runtime?.cameraFrame); stateEditor.refreshRuntime(); for (const slot of runtime?.drainAudioEvents() ?? []) if (runtimeAudioEnabled && runtimeEffectUrls[slot]) void new Audio(runtimeEffectUrls[slot]).play().catch(() => undefined); const guides = entityModel?.gameplayGuides(); preview.setGameplayGuides(guides?.lines ?? [], [...(guides?.zones ?? []), ...objectiveZones()]); if (runtimePreviewActive && runtime && runtimeFollowPlayer) { const camera = runtime.cameraFrame; preview.centerOnWorld(camera.x + camera.width / 2, camera.y + camera.height / 2); } status.textContent = `Preview · tick ${runtime?.tick ?? 0} · lives ${runtime?.lives ?? 0}${runtime?.gameOver ? " · GAME OVER" : runtimePlaying ? " · playing" : " · paused"}${runtime?.completed ? " · OBJECTIVE COMPLETE" : ""}${runtime?.invulnerable ? " · invulnerable" : ""}${runtime?.dangerContact ? " · danger contact" : ""}${runtimeFollowPlayer ? "" : " · free camera"}`; };
  const runtimeLoop = (time: number): void => { if (!runtimePlaying || !runtime) return; if (!runtimeLastTime) runtimeLastTime = time; runtimeAccumulator += Math.min(100, time - runtimeLastTime); runtimeLastTime = time; while (runtimeAccumulator >= 20) { runtime.step(runtimeInput); runtimeAccumulator -= 20; } renderRuntime(); runtimeFrame = requestAnimationFrame(runtimeLoop); };
  function stopRuntime(): void { runtimePlaying = false; runtimeMusic?.pause(); if (runtimeFrame) cancelAnimationFrame(runtimeFrame); runtimeFrame = 0; runtimeLastTime = 0; runtimeAccumulator = 0; }
  play.addEventListener("click", () => { if (!runtime) return; canvas.focus(); if (!runtimePreviewActive) runtimeEditorView = preview.getViewState(); runtimePreviewActive = true; runtimePlaying = true; if (runtimeAudioEnabled) void runtimeMusic?.play().catch(() => undefined); play.disabled = true; pause.disabled = false; step.disabled = true; resetPreview.disabled = false; runtimeFrame = requestAnimationFrame(runtimeLoop); });
  pause.addEventListener("click", () => { stopRuntime(); play.disabled = false; pause.disabled = true; step.disabled = false; renderRuntime(); });
  step.addEventListener("click", () => { if (!runtimePreviewActive) runtimeEditorView = preview.getViewState(); runtimePreviewActive = true; runtime?.step(runtimeInput); resetPreview.disabled = false; renderRuntime(); });
  resetPreview.addEventListener("click", () => { stopRuntime(); if (runtimeMusic) runtimeMusic.currentTime = 0; runtimePreviewActive = false; placingPlayer = false; placePlayer.setAttribute("aria-pressed", "false"); for (const key of Object.keys(runtimeInput) as Array<keyof PlayerInput>) runtimeInput[key] = false; runtime?.reset(); preview.setRuntimeBodies([]); preview.setPresentation(null); if (runtimeEditorView) preview.setViewState(runtimeEditorView); runtimeEditorView = null; refreshEntityOverlay(); play.disabled = false; pause.disabled = true; step.disabled = false; resetPreview.disabled = true; status.textContent = "Preview reset"; });
  const toolButtons = new Map<EditTool, HTMLButtonElement>();
  let editMenuSummary: HTMLElement | null = null;
  const toolPresentation: Record<EditTool, { status: string; left: string; inspector: string; canvas: string }> = {
    pencil: { status: "Paint tiles", left: "Layers and tiles", inspector: "Project status", canvas: "Map: paint tiles" },
    eraser: { status: "Erase tiles", left: "Layers and tiles", inspector: "Project status", canvas: "Map: erase tiles" },
    fill: { status: "Fill an area", left: "Layers and tiles", inspector: "Project status", canvas: "Map: fill an area" },
    select: { status: "Select an area", left: "Layers and tiles", inspector: "Selection", canvas: "Map: select an area" },
    entity: { status: "Edit entities", left: "Entities", inspector: "Properties", canvas: "Map: select and move entities" },
    asset: { status: "Manage assets", left: "Asset library", inspector: "Selected asset", canvas: "Map view" },
    profile: { status: "Configure game", left: "Configuration", inspector: "Game rules", canvas: "Map view" },
    states: { status: "Edit character states", left: "Character forms", inspector: "State properties", canvas: "Character state graph" },
    gameplay: { status: "Edit gameplay logic", left: "Gameplay", inspector: "Gameplay properties", canvas: "Gameplay program overview" },
  };
  const setTool = (tool: EditTool): void => {
    activeTool = tool;
    for (const [id, control] of toolButtons) control.setAttribute("aria-pressed", String(id === tool));
    const presentation = toolPresentation[tool];
    leftPanelTitle.textContent = presentation.left; inspectorTitle.textContent = presentation.inspector; canvas.setAttribute("aria-label", presentation.canvas);
    if (editMenuSummary) editMenuSummary.textContent = `Edit · ${presentation.status}`;
    status.textContent = presentation.status;
  };
  for (const [id, label, shortcut] of [["pencil", "Pencil", "P"], ["eraser", "Eraser", "E"], ["fill", "Fill", "F"], ["select", "Selection", "S"], ["entity", "Entities", "O"], ["asset", "Assets", "A"], ["profile", "Profile", "R"], ["states", "Character states", "M"], ["gameplay", "Gameplay logic", "L"]] as const) {
    const control = button(label, `Shortcut: ${shortcut}`); control.setAttribute("aria-keyshortcuts", shortcut);
    showShortcut(control, shortcut);
    control.addEventListener("click", () => { setTool(id); entityControls.hidden = id !== "entity"; const special = id === "asset" || id === "profile" || id === "states" || id === "gameplay"; layerList.hidden = special; paletteHost.hidden = id === "entity" || special; canvas.hidden = id === "states" || id === "gameplay"; if (id === "asset") assetEditor.show(); else assetEditor.hide(); if (id === "states") stateEditor.show(); else stateEditor.hide(); if (id === "gameplay") gameplayEditor.show(); else gameplayEditor.hide(); if (id === "profile") renderProfileInspector(); else if (id !== "asset" && id !== "states" && id !== "gameplay") renderDiagnostics(session.project ? validateProject(session.project) : []); preview.setSelection(id === "select" ? selection : null); refreshEntityOverlay(); });
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
    status.textContent = `Game view: ${width}×${height}`;
  });
  let gridVisible = true;
  grid.addEventListener("click", () => {
    gridVisible = !gridVisible;
    grid.textContent = `Grid: ${gridVisible ? "on" : "off"}`;
    grid.setAttribute("aria-pressed", String(gridVisible));
    preview.setGridVisible(gridVisible);
  });
  quickGuide.addEventListener("click", () => helpDialog.showModal());
  closeHelp.addEventListener("click", () => helpDialog.close());
  const toolbarGroup = (label: string, ...controls: HTMLElement[]): HTMLDetailsElement => {
    const group = document.createElement("details"); group.className = "toolbar-menu";
    const summary = document.createElement("summary"); summary.textContent = label;
    const popover = document.createElement("div"); popover.className = "toolbar-menu-popover"; popover.setAttribute("role", "group"); popover.setAttribute("aria-label", label); popover.append(...controls);
    for (const control of controls) control.addEventListener("click", () => { group.open = false; });
    group.addEventListener("toggle", () => { if (!group.open) return; for (const other of toolbar.querySelectorAll<HTMLDetailsElement>("details[open]")) if (other !== group) other.open = false; });
    group.append(summary, popover); return group;
  };
  const projectMenu = toolbarGroup("Project", newProject, demoProject, openProject, openDirectory, saveProject, saveDirectory);
  const historyMenu = toolbarGroup("History", undo, redo);
  const editMenu = toolbarGroup("Edit", ...toolButtons.values()); editMenuSummary = editMenu.querySelector("summary");
  const testMenu = toolbarGroup("Test", play, pause, step, resetPreview, invulnerable, cameraViews, followPlayer, liveEdit, sprites, bounds, audio, placePlayer);
  const viewMenu = toolbarGroup("View", zoomOut, zoomIn, fit, gameScreen, grid);
  const helpMenu = toolbarGroup("Help", quickGuide);
  toolbar.append(
    projectMenu, historyMenu, editMenu, testMenu, viewMenu, helpMenu,
  );
  window.addEventListener("pointerdown", (event) => { if (!toolbar.contains(event.target as Node)) for (const menu of toolbar.querySelectorAll<HTMLDetailsElement>("details[open]")) menu.open = false; });
  toolbar.addEventListener("keydown", (event) => { if (event.key === "Escape") { for (const menu of toolbar.querySelectorAll<HTMLDetailsElement>("details[open]")) menu.open = false; (event.target as HTMLElement).blur(); } });
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
    checkbox.setAttribute("aria-label", `Show ${label} layer`);
    layerCheckboxes.set(id, checkbox);
    checkbox.addEventListener("change", () => preview.setLayerVisible(id, checkbox.checked));
    const name = document.createElement("button");
    name.type = "button";
    name.textContent = label;
    name.setAttribute("aria-pressed", String(id === activeLayer));
    name.addEventListener("click", () => {
      activeLayer = id;
      for (const [layer, layerRow] of layerRows) layerRow.classList.toggle("active", layer === id);
      for (const [layer, layerRow] of layerRows) layerRow.querySelector("button")?.setAttribute("aria-pressed", String(layer === id));
      palette.setLayer(id);
      status.textContent = `Active layer: ${label}`;
    });
    row.append(checkbox, name);
    layerList.append(row);
  }

  const preview = new WorkspacePreview(canvas);
  const palette = new TilePalette(paletteHost);
  const assetEditor = new AssetEditor(assetControls, inspector);
  const stateEditor = new CharacterStateEditor(stateControls, inspector, stateGraph);
  const gameplayEditor = new GameplayEditor(gameplayControls, inspector, gameplayWorkspace);
  const commitStateChange = (message: string): void => { if (!levelModel) return; levelModel.flush(); session.markDirty(); if (session.project) history.record(session.project, message); persistRecovery(); refreshHistoryControls(); runtime = new PreviewRuntime(levelModel.level); runtime.setInvulnerable(runtimeInvulnerable); runtime.setCameraViewsEnabled(runtimeCameraViewsEnabled); refreshProjectState(message); if (activeTool === "states") stateEditor.render(); if (activeTool === "gameplay") gameplayEditor.render(); };
  assetEditor.setChangeListener((message, reloadMap) => { session.markDirty(); if (session.project) history.record(session.project, message); persistRecovery(); refreshHistoryControls(); refreshProjectState(message); if (reloadMap && session.project && levelModel) void preview.load(session.project, levelModel.map, false).then(() => palette.load(session.project!, levelModel!)); });
  palette.setSelectListener((gid) => { status.textContent = `Selected GID: ${gid}`; });
  preview.start();
  layerRows.get(activeLayer)?.classList.add("active");

  const groupSelect = document.createElement("select");
  groupSelect.setAttribute("aria-label", "Entity group");
  for (const group of ENTITY_GROUPS) { const option = document.createElement("option"); option.value = group; option.textContent = group; groupSelect.append(option); }
  groupSelect.value = entityGroup;
  groupSelect.addEventListener("change", () => { entityGroup = groupSelect.value as EntityGroup; selectedEntity = null; refreshEntityOverlay(); refreshProjectState(`Entity group: ${entityGroup}`); });
  const newEntity = button("New"); const duplicateEntity = button("Duplicate selected", "Ctrl+D"); const deleteEntity = button("Delete selected", "Delete"); const centerEntity = button("Center selected", "C");
  newEntity.addEventListener("click", () => { if (!entityModel || !entityModel.groups[entityGroup].length) { status.textContent = `There is no ${entityGroup} template to clone`; return; } selectedEntity = entityModel.duplicate({ group: entityGroup, index: 0 }); if (selectedEntity && lastPointerTile) entityModel.move(selectedEntity, lastPointerTile.worldX, lastPointerTile.worldY); commitEntityChange(lastPointerTile ? "Entity created at the cursor position" : "Entity created from the group template"); });
  duplicateEntity.addEventListener("click", () => { if (!selectedEntity || !entityModel) return; selectedEntity = entityModel.duplicate(selectedEntity); commitEntityChange("Entity duplicated"); });
  deleteEntity.addEventListener("click", () => { if (!selectedEntity || !entityModel) return; entityModel.remove(selectedEntity); selectedEntity = null; commitEntityChange("Entity deleted"); });
  centerEntity.addEventListener("click", () => { if (!selectedEntity || !entityModel) return; const box = entityModel.box(selectedEntity); if (box) { preview.centerOnWorld(box.x + box.width / 2, box.y + box.height / 2); status.textContent = "Entity centered"; } });
  const filterControl = (label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLLabelElement => { const row = document.createElement("label"); row.className = "entity-filter"; const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = checked; checkbox.addEventListener("change", () => onChange(checkbox.checked)); row.append(checkbox, document.createTextNode(label)); return row; };
  const groupVisibilityControls = new Map<EntityGroup, HTMLInputElement>();
  let showAllCheckbox: HTMLInputElement;
  const syncGroupVisibilityControls = (): void => {
    for (const [group, checkbox] of groupVisibilityControls) checkbox.checked = visibleEntityGroups.has(group);
    showAllCheckbox.checked = visibleEntityGroups.size === ENTITY_GROUPS.length;
    showAllCheckbox.indeterminate = visibleEntityGroups.size > 0 && visibleEntityGroups.size < ENTITY_GROUPS.length;
  };
  const showAllControl = filterControl("Show all groups", false, (checked) => { visibleEntityGroups.clear(); if (checked) for (const group of ENTITY_GROUPS) visibleEntityGroups.add(group); syncGroupVisibilityControls(); refreshEntityOverlay(); });
  showAllCheckbox = showAllControl.querySelector("input")!;
  const relationsControl = filterControl("Relations", true, (checked) => { showRelations = checked; refreshEntityOverlay(); });
  const routesControl = filterControl("Routes", true, (checked) => { showRoutes = checked; refreshEntityOverlay(); });
  const zonesControl = filterControl("Zones", true, (checked) => { showZones = checked; refreshEntityOverlay(); });
  const selectedGuidesControl = filterControl("Selected guides only", false, (checked) => { selectedGuidesOnly = checked; refreshEntityOverlay(); });
  const legend = document.createElement("div"); legend.className = "entity-legend"; legend.setAttribute("aria-label", "Entity legend");
  for (const group of ENTITY_GROUPS) { const item = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = visibleEntityGroups.has(group); checkbox.setAttribute("aria-label", `Show ${group}`); checkbox.addEventListener("change", () => { if (checkbox.checked) visibleEntityGroups.add(group); else visibleEntityGroups.delete(group); syncGroupVisibilityControls(); refreshEntityOverlay(); }); groupVisibilityControls.set(group, checkbox); const swatch = document.createElement("i"); swatch.style.background = ENTITY_COLORS[group]; item.append(checkbox, swatch, document.createTextNode(group)); legend.append(item); }
  syncGroupVisibilityControls();
  const entitySearch = document.createElement("input"); entitySearch.type = "search"; entitySearch.placeholder = "Search group, ID, or definition"; entitySearch.setAttribute("aria-label", "Search entities");
  const entityResults = document.createElement("select"); entityResults.className = "entity-result-list"; entityResults.size = 8; entityResults.setAttribute("aria-label", "Entity results");
  entitySearch.addEventListener("input", () => refreshEntityFinder());
  entityResults.addEventListener("change", () => { const [group, index] = entityResults.value.split(":"); if (!group || index === undefined || !entityModel) return; selectedEntity = { group: group as EntityGroup, index: Number(index) }; entityGroup = selectedEntity.group; groupSelect.value = entityGroup; const box = entityModel.box(selectedEntity); if (box) preview.centerOnWorld(box.x + box.width / 2, box.y + box.height / 2); refreshEntityOverlay(); renderDiagnostics([]); });
  const entitySelection = document.createElement("p"); entitySelection.className = "selection-summary"; entitySelection.setAttribute("aria-live", "polite");
  const browseEntitiesSection = createControlSection("Browse entities", true, groupSelect, entitySearch, entityResults); browseEntitiesSection.classList.add("browse-entities-section");
  entityControls.append(
    browseEntitiesSection,
    createControlSection("Display", false, showAllControl, relationsControl, routesControl, zonesControl, selectedGuidesControl, legend),
    createControlSection("Selection", true, entitySelection, newEntity, duplicateEntity, centerEntity, deleteEntity),
  );

  function refreshEntityFinder(): void {
    entityResults.innerHTML = ""; if (!entityModel) return; const query = entitySearch.value.trim().toLowerCase();
    for (const item of entityModel.all()) { const id = String(item.entity.id ?? item.ref.index); const definition = String((item.entity.attributes as Record<string, unknown> | undefined)?.definition ?? item.entity.definition ?? ""); const text = `${item.ref.group} ${id} ${definition}`; if (query && !text.toLowerCase().includes(query)) continue; const option = document.createElement("option"); option.value = `${item.ref.group}:${item.ref.index}`; option.textContent = `${item.ref.group} #${id}${definition ? ` · ${definition.split("/").at(-1)}` : ""}`; entityResults.append(option); }
    if (!entityResults.options.length) { const option = document.createElement("option"); option.textContent = query ? "No matching entities" : "No entities in this project"; option.disabled = true; entityResults.append(option); }
  }

  function refreshEntityOverlay(): void {
    const guideGroupVisible = (key?: string): boolean => !key || visibleEntityGroups.has(key.split(":", 1)[0] as EntityGroup);
    preview.setEntities(activeTool === "entity" ? (entityModel?.all().filter((item) => visibleEntityGroups.has(item.ref.group)).map((item) => ({ ...item, label: `${item.ref.group} #${String(item.entity.id ?? item.ref.index)}` })) ?? []) : [], selectedEntity);
    const guides = activeTool === "entity" ? entityModel?.gameplayGuides() : null;
    const selectedRecord = selectedEntity ? entityModel?.entity(selectedEntity) : null; const selectedKey = selectedEntity && selectedRecord ? `${selectedEntity.group}:${String(selectedRecord.id)}` : null;
    preview.setGameplayGuides(guides?.lines.filter((line) => (line.kind === "route" ? showRoutes : showRelations) && guideGroupVisible(line.from) && guideGroupVisible(line.to) && (!selectedGuidesOnly || !selectedKey || line.from === selectedKey || line.to === selectedKey)) ?? [], [...(showZones ? (guides?.zones.filter((zone) => guideGroupVisible(zone.owner) && (!selectedGuidesOnly || !selectedKey || zone.owner === selectedKey)) ?? []) : []), ...objectiveZones()]);
    const selectedRecordLabel = selectedEntity && selectedRecord ? `${selectedEntity.group} #${String(selectedRecord.id ?? selectedEntity.index)}` : "Nothing selected";
    entitySelection.textContent = selectedRecordLabel;
    duplicateEntity.disabled = !selectedEntity; centerEntity.disabled = !selectedEntity; deleteEntity.disabled = !selectedEntity;
    if (!runtimePreviewActive) {
      const selectedKey = selectedEntity && selectedRecord ? `${selectedEntity.group}:${String(selectedRecord.id)}` : null;
      preview.setRuntimeBodies(activeTool === "entity" && selectedKey && selectedEntity && visibleEntityGroups.has(selectedEntity.group) && runtime ? runtime.bodies.filter((body) => body.key === selectedKey) : []);
    }
    refreshEntityFinder();
  }
  function syncSelectedRuntimePosition(): boolean { if (!runtime || !entityModel || !selectedEntity) return false; const entity = entityModel.entity(selectedEntity), box = entityModel.box(selectedEntity); return Boolean(entity && box && runtime.moveEntity(selectedEntity.group, entity.id, box.x, box.y)); }
  function syncSelectedRuntimeGeometry(): boolean { if (!runtime || !entityModel || !selectedEntity) return false; const entity = entityModel.entity(selectedEntity), box = entityModel.box(selectedEntity); return Boolean(entity && box && runtime.moveEntity(selectedEntity.group, entity.id, box.x, box.y) && runtime.resizeEntity(selectedEntity.group, entity.id, box.width, box.height)); }
  function commitEntityChange(message: string, preserveRuntime = false): void { if (!entityModel || !levelModel) return; entityModel.flush(); if (!preserveRuntime) { runtime = new PreviewRuntime(levelModel.level); runtime.setInvulnerable(runtimeInvulnerable); runtime.setCameraViewsEnabled(runtimeCameraViewsEnabled); } session.markDirty(); if (session.project) history.record(session.project, message); persistRecovery(); refreshHistoryControls(); refreshEntityOverlay(); refreshProjectState(preserveRuntime ? `${message} · runtime updated live` : runtimePreviewActive ? `${message} · preview restarted` : message); }

  let gestureStart: PointerPosition | null = null;
  let gestureLast: PointerPosition | null = null;
  let gestureChanged = false;
  let gestureRuntimeSynced = false;
  let entityResize: { corner: ResizeCorner; box: import("./entity-document").EntityBox } | null = null;
  const resizeCornerAt = (tile: PointerPosition): ResizeCorner | null => {
    if (!selectedEntity || !entityModel || !visibleEntityGroups.has(selectedEntity.group)) return null; const box = entityModel.box(selectedEntity); if (!box) return null;
    const radius = 7 / preview.getViewState().zoom, near = (x: number, y: number): boolean => Math.abs(tile.worldX - x) <= radius && Math.abs(tile.worldY - y) <= radius;
    if (near(box.x, box.y)) return "nw"; if (near(box.x + box.width, box.y)) return "ne"; if (near(box.x, box.y + box.height)) return "sw"; if (near(box.x + box.width, box.y + box.height)) return "se"; return null;
  };
  const finishEdit = (message: string): void => {
    if (!gestureChanged || !levelModel) return;
    levelModel.flush(); session.markDirty(); if (session.project) history.record(session.project, message); persistRecovery(); refreshHistoryControls(); preview.refresh(); refreshProjectState(message);
  };
  preview.setEditHandlers({
    down(tile) {
      if (!levelModel) return;
      if (placingPlayer && runtime) { if (!runtimePreviewActive) runtimeEditorView = preview.getViewState(); runtimePreviewActive = true; resetPreview.disabled = false; runtime.placePlayerAt(tile.worldX, tile.worldY); placingPlayer = false; placePlayer.setAttribute("aria-pressed", "false"); renderRuntime(); status.textContent = `Player placed at ${Math.round(tile.worldX)}, ${Math.round(tile.worldY)}`; return; }
      if (runtimePreviewActive && !(activeTool === "entity" && runtimeLiveEdit)) return;
      canvas.focus(); gestureStart = tile; gestureLast = tile; lastPointerTile = tile; gestureChanged = false; gestureRuntimeSynced = false;
      if (activeTool === "entity") {
        const corner = resizeCornerAt(tile); if (corner && selectedEntity && entityModel) { const box = entityModel.box(selectedEntity); if (box) { entityResize = { corner, box: { ...box } }; status.textContent = `Resize ${selectedEntity.group} from ${corner.toUpperCase()} corner`; return; } }
        const hits = (entityModel?.hitTestAll(tile.worldX, tile.worldY) ?? []).filter((ref) => visibleEntityGroups.has(ref.group));
        const current = selectedEntity ? hits.findIndex((ref) => ref.group === selectedEntity!.group && ref.index === selectedEntity!.index) : -1;
        selectedEntity = hits.length ? hits[(current + 1) % hits.length]! : null; refreshEntityOverlay(); renderDiagnostics([]);
        status.textContent = hits.length > 1 ? `Overlapping entity ${((current + 1) % hits.length) + 1}/${hits.length}; click again to cycle through them` : selectedEntity ? "Entity selected" : "There are no entities at this point"; return;
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
      if (activeTool === "entity" && selectedEntity && entityModel && entityResize) { const original = entityResize.box, right = original.x + original.width, bottom = original.y + original.height; const left = entityResize.corner.includes("w") ? Math.max(0, Math.min(tile.worldX, right - 1)) : original.x, top = entityResize.corner.includes("n") ? Math.max(0, Math.min(tile.worldY, bottom - 1)) : original.y, nextRight = entityResize.corner.includes("e") ? Math.max(tile.worldX, original.x + 1) : right, nextBottom = entityResize.corner.includes("s") ? Math.max(tile.worldY, original.y + 1) : bottom; gestureChanged = entityModel.setBox(selectedEntity, { x: left, y: top, width: nextRight - left, height: nextBottom - top }); if (runtimePreviewActive && runtimeLiveEdit) gestureRuntimeSynced = syncSelectedRuntimeGeometry() || gestureRuntimeSynced; refreshEntityOverlay(); return; }
      if (activeTool === "entity" && selectedEntity && entityModel) { entityModel.translate(selectedEntity, tile.worldX - gestureLast.worldX, tile.worldY - gestureLast.worldY); gestureChanged = true; if (runtimePreviewActive && runtimeLiveEdit) gestureRuntimeSynced = syncSelectedRuntimePosition() || gestureRuntimeSynced; refreshEntityOverlay(); gestureLast = tile; return; }
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
      if (activeTool === "entity" && gestureChanged) commitEntityChange(entityResize ? "Entity resized" : "Entity moved", runtimePreviewActive && runtimeLiveEdit && gestureRuntimeSynced);
      else if (activeTool === "select" && selection) status.textContent = `Selection · ${selection.width}×${selection.height} tiles at ${selection.x}, ${selection.y}`;
      else finishEdit(activeTool === "fill" ? "Area filled" : "Tiles changed");
      gestureStart = null; gestureLast = null; gestureChanged = false; gestureRuntimeSynced = false; entityResize = null;
    },
  });

  canvas.addEventListener("pointermove", (event) => {
    const tile = preview.tileAtClient(event.clientX, event.clientY);
    if (tile) { lastPointerTile = tile; pointerStatus.textContent = `${activeLayer} · x ${tile.x}, y ${tile.y} · GID ${palette.selectedGid}`; const corner = activeTool === "entity" && (!runtimePreviewActive || runtimeLiveEdit) ? resizeCornerAt(tile) : null; canvas.dataset.resizeCorner = corner ?? ""; }
  });
  canvas.addEventListener("pointerleave", () => { pointerStatus.textContent = ""; canvas.dataset.resizeCorner = ""; });
  canvas.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "z") { event.preventDefault(); void restoreHistory(event.shiftKey ? history.redo() : history.undo(), event.shiftKey ? "Change redone" : "Change undone"); return; }
    if (event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); void restoreHistory(history.redo(), "Change redone"); return; }
    if (activeTool === "entity" && selectedEntity && entityModel && (!runtimePreviewActive || runtimeLiveEdit)) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { duplicateEntity.click(); event.preventDefault(); return; }
      if (event.key === "Delete" || event.key === "Backspace") { deleteEntity.click(); event.preventDefault(); return; }
      if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "c") { centerEntity.click(); event.preventDefault(); return; }
      const movement: Partial<Record<string, readonly [number, number]>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }, delta = movement[event.key];
      if (delta) { const step = event.shiftKey ? 8 : 1; entityModel.translate(selectedEntity, delta[0] * step, delta[1] * step); const synced = runtimePreviewActive && runtimeLiveEdit && syncSelectedRuntimePosition(); commitEntityChange(`Entity moved ${step} px`, Boolean(synced)); event.preventDefault(); return; }
    }
    if (!levelModel || !event.ctrlKey || !["c", "x", "v"].includes(event.key.toLowerCase())) return;
    const key = event.key.toLowerCase();
    if ((key === "c" || key === "x") && selection) {
      clipboard = levelModel.copy(activeLayer, selection);
      if (key === "x") { gestureChanged = levelModel.clear(activeLayer, selection); finishEdit("Selection cut"); gestureChanged = false; }
      status.textContent = key === "c" ? "Selection copied" : "Selection cut";
      event.preventDefault(); preview.refresh();
    } else if (key === "v" && clipboard) {
      const target = lastPointerTile ?? (selection ? { x: selection.x, y: selection.y } : { x: 0, y: 0 });
      gestureChanged = levelModel.paste(activeLayer, target.x, target.y, clipboard);
      finishEdit("Selection pasted within map boundaries"); gestureChanged = false;
      selection = { x: target.x, y: target.y, width: Math.min(clipboard.width, levelModel.map.width - target.x), height: Math.min(clipboard.height, levelModel.map.height - target.y) };
      preview.setSelection(selection); event.preventDefault();
    }
  });
  const zoomStatus = requiredElement<HTMLElement>(host, "#zoom-status");
  preview.setZoomListener((zoom) => { zoomStatus.textContent = `${Math.round(zoom * 100)}%`; });
  const gameKey = (event: KeyboardEvent): keyof PlayerInput | null => ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", Space: "action" } as const)[event.code] ?? null;
  window.addEventListener("keydown", (event) => { if (!runtimePreviewActive) return; const key = gameKey(event); if (key) { runtimeInput[key] = true; event.preventDefault(); } });
  window.addEventListener("keyup", (event) => { const key = gameKey(event); if (key) runtimeInput[key] = false; });
  window.addEventListener("blur", () => { for (const key of Object.keys(runtimeInput) as Array<keyof PlayerInput>) runtimeInput[key] = false; });
  window.addEventListener("keydown", (event) => {
    if (runtimePreviewActive) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement || event.ctrlKey || event.metaKey || event.altKey) return;
    const shortcuts: Record<string, EditTool> = { p: "pencil", e: "eraser", f: "fill", s: "select", o: "entity", a: "asset", r: "profile", m: "states", l: "gameplay" }; const tool = shortcuts[event.key.toLowerCase()];
    if (tool) { toolButtons.get(tool)?.click(); event.preventDefault(); return; }
    if (event.key.toLowerCase() === "g") { grid.click(); event.preventDefault(); }
    if (event.key === "0") { fit.click(); event.preventDefault(); }
    if (event.key === "?") { quickGuide.click(); event.preventDefault(); }
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
  refreshProjectState("Offline application loaded; waiting for a project");
  void loadRecovery().then((project) => { if (project && !session.project && window.confirm("An unsaved project from a previous session was found. Do you want to recover it?")) void activateProject(project, true, "Project recovered from local storage"); }).catch(() => undefined);
}
