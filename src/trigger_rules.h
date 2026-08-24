#ifndef TRIGGER_RULES_H
#define TRIGGER_RULES_H

#include "rick_params.h"

#define ACTION_EVENT_ENTERS 0
#define ACTION_EVENT_STAYS  1
#define ACTION_EVENT_EXITS  2
#define ACTION_EVENT_HITS   3

#define ACTION_FACE_ANY   0
#define ACTION_FACE_RIGHT 1
#define ACTION_FACE_LEFT  2

inline bool RectanglesOverlap(int first_x, int first_y,
                              int first_width, int first_height,
                              int second_x, int second_y,
                              int second_width, int second_height) {
  if (first_width <= 0 || first_height <= 0 ||
      second_width <= 0 || second_height <= 0) {
    return false;
  }

  return first_x < second_x + second_width &&
         first_x + first_width > second_x &&
         first_y < second_y + second_height &&
         first_y + first_height > second_y;
}

inline bool DoesTriggerFaceMatch(int expected_face, int player_face) {
  return expected_face == ACTION_FACE_ANY ||
         (expected_face == ACTION_FACE_RIGHT && player_face == CHAR_DIR_RIGHT) ||
         (expected_face == ACTION_FACE_LEFT && player_face == CHAR_DIR_LEFT);
}

inline bool DoesTriggerEventMatch(int event,
                                  bool player_is_in_trigger,
                                  bool player_was_in_trigger,
                                  int player_state,
                                  int previous_player_state) {
  const bool enters = player_is_in_trigger && !player_was_in_trigger;
  const bool stays = player_is_in_trigger && player_was_in_trigger;
  const bool exits = !player_is_in_trigger && player_was_in_trigger;

  if (event == ACTION_EVENT_ENTERS) return enters;
  if (event == ACTION_EVENT_STAYS) return stays;
  if (event == ACTION_EVENT_EXITS) return exits;
  if (event == ACTION_EVENT_HITS) {
    return stays && player_state == CHAR_STATE_HITTING &&
           previous_player_state != CHAR_STATE_HITTING;
  }
  return false;
}

#endif // TRIGGER_RULES_H
