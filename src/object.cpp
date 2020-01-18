#include "object.h"
#include "world.h"
#include "character.h"
#include "block.h"
#include "platform.h"
#include "enemy.h"

int Object::id = 0;

Action::Action() {

}

Action::~Action() {

}

Action::Action(int _direction, int _desp, int _wait, float _speed, int _cond) {
  direction = _direction;
  desp = _desp;
  wait = _wait;
  speed = _speed;
  enabled = true;
  condition = _cond;
}

Object::Object() {
  x       = 0;
  y       = 0;
  width   = 0;
  height  = 0;
  visible = false;
  active  = true;
  using_bb  = false;
  bb_x      = 0;
  bb_y      = 0;
  bb_width  = 0;
  bb_height = 0;
  playerCol = false;
  blockColRight = false;
  blockColLeft = false;
  blockColUp = false;
  blockColDown = false;    
  inPlatform = false;
  itemCol = false;
  killed = false;
  enemyCol = false;

  steps_in_state = 0;
  steps_in_direction_x = 0;
  steps_in_direction_y = 0;

  state = OBJ_STATE_STOP;
  prev_state = state;

  direction = OBJ_DIR_STOP;
  face = OBJ_DIR_RIGHT;

  obj_type = OBJ_NONE;

  obj_id = id;
  printf("Created object id = %d\n", obj_id);
  id++;

  initial_x = x;
  initial_y = y;
  initial_visible = visible;
  intial_active = active;
  initial_direction = direction;
  initial_speed_x = speed_x;
  initial_speed_y = speed_y;
  initial_state = state;

  speed_x = 0.0;
  speed_y = 0.0;
}

Object::Object(int _x, int _y, int _width, int _height, int _visible, int _active) {
  x       = _x;
  y       = _y;
  width   = _width;
  height  = _height;
  visible = _visible;
  active  = _active;
  using_bb  = false;
  bb_x      = 0;
  bb_y      = 0;
  bb_width  = 0;
  bb_height = 0;
  playerCol = false;
  blockColRight = false;
  blockColLeft = false;
  blockColUp = false;
  blockColDown = false;
  inPlatform = false;
  itemCol = false;
  killed = false;

  steps_in_state = 0;
  steps_in_direction_x = 0;
  steps_in_direction_y = 0;

  state = OBJ_STATE_STOP;
  prev_state = state;

  direction = OBJ_DIR_STOP;
  face = OBJ_DIR_RIGHT;

  obj_type = OBJ_NONE;

  obj_id = id;
  printf("created obj id = %d\n", obj_id);
  id++;

  initial_x = x;
  initial_y = y;
  initial_visible = visible;
  intial_active = active;
  initial_direction = direction;
  initial_speed_x = speed_x;
  initial_speed_y = speed_y;
  initial_state = state;

  speed_x = 0.0;
  speed_y = 0.0;
}

Object::~Object() {
  for(vector<Animation*>::iterator it = animations.begin(); it != animations.end(); it++) {
    delete *it;
  }
  animations.clear();
  printf("Object destructor\n");
}

void Object::Init(const char* file,
                  int _x,
                  int _y,
                  int _width,
                  int _height,
                  bool _visible,
                  bool _active,
                  int _state,
                  int _direction,
                  float _speed_x_step,
                  float _speed_x_max,
                  float _speed_x_min,
                  float _speed_y_step,
                  float _speed_y_max,
                  float _speed_y_min) {
  x       = _x;
  y       = _y;
  width   = _width;
  height  = _height;
  visible = _visible;
  active  = _active;

  steps_in_state = 0;
  steps_in_direction_x = 0;
  steps_in_direction_y = 0;

  state = _state;
  prev_state = state;

  direction = _direction;
  face = OBJ_DIR_RIGHT;

  initial_x = x;
  initial_y = y;
  initial_visible = visible;
  intial_active = active;
  initial_direction = direction;
  initial_state = state;

  this->SetSpeeds(_speed_x_max, _speed_x_min, _speed_x_step,
                  _speed_y_max, _speed_y_min, _speed_y_step);

  // Read animations
  pugi::xml_parse_result result = obj_file.load_file(file);
  if(!result) {
      printf("Error: loading character data from file = %s, description = %s\n", file, result.description());
  }

  printf("- Initializing object:\n");
  // Iterate over states
  int num_anims = 0;  
  sprintf(name, "%s", obj_file.child("object").attribute("name").as_string());
  printf("Object name = %s\n", name);
  for (pugi::xml_node state = obj_file.child("object").child("states").first_child();
       state; state = state.next_sibling()) {
    printf("State name = %s, id = %d\n", state.attribute("name").as_string(), state.attribute("id").as_int());
    // Create state
    pugi::xml_node animation = state.child("animation");
    // Create animation and attach to state
    printf("\tAnimation %d: file = %s, speed = %d\n", num_anims, animation.attribute("bitmap").as_string(), animation.attribute("speed").as_int());
    ALLEGRO_BITMAP* obj_bitmap = al_load_bitmap(animation.attribute("bitmap").as_string());
    if (!obj_bitmap) {
      printf("Error: failed to load animation bitmap\n");
    }
    Animation* obj_anim = new Animation(obj_bitmap, animation.attribute("speed").as_int());
    int num_sprites = 0;
    // Traverse all sprites in the animation
    for (pugi::xml_node sprite = animation.first_child(); sprite; sprite = sprite.next_sibling()) {
      int sprite_x      = sprite.attribute("x").as_int();
      int sprite_y      = sprite.attribute("y").as_int();
      int sprite_width  = sprite.attribute("width").as_int();
      int sprite_height = sprite.attribute("height").as_int();

      printf("\t\tSprite %d: x = %d, y = %d, width = %d, height = %d\n", num_sprites,
                                                                         sprite_x,
                                                                         sprite_y,
                                                                         sprite_width,
                                                                         sprite_height);
      // Set transparent color
      al_convert_mask_to_alpha(obj_bitmap, al_map_rgb(255,0,255));
      ALLEGRO_BITMAP* sprite_bitmap = al_create_sub_bitmap(obj_bitmap, sprite_x, sprite_y, sprite_width, sprite_height);

      obj_anim->AddSprite(sprite_bitmap,
                          sprite_x,
                          sprite_y,
                          sprite_width,
                          sprite_height);

      num_sprites++;
    }
    animations.push_back(obj_anim);
    num_anims++;
  }

}

void Object::Reset() {
  x = initial_x;
  y = initial_y;
  visible = initial_visible;
  active = intial_active;
  direction = initial_direction;
  speed_x = initial_speed_x;
  speed_y = initial_speed_y;
  state = initial_state;
  killed = false;
  state = OBJ_STATE_STOP;
  prev_state = state;
}

void Object::SetX(World* map, int _x) {

  int tile_width  = map->GetTilesetTileWidth();
  int tile_height = map->GetTilesetTileHeight();
  int obj_width   = (using_bb ? this->bb_width : this->width) - 1;
  int obj_height  = (using_bb ? this->bb_height : this->height) - 1;

  // Compute the displacement in x
  int desp_x = (_x > x) ? (_x - x) : (x - _x);

  // Compute x and y corrections to draw world
  int tile_col_x;
  int tile_col_up_y   = (y + bb_y) / tile_height;
  int tile_col_down_y = (y + bb_y + obj_height) / tile_height;
  if ( _x > x) {
    // Collision moving right
    tile_col_x = (x + bb_x + desp_x + obj_width)  / tile_width;
    if ((!map->IsTileCollisionable(tile_col_x, tile_col_up_y)) &&
        (!map->IsTileCollisionableDown(tile_col_x, tile_col_down_y))) {
      // No collision
      x = x + desp_x;
    } else {      
      // Collision. Move to safe position
      int correction = (x + bb_x + desp_x + obj_width) % tile_width;
      x = x + desp_x - correction - 1;
    }
  } else if ((_x > 0) && (_x < x)) {
    // Collision moving left
    tile_col_x = (x + bb_x - desp_x) / tile_width;
    if ((!map->IsTileCollisionable(tile_col_x, tile_col_up_y)) &&
        (!map->IsTileCollisionableDown(tile_col_x, tile_col_down_y))) {
      // No collision
      x = x - desp_x;
    } else {
      // Collision. Move to safe position
      int correction = tile_width - ((x + bb_x - desp_x) % tile_width);
      x = x - desp_x + correction;
    }
  }
}

void Object::SetY(World* map, int _y) {
  int tile_width  = map->GetTilesetTileWidth();
  int tile_height = map->GetTilesetTileHeight();
  int obj_width   = (using_bb ? this->bb_width : this->width) - 1;
  int obj_height  = (using_bb ? this->bb_height : this->height) - 1;  

  // Compute the displacement in x
  int desp_y = (_y > y) ? (_y - y) : (y - _y);

  // Compute x and y corrections to draw world
  int tile_col_y;
  int tile_col_left_x  = (x + bb_x) / tile_width;
  int tile_col_right_x = (x + bb_x + obj_width) / tile_width;
  if (_y > y) {
    // Collision moving down
    tile_col_y = (y + bb_y + desp_y + obj_height)  / tile_height;
    if ((!map->IsTileCollisionableDown(tile_col_left_x, tile_col_y)) &&
        (!map->IsTileCollisionableDown(tile_col_right_x, tile_col_y))) {
      // No collision
      y = y + desp_y;
    } else {
      // Collision. Move to safe position
      int correction = ((y + bb_y + desp_y + obj_height) % tile_height);      
      y = y + desp_y - correction - 1;
    }
  } else if ((_y > 0) && (_y < y)) {
    // Collision moving up
    tile_col_y = (y + bb_y - desp_y) / tile_height;
    if ((!map->IsTileCollisionable(tile_col_left_x, tile_col_y)) &&
        (!map->IsTileCollisionable(tile_col_right_x, tile_col_y))) {
      // No collision      
      y = y - desp_y;      
    } else {
      // Collision. Move to safe position      
      int correction = tile_height - ((y + bb_y - desp_y) % tile_height);      
      y = y + desp_y + correction;      
    }
  }
}

void Object::GetCollisionsByCoords(World* map, Colbox &mask_col, int left_up_x, int left_up_y, int right_down_x, int right_down_y) {
  mask_col.SetLeftUpCol(map->GetTileByCoord(left_up_x, left_up_y)->GetType());
  mask_col.SetRightUpCol(map->GetTileByCoord(right_down_x, left_up_y)->GetType());
  mask_col.SetRightDownCol(map->GetTileByCoord(right_down_x, right_down_y)->GetType());
  mask_col.SetLeftDownCol(map->GetTileByCoord(left_up_x, right_down_y)->GetType());
}

void Object::GetCollisionsExternalBoxExt(World* map, Colbox &mask_col) {
  if (using_bb) {
    this->GetCollisionsByCoords(map,
                                mask_col,
                                x + bb_x - 1,
                                y + bb_y - 1,
                                x + bb_x + bb_width,
                                y + bb_y + bb_height);
  } else {
    this->GetCollisionsByCoords(map,
                                mask_col,
                                x - 1,
                                y - 1,
                                x + width,
                                y + height);
  }
}

void Object::GetCollisionsWidthBoxExt(World* map, Colbox &mask_col) {
  if (using_bb) {
    this->GetCollisionsByCoords(map,
                                mask_col,
                                x + bb_x - 1,
                                y + bb_y,
                                x + bb_x + bb_width,
                                y + bb_y + bb_height - 1);
  } else {
    this->GetCollisionsByCoords(map,
                                mask_col,
                                x - 1,
                                y,
                                x + width,
                                y + height - 1);
  }
}

void Object::GetCollisionsHeightBoxExt(World* map, Colbox &mask_col) {
  if (using_bb) {    
    this->GetCollisionsByCoords(map,
                                mask_col,
                                x + bb_x,
                                y + bb_y - 1,
                                x + bb_x + bb_width - 1,
                                y + bb_y + bb_height);    
  } else {
    this->GetCollisionsByCoords(map,
                                mask_col,
                                x,
                                y - 1,
                                x + width - 1,
                                y + height);
  }
}

void Object::SetBoundingBox(int _bb_x, int _bb_y, int _bb_width, int _bb_height) {
  bb_x      = _bb_x - 1;  // Relative to 0
  bb_y      = _bb_y - 1;  // Relative to 0
  bb_width  = _bb_width;
  bb_height = _bb_height;
  using_bb  = true;
}

void Object::UnsetBoundingBox() {
  using_bb  = true;
  bb_x      = 0;
  bb_y      = 0;
  bb_width  = 0;
  bb_height = 0;
}

bool Object::IsUsingBoundingBox() {
  return using_bb;
}

void Object::ComputeCollisionPlatforms(World* map) {
  int down_left_x;
  int down_right_x;
  int down_y;
  int col_width = (using_bb ? bb_width : width);
  int col_height = (using_bb ? bb_height : height);

  inPlatform = false;

  vector<Platform*> *platforms = map->GetPlatforms();
  for (vector<Platform*>::iterator it = platforms->begin() ; it != platforms->end(); ++it) {
    down_left_x = x + bb_x;
    down_right_x = x + col_width;
    down_y = y + bb_y + col_height + 1;

    Platform* platform = *it;
    if ((down_y >= platform->GetY()) && (down_y <= (platform->GetY() + platform->GetHeight())) &&
      (((down_left_x >= platform->GetX()) && (down_left_x <= (platform->GetX() + platform->GetWidth()))) ||
       ((down_right_x >= platform->GetX()) && (down_right_x <= (platform->GetX() + platform->GetWidth()))))) {
      inPlatform = true;
      inPlatformPtr = platform;
      // Take first platform with collision
      break;
    } else {
      inPlatform = false;
      inPlatformPtr = 0;
    }
  }
}

void Object::ComputeCollisionBlocks(World* map) {
  int col_width  = (using_bb ? bb_width  : width);
  int col_height = (using_bb ? bb_height : height);

  blockColRight = false;
  blockColLeft  = false;
  blockColUp    = false;
  blockColDown  = false;
  blockColPtr   = 0;

  list<Block*> *blocks = map->GetBlocks();
  for (list<Block*>::iterator it = blocks->begin() ; it != blocks->end(); ++it) {
    Block* block = *it;

    if ((block->GetState() == OBJ_STATE_DYING) || (block->GetState() == OBJ_STATE_DEAD)) {
      break;
    }

    if (block->CoordsWithinObject(x + bb_x + col_width, y + bb_y) ||        
        block->CoordsWithinObject(x + bb_x + col_width, y + bb_y + bb_height)) {
      blockColRight = true;
      blockColPtr = block;
      // Take first block with collision
      break;
    } else if (block->CoordsWithinObject(x + bb_x, y + bb_y) ||
               block->CoordsWithinObject(x + bb_x, y + bb_y + bb_height)) {
      blockColLeft = true;
      blockColPtr = block;
      // Take first block with collision
      break;
    } else if (block->CoordsWithinObject(x + bb_x, y + bb_y) ||
               block->CoordsWithinObject(x + bb_x + bb_width, y + bb_y)) {
      blockColUp = true;
      blockColPtr = block;
      // Take first block with collision
      break;
    } else if (block->CoordsWithinObject(x + bb_x, y + bb_y + bb_height) ||
               block->CoordsWithinObject(x + bb_x + bb_width, y + bb_y + bb_height)) {
      blockColDown = true;
      blockColPtr = block;
      // Take first block with collision
      break;
    }
  } 
}

void Object::ComputeCollisionObjects(World* map) {
  int col_width  = (using_bb ? bb_width  : width);
  int col_height = (using_bb ? bb_height : height);
  int col_x      = (using_bb ? x + bb_x : x);
  int col_y      = (using_bb ? y + bb_y : y);

  itemCol = false;
  enemyCol = false;

  // Traverse objects
  list<Object*> *blocks = map->GetObjects();
  for (list<Object*>::iterator it = blocks->begin() ; it != blocks->end(); ++it) {
    Object* object = *it;    

    if ((object->GetType() != OBJ_ITEM)         ||
        (object->GetState() == OBJ_STATE_DYING) ||
        (object->GetState() == OBJ_STATE_DEAD)) {
      break;
    }

    if (object->CoordsWithinObject(x + bb_x + col_width, y + bb_y) ||        
        object->CoordsWithinObject(x + bb_x + col_width, y + bb_y + bb_height)) {
      itemCol = true;
      itemColPtr = object;
      // Take first object with collision
      break;
    } else if (object->CoordsWithinObject(x + bb_x, y + bb_y) ||
               object->CoordsWithinObject(x + bb_x, y + bb_y + bb_height)) {
      itemCol = true;
      itemColPtr = object;
      // Take first object with collision
      break;
    } else if (object->CoordsWithinObject(x + bb_x, y + bb_y) ||
               object->CoordsWithinObject(x + bb_x + bb_width, y + bb_y)) {
      itemCol = true;
      itemColPtr = object;
      // Take first object with collision
      break;
    } else if (object->CoordsWithinObject(x + bb_x, y + bb_y + bb_height) ||
               object->CoordsWithinObject(x + bb_x + bb_width, y + bb_y + bb_height)) {
      itemCol = true;
      itemColPtr = object;
      // Take first object with collision
      break;
    }
  }

  // Traverse enemies
  vector<Character*>* enemies = map->GetEnemies();
  for (vector<Character*>::iterator it = enemies->begin(); it != enemies->end(); it++) {
    Enemy* enemy = (Enemy*)*it;
    if ((enemy->GetState() == CHAR_STATE_DYING) ||
        (enemy->GetState() == CHAR_STATE_DEAD)) {
      continue;
    }


    enemyCol = // Player within object
                (BoxWithinBox(enemy->GetPosX() + enemy->GetBBX(),
                              enemy->GetPosY() + enemy->GetBBY(),
                              enemy->GetBBWidth(),
                              enemy->GetBBHeight(),
                              col_x,
                              col_y,
                              col_width,
                              col_height) ||

                 // Object within player
                 BoxWithinBox(col_x,
                              col_y,
                              col_width,
                              col_height,
                              enemy->GetPosX() + enemy->GetBBX(),
                              enemy->GetPosY() + enemy->GetBBY(),
                              enemy->GetBBWidth(),
                              enemy->GetBBHeight()));

    if (enemyCol) {
      enemyPtr = enemy;
      break;
    }

  }
}

bool Object::BoxWithinBox(int a_x, int a_y, int a_width, int a_height,
                          int b_x, int b_y, int b_width, int b_height) {

  bool inside = ((a_x >= b_x) &&
                 (a_x <= (b_x + b_width)) &&
                 (a_y >= b_y) &&
                 (a_y <= (b_y + b_height))) ||

                (((a_x + a_width) >= b_x) &&
                 ((a_x + a_width) <= (b_x + b_width)) &&
                 (a_y >= b_y) &&
                 (a_y <= (b_y + b_height))) ||

                ((a_x >= b_x) &&
                 (a_x <= (b_x + b_width)) &&
                 ((a_y + a_height) >= b_y) &&
                 ((a_y + a_height) <= (b_y + b_height))) ||

                (((a_x + a_width) >= b_x) &&
                 ((a_x + a_width) <= (b_x + b_width)) &&
                 ((a_y + a_height) >= b_y) &&
                 ((a_y + a_height) <= (b_y + b_height)));

  return inside;
}

void Object::ComputeCollisions(World* map, Character* player) {
  int col_x;
  int col_y;
  int col_width;
  int col_height;

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

  // Check collisions with world
  this->GetCollisionsExternalBoxExt(map, extColExt);
  this->GetCollisionsWidthBoxExt(map, widthColExt);
  this->GetCollisionsHeightBoxExt(map, heightColExt);

  // Check collisions with player. Player does not collision
  // when DYING or DEAD
  playerCol = ((player->GetState() != CHAR_STATE_DYING) &&
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
    //printf("Player colliding with obj = %d\n", obj_id);
    playerPtr = player; // There is only one player at the moment.
  }

}

void Object::UpdateFSMState(World* map) {
  bool inAir;

  inAir = ((extColExt.GetLeftDownCol() == 0) &&
           (extColExt.GetRightDownCol() == 0));

  switch(state) {
    case OBJ_STATE_STOP:
    case OBJ_STATE_MOVING:

      if (inAir) {
        state = OBJ_STATE_MOVING;
        direction = OBJ_DIR_DOWN;
      } else {
        state = OBJ_STATE_STOP;
        direction = OBJ_DIR_STOP;
      }

      break;

    default:
      break;
  }
}

void Object::ComputeNextState(World* map) {
  //printf("[OBJ] ComputeNextState: state = %d direction  = %d\n", state, direction);

  // Save current state before computing next state
  prev_state = state;
  // Save current direction before computing next state and direction
  prev_direction = direction;

  // Object implements simple states based on world collisions
  // Derivate classes should re-implement this function for more complex behaviour
  this->UpdateFSMState(map);

  // Increment steps in state if no change in state
  if (prev_state == state)
    steps_in_state++;
  else {
    steps_in_state = 0;
    if (state != OBJ_STATE_DEAD)  // Check if there is an animation before resetting
      GetCurrentAnimation()->ResetAnim();
  }

  if ((prev_direction == direction)) { 
    if ((direction == OBJ_DIR_LEFT) || (direction == OBJ_DIR_RIGHT)) {      
      steps_in_direction_x++;
    } else {
      steps_in_direction_y++;
    }
  } else {
    steps_in_direction_x = 0;
    steps_in_direction_y = 0;
  }

  // keep last direction in face
  if (direction & OBJ_DIR_LEFT) {
    face = OBJ_DIR_LEFT ;
  } else if (direction & OBJ_DIR_RIGHT) {
    face = OBJ_DIR_RIGHT;
  }

}

void Object::ComputeNextPosition(World* map) {

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
      else if (direction & OBJ_DIR_LEFT) {
        SetX(map, GetX() - speed_x);
      }

      break;

    default:
      break;
  }
}

void Object::ComputeNextSpeed() {

  switch (state) {
    case OBJ_STATE_STOP:
      speed_x = 0.0;
      speed_y = 0.0;
      break;

    case OBJ_STATE_MOVING:
        if (!steps_in_state) {
          if (direction & OBJ_DIR_UP)
            speed_y = speed_y_max;
          else
            speed_y = speed_y_min;
        } else if ((direction & OBJ_DIR_UP) && (steps_in_direction_y > 0)) {
          if (speed_y > speed_y_min)
            speed_y = speed_y - speed_y_step;
          else
            speed_y = speed_y_min;
        } else if ((direction & OBJ_DIR_DOWN) && (steps_in_direction_y > 0)) {
          if (speed_y < speed_y_max)
            speed_y = speed_y + speed_y_step;
          else
            speed_y = speed_y_max;
        }

        speed_x = speed_x_max;
      break;

    default:
      speed_x = speed_x_max;
      speed_y = speed_y_max;
      break;
  }
}

void Object::ObjectStep(World* map, Character* player) {

//  printf("[Object] ComputeCollisions\n");
  this->ComputeCollisions(map, player);
//  printf("[Object] ComputeNextState\n");
  this->ComputeNextState(map);
//  printf("[Object] ComputeNextPosition\n");
  this->ComputeNextPosition(map);
//  printf("[Object] ComputeNextSpeed\n");
  this->ComputeNextSpeed();
  // If non-dead object then handle updates on animations.
  // This is used in some objects to control how long an animation
  // takes. For instance, an object dying like a laser, should
  // wait until the animation completes to transition to the next state.
//  printf("[Object] ComputeAnimationStep\n");
  if (state != OBJ_STATE_DEAD) {
    if ((prev_direction != direction) && (direction == OBJ_DIR_STOP) && (obj_type != OBJ_BOMB))  // BOMBs are an exception!
      animations[state]->ResetAnim();
    else
      animations[state]->AnimStep();
  }
}

Animation* Object::GetCurrentAnimation() {
  return animations[state];
}

ALLEGRO_BITMAP* Object::GetCurrentAnimationBitmap() {
  sprite_ptr sprite = &(*animations[state]->sprites[animations[state]->GetCurrentAnim()]);
  return sprite->GetBitmap();
}

int Object::GetCurrentAnimationBitmapAttributes() {
  if (face == OBJ_DIR_LEFT) {
    return ALLEGRO_FLIP_HORIZONTAL;
  }
  return 0;
}

bool Object::CoordsWithinObject(int _x, int _y) {
  if (using_bb) {
    return ((_x >= (x + bb_x)) && (_x <= (x + bb_x + bb_width)) &&
            (_y >= (y + bb_y)) && (_y <= (y + bb_y + bb_height)));
  } else {
    return ((_x >= x) && (_x <= x + width) &&
            (_y >= y) && (_y <= y + height));
  }
}
