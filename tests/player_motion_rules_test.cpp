#include "../src/player_motion_rules.h"
#include <cassert>

int main() {
  assert(KeepMovingDirection(true, true, true, false) == 1);
  assert(KeepMovingDirection(true, true, true, true) == -1);
  assert(KeepMovingDirection(true, false, true, false) == 0);
  assert(KeepMovingDirection(true, true, false, false) == 0);
  assert(KeepMovingDirection(false, true, true, false) == 0);
}
