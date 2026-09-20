#include <cassert>
#include "../src/tile_edge_collision_rules.h"

int main() {
  assert(IsTileEdgeBlocked(23, 27, [](int row) { return row == 25; }));
  assert(!IsTileEdgeBlocked(23, 27, [](int row) { return row == 28; }));
  assert(IsTileEdgeBlocked(110, 112, [](int column) { return column == 111; }));
  assert(!IsTileEdgeBlocked(110, 112, [](int column) { return column == 113; }));
  return 0;
}
