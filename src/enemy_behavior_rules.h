#ifndef ENEMY_BEHAVIOR_RULES_H
#define ENEMY_BEHAVIOR_RULES_H
#include <algorithm>
#include <cmath>
inline int PatrolPhaseDirection(int ticks, int phase_ticks, int initial = 1) { const int phase = std::max(1, phase_ticks); return ticks % (phase * 2) < phase ? initial : -initial; }
inline float JumpInitialSpeed(float height, float acceleration = 0.4f) { return -std::sqrt(2.0f * acceleration * std::max(0.0f, height)); }
#endif
