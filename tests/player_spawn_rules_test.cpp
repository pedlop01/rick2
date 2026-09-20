#include <cassert>

#include "../src/player_spawn_rules.h"

int main() {
  Checkpoint right(0, 0, 0, 8, 8, 320, 500, CHAR_DIR_RIGHT);
  PlayerSpawnState spawn = InitialPlayerSpawn(right);
  assert(spawn.x == 320);
  assert(spawn.y == 500);
  assert(spawn.direction == CHAR_DIR_STOP);
  assert(spawn.face == CHAR_DIR_RIGHT);

  Checkpoint left(1, 0, 0, 8, 8, 24, 48, CHAR_DIR_LEFT);
  spawn = InitialPlayerSpawn(left);
  assert(spawn.x == 24);
  assert(spawn.y == 48);
  assert(spawn.face == CHAR_DIR_LEFT);

  Checkpoint preserve(2, 0, 0, 8, 8, 60, 70, CHAR_DIR_RIGHT, true);
  assert(RespawnPlayerFace(preserve, CHAR_DIR_LEFT) == CHAR_DIR_LEFT);
  assert(RespawnPlayerFace(preserve, CHAR_DIR_RIGHT) == CHAR_DIR_RIGHT);
  assert(RespawnPlayerFace(left, CHAR_DIR_RIGHT) == CHAR_DIR_LEFT);
  return 0;
}
