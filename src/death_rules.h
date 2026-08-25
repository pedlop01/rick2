#ifndef DEATH_RULES_H
#define DEATH_RULES_H

#include "rick_params.h"

constexpr int PLAYER_DEATH_RISE_PIXELS = 80;

inline bool ShouldStartDeathFall(int origin_y, int current_y,
                                 int rise_pixels = PLAYER_DEATH_RISE_PIXELS) {
  return origin_y - current_y >= rise_pixels;
}

inline bool HasCrossedDeathBoundary(int player_y, int camera_y,
                                    int camera_height) {
  return player_y >= camera_y + camera_height;
}

inline bool ShouldFreezeCameraForState(int state) {
  return state == CHAR_STATE_DYING || state == CHAR_STATE_DEAD;
}

#endif // DEATH_RULES_H
