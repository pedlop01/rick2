import { WorkspacePreview } from "./workspace-preview";
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

  const session = new ProjectSession();
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
    documentTitle.textContent = project
        ? `${project.manifest.name}${session.dirty ? " •" : ""}`
        : "Sin proyecto";
    hint.textContent = project
        ? `${project.manifest.levels.length} nivel(es) · ${project.files.size} archivo(s)`
        : "Crea o abre un proyecto para comenzar";
    saveProject.disabled = !project;
    saveDirectory.disabled = !project || !supportsDirectoryAccess();
    status.textContent = message;
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

  newProject.addEventListener("click", () => {
    if (!canReplaceProject()) return;
    directoryHandle = null;
    session.replace(createEmptyProject(), true);
    clearError();
    refreshProjectState("Proyecto vacío creado; todavía no se ha guardado");
  });
  openProject.addEventListener("click", () => {
    if (canReplaceProject()) fileInput.click();
  });
  fileInput.addEventListener("change", () => void run(async () => {
    const file = fileInput.files?.[0];
    fileInput.value = "";
    if (!file) return;
    const project = await readProjectFile(file);
    directoryHandle = null;
    session.replace(project, false);
    refreshProjectState(`Proyecto abierto desde ${file.name}`);
  }));
  openDirectory.addEventListener("click", () => void run(async () => {
    if (!canReplaceProject()) return;
    const handle = await pickProjectDirectory();
    const project = await readProjectDirectory(handle);
    directoryHandle = handle;
    session.replace(project, false);
    refreshProjectState(`Proyecto abierto desde la carpeta ${handle.name}`);
  }));
  saveProject.addEventListener("click", () => void run(async () => {
    const project = session.project;
    if (!project) return;
    downloadProject(project);
    session.markSaved();
    refreshProjectState("Proyecto exportado como ZIP");
  }));
  saveDirectory.addEventListener("click", () => void run(async () => {
    const project = session.project;
    if (!project) return;
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
  toolbar.append(newProject, openProject, openDirectory, saveProject,
                 saveDirectory, separator, undo, redo);

  for (const [id, label] of LAYERS) {
    const row = document.createElement("label");
    row.className = "layer-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.disabled = true;
    checkbox.dataset.layer = id;
    const name = document.createElement("span");
    name.textContent = label;
    row.append(checkbox, name);
    layerList.append(row);
  }

  const preview = new WorkspacePreview(canvas);
  preview.start();
  window.addEventListener("beforeunload", (event) => {
    preview.stop();
    if (session.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  refreshProjectState("Aplicación offline cargada; esperando un proyecto");
}
