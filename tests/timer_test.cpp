#include "../src/timer.h"

#include <chrono>
#include <iostream>

int main() {
  const unsigned int expected_ticks = 50;
  unsigned int processed_ticks = 0;
  Timer timer;

  const std::chrono::steady_clock::time_point started =
      std::chrono::steady_clock::now();
  timer.StartCounter();

  while (processed_ticks < expected_ticks) {
    const unsigned int ticks = timer.WaitForSimulationTicks();
    if (ticks == 0 || ticks > 5) {
      std::cerr << "Invalid tick batch: " << ticks << std::endl;
      return 1;
    }
    processed_ticks += ticks;
  }

  const long elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now() - started).count();

  std::cout << "Processed " << processed_ticks << " ticks in "
            << elapsed_ms << " ms" << std::endl;

  // Fifty 20 ms ticks should take approximately one second. Keep generous
  // bounds so the test remains reliable on a loaded development machine.
  if (elapsed_ms < 900 || elapsed_ms > 1500) {
    std::cerr << "Fixed timestep is outside the expected range" << std::endl;
    return 1;
  }

  return 0;
}
