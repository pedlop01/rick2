#include <cassert>
#include "../src/tile_edge_collision_rules.h"

int main() {
  assert(IsTileEdgeBlocked(23, 27, [](int row) { return row == 25; }));
  assert(!IsTileEdgeBlocked(23, 27, [](int row) { return row == 28; }));
  assert(IsTileEdgeBlocked(110, 112, [](int column) { return column == 111; }));
  assert(!IsTileEdgeBlocked(110, 112, [](int column) { return column == 113; }));
  // A character wider than a tile can stand over a one-column stair top even
  // when neither lower corner belongs to that column.
  assert(IsTileEdgeBlocked(7, 8, [](int column) { return column == 7; }));
  return 0;
}
