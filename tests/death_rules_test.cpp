#include "../src/death_rules.h"

#include <cassert>

int main() {
  assert(!ShouldStartDeathFall(1000, 921));
  assert(ShouldStartDeathFall(1000, 920));
  assert(ShouldStartDeathFall(1000, 900));

  assert(!HasCrossedDeathBoundary(1199, 1000, 200));
  assert(HasCrossedDeathBoundary(1200, 1000, 200));

  assert(ShouldFreezeCameraForState(CHAR_STATE_DYING));
  assert(ShouldFreezeCameraForState(CHAR_STATE_DEAD));
  assert(!ShouldFreezeCameraForState(CHAR_STATE_STOP));
  assert(!ShouldFreezeCameraForState(CHAR_STATE_JUMPING));
  return 0;
}
