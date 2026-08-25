#ifndef ENEMY_IA_RULES_H
#define ENEMY_IA_RULES_H

#include <cstdint>

#include "rick_params.h"

// Random decisions use the configured value as a one-in-N probability. Keep
// zero safe for malformed or legacy data, matching the web runtime's minimum.
inline int NormalizeEnemyIARandomness(int configured_randomness) {
  return configured_randomness > 0 ? configured_randomness : 1;
}

// Keep this sequence in sync with PreviewRuntime.#randomEnemyDecision. Each
// enemy owns its state, so construction order and decisions by other enemies
// cannot perturb its behaviour.
inline std::uint32_t InitialEnemyIARandomState(int enemy_id) {
  return (static_cast<std::uint32_t>(enemy_id) + 1u) * 0x9e3779b1u;
}

inline std::uint32_t NextEnemyIARandomState(std::uint32_t state) {
  return state * 1664525u + 1013904223u;
}

inline int EnemyChaserVerticalDirection(int player_y, int enemy_y,
                                        int enemy_state, bool in_stairs,
                                        bool over_stairs, bool in_floor) {
  const int vertical_tolerance = 10;

  if (player_y > enemy_y + vertical_tolerance && over_stairs) {
    return CHAR_DIR_DOWN;
  }

  // CLIMBING is a previous-frame state. Do not keep steering vertically after
  // the enemy has left the ladder shaft; Character will then fall or leave
  // horizontally according to its current collisions.
  if (enemy_state == CHAR_STATE_CLIMBING && !in_floor &&
      (in_stairs || over_stairs)) {
    return player_y + vertical_tolerance > enemy_y
             ? CHAR_DIR_DOWN
             : CHAR_DIR_UP;
  }

  if (enemy_state != CHAR_STATE_CLIMBING && in_stairs &&
      player_y + vertical_tolerance < enemy_y) {
    return CHAR_DIR_UP;
  }

  return CHAR_DIR_STOP;
}

inline bool ShouldCenterClimbingEnemy(int enemy_state, bool in_stairs,
                                      bool over_stairs, bool in_floor) {
  return enemy_state == CHAR_STATE_CLIMBING && !in_floor &&
         (in_stairs || over_stairs);
}

#endif // ENEMY_IA_RULES_H
