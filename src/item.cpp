#include "item.h"
#include "game_time.h"
#include "vertical_collision_rules.h"
#include "json_level_loader.h"

Item::Item() {
  steps_dying = 0;
  obj_type = OBJ_ITEM;
  affected_by_gravity = true;
  gameplay_program = NULL;
}

Item::Item(int _type_id) {
  type_id = _type_id;
  steps_dying = 0;
  obj_type = OBJ_ITEM;  
  affected_by_gravity = true;
  gameplay_program = NULL;
}

Item::~Item() {
  printf("Calling destructor!\n");
}

void Item::ConfigureCollection(GameplayProgram* program, const nlohmann::json& actions) {
  gameplay_program = program;
  on_collect = actions;
  if (gameplay_program && !on_collect.empty())
    gameplay_program->ValidateTrigger({{"actions", on_collect}});
}

void Item::UpdateFSMState(World* map) {
  bool inAir;
  Animation* current_anim;

  inAir = IsBodyUnsupported(extColExt.GetLeftDownCol(),
                            extColExt.GetRightDownCol());

  switch(state) {
    case OBJ_STATE_STOP:
    case OBJ_STATE_MOVING:

      if (playerCol) {
        if (gameplay_program)
          for (nlohmann::json::const_iterator action = on_collect.begin(); action != on_collect.end(); ++action)
            gameplay_program->Execute(*action);
        if(strcmp(name, "bonus") != 0) {
          state = OBJ_STATE_DEAD;
          const int slot = GetRuntimeAudioBindings().item_pickup;
          if (slot >= 0) sound_handler->PlaySound(slot, false);
        } else {
          state = OBJ_STATE_DYING;
          const int slot = GetRuntimeAudioBindings().bonus_pickup;
          if (slot >= 0) sound_handler->PlaySound(slot, false);
        }
      } else if (killed) {
        if(strcmp(name, "bonus") != 0) {
          state = OBJ_STATE_DYING;
          direction = OBJ_DIR_STOP;
          const int slot = GetRuntimeAudioBindings().explosion;
          if (slot >= 0) sound_handler->PlaySound(slot, false);
        } else {
          state = OBJ_STATE_DEAD;
        }
      } else if (affected_by_gravity && inAir) {
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
        if (steps_dying >= GameTime::BONUS_DISAPPEAR_DURATION_TICKS) {
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
