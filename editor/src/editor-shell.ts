import { WorkspacePreview } from "./workspace-preview";

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

export function createEditorShell(host: HTMLElement): void {
  host.className = "editor-shell";
  host.innerHTML = `
    <header class="app-header">
      <div class="brand"><span class="brand-mark">R2</span><div><h1>Rick2 Engine</h1><p>Editor offline de niveles</p></div></div>
      <div class="document-title" aria-live="polite">Sin proyecto</div>
    </header>
    <nav class="toolbar" aria-label="Herramientas del proyecto"></nav>
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

  const toolbar = host.querySelector<HTMLElement>(".toolbar");
  const layerList = host.querySelector<HTMLElement>("#layer-list");
  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const status = host.querySelector<HTMLElement>("#status");
  if (!toolbar || !layerList || !canvas || !status) {
    throw new Error("La plantilla del editor está incompleta");
  }

  const newProject = button("Nuevo", "La creación de proyectos se implementará en la tarea 18");
  const openProject = button("Abrir", "La apertura de proyectos se implementará en la tarea 18");
  const saveProject = button("Guardar", "La exportación se implementará en la tarea 18");
  for (const unavailable of [newProject, openProject, saveProject]) {
    unavailable.disabled = true;
    unavailable.setAttribute("aria-disabled", "true");
  }
  const separator = document.createElement("span");
  separator.className = "toolbar-separator";
  separator.setAttribute("aria-hidden", "true");
  const undo = button("Deshacer", "El historial se implementará en la tarea 25");
  const redo = button("Rehacer", "El historial se implementará en la tarea 25");
  undo.disabled = true;
  redo.disabled = true;
  toolbar.append(newProject, openProject, saveProject, separator, undo, redo);

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
  window.addEventListener("beforeunload", () => preview.stop(), { once: true });
  status.textContent = "Aplicación offline cargada; esperando un proyecto";
}
