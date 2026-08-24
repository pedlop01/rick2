#include "../src/enemy_ia_rules.h"

#include <cassert>
#include <cstdint>

int main() {
  // Level 1 deliberately assigns different decision frequencies per enemy.
  assert(NormalizeEnemyIARandomness(32) == 32);
  assert(NormalizeEnemyIARandomness(64) == 64);
  assert(NormalizeEnemyIARandomness(512) == 512);

  // Avoid rand() % 0 if legacy or hand-authored data enables random AI with 0.
  assert(NormalizeEnemyIARandomness(0) == 1);
  assert(NormalizeEnemyIARandomness(-1) == 1);

  // These values are the unsigned 32-bit results of the LCG also used by JS.
  std::uint32_t enemy_zero = InitialEnemyIARandomState(0);
  assert(enemy_zero == 2654435761u);
  enemy_zero = NextEnemyIARandomState(enemy_zero);
  assert(enemy_zero == 1107666780u);
  enemy_zero = NextEnemyIARandomState(enemy_zero);
  assert(enemy_zero == 795024139u);

  // A second enemy owns a different sequence; resetting recreates the first.
  std::uint32_t enemy_one = InitialEnemyIARandomState(1);
  assert(enemy_one != InitialEnemyIARandomState(0));
  assert(NextEnemyIARandomState(enemy_one) !=
         NextEnemyIARandomState(InitialEnemyIARandomState(0)));
  assert(InitialEnemyIARandomState(0) == 2654435761u);

  // A running chaser can now enter a ladder when Rick is above it.
  assert(EnemyChaserVerticalDirection(80, 120, CHAR_STATE_RUNNING,
                                      true, false, true) == CHAR_DIR_UP);
  assert(EnemyChaserVerticalDirection(80, 120, CHAR_STATE_RUNNING,
                                      false, false, true) == CHAR_DIR_STOP);

  // Descending starts at a ladder top and climbing keeps its vertical target.
  assert(EnemyChaserVerticalDirection(140, 100, CHAR_STATE_RUNNING,
                                      false, true, true) == CHAR_DIR_DOWN);
  assert(EnemyChaserVerticalDirection(80, 120, CHAR_STATE_CLIMBING,
                                      true, false, false) == CHAR_DIR_UP);
  assert(EnemyChaserVerticalDirection(140, 100, CHAR_STATE_CLIMBING,
                                      true, false, false) == CHAR_DIR_DOWN);

  // Small vertical differences do not make a grounded chaser oscillate.
  assert(EnemyChaserVerticalDirection(105, 100, CHAR_STATE_RUNNING,
                                      true, true, true) == CHAR_DIR_STOP);
  return 0;
}
