#include "../src/game_time.h"

#include <iostream>

int main() {
  if (GameTime::TICKS_PER_SECOND != 50 ||
      GameTime::MILLISECONDS_PER_TICK != 20 ||
      GameTime::TicksFromMilliseconds(1000) != 50 ||
      GameTime::ENEMY_FREEZE_DURATION_TICKS != 100 ||
      GameTime::BONUS_DISAPPEAR_DURATION_TICKS != 30 ||
      GameTime::PLAYER_HIT_HOLD_DURATION_TICKS != 20) {
    std::cerr << "Unexpected fixed-timestep conversion" << std::endl;
    return 1;
  }

  // Durations round up so a positive sub-tick duration can never disappear.
  if (GameTime::TicksFromMilliseconds(1) != 1 ||
      GameTime::TicksFromMilliseconds(21) != 2) {
    std::cerr << "Duration conversion must round up" << std::endl;
    return 1;
  }

  return 0;
}
