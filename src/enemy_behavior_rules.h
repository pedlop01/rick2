#ifndef ENEMY_BEHAVIOR_RULES_H
#define ENEMY_BEHAVIOR_RULES_H
#include <algorithm>
#include <cmath>
inline int PatrolPhaseDirection(int ticks, int phase_ticks, int initial = 1) { const int phase = std::max(1, phase_ticks); return ticks % (phase * 2) < phase ? initial : -initial; }
inline bool EnemyDeathHasPriority(bool killed) { return killed; }
inline void StepPatrolAxis(int position, int distance, int& anchor, int& direction) {
  if (std::abs(position - anchor) > distance) { anchor = position; direction = -direction; }
}
inline bool VerticalPatrolLimitReached(int ticks, float speed, int distance) {
  return static_cast<float>(ticks) * speed >= static_cast<float>(distance);
}
inline float JumpInitialSpeed(float height, float acceleration = 0.4f) { return -std::sqrt(2.0f * acceleration * std::max(0.0f, height)); }
#endif
