import { WorkspacePreview, type MapLayerName } from "./workspace-preview";
import {
  createEmptyProject,
  downloadProject,
  pickProjectDirectory,
  readProjectDirectory,
  readProjectFile,
  supportsDirectoryAccess,
  writeProjectDirectory,
} from "./project-io";
import { ProjectSession } from "./project-session";
import { hasValidationErrors, validateProject, type Diagnostic } from "./validation";

const LAYERS = [
  ["tiles", "Tiles"],
  ["frontTiles", "Front tiles"],
  ["collisions", "Colisiones"],
] as const;

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
      <div class="panel-content" id="layer-list"></div>
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

  const session = new ProjectSession();
  const layerCheckboxes = new Map<MapLayerName, HTMLInputElement>();
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
  ): Promise<void> {
    session.replace(project, dirty);
    for (const checkbox of layerCheckboxes.values()) checkbox.disabled = false;
    refreshProjectState(message);
    await preview.load(project);
    hint.hidden = true;
  }

  function renderDiagnostics(diagnostics: readonly Diagnostic[]): void {
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
      const location = document.createElement("code");
      location.textContent = `${diagnostic.file}${diagnostic.path}`;
      const message = document.createElement("span");
      message.textContent = diagnostic.message;
      item.append(location, message);
      list.append(item);
    }
    inspector.append(title, list);
  }

  function canReplaceProject(): boolean {
    return session.canDiscard(() => window.confirm(
      "El proyecto tiene cambios sin guardar. ¿Quieres descartarlos?",
    ));
  }

  async function run(action: () => Promise<void>): Promise<void> {
    clearError();
    try { await action(); }
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
    refreshProjectState(`Proyecto guardado en la carpeta ${directoryHandle.name}`);
  }));
  const separator = document.createElement("span");
  separator.className = "toolbar-separator";
  separator.setAttribute("aria-hidden", "true");
  const undo = button("Deshacer", "El historial se implementará en la tarea 25");
  const redo = button("Rehacer", "El historial se implementará en la tarea 25");
  undo.disabled = true;
  redo.disabled = true;
  const zoomOut = button("−", "Alejar");
  const zoomIn = button("+", "Acercar");
  const fit = button("Encajar", "Mostrar el mapa completo");
  const grid = button("Rejilla: sí", "Mostrar u ocultar la rejilla");
  zoomOut.addEventListener("click", () => preview.zoomBy(1 / 1.25));
  zoomIn.addEventListener("click", () => preview.zoomBy(1.25));
  fit.addEventListener("click", () => preview.fit());
  let gridVisible = true;
  grid.addEventListener("click", () => {
    gridVisible = !gridVisible;
    grid.textContent = `Rejilla: ${gridVisible ? "sí" : "no"}`;
    grid.setAttribute("aria-pressed", String(gridVisible));
    preview.setGridVisible(gridVisible);
  });
  toolbar.append(newProject, openProject, openDirectory, saveProject,
                 saveDirectory, separator, undo, redo, separator.cloneNode(),
                 zoomOut, zoomIn, fit, grid);

  for (const [id, label] of LAYERS) {
    const row = document.createElement("label");
    row.className = "layer-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.disabled = true;
    checkbox.dataset.layer = id;
    layerCheckboxes.set(id, checkbox);
    checkbox.addEventListener("change", () => preview.setLayerVisible(id, checkbox.checked));
    const name = document.createElement("span");
    name.textContent = label;
    row.append(checkbox, name);
    layerList.append(row);
  }

  const preview = new WorkspacePreview(canvas);
  preview.start();
  const zoomStatus = requiredElement<HTMLElement>(host, ".statusbar span:last-child");
  preview.setZoomListener((zoom) => { zoomStatus.textContent = `${Math.round(zoom * 100)}%`; });
  window.addEventListener("beforeunload", (event) => {
    preview.stop();
    if (session.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  refreshProjectState("Aplicación offline cargada; esperando un proyecto");
}
