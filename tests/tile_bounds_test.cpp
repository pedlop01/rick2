#include "../src/tile_bounds.h"

#include <cassert>

int main()
{
  const int map_width = 10;
  const int map_height = 5;
  const int tile_width = 8;
  const int tile_height = 8;

  assert(IsTileIndexInBounds(0, 0, map_width, map_height));
  assert(IsTileIndexInBounds(9, 4, map_width, map_height));
  assert(!IsTileIndexInBounds(-1, 0, map_width, map_height));
  assert(!IsTileIndexInBounds(0, -1, map_width, map_height));
  assert(!IsTileIndexInBounds(10, 0, map_width, map_height));
  assert(!IsTileIndexInBounds(0, 5, map_width, map_height));

  assert(IsWorldCoordinateInBounds(0, 0, map_width, map_height,
                                   tile_width, tile_height));
  assert(IsWorldCoordinateInBounds(79, 39, map_width, map_height,
                                   tile_width, tile_height));
  assert(!IsWorldCoordinateInBounds(-1, 0, map_width, map_height,
                                    tile_width, tile_height));
  assert(!IsWorldCoordinateInBounds(0, -1, map_width, map_height,
                                    tile_width, tile_height));
  assert(!IsWorldCoordinateInBounds(80, 0, map_width, map_height,
                                    tile_width, tile_height));
  assert(!IsWorldCoordinateInBounds(0, 40, map_width, map_height,
                                    tile_width, tile_height));
  assert(!IsWorldCoordinateInBounds(0, 0, map_width, map_height, 0, 8));

  return 0;
}
