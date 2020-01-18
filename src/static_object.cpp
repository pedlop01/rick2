#include "static_object.h"

StaticObject::StaticObject() {
  obj_type = OBJ_STATIC;
}

StaticObject::StaticObject(int _type_id) {
  type_id = _type_id;
  obj_type = OBJ_STATIC;
}

StaticObject::~StaticObject() {  
}

void StaticObject::Init(const char* _file, int _x, int _y, int _width, int _height, int _anim_step) {
  Object::Init(_file, _x, _y, _width, _height, true, true, OBJ_STATE_MOVING, OBJ_DIR_RIGHT, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  // Advance some animation frames based on _anim_step
  for(int i = 0; i < _anim_step; i++)
    animations[state]->AnimStep();
}

void StaticObject::StaticObjectStep() {
  if (state != OBJ_STATE_DEAD) {
    if (direction == OBJ_DIR_STOP)
      animations[state]->ResetAnim();
    else
      animations[state]->AnimStep();
  }
}