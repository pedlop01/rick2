#include "../src/animation_rules.h"

#include <cassert>

int main() {
  AnimationClockStep clock{0, 0};
  for (int tick = 0; tick < 4; ++tick) {
    clock = AdvanceAnimationOnce(clock.frame, clock.ticks, 2, 4);
  }
  assert(clock.frame == 1);
  assert(clock.ticks == 0);

  for (int tick = 0; tick < 20; ++tick) {
    clock = AdvanceAnimationOnce(clock.frame, clock.ticks, 2, 4);
  }
  assert(clock.frame == 1);
  assert(clock.ticks == 3);

  assert(ShouldAnimateCharacterOnce(CHAR_STATE_CROUCHING, CHAR_DIR_STOP));
  assert(!ShouldAnimateCharacterOnce(CHAR_STATE_CROUCHING, CHAR_DIR_RIGHT));
  assert(!ShouldAnimateCharacterOnce(CHAR_STATE_CLIMBING, CHAR_DIR_STOP));

  assert(ShouldPauseFrozenEnemy(true, false));
  assert(!ShouldPauseFrozenEnemy(true, true));
  assert(!ShouldPauseFrozenEnemy(false, false));
  return 0;
}
