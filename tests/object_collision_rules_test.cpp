#include "../src/object_collision_rules.h"

#include <cassert>

int main() {
  assert(IsBlockCollisionCandidate(OBJ_STATE_STOP));
  assert(IsBlockCollisionCandidate(OBJ_STATE_MOVING));
  assert(!IsBlockCollisionCandidate(OBJ_STATE_DYING));
  assert(!IsBlockCollisionCandidate(OBJ_STATE_DEAD));

  assert(IsItemCollisionCandidate(OBJ_ITEM, OBJ_STATE_STOP));
  assert(IsItemCollisionCandidate(OBJ_ITEM, OBJ_STATE_MOVING));
  assert(!IsItemCollisionCandidate(OBJ_HAZARD, OBJ_STATE_STOP));
  assert(!IsItemCollisionCandidate(OBJ_ITEM, OBJ_STATE_DYING));
  assert(!IsItemCollisionCandidate(OBJ_ITEM, OBJ_STATE_DEAD));

  assert(CollisionRangesOverlap(10, 8, 17, 4));
  assert(!CollisionRangesOverlap(10, 8, 18, 4));

  // A body penetrating a block by a small fall step still lands on top.
  assert(IsLandingOnBlock(10, 8, 8, 13, 12, 20, 16, 8));
  assert(IsLandingOnBlock(10, 7, 8, 13, 12, 20, 16, 8));
  assert(!IsLandingOnBlock(2, 8, 8, 13, 12, 20, 16, 8));
  assert(!IsLandingOnBlock(10, 21, 8, 13, 12, 20, 16, 8));
  return 0;
}
