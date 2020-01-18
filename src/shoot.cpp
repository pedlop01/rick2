#include "shoot.h"
#include "enemy.h"

Shoot::Shoot() {
  obj_type = OBJ_SHOOT;
}

Shoot::Shoot(const char* file,
             int _x,
             int _y,
             int _width,
             int _height,
             int _direction) : 
  Object(_x, _y, _width, _height, true, true) {
  obj_type = OBJ_SHOOT;

  // Initialize animations from parent class
  Object::Init(file, _x, _y, _width, _height, true, true, OBJ_STATE_MOVING, _direction, 4.0, 4.0, 4.0, 0.0, 0.0, 0.0);
}

Shoot::~Shoot() {

}

void Shoot::UpdateFSMState(World* map) {
  bool inCol;
  bool blockCollision;
  Animation* current_anim;

  inCol = (extColExt.GetLeftUpCol() == TILE_COL)   ||
          (extColExt.GetRightUpCol() == TILE_COL)  ||
          (extColExt.GetLeftDownCol() == TILE_COL) ||
          (extColExt.GetRightDownCol() == TILE_COL);

  ComputeCollisionBlocks(map);
  ComputeCollisionObjects(map);
  blockCollision = blockColDown ||
                   blockColUp   ||
                   blockColLeft ||
                   blockColRight;

  switch(state) {
    case OBJ_STATE_STOP:
      // REVISIT: Implement trigger actions here
      state = OBJ_STATE_MOVING;
      break;

    case OBJ_STATE_MOVING:

      if (inCol || blockCollision || itemCol || enemyCol) {
        state = OBJ_STATE_DEAD;
        if (itemCol) {
          itemColPtr->SetKilled();
        } else if (enemyCol) {
          enemyPtr->SetKilled();
        }
      }

      break;

    default:
      break;
  }
}