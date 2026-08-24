import { getProjectAsset } from "./project-io";
import { AssetDocumentModel } from "./asset-document";

export class AssetEditor {
  readonly #controls: HTMLElement; readonly #inspector: HTMLElement;
  #model: AssetDocumentModel | null = null; #definitionId = ""; #stateIndex = 0; #frameIndex = 0; #timer = 0;
  #visible = false;
  #onChange: (message: string, reloadMap?: boolean) => void = () => undefined;
  constructor(controls: HTMLElement, inspector: HTMLElement) { this.#controls = controls; this.#inspector = inspector; }
  setChangeListener(listener: (message: string, reloadMap?: boolean) => void): void { this.#onChange = listener; }
  load(model: AssetDocumentModel): void { this.#model = model; this.#definitionId = Object.keys(model.definitions)[0] ?? ""; this.#stateIndex = 0; this.#frameIndex = 0; if (this.#visible) this.render(); }
  show(): void { this.#visible = true; this.#controls.hidden = false; this.render(); }
  hide(): void { this.#visible = false; this.#controls.hidden = true; if (this.#timer) window.clearInterval(this.#timer); }

  render(): void {
    if (this.#timer) window.clearInterval(this.#timer); this.#controls.innerHTML = ""; this.#inspector.innerHTML = ""; this.#inspector.classList.remove("empty-inspector");
    const model = this.#model; if (!model) return;
    const definitionSelect = document.createElement("select");
    for (const id of Object.keys(model.definitions).sort()) { const option = document.createElement("option"); option.value = id; option.textContent = id; definitionSelect.append(option); }
    definitionSelect.value = this.#definitionId; definitionSelect.title = this.#definitionId; definitionSelect.addEventListener("change", () => { this.#definitionId = definitionSelect.value; this.#stateIndex = 0; this.#frameIndex = 0; this.render(); });
    const stateSelect = document.createElement("select"); const definition = model.definitions[this.#definitionId];
    definition?.states.forEach((state, index) => { const option = document.createElement("option"); option.value = String(index); option.textContent = `${state.id}: ${state.name}`; stateSelect.append(option); });
    stateSelect.value = String(this.#stateIndex); stateSelect.addEventListener("change", () => { this.#stateIndex = Number(stateSelect.value); this.#frameIndex = 0; this.render(); });
    const frameSelect = document.createElement("select"); definition?.states[this.#stateIndex]?.animation.sprites.forEach((_frame, index) => { const option = document.createElement("option"); option.value = String(index); option.textContent = `Frame ${index + 1}`; frameSelect.append(option); }); frameSelect.value = String(this.#frameIndex); frameSelect.addEventListener("change", () => { this.#frameIndex = Number(frameSelect.value); this.render(); });
    const addDefinition = this.#button("Nueva definición", () => { const id = window.prompt("ID de la definición (por ejemplo objects/coin)"); if (!id) return; const bitmap = definition?.states[0]?.animation.bitmap; if (!bitmap) throw new Error("Importa primero un sprite que sirva como plantilla"); model.addDefinition(id, "object", bitmap); this.#definitionId = id; this.#stateIndex = 0; this.#change("Definición creada"); });
    const addState = this.#button("Añadir estado", () => { this.#stateIndex = model.addState(this.#definitionId); this.#frameIndex = 0; this.#change("Estado de animación añadido"); });
    const addFrame = this.#button("Añadir frame", () => { this.#frameIndex = model.addFrame(this.#definitionId, this.#stateIndex); this.#change("Frame añadido"); });
    const spriteImport = this.#importButton("Importar sprite", "image/*", async (file) => { const imported = model.importAsset(file.name, new Uint8Array(await file.arrayBuffer()), "images"); model.definitions[this.#definitionId]!.states[this.#stateIndex]!.animation.bitmap = imported.reference; this.#change("Sprite importado"); });
    const tileImport = this.#importButton("Importar tileset", "image/*", async (file) => { const bytes = new Uint8Array(await file.arrayBuffer()); const imported = model.importAsset(file.name, bytes, "images"); const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type: file.type })); const map = model.level.map as { tileWidth: number; tileHeight: number; tileset: Record<string, unknown> }; map.tileset.image = imported.reference; map.tileset.imageWidth = bitmap.width; map.tileset.imageHeight = bitmap.height; map.tileset.columns = Math.floor(bitmap.width / map.tileWidth); map.tileset.tileCount = Math.floor(bitmap.width / map.tileWidth) * Math.floor(bitmap.height / map.tileHeight); bitmap.close(); this.#change("Tileset importado", true); });
    const audioImport = this.#importButton("Importar audio", "audio/*", async (file) => { const imported = model.importAsset(file.name, new Uint8Array(await file.arrayBuffer()), "audio"); model.audio.music.push(imported.reference); this.#change("Audio añadido a la lista de música"); });
    const musicPlayback = this.#button("Configurar música", () => { const audio = model.audio, initial = Number(window.prompt(`Pista inicial (0-${audio.music.length - 1})`, String(audio.initialMusic))); if (!Number.isInteger(initial) || initial < 0 || initial >= audio.music.length) throw new Error("Pista inicial no válida"); const followText = window.prompt("Pista posterior (vacío para ninguna)", audio.playback.followUpMusic === null ? "" : String(audio.playback.followUpMusic)); const follow = followText?.trim() ? Number(followText) : null; if (follow !== null && (!Number.isInteger(follow) || follow < 0 || follow >= audio.music.length)) throw new Error("Pista posterior no válida"); audio.initialMusic = initial; audio.playback.initialLoop = window.confirm("¿Repetir en bucle la pista inicial?"); audio.playback.followUpMusic = follow; audio.playback.followUpLoop = follow === null ? false : window.confirm("¿Repetir en bucle la pista posterior?"); this.#change("Reproducción musical configurada"); });
    const effectImport = this.#importButton("Reemplazar efecto", "audio/*", async (file) => { const imported = model.importAsset(file.name, new Uint8Array(await file.arrayBuffer()), "audio"); const slot = Number(window.prompt("Slot de efecto (0-6)", "0")); if (!Number.isInteger(slot) || slot < 0 || slot >= model.audio.effects.length) throw new Error("Slot de efecto no válido"); model.audio.effects[slot] = imported.reference; this.#change(`Efecto ${slot} reemplazado`); });
    this.#controls.append(definitionSelect, stateSelect, frameSelect, addDefinition, addState, addFrame, spriteImport, tileImport, audioImport, musicPlayback, effectImport);
    if (definition) this.#renderInspector(definition);
  }

  #renderInspector(definition: AssetDocumentModel["definitions"][string]): void {
    const state = definition.states[this.#stateIndex]; if (!state || !this.#model) return;
    const heading = document.createElement("h3"); heading.textContent = definition.name;
    const canvas = document.createElement("canvas"); canvas.className = "animation-preview"; canvas.width = 220; canvas.height = 120; this.#inspector.append(heading, canvas);
    const fields: Array<[string, HTMLInputElement]> = [];
    const input = (label: string, value: string | number, apply: (value: string) => void, type = "text"): void => { const wrapper = document.createElement("label"); wrapper.className = "property-field"; const caption = document.createElement("span"); caption.textContent = label; const control = document.createElement("input"); control.type = type; control.value = String(value); control.addEventListener("change", () => { apply(control.value); this.#change(`${label} actualizado`); }); wrapper.append(caption, control); this.#inspector.append(wrapper); fields.push([label, control]); };
    const kindLabel = document.createElement("label"); kindLabel.className = "property-field"; const kindCaption = document.createElement("span"); kindCaption.textContent = "definition.kind"; const kind = document.createElement("select"); for (const value of ["object", "character"] as const) { const option = document.createElement("option"); option.value = value; option.textContent = value; kind.append(option); } kind.value = definition.kind; kind.addEventListener("change", () => { definition.kind = kind.value as "object" | "character"; this.#change("Tipo de definición actualizado"); }); kindLabel.append(kindCaption, kind); this.#inspector.append(kindLabel);
    input("definition.name", definition.name, (value) => { definition.name = value; }); input("state.name", state.name, (value) => { state.name = value; }); input("state.id", state.id, (value) => { state.id = Number(value); }, "number"); input("frameDurationTicks", state.animation.frameDurationTicks, (value) => { state.animation.frameDurationTicks = Number(value); }, "number");
    const frame = state.animation.sprites[this.#frameIndex] ?? state.animation.sprites[0]!;
    for (const key of ["x", "y", "width", "height"] as const) input(`frame.${key}`, frame[key], (value) => { frame[key] = Number(value); }, "number");
    void this.#animate(canvas, state);
  }

  async #animate(canvas: HTMLCanvasElement, state: AssetDocumentModel["definitions"][string]["states"][number]): Promise<void> {
    try { const bytes = getProjectAsset(this.#model!.project, this.#model!.project.manifest.initialLevel, state.animation.bitmap); const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer])); let frame = 0; const draw = (): void => { const sprite = state.animation.sprites[frame % state.animation.sprites.length]!; const context = canvas.getContext("2d")!; context.clearRect(0, 0, canvas.width, canvas.height); context.imageSmoothingEnabled = false; const scale = Math.max(1, Math.floor(Math.min(canvas.width / sprite.width, canvas.height / sprite.height, 6))); context.drawImage(bitmap, sprite.x, sprite.y, sprite.width, sprite.height, (canvas.width - sprite.width * scale) / 2, (canvas.height - sprite.height * scale) / 2, sprite.width * scale, sprite.height * scale); frame += 1; };
      draw(); this.#timer = window.setInterval(draw, state.animation.frameDurationTicks * 20);
    } catch { canvas.getContext("2d")!.fillText("Bitmap no disponible", 20, 60); }
  }
  #change(message: string, reloadMap = false): void { this.#model!.flush(); this.#onChange(message, reloadMap); this.render(); }
  #button(label: string, action: () => void): HTMLButtonElement { const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.addEventListener("click", action); return button; }
  #importButton(label: string, accept: string, action: (file: File) => Promise<void>): HTMLButtonElement { const input = document.createElement("input"); input.type = "file"; input.accept = accept; input.hidden = true; const button = this.#button(label, () => input.click()); input.addEventListener("change", () => { const file = input.files?.[0]; input.value = ""; if (file) void action(file); }); this.#controls.append(input); return button; }
}
