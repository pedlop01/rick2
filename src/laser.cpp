#include "laser.h"
#include "character.h"
#include "enemy.h"

Laser::Laser() {
  obj_type = OBJ_LASER;
}

Laser::Laser(const char* file,
             int _id,
             int _x,
             int _y,
             int _bb_x,
             int _bb_y,
             int _bb_width,
             int _bb_height,
             int _type,
             bool _onehot,
             float _speed,
             int _direction,
             int _default_trigger) : 
  Object(_x, _y, 0, 0, true, true) {
  obj_type = OBJ_LASER;
  obj_id = _id;

  start_x = x;
  start_y = y;
  laser_type = _type;
  onehot = _onehot;  
  already_triggered = false;
  default_trigger = _default_trigger;
  initial_trigger = _default_trigger;
  trigger = default_trigger;

  // Initialize animations from parent class
  Object::Init(file, _x, _y, 0, 0, true, true, OBJ_STATE_STOP, _direction, _speed, _speed, _speed, _speed, _speed, _speed);
  SetBoundingBox(_bb_x, _bb_y, _bb_width, _bb_height);

  // Need to recompute direction
  switch(laser_type) {
    case LASER_TYPE_HORIZONTAL:
      // direction already correctly set
      break;
    case LASER_TYPE_VERTICAL:
      // REVISIT: currently, only vertical down are supported
      direction = OBJ_DIR_DOWN;
      break;
    case LASER_TYPE_DIAGONAL:
      // Need to add the direction down
      direction |= OBJ_DIR_DOWN;
      break;
    default:
      break;
  }

}

Laser::~Laser() {

}

void Laser::Reset() {
  Object::Reset();
  visible = false;
  trigger = false;
  already_triggered = false;
  default_trigger = initial_trigger;
  trigger = default_trigger;  
  state = OBJ_STATE_STOP;

  // Need to recompute direction
  switch(laser_type) {
    case LASER_TYPE_HORIZONTAL:
      // direction already correctly set
      break;
    case LASER_TYPE_VERTICAL:
      // REVISIT: currently, only vertical down are supported
      direction = OBJ_DIR_DOWN;
      break;
    case LASER_TYPE_DIAGONAL:
      // Need to add the direction down
      direction |= OBJ_DIR_DOWN;
      break;
    default:
      break;
  }
}

void Laser::UpdateFSMState(World* map) {
  bool inCol;
  bool rightCol;
  bool leftCol;
  bool upCol;
  bool downCol;
  Animation* current_anim;

  // If there is a collision with player, then
  // kill player and allow world to make
  // reset to objects
  if (visible && playerCol) {
    playerPtr->SetKilled(map);
    return;
  }

  this->ComputeCollisionObjects(map);

  if (visible && enemyCol) {
    enemyPtr->SetKilled();
  }

  upCol    = ((extColExt.GetLeftUpCol() != 0) ||
              (extColExt.GetRightUpCol() != 0));

  downCol  = ((extColExt.GetLeftDownCol() != 0) ||
              (extColExt.GetRightDownCol() != 0));

  rightCol = ((extColExt.GetRightUpCol() != 0) ||
              (extColExt.GetRightDownCol() != 0));

  leftCol  = ((extColExt.GetLeftUpCol() != 0) ||
              (extColExt.GetLeftDownCol() != 0));

  inCol = rightCol ||
          leftCol  ||
          upCol    ||
          downCol;  

  switch(state) {
    case OBJ_STATE_STOP:
      visible = false;
      if (trigger || (!onehot && already_triggered)) {
        state = OBJ_STATE_MOVING;
        trigger = false;
        visible = true;
        already_triggered = true;
      }
      break;

    case OBJ_STATE_MOVING:
      if (inCol) {
        state = OBJ_STATE_DYING;
      }

      break;
    case OBJ_STATE_DYING:
      // wait until animation completes
      current_anim = this->GetCurrentAnimation();
      if (current_anim->CompletedLastAnim()) {        
        // Re-launch trigger if by default is always enabled        
        state = OBJ_STATE_STOP;
        trigger = default_trigger;
        x = start_x;
        y = start_y;
        visible = false;
      }      
      break;

    default:
      break;
  }
}