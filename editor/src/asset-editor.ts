import { getProjectAsset } from "./project-io";
import { AssetDocumentModel } from "./asset-document";
import { readableDataPath } from "./ui-labels";
import { createControlSection } from "./ui-controls";

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
    const addDefinition = this.#button("New definition", () => { const id = window.prompt("Definition ID (for example objects/coin)"); if (!id) return; const bitmap = definition?.states[0]?.animation.bitmap; if (!bitmap) throw new Error("Import a sprite to use as a template first"); model.addDefinition(id, "object", bitmap); this.#definitionId = id; this.#stateIndex = 0; this.#change("Definition created"); });
    const addState = this.#button("Add state", () => { this.#stateIndex = model.addState(this.#definitionId); this.#frameIndex = 0; this.#change("Animation state added"); });
    const addFrame = this.#button("Add frame", () => { this.#frameIndex = model.addFrame(this.#definitionId, this.#stateIndex); this.#change("Frame added"); });
    const deleteState = this.#button("Delete state", () => { const selected = model.definitions[this.#definitionId]?.states[this.#stateIndex]; if (!selected || !window.confirm(`Delete state “${selected.name}”? You can restore it with Undo.`)) return; this.#stateIndex = model.removeState(this.#definitionId, this.#stateIndex); this.#frameIndex = 0; this.#change("Animation state deleted"); });
    const deleteFrame = this.#button("Delete frame", () => { if (!window.confirm(`Delete frame ${this.#frameIndex + 1}? You can restore it with Undo.`)) return; this.#frameIndex = model.removeFrame(this.#definitionId, this.#stateIndex, this.#frameIndex); this.#change("Animation frame deleted"); });
    deleteState.disabled = !definition || definition.states.length <= 1;
    deleteFrame.disabled = !definition?.states[this.#stateIndex] || definition.states[this.#stateIndex]!.animation.sprites.length <= 1;
    const stateActions = document.createElement("div"); stateActions.className = "paired-actions"; stateActions.append(addState, deleteState);
    const frameActions = document.createElement("div"); frameActions.className = "paired-actions"; frameActions.append(addFrame, deleteFrame);
    const spriteImport = this.#importButton("Import sprite", "image/*", async (file) => { const imported = model.importAsset(file.name, new Uint8Array(await file.arrayBuffer()), "images"); model.definitions[this.#definitionId]!.states[this.#stateIndex]!.animation.bitmap = imported.reference; this.#change("Sprite imported"); });
    const tileImport = this.#importButton("Import tileset", "image/*", async (file) => { const bytes = new Uint8Array(await file.arrayBuffer()); const imported = model.importAsset(file.name, bytes, "images"); const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type: file.type })); const map = model.level.map as { tileWidth: number; tileHeight: number; tileset: Record<string, unknown> }; map.tileset.image = imported.reference; map.tileset.imageWidth = bitmap.width; map.tileset.imageHeight = bitmap.height; map.tileset.columns = Math.floor(bitmap.width / map.tileWidth); map.tileset.tileCount = Math.floor(bitmap.width / map.tileWidth) * Math.floor(bitmap.height / map.tileHeight); bitmap.close(); this.#change("Tileset imported", true); });
    const audioImport = this.#importButton("Import audio", "audio/*", async (file) => { const imported = model.importAsset(file.name, new Uint8Array(await file.arrayBuffer()), "audio"); model.audio.music.push(imported.reference); this.#change("Audio added to the music list"); });
    const musicPlayback = this.#button("Configure music", () => { const audio = model.audio, initial = Number(window.prompt(`Initial track (0-${audio.music.length - 1})`, String(audio.initialMusic))); if (!Number.isInteger(initial) || initial < 0 || initial >= audio.music.length) throw new Error("Invalid initial track"); const followText = window.prompt("Follow-up track (leave empty for none)", audio.playback.followUpMusic === null ? "" : String(audio.playback.followUpMusic)); const follow = followText?.trim() ? Number(followText) : null; if (follow !== null && (!Number.isInteger(follow) || follow < 0 || follow >= audio.music.length)) throw new Error("Invalid follow-up track"); audio.initialMusic = initial; audio.playback.initialLoop = window.confirm("Loop the initial track?"); audio.playback.followUpMusic = follow; audio.playback.followUpLoop = follow === null ? false : window.confirm("Loop the follow-up track?"); this.#change("Music playback configured"); });
    const effectImport = this.#importButton("Replace effect", "audio/*", async (file) => { const imported = model.importAsset(file.name, new Uint8Array(await file.arrayBuffer()), "audio"); const slot = Number(window.prompt("Effect slot (0-6)", "0")); if (!Number.isInteger(slot) || slot < 0 || slot >= model.audio.effects.length) throw new Error("Invalid effect slot"); model.audio.effects[slot] = imported.reference; this.#change(`Effect ${slot} replaced`); });
    definitionSelect.setAttribute("aria-label", "Asset definition"); stateSelect.setAttribute("aria-label", "Animation state"); frameSelect.setAttribute("aria-label", "Animation frame");
    this.#controls.append(
      createControlSection("Definition", true, definitionSelect, addDefinition),
      createControlSection("Animation", true, stateSelect, stateActions, frameSelect, frameActions),
      createControlSection("Images", false, spriteImport, tileImport),
      createControlSection("Audio", false, audioImport, musicPlayback, effectImport),
    );
    if (definition) this.#renderInspector(definition);
    else { const empty = document.createElement("p"); empty.className = "selection-summary"; empty.textContent = "No asset definitions available"; this.#inspector.append(empty); }
  }

  #renderInspector(definition: AssetDocumentModel["definitions"][string]): void {
    const state = definition.states[this.#stateIndex]; if (!state || !this.#model) return;
    const heading = document.createElement("h3"); heading.textContent = definition.name;
    const canvas = document.createElement("canvas"); canvas.className = "animation-preview"; canvas.width = 220; canvas.height = 120; this.#inspector.append(heading, canvas);
    const fields: Array<[string, HTMLInputElement]> = [];
    const input = (label: string, value: string | number, apply: (value: string) => void, type = "text"): void => { const wrapper = document.createElement("label"); wrapper.className = "property-field"; wrapper.title = label; const caption = document.createElement("span"); caption.textContent = readableDataPath(label.split(".")); const control = document.createElement("input"); control.type = type; control.value = String(value); control.addEventListener("change", () => { apply(control.value); this.#change(`${readableDataPath(label.split("."))} updated`); }); wrapper.append(caption, control); this.#inspector.append(wrapper); fields.push([label, control]); };
    const kindLabel = document.createElement("label"); kindLabel.className = "property-field"; kindLabel.title = "definition.kind"; const kindCaption = document.createElement("span"); kindCaption.textContent = readableDataPath(["definition", "kind"]); const kind = document.createElement("select"); for (const value of ["object", "character"] as const) { const option = document.createElement("option"); option.value = value; option.textContent = value; kind.append(option); } kind.value = definition.kind; kind.addEventListener("change", () => { definition.kind = kind.value as "object" | "character"; this.#change("Definition type updated"); }); kindLabel.append(kindCaption, kind); this.#inspector.append(kindLabel);
    input("definition.name", definition.name, (value) => { definition.name = value; }); input("state.name", state.name, (value) => { state.name = value; }); input("state.id", state.id, (value) => { state.id = Number(value); }, "number"); input("frameDurationTicks", state.animation.frameDurationTicks, (value) => { state.animation.frameDurationTicks = Number(value); }, "number");
    const frame = state.animation.sprites[this.#frameIndex] ?? state.animation.sprites[0]!;
    for (const key of ["x", "y", "width", "height"] as const) input(`frame.${key}`, frame[key], (value) => { frame[key] = Number(value); }, "number");
    void this.#animate(canvas, state);
  }

  async #animate(canvas: HTMLCanvasElement, state: AssetDocumentModel["definitions"][string]["states"][number]): Promise<void> {
    try { const bytes = getProjectAsset(this.#model!.project, this.#model!.project.manifest.initialLevel, state.animation.bitmap); const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer])); let frame = 0; const draw = (): void => { const sprite = state.animation.sprites[frame % state.animation.sprites.length]!; const context = canvas.getContext("2d")!; context.clearRect(0, 0, canvas.width, canvas.height); context.imageSmoothingEnabled = false; const scale = Math.max(1, Math.floor(Math.min(canvas.width / sprite.width, canvas.height / sprite.height, 6))); context.drawImage(bitmap, sprite.x, sprite.y, sprite.width, sprite.height, (canvas.width - sprite.width * scale) / 2, (canvas.height - sprite.height * scale) / 2, sprite.width * scale, sprite.height * scale); frame += 1; };
      draw(); this.#timer = window.setInterval(draw, state.animation.frameDurationTicks * 20);
    } catch { canvas.getContext("2d")!.fillText("Bitmap unavailable", 20, 60); }
  }
  #change(message: string, reloadMap = false): void { this.#model!.flush(); this.#onChange(message, reloadMap); this.render(); }
  #button(label: string, action: () => void): HTMLButtonElement { const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.addEventListener("click", action); return button; }
  #importButton(label: string, accept: string, action: (file: File) => Promise<void>): HTMLButtonElement { const input = document.createElement("input"); input.type = "file"; input.accept = accept; input.hidden = true; const button = this.#button(label, () => input.click()); input.addEventListener("change", () => { const file = input.files?.[0]; input.value = ""; if (file) void action(file); }); this.#controls.append(input); return button; }
}
