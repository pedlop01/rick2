#include "../src/collision_gid_rules.h"

#include <cassert>
#include <iostream>

int main() {
  assert(CollisionTypeForGid(0, 453) == 0);
  assert(CollisionTypeForGid(454, 453) == TILE_COL);
  assert(CollisionTypeForGid(455, 453) == TILE_COL_DOWN);
  assert(CollisionTypeForGid(458, 453) == TILE_SLOPE_LEFT);
  assert(CollisionTypeForGid(459, 453) == TILE_SLOPE_RIGHT);
  assert(CollisionTypeForGid(309, 308) == TILE_COL);
  std::cout << "collision gid rules ok\n";
}
