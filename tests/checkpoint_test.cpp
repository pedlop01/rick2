#include "../src/checkpoint.h"

#include <cassert>

int main() {
  Checkpoint start(0, 0, 0, 8, 8, 2, 3, CHAR_DIR_RIGHT);
  Checkpoint upper(1, 20, 20, 8, 8, 22, 23, CHAR_DIR_LEFT);
  Checkpoint lower(2, 20, 40, 8, 8, 22, 43, CHAR_DIR_RIGHT);

  start.AddNextCheckpoint(&upper);
  start.AddNextCheckpoint(&lower);
  assert(start.GetNextCheckpoints()->size() == 2);
  assert(start.GetNextCheckpoints()->at(0) == &upper);
  assert(start.GetNextCheckpoints()->at(1) == &lower);

  // A checkpoint wholly contained by a body must still be reached.
  assert(upper.InCheckpoint(10, 10, 30, 30));
  // Merely touching its boundary is not entering it.
  assert(!upper.InCheckpoint(12, 20, 8, 8));
  assert(upper.GetPlayerX() == 22);
  assert(upper.GetPlayerY() == 23);
  assert(upper.GetPlayerFace() == CHAR_DIR_LEFT);
  return 0;
}
