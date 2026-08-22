#ifndef TILE_BOUNDS_H
#define TILE_BOUNDS_H

inline bool IsTileIndexInBounds(int x, int y, int map_width, int map_height)
{
  return x >= 0 && y >= 0 && x < map_width && y < map_height;
}

inline bool IsWorldCoordinateInBounds(int x, int y,
                                      int map_width, int map_height,
                                      int tile_width, int tile_height)
{
  return x >= 0 && y >= 0 &&
         map_width > 0 && map_height > 0 &&
         tile_width > 0 && tile_height > 0 &&
         x / tile_width < map_width && y / tile_height < map_height;
}

#endif
