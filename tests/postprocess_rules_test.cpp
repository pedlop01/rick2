#include <cassert>
#include "../src/postprocess_rules.h"

int main() {
  const int expected[] = {0, 1, 2, 3, 4, 3, 2, 1, 0};
  for (std::size_t index = 0; index < 9; ++index)
    assert(HorizontalStripBaseOffset(index, 4) == expected[index]);

  assert(HorizontalStripOffset(0, 48, 4, 0, 25) == 0);
  assert(HorizontalStripOffset(0, 48, 4, 24, 25) == 0);
  assert(HorizontalStripOffset(0, 48, 4, 25, 25) == 1);
  assert(HorizontalStripOffset(1, 48, 4, 25, 25) == 0);
  assert(HorizontalStripOffset(0, 48, 4, 50, 25) == 2);
  return 0;
}
