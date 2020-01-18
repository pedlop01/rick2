#include "item.h"

Item::Item() {
  steps_dying = 0;
  obj_type = OBJ_ITEM;
}

Item::Item(int _type_id) {
  type_id = _type_id;
  steps_dying = 0;
  obj_type = OBJ_ITEM;  
}

Item::~Item() {
  printf("Calling destructor!\n");
}

void Item::UpdateFSMState(World* map) {
  bool inAir;
  Animation* current_anim;

  inAir = ((extColExt.GetLeftDownCol() == 0) &&
           (extColExt.GetRightDownCol() == 0));

  switch(state) {
    case OBJ_STATE_STOP:
    case OBJ_STATE_MOVING:

      if (playerCol) {
        if(strcmp(name, "bonus") != 0) {
          state = OBJ_STATE_DEAD;
          sound_handler->PlaySound(FX_RING, false);
        } else {
          state = OBJ_STATE_DYING;
          sound_handler->PlaySound(FX_BONUS, false);
        }
      } else if (killed) {
        if(strcmp(name, "bonus") != 0) {
          state = OBJ_STATE_DYING;
          direction = OBJ_DIR_STOP;
          sound_handler->PlaySound(FX_EXPLOSION, false);
        } else {
          state = OBJ_STATE_DEAD;
        }
      } else if (inAir) {
        state = OBJ_STATE_MOVING;
        direction = OBJ_DIR_DOWN;
      } else {
        state = OBJ_STATE_STOP;
        direction = OBJ_DIR_STOP;
      }

      break;

    case OBJ_STATE_DYING:
      steps_dying++;
      if(strcmp(name, "bonus") == 0) {
        if (steps_dying >= 30) {   // REVISIT: hard-coded. I do not really know if it is good to have this as a parameter
          state = OBJ_STATE_DEAD;
        }
      } else {
        // wait until animation completes
        current_anim = this->GetCurrentAnimation();
        if (current_anim->CompletedLastAnim()) {
          state = OBJ_STATE_DEAD;
        }
      }
      break;
    default:
      break;
  }
}

void Item::ComputeNextPosition(World* map) {
  //printf("[ITEM] ComputeNextPosition x = %d, y = %d\n", GetX(), GetY());

  switch(state) {
    case OBJ_STATE_STOP:
      break;

    case OBJ_STATE_MOVING:

      if (direction & OBJ_DIR_UP)
        SetY(map, GetY() - speed_y);
      else if (direction & OBJ_DIR_DOWN)
        SetY(map, GetY() + speed_y);

      if (direction & OBJ_DIR_RIGHT)
        SetX(map, GetX() + speed_x);
      else if (direction & OBJ_DIR_LEFT)
        SetX(map, GetX() - speed_x);

      break;
    
    case OBJ_STATE_DYING:
      if(strcmp(name, "bonus") == 0) {
        y -= speed_y;
      }

      break;

    default:
      break;
  }
}

void Item::ObjectStep(World* map, Character* player) {
  // Call parent
  Object::ObjectStep(map, player);
}
