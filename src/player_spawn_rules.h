#ifndef PLAYER_SPAWN_RULES_H
#define PLAYER_SPAWN_RULES_H

#include "checkpoint.h"

struct PlayerSpawnState {
  int x;
  int y;
  int direction;
  int face;
};

inline PlayerSpawnState InitialPlayerSpawn(const Checkpoint& checkpoint) {
  PlayerSpawnState result = {checkpoint.GetPlayerX(), checkpoint.GetPlayerY(),
                             CHAR_DIR_STOP, checkpoint.GetPlayerFace()};
  return result;
}

inline int RespawnPlayerFace(const Checkpoint& checkpoint, int current_face) {
  return checkpoint.PreservePlayerFace() ? current_face : checkpoint.GetPlayerFace();
}

#endif  // PLAYER_SPAWN_RULES_H
