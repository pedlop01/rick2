import { getProjectAsset, type Rick2Project } from "./project-io";
import type { LevelDocumentModel } from "./level-document";
import type { MapLayerName } from "./workspace-preview";

export class TilePalette {
  readonly #host: HTMLElement;
  #bitmap: ImageBitmap | null = null;
  #model: LevelDocumentModel | null = null;
  #layer: MapLayerName = "tiles";
  #selected = 1;
  #onSelect: (gid: number) => void = () => undefined;

  constructor(host: HTMLElement) { this.#host = host; }
  setSelectListener(listener: (gid: number) => void): void { this.#onSelect = listener; }
  get selectedGid(): number { return this.#selected; }

  async load(project: Rick2Project, model: LevelDocumentModel): Promise<void> {
    const asset = getProjectAsset(project, model.path, model.map.tileset.image);
    this.#bitmap?.close();
    this.#bitmap = await createImageBitmap(new Blob([asset.slice().buffer], { type: "image/png" }));
    this.#model = model;
    this.#selected = 1;
    this.#render();
    this.#onSelect(this.#selected);
  }

  setLayer(layer: MapLayerName): void {
    this.#layer = layer;
    this.#selected = layer === "collisions" ? (this.#model?.map.tileset.tileCount ?? 0) + 1 : 1;
    this.#render();
    this.#onSelect(this.#selected);
  }

  #choose(gid: number): void { this.#selected = gid; this.#render(); this.#onSelect(gid); }

  #render(): void {
    this.#host.innerHTML = "";
    if (!this.#model || !this.#bitmap) return;
    const title = document.createElement("h3");
    title.textContent = this.#layer === "collisions" ? "Tipo de colisión" : "Tileset";
    this.#host.append(title);
    if (this.#layer === "collisions") {
      const names = ["Sólido", "Plataforma", "Escalera", "Tope escalera"];
      const list = document.createElement("div");
      list.className = "collision-palette";
      names.forEach((name, index) => {
        const gid = this.#model!.map.tileset.tileCount + index + 1;
        const item = document.createElement("button");
        item.type = "button"; item.textContent = name; item.classList.toggle("selected", gid === this.#selected);
        item.addEventListener("click", () => this.#choose(gid));
        list.append(item);
      });
      this.#host.append(list);
      return;
    }
    const map = this.#model.map;
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = map.tileset.columns * map.tileWidth * scale;
    canvas.height = Math.ceil(map.tileset.tileCount / map.tileset.columns) * map.tileHeight * scale;
    canvas.className = "tileset-palette";
    canvas.title = `Tile seleccionado: ${this.#selected}`;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(this.#bitmap, 0, 0, canvas.width, canvas.height);
    const index = this.#selected - 1;
    const x = (index % map.tileset.columns) * map.tileWidth * scale;
    const y = Math.floor(index / map.tileset.columns) * map.tileHeight * scale;
    context.strokeStyle = "#57d3ff"; context.lineWidth = 2; context.strokeRect(x + 1, y + 1, map.tileWidth * scale - 2, map.tileHeight * scale - 2);
    canvas.addEventListener("click", (event) => {
      const bounds = canvas.getBoundingClientRect();
      const column = Math.floor((event.clientX - bounds.left) / (map.tileWidth * scale));
      const row = Math.floor((event.clientY - bounds.top) / (map.tileHeight * scale));
      const gid = row * map.tileset.columns + column + 1;
      if (gid <= map.tileset.tileCount) this.#choose(gid);
    });
    this.#host.append(canvas);
  }
}
