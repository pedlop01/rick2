#include "platform.h"

Platform::Platform() {
  obj_type = OBJ_PLATFORM;
  actions.clear();
  current_action = actions.begin();  // REVISIT
  current_desp = 0;
  current_wait_time = 0;
  cond_actions = false;
}

Platform::Platform(const char* file,
                   int _id,
                   int _ini_state,
                   int _x,
                   int _y,
                   int _width,
                   int _height,
                   bool _visible,
                   bool _recursive,
                   bool _one_use) : 
  Object(_x, _y, _width, _height, _visible, true) {
  obj_type = OBJ_PLATFORM;

  platform_id = _id;
  ini_state = _ini_state;
  ini_x = _x;
  ini_y = _y;
  recursive = _recursive;
  one_use = _one_use;
  current_action = actions.begin();  // REVISIT
  current_desp = 0;
  current_wait_time = 0;
  // Trigger is false by default. Platforms moving without trigger
  // go directly to state MOVING, so no need to use trigger
  trigger = false;
  cond_actions = false;

  // Initialize animations from parent class
  // Speeds and direction are not really relevant for initialization  
  Object::Init(file, _x, _y, _width, _height, _visible, true, _ini_state, OBJ_DIR_STOP, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0);
}

Platform::~Platform() {
  // Remove all created actions
  for(list<Action*>::iterator it = actions.begin(); it != actions.end(); it++) {
    delete *it;
  }
  actions.clear();
}

void Platform::AddAction(int direction, int desp, int wait, float speed, int cond) {
  Action* action = new Action(direction, desp, wait, speed, cond);
  actions.push_back(action);

  // Initialize current_action if first push
  if (actions.size() == 1) {
    current_action = actions.begin();
  }
}

int Platform::GetDirection() {
  if ((actions.size() == 0) ||
      (current_action == actions.end()) ||
      (state == OBJ_STATE_STOP)) {
    return OBJ_DIR_STOP;
  }

  return (*current_action)->GetDirection();
}

float Platform::GetSpeed() {
  if ((actions.size() == 0) ||
      (current_action == actions.end()) ||
      (state == OBJ_STATE_STOP)) {
    return 0.0;
  }

  return (*current_action)->GetSpeed();
}

// REVISIT: same function than in Hazard. Maybe we can unify this code
void Platform::HandleConditionalActions(list<Action*>::iterator& _current_action) {
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

// No use of ObjectStep
void Platform::PlatformStep() {
  bool advance_action = false;
  int  current_speed;

  // If no actions, then return
  if (actions.size() == 0) return;

  if (state == OBJ_STATE_STOP) {
    // wait for trigger before moving
    if (trigger) {
      trigger = false;
      state = OBJ_STATE_MOVING;      
      current_desp = 0;
      current_wait_time = 0;
      current_action = actions.begin();
    } else {
      // No actions for this platform yet      
      return;
    }
  }

  // If conditional actions is enabled then
  // check the action before executing it
  this->HandleConditionalActions(current_action);

  // Check if we have completed all actions
  if (current_action == actions.end()) {
    if (one_use) {
      // Object still is present but can not be used
      return;
    } else if (recursive) {
      current_action = actions.begin();
    } else {      
      state = OBJ_STATE_STOP;
      // Make sure trigger is cleared when sequence is completed.
      trigger = false;
      return;
    }
  }

  // Handle current actions
  Action* current_action_ptr = *current_action;
  current_speed = current_action_ptr->GetSpeed();
  //printf("platform dir=%d, desp=%d, wait=%d cond=%d desp=%d wait_time=%d\n",
  //  current_action_ptr->GetDirection(),
  //  current_action_ptr->GetDesp(),
  //  current_action_ptr->GetWait(),
  //  current_action_ptr->GetCondition(),
  //  current_desp,
  //  current_wait_time);

  switch (current_action_ptr->GetDirection()) {    
    case OBJ_DIR_STOP:
      // only wait time can be used here
      if (current_wait_time >= current_action_ptr->GetWait()) {
        advance_action = true;
      }
      break;
    case OBJ_DIR_RIGHT:
    case OBJ_DIR_LEFT:
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

  if (advance_action) {
    current_action++;
    current_desp = 0;
    current_wait_time = 0;
  }

  current_wait_time++;
}