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

  Checkpoint point(3, 20, 20, 8, 8, 22, 23, CHAR_DIR_RIGHT, true, true);
  assert(point.PreservePlayerFace());
  assert(point.InCheckpoint(20, 20, 30, 30));
  assert(point.InCheckpoint(27, 27, 1, 1));
  assert(!point.InCheckpoint(19, 20, 30, 30));
  assert(!point.InCheckpoint(28, 20, 1, 1));

  Checkpoint merge(7, 70, 0, 10, 10, 70, 0, CHAR_DIR_RIGHT, false, true);
  Checkpoint branch_a(5, 50, 0, 10, 10, 50, 0, CHAR_DIR_RIGHT, false, true);
  Checkpoint branch_b(6, 60, 0, 10, 10, 60, 0, CHAR_DIR_RIGHT, false, true);
  Checkpoint fork(4, 40, 0, 10, 10, 40, 0, CHAR_DIR_RIGHT, false, true);
  fork.AddNextCheckpoint(&branch_a);
  fork.AddNextCheckpoint(&branch_b);
  branch_a.AddNextCheckpoint(&merge);
  branch_b.AddNextCheckpoint(&merge);
  Checkpoint* current = &fork;
  assert(AdvanceCheckpoint(current, 70, 0, 1, 1) == current);
  current = AdvanceCheckpoint(current, 60, 0, 1, 1);
  assert(current == &branch_b);
  current = AdvanceCheckpoint(current, 70, 0, 1, 1);
  assert(current == &merge);
  current = &fork;  // A fresh level entry resets eligibility to its initial node.
  assert(AdvanceCheckpoint(current, 50, 0, 1, 1) == &branch_a);
  Checkpoint terminal(10, 1, 1, 1, 1, 1, 1, CHAR_DIR_RIGHT, false, true, false);
  merge.AddNextCheckpoint(&terminal);
  assert(AdvanceCheckpoint(&merge, 1, 1, 1, 1) == &merge);
  return 0;
}
