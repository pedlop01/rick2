import { createEditorShell } from "./editor-shell";

const host = document.querySelector<HTMLElement>("#app");
if (!host) {
  throw new Error("No se ha encontrado el contenedor de Rick2 Engine");
}

try {
  createEditorShell(host);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  host.innerHTML = "";
  const alert = document.createElement("div");
  alert.className = "fatal-error";
  alert.setAttribute("role", "alert");
  alert.textContent = `No se pudo iniciar Rick2 Engine: ${message}`;
  host.append(alert);
}
