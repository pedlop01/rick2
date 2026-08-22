#ifndef TIMER_H
#define TIMER_H

#include <chrono>

class Timer {
  private:
    typedef std::chrono::steady_clock Clock;

    Clock::duration timestep;
    Clock::duration accumulator;
    Clock::time_point previous_time;
    unsigned int max_catch_up_ticks;

  public:
    Timer();

    void StartCounter();

    // Wait until at least one fixed simulation tick is available and return
    // how many ticks must be processed. Long stalls are capped so the game
    // cannot enter an unbounded catch-up loop.
    unsigned int WaitForSimulationTicks();
};

#endif // TIMER_H
