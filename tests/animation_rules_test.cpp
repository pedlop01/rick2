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

  MillisecondAnimationStep exact{0, 0};
  for (int tick = 0; tick < 17; ++tick)
    exact = AdvanceLoopingAnimationMilliseconds(exact.frame, exact.elapsed_ms, 2, 85);
  assert(exact.frame == 0 && exact.elapsed_ms == 0);
  for (int tick = 0; tick < 4; ++tick)
    exact = AdvanceLoopingAnimationMilliseconds(exact.frame, exact.elapsed_ms, 2, 85);
  assert(exact.frame == 0 && exact.elapsed_ms == 80);
  exact = AdvanceLoopingAnimationMilliseconds(exact.frame, exact.elapsed_ms, 2, 85);
  assert(exact.frame == 1 && exact.elapsed_ms == 15);

  MillisecondAnimationStep explosion{0, 0};
  for (int tick = 0; tick < 62; ++tick)
    explosion = AdvanceLoopingAnimationMilliseconds(explosion.frame, explosion.elapsed_ms, 5, 250);
  assert(explosion.frame == 4 && explosion.elapsed_ms == 240);
  explosion = AdvanceLoopingAnimationMilliseconds(explosion.frame, explosion.elapsed_ms, 5, 250);
  assert(explosion.frame == 0 && explosion.elapsed_ms == 10);
  return 0;
}
