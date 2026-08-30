import { createEditorShell } from "./editor-shell";

const host = document.querySelector<HTMLElement>("#app");
if (!host) {
  throw new Error("The Rick2 Engine container was not found");
}

try {
  createEditorShell(host);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  host.innerHTML = "";
  const alert = document.createElement("div");
  alert.className = "fatal-error";
  alert.setAttribute("role", "alert");
  alert.textContent = `Rick2 Engine could not start: ${message}`;
  host.append(alert);
}
