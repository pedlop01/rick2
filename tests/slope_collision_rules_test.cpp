#include "../src/slope_collision_rules.h"

#include <cassert>
#include <iostream>

int main() {
  assert(!IsSlopeCollisionTile(TILE_COL));
  assert(IsSlopeCollisionTile(TILE_SLOPE_LEFT));
  assert(IsSlopeCollisionTile(TILE_SLOPE_RIGHT));
  assert(SlopeSurfaceY(TILE_SLOPE_LEFT, 32, 64, 32, 32, 32) == 64);
  assert(SlopeSurfaceY(TILE_SLOPE_LEFT, 32, 64, 32, 32, 63) == 95);
  assert(SlopeSurfaceY(TILE_SLOPE_RIGHT, 32, 64, 32, 32, 32) == 95);
  assert(SlopeSurfaceY(TILE_SLOPE_RIGHT, 32, 64, 32, 32, 63) == 64);
  int standing_y = 0;
  assert(SlopeStandingPositionY(TILE_SLOPE_LEFT, 32, 64, 32, 32, 36,
                                52, 0, 16, 5, &standing_y));
  assert(standing_y == 52);
  assert(SlopeStandingPositionY(TILE_SLOPE_RIGHT, 32, 64, 32, 32, 36,
                                75, 0, 16, 5, &standing_y));
  assert(standing_y == 75);
  assert(!SlopeStandingPositionY(TILE_SLOPE_LEFT, 32, 64, 32, 32, 36,
                                 40, 0, 16, 5, &standing_y));
  std::cout << "slope collision rules ok\n";
}
