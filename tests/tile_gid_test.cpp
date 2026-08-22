#include "../src/world.h"

#include <cassert>

int main() {
  Tile tile;
  assert(tile.IsEmpty());

  // TMX GID 1 is the first tile, not the empty GID 0.
  tile.SetValue(1);
  assert(!tile.IsEmpty());
  assert(tile.GetValue() == 1);

  tile.SetValue(0);
  assert(tile.IsEmpty());
  return 0;
}
