#ifndef GAME_TIME_H
#define GAME_TIME_H

namespace GameTime {

// Gameplay advances in fixed 20 ms ticks. Render frequency never changes
// these units or the speed of the simulation.
constexpr unsigned int TICKS_PER_SECOND = 50;
constexpr unsigned int MILLISECONDS_PER_TICK = 1000 / TICKS_PER_SECOND;

constexpr unsigned int TicksFromMilliseconds(unsigned int milliseconds) {
  return (milliseconds + MILLISECONDS_PER_TICK - 1) /
         MILLISECONDS_PER_TICK;
}

constexpr unsigned int ENEMY_FREEZE_DURATION_TICKS = TicksFromMilliseconds(2000);
constexpr unsigned int ENEMY_FREEZE_FLASH_PERIOD_TICKS = TicksFromMilliseconds(80);
constexpr unsigned int BONUS_DISAPPEAR_DURATION_TICKS = TicksFromMilliseconds(600);
constexpr unsigned int PLAYER_HIT_HOLD_DURATION_TICKS = TicksFromMilliseconds(400);

}  // namespace GameTime

#endif  // GAME_TIME_H
