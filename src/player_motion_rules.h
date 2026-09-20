#ifndef PLAYER_MOTION_RULES_H
#define PLAYER_MOTION_RULES_H

inline int KeepMovingDirection(bool enabled, bool grounded, bool no_input, bool facing_left) {
  return enabled && grounded && no_input ? (facing_left ? -1 : 1) : 0;
}

#endif
