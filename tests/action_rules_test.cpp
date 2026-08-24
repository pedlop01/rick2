#include "../src/action_rules.h"

#include <cassert>

int main() {
  assert(ActionMovementForTick(64, 0, 4) == 4);
  assert(ActionMovementForTick(64, 60, 4) == 4);
  assert(ActionMovementForTick(64, 64, 4) == 0);

  // Level 1 uses 728 px at 6 px/tick: the final tick must move only 2 px.
  assert(ActionMovementForTick(728, 720, 6) == 6);
  assert(ActionMovementForTick(728, 726, 6) == 2);
  assert(ActionMovementForTick(728, 728, 6) == 0);

  assert(IsActionWaitComplete(0, 0));
  assert(!IsActionWaitComplete(19, 20));
  assert(IsActionWaitComplete(20, 20));
  assert(IsActionWaitComplete(0, -1));

  assert(DoesActionConditionMatch(ACTION_COND_ALWAYS, false));
  assert(DoesActionConditionMatch(ACTION_COND_ALWAYS, true));
  assert(DoesActionConditionMatch(ACTION_COND_TRIG_ON, true));
  assert(!DoesActionConditionMatch(ACTION_COND_TRIG_ON, false));
  assert(DoesActionConditionMatch(ACTION_COND_TRIG_OFF, false));
  assert(!DoesActionConditionMatch(ACTION_COND_TRIG_OFF, true));
  return 0;
}
