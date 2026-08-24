#include "../src/trigger_rules.h"

#include <cassert>

int main() {
  assert(RectanglesOverlap(10, 10, 20, 20, 15, 15, 5, 5));
  assert(RectanglesOverlap(10, 10, 20, 20, 0, 15, 40, 5));
  assert(RectanglesOverlap(0, 15, 40, 5, 10, 10, 20, 20));
  assert(!RectanglesOverlap(0, 0, 10, 10, 10, 0, 10, 10));
  assert(!RectanglesOverlap(0, 0, 0, 10, 0, 0, 10, 10));

  assert(DoesTriggerFaceMatch(ACTION_FACE_ANY, CHAR_DIR_LEFT));
  assert(DoesTriggerFaceMatch(ACTION_FACE_RIGHT, CHAR_DIR_RIGHT));
  assert(!DoesTriggerFaceMatch(ACTION_FACE_RIGHT, CHAR_DIR_LEFT));

  assert(DoesTriggerEventMatch(ACTION_EVENT_ENTERS, true, false,
                               CHAR_STATE_STOP, CHAR_STATE_STOP));
  assert(DoesTriggerEventMatch(ACTION_EVENT_STAYS, true, true,
                               CHAR_STATE_STOP, CHAR_STATE_STOP));
  assert(DoesTriggerEventMatch(ACTION_EVENT_EXITS, false, true,
                               CHAR_STATE_STOP, CHAR_STATE_STOP));
  assert(DoesTriggerEventMatch(ACTION_EVENT_HITS, true, true,
                               CHAR_STATE_HITTING, CHAR_STATE_STOP));
  assert(!DoesTriggerEventMatch(ACTION_EVENT_HITS, true, true,
                                CHAR_STATE_HITTING, CHAR_STATE_HITTING));
  assert(!DoesTriggerEventMatch(ACTION_EVENT_HITS, true, false,
                                CHAR_STATE_HITTING, CHAR_STATE_STOP));
  return 0;
}
