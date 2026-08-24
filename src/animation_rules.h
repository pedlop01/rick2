#ifndef ANIMATION_RULES_H
#define ANIMATION_RULES_H

#include <algorithm>

#include "rick_params.h"

struct AnimationClockStep {
  int frame;
  int ticks;
};

inline AnimationClockStep AdvanceAnimationOnce(int frame, int ticks,
                                                int frame_count,
                                                int duration_ticks) {
  if (frame_count <= 0) return AnimationClockStep{0, 0};
  const int duration = std::max(1, duration_ticks);
  const int last_frame = frame_count - 1;
  frame = std::max(0, std::min(frame, last_frame));
  ticks += 1;
  if (ticks >= duration) {
    if (frame < last_frame) {
      frame += 1;
      ticks = 0;
    } else {
      ticks = duration - 1;
    }
  }
  return AnimationClockStep{frame, ticks};
}

inline bool ShouldAnimateCharacterOnce(int state, int direction) {
  return state == CHAR_STATE_CROUCHING && direction == CHAR_DIR_STOP;
}

inline bool ShouldPauseFrozenEnemy(bool frozen, bool killed) {
  return frozen && !killed;
}

#endif // ANIMATION_RULES_H
