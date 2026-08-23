export interface TileMapDimensions {
  width: number; height: number; tileWidth: number; tileHeight: number;
}

export interface VisibleBounds { left: number; top: number; right: number; bottom: number; }

export function visibleTileBounds(
  map: TileMapDimensions,
  viewportWidth: number,
  viewportHeight: number,
  offsetX: number,
  offsetY: number,
  zoom: number,
): VisibleBounds {
  return {
    left: Math.max(0, Math.floor(-offsetX / zoom / map.tileWidth)),
    top: Math.max(0, Math.floor(-offsetY / zoom / map.tileHeight)),
    right: Math.min(map.width, Math.ceil((viewportWidth - offsetX) / zoom / map.tileWidth)),
    bottom: Math.min(map.height, Math.ceil((viewportHeight - offsetY) / zoom / map.tileHeight)),
  };
}

export function tileSource(gid: number, columns: number, tileWidth: number, tileHeight: number): [number, number] {
  const index = gid - 1;
  return [(index % columns) * tileWidth, Math.floor(index / columns) * tileHeight];
}
