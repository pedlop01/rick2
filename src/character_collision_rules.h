#ifndef CHARACTER_COLLISION_RULES_H
#define CHARACTER_COLLISION_RULES_H

#include "rick_params.h"

inline bool IsStairCollisionTile(int tile) {
  return tile == TILE_STAIRS || tile == TILE_STAIRS_TOP;
}

inline bool IsInsideStairs(int left_up, int right_up,
                           int left_down, int right_down) {
  return IsStairCollisionTile(left_up) ||
         IsStairCollisionTile(right_up) ||
         IsStairCollisionTile(left_down) ||
         IsStairCollisionTile(right_down);
}

inline int StairAlignmentTargetX(int collision_x, int collision_width,
                                 int tile_width, int left_column,
                                 int right_column) {
  const int minimum = left_column * tile_width;
  const int shaft_right = (right_column + 1) * tile_width;
  const int maximum = shaft_right - collision_width;

  if (minimum > maximum) {
    return (minimum + shaft_right - collision_width) / 2;
  }
  if (collision_x < minimum) return minimum;
  if (collision_x > maximum) return maximum;
  return collision_x;
}

inline bool ShouldExitStairsHorizontally(bool in_floor,
                                         bool pressed_left,
                                         bool pressed_right) {
  return in_floor && (pressed_left || pressed_right);
}

inline bool ShouldStopDescendingStairs(bool in_floor, bool over_stairs) {
  return in_floor && !over_stairs;
}

#endif // CHARACTER_COLLISION_RULES_H
