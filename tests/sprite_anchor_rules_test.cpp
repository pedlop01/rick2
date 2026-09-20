#include <cassert>
#include <iostream>

#include "../src/sprite_anchor_rules.h"

int main() {
  const SpriteDrawPosition compatible =
      AnchoredSpritePosition(100, 200, 80, 66, 70, 66, 1);
  assert(compatible.x == 100 && compatible.y == 200);

  const SpriteDrawPosition scaled =
      AnchoredSpritePosition(781, 290, 64, 92, 16, 23, 4);
  assert(scaled.x == 781 && scaled.y == 290);

  const SpriteDrawPosition centered =
      AnchoredSpritePosition(411, 1244, 320, 264, 70, 66, 4);
  assert(centered.x == 431 && centered.y == 1244);

  std::cout << "sprite anchor rules ok\n";
}
