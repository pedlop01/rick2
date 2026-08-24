#include "checkpoint.h"
#include "trigger_rules.h"

Checkpoint::Checkpoint(
  int _chk_id,
  int _chk_x, int _chk_y, int _chk_width, int _chk_height,
  int _player_x, int _player_y, int _player_face) {

  chk_id      = _chk_id;
  chk_x       = _chk_x;
  chk_y       = _chk_y;
  chk_width   = _chk_width;
  chk_height  = _chk_height;
  player_x    = _player_x;
  player_y    = _player_y;
  player_face = _player_face;
}

Checkpoint::~Checkpoint() {

}

void Checkpoint::AddNextCheckpoint(Checkpoint* next_checkpoint) {
  next_checkpoints.push_back(next_checkpoint);
}

bool Checkpoint::InCheckpoint(int x, int y, int width, int height) {
  return RectanglesOverlap(x, y, width, height,
                           chk_x, chk_y, chk_width, chk_height);
}
