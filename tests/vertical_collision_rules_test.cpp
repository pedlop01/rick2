#include "../src/vertical_collision_rules.h"

#include <cassert>

int main() {
  assert(IsBodyUnsupported(0, 0));
  assert(IsBodyUnsupported(TILE_STAIRS, 0));
  assert(IsBodyUnsupported(0, TILE_STAIRS));
  assert(IsBodyUnsupported(TILE_STAIRS, TILE_STAIRS));

  // One supported side is enough to stand at an edge.
  assert(!IsBodyUnsupported(TILE_COL, 0));
  assert(!IsBodyUnsupported(0, TILE_COL_DOWN));
  assert(!IsBodyUnsupported(TILE_STAIRS, TILE_STAIRS_TOP));

  // The top of a ladder is intentionally a one-way landing surface.
  assert(!IsAirBelowTile(TILE_STAIRS_TOP));

  // A 21 px collision box landing in tile row 5 (top y=40) ends at y=19.
  assert(ResolveDownwardCollisionY(21, 0, 21, 8) == 19);
  assert(ResolveDownwardCollisionY(23, 2, 21, 8) == 17);

  // An upward collision with row 4 [32, 39] leaves the top at y=40.
  assert(ResolveUpwardCollisionY(38, 0, 8) == 40);
  assert(ResolveUpwardCollisionY(36, 2, 8) == 38);

  // Both boundaries remain stable regardless of penetration within the tile.
  assert(ResolveDownwardCollisionY(28, 0, 13, 8) == 27);
  assert(ResolveDownwardCollisionY(34, 0, 13, 8) == 27);
  assert(ResolveUpwardCollisionY(32, 0, 8) == 40);
  return 0;
}
