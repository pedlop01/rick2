#ifndef ACTION_RULES_H
#define ACTION_RULES_H

#include <algorithm>

#include "rick_params.h"

inline int ActionMovementForTick(int distance, int progress, int speed) {
  const int remaining = std::max(0, distance - progress);
  return std::min(std::max(0, speed), remaining);
}

inline bool IsActionWaitComplete(int elapsed_ticks, int wait_ticks) {
  return elapsed_ticks >= std::max(0, wait_ticks);
}

inline bool DoesActionConditionMatch(int condition, bool condition_enabled) {
  return condition == ACTION_COND_ALWAYS ||
         (condition_enabled && condition == ACTION_COND_TRIG_ON) ||
         (!condition_enabled && condition == ACTION_COND_TRIG_OFF);
}

#endif // ACTION_RULES_H
