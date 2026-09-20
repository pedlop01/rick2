#ifndef PLAYER_JUMP_RULES_H
#define PLAYER_JUMP_RULES_H

#include "rick_params.h"

inline int InitialJumpDirection(bool grounded, bool air_control, int face) {
  int direction = grounded ? CHAR_DIR_UP : CHAR_DIR_DOWN;
  if (grounded && !air_control)
    direction |= face & (CHAR_DIR_LEFT | CHAR_DIR_RIGHT);
  return direction;
}

inline int StartJumpFall(int direction) {
  return (direction & (CHAR_DIR_LEFT | CHAR_DIR_RIGHT)) | CHAR_DIR_DOWN;
}

#endif
