#ifndef SLOPE_COLLISION_RULES_H
#define SLOPE_COLLISION_RULES_H

#include "rick_params.h"

inline bool IsSlopeCollisionTile(int tile) {
  return tile == TILE_SLOPE_LEFT || tile == TILE_SLOPE_RIGHT;
}

inline int SlopeSurfaceY(int tile, int tile_left, int tile_top,
                         int tile_width, int tile_height, int world_x) {
  if (!IsSlopeCollisionTile(tile) || tile_width <= 1 || tile_height <= 0)
    return tile_top + tile_height;
  int local_x = world_x - tile_left;
  if (local_x < 0) local_x = 0;
  if (local_x >= tile_width) local_x = tile_width - 1;
  if (tile == TILE_SLOPE_RIGHT) local_x = tile_width - 1 - local_x;
  return tile_top + local_x * (tile_height - 1) / (tile_width - 1);
}

inline bool SlopeStandingPositionY(int tile, int tile_left, int tile_top,
                                   int tile_width, int tile_height, int foot_x,
                                   int body_y, int collision_offset_y,
                                   int collision_height, int tolerance,
                                   int* standing_y) {
  if (!IsSlopeCollisionTile(tile)) return false;
  const int candidate = SlopeSurfaceY(tile, tile_left, tile_top, tile_width,
                                      tile_height, foot_x) -
                        collision_offset_y - collision_height;
  int distance = candidate - body_y;
  if (distance < 0) distance = -distance;
  if (distance > tolerance) return false;
  if (standing_y) *standing_y = candidate;
  return true;
}

#endif
