#include "../src/character_collision_rules.h"

#include <cassert>

int main() {
  assert(!IsInsideStairs(0, 0, 0, 0));
  assert(!IsInsideStairs(TILE_COL, TILE_COL, TILE_COL, TILE_COL));

  // Every sampled corner can keep a character attached to a normal ladder.
  assert(IsInsideStairs(TILE_STAIRS, 0, 0, 0));
  assert(IsInsideStairs(0, TILE_STAIRS, 0, 0));
  assert(IsInsideStairs(0, 0, TILE_STAIRS, 0));
  assert(IsInsideStairs(0, 0, 0, TILE_STAIRS));

  // The top tile is part of the same continuous ladder volume.
  assert(IsInsideStairs(TILE_STAIRS_TOP, 0, 0, 0));
  assert(IsInsideStairs(0, 0, 0, TILE_STAIRS_TOP));

  // A 10 px box fits between x=16 and x=32 only in the [16, 22] range.
  assert(StairAlignmentTargetX(14, 10, 8, 2, 3) == 16);
  assert(StairAlignmentTargetX(19, 10, 8, 2, 3) == 19);
  assert(StairAlignmentTargetX(25, 10, 8, 2, 3) == 22);

  // When the box is wider than a one-tile ladder, center it deterministically.
  assert(StairAlignmentTargetX(40, 10, 8, 5, 5) == 39);

  // Horizontal input exits CLIMBING only after reaching real floor.
  assert(ShouldExitStairsHorizontally(true, true, false));
  assert(ShouldExitStairsHorizontally(true, false, true));
  assert(!ShouldExitStairsHorizontally(true, false, false));
  assert(!ShouldExitStairsHorizontally(false, true, false));
  return 0;
}
