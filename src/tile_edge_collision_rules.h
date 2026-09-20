#ifndef TILE_EDGE_COLLISION_RULES_H
#define TILE_EDGE_COLLISION_RULES_H

template <typename IsBlocked>
bool IsTileEdgeBlocked(int first_tile, int last_tile, IsBlocked is_blocked) {
  for (int tile = first_tile; tile <= last_tile; ++tile)
    if (is_blocked(tile)) return true;
  return false;
}

#endif
