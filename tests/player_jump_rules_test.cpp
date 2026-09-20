#include <cassert>
#include <iostream>
#include "../src/player_jump_rules.h"

int main() {
  assert(InitialJumpDirection(true, true, CHAR_DIR_RIGHT) == CHAR_DIR_UP);
  assert(InitialJumpDirection(true, false, CHAR_DIR_RIGHT) ==
         (CHAR_DIR_UP | CHAR_DIR_RIGHT));
  assert(InitialJumpDirection(false, false, CHAR_DIR_LEFT) == CHAR_DIR_DOWN);
  assert(StartJumpFall(CHAR_DIR_UP | CHAR_DIR_RIGHT) ==
         (CHAR_DIR_DOWN | CHAR_DIR_RIGHT));
  std::cout << "player jump rules ok\n";
}
