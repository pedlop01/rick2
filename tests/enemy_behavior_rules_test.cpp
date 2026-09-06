#include "../src/enemy_behavior_rules.h"
#include <cassert>
int main() { assert(PatrolPhaseDirection(0, 2) == 1); assert(PatrolPhaseDirection(2, 2) == -1); assert(PatrolPhaseDirection(4, 2) == 1); assert(PatrolPhaseDirection(0, 2, -1) == -1); assert(JumpInitialSpeed(8) < 0); return 0; }
