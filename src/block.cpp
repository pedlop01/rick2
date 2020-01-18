#include "block.h"

Block::Block() {
  exploits = false;
  trigger = false;
  obj_type = OBJ_BLOCK;
}

Block::Block(int _type_id) {
  type_id = _type_id;
  exploits = false;
  trigger = false;
  obj_type = OBJ_BLOCK;
}

Block::~Block() {  
}

void Block::Init(const char* _file, int _x, int _y, int _width, int _height, bool _exploits) {
  exploits = _exploits;
  Object::Init(_file, _x, _y, _width, _height, true, true, OBJ_STATE_STOP, OBJ_DIR_STOP, 10.0, 10.0, 10.0, 0.0, 0.0, 0.0);
}

void Block::UpdateFSMState(World* map) {
  Animation* current_anim;

  switch(state) {
    case OBJ_STATE_STOP:    
      // REVISIT: need to add here a condition about
      // collisions with bombs when bombs are implemented.
      if (trigger) {
        if (exploits) {
          state = OBJ_STATE_DYING;
        } else {
          state = OBJ_STATE_MOVING;
          start_x = x;
        }
        // Add a direction to make the animation to advance even when the block
        // does not move in the screen
        direction = OBJ_DIR_LEFT;
      }

      break;
    case OBJ_STATE_MOVING:
      // If block is far from the camera size then it can be completely destroyed
      if (abs(start_x - x) >= CAMERA_X)
        state = OBJ_STATE_DEAD;
      break;
    case OBJ_STATE_DYING:
      // wait until animation completes
      current_anim = this->GetCurrentAnimation();
      if (current_anim->CompletedLastAnim()) {
        state = OBJ_STATE_DEAD;
      }      
      break;

    default:
      break;
  }
}

void Block::ComputeCollisions(World* map, Character* player) {
  // No collisions for blocks here
  // REVISIT: should we implement collisions with player and other world objects here?
  //printf("[Block] ComputeCollisions\n");
}

void Block::ComputeNextPosition(World* map) {
  //printf("[BLOCK] ComputeNextPosition x = %d, y = %d\n", GetX(), GetY());

  switch(state) {
    case OBJ_STATE_STOP:
      break;

    case OBJ_STATE_MOVING:
      if (direction & OBJ_DIR_RIGHT)
        x += speed_x;
      else if (direction & OBJ_DIR_LEFT)
        x -= speed_x;

      break;

    default:
      break;
  }
}