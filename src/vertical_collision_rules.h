#ifndef VERTICAL_COLLISION_RULES_H
#define VERTICAL_COLLISION_RULES_H

#include "rick_params.h"

inline bool IsAirBelowTile(int tile) {
  return tile == 0 || tile == TILE_STAIRS;
}

inline bool IsBodyUnsupported(int left_below, int right_below) {
  return IsAirBelowTile(left_below) && IsAirBelowTile(right_below);
}

inline int ResolveDownwardCollisionY(int requested_y, int bb_y,
                                     int collision_height, int tile_height) {
  const int requested_bottom = requested_y + bb_y + collision_height - 1;
  const int tile_top = (requested_bottom / tile_height) * tile_height;
  return tile_top - bb_y - collision_height;
}

inline int ResolveUpwardCollisionY(int requested_y, int bb_y,
                                   int tile_height) {
  const int requested_top = requested_y + bb_y;
  const int tile_bottom =
      (requested_top / tile_height + 1) * tile_height;
  return tile_bottom - bb_y;
}

#endif // VERTICAL_COLLISION_RULES_H
