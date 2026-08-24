#include "bomb.h"
#include "block.h"
#include "character.h"
#include "enemy.h"
#include "vertical_collision_rules.h"

Bomb::Bomb() {
  obj_type = OBJ_BOMB;
  contact_block = 0;
}

Bomb::Bomb(const char* file,
             int _x,
             int _y,
             int _width,
             int _height,
             int _direction) : 
  Object(_x, _y, _width, _height, true, true) {
  obj_type = OBJ_BOMB;
  contact_block = 0;

  // Initialize animations from parent class
  Object::Init(file, _x, _y, _width, _height, true, true, OBJ_STATE_MOVING, _direction, 1.0, 1.0, 1.0, 0.4, 5.0, 1.0);
}

Bomb::~Bomb() {

}

void Bomb::UpdateFSMState(World* map) {
  bool inAir;
  bool blockCollision;
  Animation* current_anim;

  inAir = !inPlatform &&
          IsBodyUnsupported(heightColExt.GetLeftDownCol(),
                            heightColExt.GetRightDownCol());

  ComputeCollisionPlatforms(map);
  ComputeCollisionBlocks(map);
  ComputeCollisionObjects(map);
  blockCollision = blockColDown ||
                   blockColUp   ||
                   blockColLeft ||
                   blockColRight;
  if (state == OBJ_STATE_MOVING && blockCollision) {
    contact_block = (Block*)blockColPtr;
  }

  switch(state) {
    case OBJ_STATE_STOP:
      // REVISIT: Implement trigger actions here
      state = OBJ_STATE_MOVING;
      break;

    case OBJ_STATE_MOVING:
      // wait until animation completes
      current_anim = this->GetCurrentAnimation();
      if (current_anim->CompletedLastAnim()) {
        state = OBJ_STATE_DYING;
      }
      
      if (blockCollision) {
        direction = OBJ_DIR_STOP;
      } else if (inAir) {
        direction |= OBJ_DIR_DOWN;
      } else {
        direction &= ~OBJ_DIR_DOWN;
      }
      break;

    case OBJ_STATE_DYING:
      direction = OBJ_DIR_STOP;
      if (contact_block) {
        Block* live_contact = 0;
        list<Block*>* blocks = map->GetBlocks();
        for (list<Block*>::iterator it = blocks->begin(); it != blocks->end(); ++it) {
          if (*it == contact_block) {
            live_contact = *it;
            break;
          }
        }
        if (live_contact) live_contact->SetTriggered(true);
      } else if (blockCollision) {
        ((Block*)blockColPtr)->SetTriggered(true);
      }
      if (playerCol) {
        playerPtr->SetKilled(map);
      }
      if (itemCol) {
        itemColPtr->SetKilled();
      }
      if (enemyCol) {
        enemyPtr->SetKilled();
      }
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

void Bomb::ComputeNextPosition(World* map) {

  if (inPlatform && (state != OBJ_STATE_DYING)) {
    // Correct y to be on top of platform
    SetY(map, GetY() - (GetY() + GetHeight() - inPlatformPtr->GetY()));
    if (((Platform*)inPlatformPtr)->GetDirection() == OBJ_DIR_RIGHT) {
      SetX(map, GetX() + 1);
    } else if (((Platform*)inPlatformPtr)->GetDirection() == OBJ_DIR_LEFT) {
      SetX(map, GetX() - 1);
    }
  }

  Object::ComputeNextPosition(map);
}
