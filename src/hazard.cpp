#include "hazard.h"

Hazard::Hazard() {
  obj_type = OBJ_HAZARD;
  actions.clear();
  current_action = actions.begin();  // REVISIT
  current_desp = 0;
  current_wait_time = 0;
  always_trigger = true;
  trigger = true;
  completed_trigger = true;
  cond_actions = false;
}

Hazard::Hazard(const char* file,
               int _id,
               int _x,
               int _y,
               int _width,
               int _height,
               bool _trigger,
               bool _stop_inactive) : 
  Object(_x, _y, _width, _height, true, true) {
  obj_type = OBJ_HAZARD;

  hazard_id = _id;
  ini_x = _x;
  ini_y = _y;
  always_trigger = _trigger;
  trigger = always_trigger;
  completed_trigger = true;
  stop_inactive = _stop_inactive;
  current_action = actions.begin();  // REVISIT
  current_desp = 0;
  current_wait_time = 0;
  cond_actions = false;

  // Initialize animations from parent class
  // Speeds and direction are not really relevant for initialization  
  Object::Init(file, _x, _y, _width, _height, true, true, OBJ_STATE_STOP, OBJ_DIR_STOP, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0);
}

Hazard::~Hazard() {
  // Remove all created actions
  for(list<Action*>::iterator it = actions.begin(); it != actions.end(); it++) {
    delete *it;
  }
  actions.clear();
}

void Hazard::AddAction(int direction, int desp, int wait, float speed, bool _enabled, int cond) {
  Action* action = new Action(direction, desp, wait, speed, cond);
  action->SetEnabled(_enabled);
  actions.push_back(action);

  // Initialize current_action if first push
  if (actions.size() == 1) {
    current_action = actions.begin();
  }
}

void Hazard::HandleConditionalActions(list<Action*>::iterator& _current_action) {
  if (_current_action == actions.end()) {
    return;
  } else {
    Action* current_action_ptr = *_current_action;
    int condition = current_action_ptr->GetCondition();
    if ((condition == ACTION_COND_ALWAYS) ||
        (cond_actions && (condition == ACTION_COND_TRIG_ON)) ||
        (!cond_actions && (condition == ACTION_COND_TRIG_OFF))) {
      return;
    } else {
      // As in any advance action, need to reset the desp and wait time
      current_desp = 0;
      current_wait_time = 0;
      HandleConditionalActions(++_current_action);
    }
  }
}

void Hazard::ComputeCollisionsPlayer(World* map, Character* player) {
  int col_x;
  int col_y;
  int col_width;
  int col_height;
  bool playerCol;

  if (using_bb) {
    col_x      = x + bb_x;
    col_y      = y + bb_y;
    col_width  = bb_width;
    col_height = bb_height;
  } else {
    col_x      = x;
    col_y      = y;
    col_width  = width;
    col_height = height;
  }

  // Check collisions with player. Player does not collision
  // when DYING or DEAD
  // If hazard is not visible it cannot kill the player
  playerCol = (visible &&

               (player->GetState() != CHAR_STATE_DYING) &&
               (player->GetState() != CHAR_STATE_DEAD)) &&

              // Player within object
              (BoxWithinBox(player->GetPosX() + player->GetBBX(),
                            player->GetPosY() + player->GetBBY(),
                            player->GetBBWidth(),
                            player->GetBBHeight(),
                            col_x,
                            col_y,
                            col_width,
                            col_height) ||

               // Object within player
               BoxWithinBox(col_x,
                            col_y,
                            col_width,
                            col_height,
                            player->GetPosX() + player->GetBBX(),
                            player->GetPosY() + player->GetBBY(),
                            player->GetBBWidth(),
                            player->GetBBHeight()));

  if (playerCol) {    
    player->SetKilled(map);
  }
}

// No use of ObjectStep
void Hazard::HazardStep(World* map, Character* player) {
  bool advance_action = false;
  int  current_speed;

  // If no actions, then return
  if (actions.size() == 0) return;

  if (!always_trigger && completed_trigger && (state == OBJ_STATE_STOP)) {
    visible = !stop_inactive;
    // wait for trigger before moving
    if (trigger) {
      trigger = false;
      state = OBJ_STATE_MOVING;
      current_desp = 0;
      current_wait_time = 0;
      current_action = actions.begin();
      completed_trigger = false;
    } else {
      // No actions for this hazard. However, need to move animation if present        
      animations[state]->AnimStep();
      return;
    }
  }

  // If there are action, check collisions first
  this->ComputeCollisionsPlayer(map, player);

  // If conditional actions is enabled then
  // check the action before executing it
  this->HandleConditionalActions(current_action);

  // Check if we have completed all actions
  if (current_action == actions.end()) {
    if (always_trigger) {
      current_action = actions.begin();
    } else {
      state = OBJ_STATE_STOP;
      trigger = false;
    }
    completed_trigger = true;
    return;
  }

  // Handle current actions
  Action* current_action_ptr = *current_action;
  current_speed = current_action_ptr->GetSpeed();
  //printf("hazard dir=%d, desp=%d, wait=%d\n", current_action_ptr->GetDirection(), current_action_ptr->GetDesp(), current_action_ptr->GetWait());
  switch (current_action_ptr->GetDirection()) {    
    case OBJ_DIR_STOP:
      state = OBJ_STATE_STOP;
      visible = current_action_ptr->GetEnabled();      
      // Active and inactive stop actions enters here
      // only wait time can be used here
      if (current_wait_time >= current_action_ptr->GetWait()) {
        advance_action = true;
        // Also make hazard visible, as any change in action
        // requires it to be updated
        visible = true;
      }
      break;
    case OBJ_DIR_RIGHT:
    case OBJ_DIR_LEFT:      
      state = OBJ_STATE_MOVING;      
      if (current_action_ptr->GetDesp() != 0) {
        if (current_action_ptr->GetDirection() == OBJ_DIR_RIGHT) {
          x += current_speed;
        } else {
          x -= current_speed;
        }
        current_desp += current_speed;
        if (current_desp >= current_action_ptr->GetDesp()) {
          advance_action = true;
        }
      } else {
        if (current_wait_time >= current_action_ptr->GetWait()) {
          advance_action = true;
        }
      }
      break;
    case OBJ_DIR_UP:
    case OBJ_DIR_DOWN:
      state = OBJ_STATE_MOVING;
      if (current_action_ptr->GetDesp() != 0) {
        if (current_action_ptr->GetDirection() == OBJ_DIR_DOWN) {
          y += current_speed;
        } else {
          y -= current_speed;
        }
        current_desp += current_speed;
        if (current_desp >= current_action_ptr->GetDesp()) {          
          advance_action = true;
        }
      } else {        
        if (current_wait_time >= current_action_ptr->GetWait()) {                    
          advance_action = true;
        }
      }
      break;
    default:
      break;
  }

  // Move animations
  animations[state]->AnimStep();

  if (advance_action) {
    current_action++;
    current_desp = 0;
    current_wait_time = 0;
  }

  current_wait_time++;
}