#include "timer.h"
#include "game_time.h"

#include <thread>

namespace {
const std::chrono::milliseconds GAME_TIMESTEP(GameTime::MILLISECONDS_PER_TICK);
const unsigned int MAX_CATCH_UP_TICKS = 5;
}

Timer::Timer()
  : timestep(GAME_TIMESTEP),
    accumulator(Clock::duration::zero()),
    previous_time(Clock::now()),
    max_catch_up_ticks(MAX_CATCH_UP_TICKS) {
}

void Timer::StartCounter() {
  accumulator = Clock::duration::zero();
  previous_time = Clock::now();
}

unsigned int Timer::WaitForSimulationTicks() {
  Clock::time_point now = Clock::now();
  accumulator += now - previous_time;
  previous_time = now;

  while (accumulator < timestep) {
    std::this_thread::sleep_for(timestep - accumulator);
    now = Clock::now();
    accumulator += now - previous_time;
    previous_time = now;
  }

  const Clock::duration max_accumulator = timestep * max_catch_up_ticks;
  if (accumulator > max_accumulator) {
    accumulator = max_accumulator;
  }

  const unsigned int ticks = static_cast<unsigned int>(accumulator / timestep);
  accumulator -= timestep * ticks;
  return ticks;
}
