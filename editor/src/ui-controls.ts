const MIN_BODY_HEIGHT = 48;
const MAX_BODY_HEIGHT = 620;

export function createControlSection(title: string, open: boolean, ...children: HTMLElement[]): HTMLDetailsElement {
  const section = document.createElement("details");
  section.className = "control-section resizable-section";
  section.open = open;

  const summary = document.createElement("summary");
  summary.textContent = title;
  const body = document.createElement("div");
  body.className = "control-section-body";
  body.append(...children);
  const handle = document.createElement("div");
  handle.className = "section-resize-handle";
  handle.tabIndex = 0;
  handle.setAttribute("role", "separator");
  handle.setAttribute("aria-orientation", "horizontal");
  handle.setAttribute("aria-label", `Resize ${title}`);
  handle.title = "Drag to resize · Arrow keys resize · Double-click resets";

  const maximumHeight = (): number => Math.max(MIN_BODY_HEIGHT, Math.min(MAX_BODY_HEIGHT, window.innerHeight * .62));
  const setHeight = (height: number): void => {
    const next = Math.round(Math.min(maximumHeight(), Math.max(MIN_BODY_HEIGHT, height)));
    body.style.height = `${next}px`;
    handle.setAttribute("aria-valuenow", String(next));
    handle.setAttribute("aria-valuemin", String(MIN_BODY_HEIGHT));
    handle.setAttribute("aria-valuemax", String(Math.round(maximumHeight())));
  };

  let startY = 0; let startHeight = 0;
  handle.addEventListener("pointerdown", (event) => {
    startY = event.clientY; startHeight = body.getBoundingClientRect().height;
    handle.setPointerCapture(event.pointerId); section.classList.add("is-resizing"); event.preventDefault();
  });
  handle.addEventListener("pointermove", (event) => { if (handle.hasPointerCapture(event.pointerId)) setHeight(startHeight + event.clientY - startY); });
  const stopResize = (event: PointerEvent): void => { if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId); section.classList.remove("is-resizing"); };
  handle.addEventListener("pointerup", stopResize); handle.addEventListener("pointercancel", stopResize);
  handle.addEventListener("dblclick", () => { body.style.height = ""; handle.removeAttribute("aria-valuenow"); });
  handle.addEventListener("keydown", (event) => {
    if (event.key === "Home") { body.style.height = ""; handle.removeAttribute("aria-valuenow"); event.preventDefault(); return; }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    setHeight(body.getBoundingClientRect().height + (event.key === "ArrowUp" ? -32 : 32)); event.preventDefault();
  });

  section.append(summary, body, handle);
  return section;
}
