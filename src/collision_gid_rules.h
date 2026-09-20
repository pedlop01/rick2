#ifndef COLLISION_GID_RULES_H
#define COLLISION_GID_RULES_H

#include "rick_params.h"

inline int CollisionTypeForGid(int gid, int tile_count) {
  return gid == 0 ? 0 : TILE_COL + gid - tile_count - 1;
}

#endif
