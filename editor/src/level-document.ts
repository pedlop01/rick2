import { strFromU8, strToU8 } from "fflate";
import type { MapLayerName } from "./workspace-preview";
import type { Rick2Project } from "./project-io";

export interface TileMapDocument {
  width: number; height: number; tileWidth: number; tileHeight: number;
  tileset: { image: string; tileCount: number; columns: number };
  layers: Record<MapLayerName, number[]>;
}

export interface EditableLevel { map: TileMapDocument; [key: string]: unknown; }
export interface TileRect { x: number; y: number; width: number; height: number; }
export interface TileClipboard { width: number; height: number; cells: number[]; }

export class LevelDocumentModel {
  readonly project: Rick2Project;
  readonly path: string;
  readonly level: EditableLevel;

  constructor(project: Rick2Project) {
    this.project = project;
    this.path = project.manifest.initialLevel;
    const bytes = project.files.get(this.path);
    if (!bytes) throw new Error(`${this.path} was not found`);
    this.level = JSON.parse(strFromU8(bytes)) as EditableLevel;
  }

  get map(): TileMapDocument { return this.level.map; }

  flush(): void {
    this.project.files.set(this.path, strToU8(`${JSON.stringify(this.level, null, 2)}\n`));
  }

  isInside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
  }

  isValidGid(layer: MapLayerName, gid: number): boolean {
    if (!Number.isInteger(gid) || gid < 0) return false;
    if (layer === "collisions") {
      return gid === 0 || (gid >= this.map.tileset.tileCount + 1 && gid <= this.map.tileset.tileCount + 4);
    }
    return gid <= this.map.tileset.tileCount;
  }

  setCell(layer: MapLayerName, x: number, y: number, gid: number): boolean {
    if (!this.isInside(x, y) || !this.isValidGid(layer, gid)) return false;
    const index = y * this.map.width + x;
    if (this.map.layers[layer][index] === gid) return false;
    this.map.layers[layer][index] = gid;
    return true;
  }

  paintLine(layer: MapLayerName, fromX: number, fromY: number, toX: number, toY: number, gid: number): boolean {
    let changed = false;
    let x = fromX;
    let y = fromY;
    const dx = Math.abs(toX - fromX);
    const sx = fromX < toX ? 1 : -1;
    const dy = -Math.abs(toY - fromY);
    const sy = fromY < toY ? 1 : -1;
    let error = dx + dy;
    while (true) {
      changed = this.setCell(layer, x, y, gid) || changed;
      if (x === toX && y === toY) break;
      const doubled = 2 * error;
      if (doubled >= dy) { error += dy; x += sx; }
      if (doubled <= dx) { error += dx; y += sy; }
    }
    return changed;
  }

  floodFill(layer: MapLayerName, x: number, y: number, gid: number): boolean {
    if (!this.isInside(x, y) || !this.isValidGid(layer, gid)) return false;
    const cells = this.map.layers[layer];
    const target = cells[y * this.map.width + x];
    if (target === gid) return false;
    const pending: number[] = [y * this.map.width + x];
    cells[pending[0]!] = gid;
    for (let cursor = 0; cursor < pending.length; ++cursor) {
      const index = pending[cursor]!;
      const cellX = index % this.map.width;
      const neighbors = [
        cellX > 0 ? index - 1 : -1,
        cellX + 1 < this.map.width ? index + 1 : -1,
        index >= this.map.width ? index - this.map.width : -1,
        index + this.map.width < cells.length ? index + this.map.width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && cells[neighbor] === target) {
          cells[neighbor] = gid;
          pending.push(neighbor);
        }
      }
    }
    return true;
  }

  normalizedRect(startX: number, startY: number, endX: number, endY: number): TileRect {
    const left = Math.max(0, Math.min(startX, endX));
    const top = Math.max(0, Math.min(startY, endY));
    const right = Math.min(this.map.width - 1, Math.max(startX, endX));
    const bottom = Math.min(this.map.height - 1, Math.max(startY, endY));
    return { x: left, y: top, width: Math.max(0, right - left + 1), height: Math.max(0, bottom - top + 1) };
  }

  copy(layer: MapLayerName, rect: TileRect): TileClipboard {
    const safe = this.normalizedRect(rect.x, rect.y, rect.x + rect.width - 1, rect.y + rect.height - 1);
    const cells: number[] = [];
    for (let y = 0; y < safe.height; ++y) for (let x = 0; x < safe.width; ++x) {
      cells.push(this.map.layers[layer][(safe.y + y) * this.map.width + safe.x + x] ?? 0);
    }
    return { width: safe.width, height: safe.height, cells };
  }

  clear(layer: MapLayerName, rect: TileRect): boolean {
    let changed = false;
    const safe = this.normalizedRect(rect.x, rect.y, rect.x + rect.width - 1, rect.y + rect.height - 1);
    for (let y = 0; y < safe.height; ++y) for (let x = 0; x < safe.width; ++x) {
      changed = this.setCell(layer, safe.x + x, safe.y + y, 0) || changed;
    }
    return changed;
  }

  paste(layer: MapLayerName, x: number, y: number, clipboard: TileClipboard): boolean {
    let changed = false;
    for (let row = 0; row < clipboard.height; ++row) for (let column = 0; column < clipboard.width; ++column) {
      const gid = clipboard.cells[row * clipboard.width + column] ?? 0;
      changed = this.setCell(layer, x + column, y + row, gid) || changed;
    }
    return changed;
  }
}
