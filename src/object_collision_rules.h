#ifndef OBJECT_COLLISION_RULES_H
#define OBJECT_COLLISION_RULES_H

#include "object.h"

inline bool IsBlockCollisionCandidate(int state) {
  return state != OBJ_STATE_DYING && state != OBJ_STATE_DEAD;
}

inline bool IsItemCollisionCandidate(int type, int state) {
  return type == OBJ_ITEM &&
         state != OBJ_STATE_DYING && state != OBJ_STATE_DEAD;
}

inline bool CollisionRangesOverlap(int first_start, int first_size,
                                   int second_start, int second_size) {
  return first_start < second_start + second_size &&
         first_start + first_size > second_start;
}

inline bool IsLandingOnBlock(int body_left, int body_top,
                             int body_width, int body_height,
                             int block_x, int block_y,
                             int block_width, int block_height) {
  const int body_bottom = body_top + body_height - 1;
  return CollisionRangesOverlap(body_left, body_width, block_x, block_width) &&
         body_top < block_y &&
         body_bottom >= block_y - 1 &&
         body_bottom < block_y + block_height;
}

#endif // OBJECT_COLLISION_RULES_H
