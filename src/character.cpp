#include "character.h" // class's header file
#include "character_collision_rules.h"
#include "vertical_collision_rules.h"
#include "object_collision_rules.h"
#include "animation_rules.h"
#include "death_rules.h"
#include "camera.h"
#include "game_time.h"
#include "player_spawn_rules.h"
#include "tile_edge_collision_rules.h"
#include "slope_collision_rules.h"

// class constructor
Character::Character() {
  pos_x = 0;
  pos_y = 0;

  // Default values that shouldn´t be used
  height = 0;
  width  = 0;
  height_orig = height;
  width_orig = width;

  using_bb = false;  
  bb_x = 0;
  bb_y = 0;
  bb_width = 0;
  bb_width_orig = bb_width;
  bb_height = 0;
  bb_height_orig = bb_height;

  state = CHAR_STATE_STOP;
  direction = CHAR_DIR_STOP;

  speed_x = RICK_HOR_SPEED_MAX;
  speed_y = RICK_VERT_SPEED_MAX;
  speed_x_max = RICK_HOR_SPEED_MAX;
  speed_x_min = RICK_HOR_SPEED_MIN;
  speed_x_step = RICK_HOR_SPEED_STEP;
  speed_y_max = RICK_VERT_SPEED_MAX;
  speed_y_min = RICK_VERT_SPEED_MIN;
  speed_y_step = RICK_VERT_SPEED_STEP;
  climb_speed = RICK_HOR_SPEED_MAX;
  death_speed_multiplier = 2.0;
  jump_height = 40;
  death_rise = 80;
  crouching_height = 15;
  hit_hold_ticks = GameTime::PLAYER_HIT_HOLD_DURATION_TICKS;
  can_jump = true;
  can_crouch = true;
  can_climb = true;
  action_neutral_state = -1;
  action_up_state = CHAR_STATE_SHOOTING;
  action_down_state = CHAR_STATE_BOMBING;
  action_horizontal_state = CHAR_STATE_HITTING;
  damage_enabled = true;
  respawn_from_checkpoint = true;

  stepsInState = 0;
  stepsInDirectionX = 0;
  stepsInDirectionY = 0;

  face = CHAR_DIR_RIGHT;

  inPlatform = false;

  initial_x = pos_x;
  initial_y = pos_y;
  initial_direction = direction;
  initial_speed_x = speed_x;
  initial_speed_y = speed_y;
  initial_state = state;

  animation_scaling_factor = 1.0;
  visual_scale = 1.0;

  killed = false;

  stop_move_block_col = false;

  camera = nullptr;
}

Character::Character(const char* file) {
  // REVISIT: most of this information should be read from the file
  pos_x = 0;
  pos_y = 0;
  height = 0;
  width  = 0;
  using_bb = false;
  bb_x = 0;
  bb_y = 0;
  bb_width = 0;
  bb_width_orig = bb_width;
  bb_height = 0;
  bb_height_orig = bb_height;
  height_orig = height;
  width_orig = width;
  state = CHAR_STATE_STOP;
  direction = CHAR_DIR_STOP;
  speed_x = RICK_HOR_SPEED_MAX;
  speed_y = RICK_VERT_SPEED_MAX;
  speed_x_max = RICK_HOR_SPEED_MAX;
  speed_x_min = RICK_HOR_SPEED_MIN;
  speed_x_step = RICK_HOR_SPEED_STEP;
  speed_y_max = RICK_VERT_SPEED_MAX;
  speed_y_min = RICK_VERT_SPEED_MIN;
  speed_y_step = RICK_VERT_SPEED_STEP;
  climb_speed = RICK_HOR_SPEED_MAX;
  death_speed_multiplier = 2.0;
  jump_height = 40;
  death_rise = 80;
  crouching_height = 15;
  hit_hold_ticks = GameTime::PLAYER_HIT_HOLD_DURATION_TICKS;
  can_jump = true;
  can_crouch = true;
  can_climb = true;
  action_neutral_state = -1;
  action_up_state = CHAR_STATE_SHOOTING;
  action_down_state = CHAR_STATE_BOMBING;
  action_horizontal_state = CHAR_STATE_HITTING;
  damage_enabled = true;
  respawn_from_checkpoint = true;
  stepsInState = 0;
  stepsInDirectionX = 0;
  stepsInDirectionY = 0;
  face = CHAR_DIR_RIGHT;
  inPlatform = false;
  initial_x = pos_x;
  initial_y = pos_y;
  initial_direction = direction;
  initial_speed_x = speed_x;
  initial_speed_y = speed_y;
  initial_state = state;
  animation_scaling_factor = 1.0;
  visual_scale = 1.0;
  killed = false;
  stop_move_block_col = false;
  camera = nullptr;

  // Initialize animations directly from the canonical JSON package.
  const nlohmann::json& definition = GetAnimationDefinition(file);

  printf("- Initializing player:\n");
  // Iterate over states
  int num_anims = 0;
  for (nlohmann::json::const_iterator state = definition.at("states").begin();
       state != definition.at("states").end(); ++state) {
    printf("State name = %s, id = %d\n",
           state->at("name").get<std::string>().c_str(),
           state->at("id").get<int>());
    const nlohmann::json& animation = state->at("animation");
    // Create animation and attach to state
    const std::string bitmap_file = animation.at("bitmap").get<std::string>();
    printf("\tAnimation %d: file = %s, speed = %d\n", num_anims,
           bitmap_file.c_str(), animation.at("frameDurationTicks").get<int>());
    BitmapResource anim_bitmap = ResourceCache::Instance().LoadBitmap(bitmap_file);
    if (!anim_bitmap) {
      throw DataLoadError(std::string("Cannot load animation bitmap '") +
                          bitmap_file +
                          "' referenced by '" + file + "'");
    }
    Animation* player_anim = new Animation(
        anim_bitmap, animation.at("frameDurationTicks").get<unsigned int>(), animation.value("frameDurationMs", 0u));
    int num_sprites = 0;
    // Traverse all sprites in the animation
    for (nlohmann::json::const_iterator sprite = animation.at("sprites").begin();
         sprite != animation.at("sprites").end(); ++sprite) {
      int sprite_x      = sprite->at("x").get<int>();
      int sprite_y      = sprite->at("y").get<int>();
      int sprite_width  = sprite->at("width").get<int>();
      int sprite_height = sprite->at("height").get<int>();

      printf("\t\tSprite %d: x = %d, y = %d, width = %d, height = %d\n", num_sprites,
                                                                         sprite_x,
                                                                         sprite_y,
                                                                         sprite_width,
                                                                         sprite_height);

      BitmapResource sprite_bitmap = ResourceCache::Instance().LoadSubBitmap(
          bitmap_file, anim_bitmap, sprite_x, sprite_y, sprite_width,
          sprite_height);
      if (!sprite_bitmap) {
        throw DataLoadError(std::string("Invalid sprite rectangle in '") +
                            file + "'");
      }
      player_anim->AddSprite(sprite_bitmap,
                             sprite_x,
                             sprite_y,
                             sprite_width,
                             sprite_height);      
      num_sprites++;
    }
    const int state_id = ResolveCharacterAnimationStateId(
        file, state->at("name").get<std::string>(),
        state->at("id").get<int>());
    if (!animations.insert(std::make_pair(state_id, player_anim)).second) {
      delete player_anim;
      throw DataLoadError(std::string("Duplicate animation state id in '") +
                          file + "'");
    }
    num_anims++;
  }
}

// class destructor
Character::~Character() {  
  for(map<int, Animation*>::iterator it = animations.begin(); it != animations.end(); ++it) {
    delete it->second;
  }
}

void Character::Reset() {
  pos_x = initial_x;
  pos_y = initial_y;
  direction = initial_direction;
  speed_x = initial_speed_x;
  speed_y = initial_speed_y;
  state = initial_state;
  face = initial_direction;
  height = height_orig;
  width = width_orig;
  bb_width = bb_width_orig;
  bb_height = bb_height_orig;

  killed = false;
  stepsInState = 0;
  stepsInDirectionX = 0;
  stepsInDirectionY = 0;
  animation_scaling_factor = 1.0;
  inPlatform = false;
  inPlatformPtr = 0;
  blockCollisionLeft = false;
  blockCollisionRight = false;
  blockCollisionPtr = 0;
  stop_move_block_col = false;
  if (combat_state) combat_state->Reset();
}

void Character::SetKilled(World* map) {
  if (type == CHARACTER_PLAYER && !IsDamageEnabled()) return;
  killed = true;
  initial_x         = map->GetCurrentCheckpoint()->GetPlayerX();
  initial_y         = map->GetCurrentCheckpoint()->GetPlayerY();
  initial_direction = RespawnPlayerFace(*map->GetCurrentCheckpoint(), face);
}

int Character::GetCorrectedPosX() {
  if (width == width_orig)
    return pos_x;
  else if (width > width_orig)
    return pos_x + (width - width_orig);
  else
    return pos_x - (width_orig - width);
}

int Character::GetCorrectedPosY() {
  if (height == height_orig)
    return pos_y;
  else if (height > height_orig)
    return pos_y + (height - height_orig);
  else
    return pos_y - (height_orig - height);
}

void Character::SetPosX(World* map, int x) {
  // REVISIT: character is currently a single box, this function requires to be updated
  // when the character will be based on a generic player.
  int tile_width = map->GetTilesetTileWidth();
  int tile_height = map->GetTilesetTileHeight();
  int character_width = (using_bb ? this->bb_width : this->width) - 1;
  int character_height = (using_bb ? this->bb_height : this->height) - 1;

  // Compute the displacement in x
  int desp_x = (x > pos_x) ? (x - pos_x) : (pos_x - x);

  // Compute x and y corrections to draw world
  int tile_col_x;
  int tile_col_top_y = (pos_y + bb_y) / tile_height;
  int tile_col_bottom_y = (pos_y + bb_y + character_height) / tile_height;
  auto edgeBlocked = [&](int column) {
    return IsTileEdgeBlocked(tile_col_top_y, tile_col_bottom_y,
                             [&](int row) { return map->IsTileCollisionable(column, row); });
  };
  if ( x > pos_x) {
    // Collision moving right
    tile_col_x = (pos_x + bb_x + desp_x + character_width)  / tile_width;
    if (!edgeBlocked(tile_col_x)) {
      // No collision
      pos_x = pos_x + desp_x;
    } else {
      // Collision. Move to safe position
      int correction = (pos_x + bb_x + desp_x + character_width) % tile_width;
      pos_x = pos_x + desp_x - correction - 1;
    }
  } else if ((x > 0) && (x < pos_x)) {
    // Collision moving left    
    tile_col_x = (pos_x + bb_x - desp_x) / tile_width;
    if (!edgeBlocked(tile_col_x)) {
      // No collision
      pos_x = pos_x - desp_x;
    } else {
      // Collision. Move to safe position
      int correction = tile_width - ((pos_x + bb_x - desp_x) % tile_width);
      pos_x = pos_x - desp_x + correction;
    }
  }
}

void Character::SetPosY(World* map, int y, bool all) {
  // REVISIT: character is currently a single box, this function requires to be updated
  // when the character will be based on a generic player.
  int tile_width       = map->GetTilesetTileWidth();
  int tile_height      = map->GetTilesetTileHeight();
  int character_width  = (using_bb ? this->bb_width : this->width) - 1;
  int character_height = (using_bb ? this->bb_height : this->height) - 1;

  // Compute the displacement in x
  int desp_y = (y > pos_y) ? (y - pos_y) : (pos_y - y);

  // Compute x and y corrections to draw world
  int tile_col_y;
  int tile_col_left_x = (pos_x + bb_x) / tile_width;
  int tile_col_right_x = (pos_x + bb_x + character_width) / tile_width;
  auto edgeBlocked = [&](int row) {
    return IsTileEdgeBlocked(tile_col_left_x, tile_col_right_x,
                             [&](int column) { return all ? map->IsTileCollisionableDown(column, row)
                                                           : map->IsTileCollisionable(column, row); });
  };
  if (y > pos_y) {
    int slope_y = pos_y;
    if (all && SlopeStandingY(map, pos_x, y, desp_y + 1, &slope_y) &&
        slope_y >= pos_y && slope_y <= y) {
      pos_y = slope_y;
      return;
    }
    // Collision moving down
    tile_col_y = (pos_y + bb_y + desp_y + character_height)  / tile_height;
    // REVISIT: improve coding for "all"
    if (!edgeBlocked(tile_col_y)) {
      // No collision
      pos_y = pos_y + desp_y;
    } else {      
      // Collision. Move to safe position
      pos_y = ResolveDownwardCollisionY(pos_y + desp_y, bb_y,
                                        character_height + 1, tile_height);
    }
  } else if ((y > 0) && (y < pos_y)) {
    // Collision moving up    
    tile_col_y = (pos_y + bb_y - desp_y) / tile_height;
    // REVISIT: improve coding for "all"
    if (!edgeBlocked(tile_col_y)) {
      // No collision
      pos_y = pos_y - desp_y;
    } else {
      // Collision. Move to safe position
      pos_y = ResolveUpwardCollisionY(pos_y - desp_y, bb_y, tile_height);
    }
  }
}

bool Character::ComputeCollisionBlocks(World* map) {
  blockCollisionRight = false;
  blockCollisionLeft = false;
  blockCollisionPtr = 0;

  list<Block*> *blocks = map->GetBlocks();
  for (list<Block*>::iterator it = blocks->begin() ; it != blocks->end(); ++it) {
    Block* block = *it;

    if (!IsBlockCollisionCandidate(block->GetState())) continue;

    if (IsLandingOnBlock(pos_x + bb_x, pos_y + bb_y,
                         bb_width, bb_height,
                         block->GetX(), block->GetY(),
                         block->GetWidth(), block->GetHeight())) {
      pos_y = block->GetY() - bb_y - bb_height;
      inFloor = true;
      inAir = false;
      continue;
    }

    if (block->CoordsWithinObject(pos_x + bb_x + bb_width, pos_y + bb_y) ||
        block->CoordsWithinObject(pos_x + bb_x + bb_width,
                                  pos_y + bb_y + bb_height - 1)) {
      blockCollisionRight = true;
      blockCollisionPtr = block;
      // Take first block with collision
      break;
    } else if (block->CoordsWithinObject(pos_x + bb_x, pos_y + bb_y) ||
               block->CoordsWithinObject(pos_x + bb_x, pos_y + bb_y + bb_height - 1)) {
      blockCollisionLeft = true;
      blockCollisionPtr = block;
      // Take first block with collision
      break;
    }
  }

  return blockCollisionLeft || blockCollisionRight;
}

void Character::GetCollisionsByCoords(World* map, Colbox &mask_col, int left_up_x, int left_up_y, int right_down_x, int right_down_y) {
  mask_col.SetLeftUpCol(map->GetTileByCoord(left_up_x, left_up_y)->GetType());
  mask_col.SetRightUpCol(map->GetTileByCoord(right_down_x, left_up_y)->GetType());
  mask_col.SetRightDownCol(map->GetTileByCoord(right_down_x, right_down_y)->GetType());
  mask_col.SetLeftDownCol(map->GetTileByCoord(left_up_x, right_down_y)->GetType());
}

void Character::GetCollisionsExternalBoxExt(World* map, Colbox &mask_col) {
  this->GetCollisionsByCoords(map,
                              mask_col,
                              pos_x - 1,
                              pos_y - 1,
                              pos_x + width,
                              pos_y + height);
}

void Character::GetCollisionsExternalHeightBoxExt(World* map, Colbox &mask_col) {
  this->GetCollisionsByCoords(map,
                              mask_col,
                              pos_x,
                              pos_y - 1,
                              pos_x + width - 1,
                              pos_y + height);
}

// REVISIT: use Bounding Box instead
void Character::GetCollisionsInternalHeightBoxExt(World* map, Colbox &mask_col) {  
  this->GetCollisionsByCoords(map,
                              mask_col,
                              pos_x + bb_x,
                              pos_y + bb_y - 1,
                              pos_x + bb_x + bb_width - 1,
                              pos_y + bb_y + bb_height);
}

void Character::GetCollisionsInternalHeightBoxExtOrig(World* map, Colbox &mask_col) {
  this->GetCollisionsByCoords(map,
                              mask_col,
                              this->GetCorrectedPosX() + bb_x,
                              this->GetCorrectedPosY() + bb_y - 1,
                              this->GetCorrectedPosX() + bb_x + bb_width_orig - 1,
                              this->GetCorrectedPosY() + bb_y + bb_height_orig);
}

void Character::GetCollisionsInternalHeightBoxInt(World* map, Colbox &mask_col) {
  this->GetCollisionsByCoords(map,
                              mask_col,
                              pos_x + bb_x,
                              pos_y + bb_y,
                              pos_x + bb_x + bb_width - 1,
                              pos_y + bb_y + bb_height - 1);
}

void Character::GetCollisionsInternalWeightBoxExt(World* map, Colbox &mask_col) {  
  this->GetCollisionsByCoords(map,
                              mask_col,
                              pos_x + bb_x - 1,
                              pos_y + bb_y,
                              pos_x + bb_x + bb_width,
                              pos_y + bb_y + bb_height - 1);
}

bool Character::SlopeStandingY(World* map, int at_x, int at_y, int tolerance,
                               int* standing_y, int expected_tile) const {
  const int tile_width = map->GetTilesetTileWidth();
  const int tile_height = map->GetTilesetTileHeight();
  if (tile_width <= 1 || tile_height <= 0 || bb_width <= 0 || bb_height <= 0)
    return false;
  const int feet_x[] = {at_x + bb_x, at_x + bb_x + bb_width - 1};
  const int bottom = at_y + bb_y + bb_height;
  bool found = false;
  int closest = 0;
  for (int side = 0; side < 2; ++side) {
    const int column = feet_x[side] / tile_width;
    const int rows[] = {bottom / tile_height, (bottom - 1) / tile_height,
                        (bottom + tolerance) / tile_height};
    for (unsigned int index = 0; index < sizeof(rows) / sizeof(rows[0]); ++index) {
      if (column < 0 || column >= map->GetMapWidth() || rows[index] < 0 ||
          rows[index] >= map->GetMapHeight()) continue;
      const int tile = map->GetTile(column, rows[index])->GetType();
      if ((side == 0 && tile != TILE_SLOPE_LEFT) ||
          (side == 1 && tile != TILE_SLOPE_RIGHT) ||
          (expected_tile && tile != expected_tile)) continue;
      int candidate = at_y;
      if (!SlopeStandingPositionY(tile, column * tile_width,
                                  rows[index] * tile_height,
                                  tile_width, tile_height, feet_x[side], at_y,
                                  bb_y, bb_height, tolerance, &candidate)) continue;
      if (!found || abs(candidate - at_y) < abs(closest - at_y)) {
        closest = candidate;
        found = true;
      }
    }
  }
  if (found && standing_y) *standing_y = closest;
  return found;
}

bool Character::SnapToSlope(World* map, int tolerance) {
  int standing_y = pos_y;
  if (!SlopeStandingY(map, pos_x, pos_y, tolerance, &standing_y)) return false;
  pos_y = standing_y;
  return true;
}

void Character::ComputeCollisions(World* map) {
  int down_left_x;
  int down_right_x;
  int down_y;

  //printf("[ComputeCollisions] state = %d\n", state);

  // Do not check collisions when DYING
  if ((state == CHAR_STATE_DYING) || (state == CHAR_STATE_DEAD)) return;
  
  this->GetCollisionsExternalBoxExt(map, extColExt);
  this->GetCollisionsExternalHeightBoxExt(map, extHeightColExt);
  this->GetCollisionsInternalHeightBoxExtOrig(map, heightColExtOrig);
  this->GetCollisionsInternalHeightBoxInt(map, heightColInt);  
  this->GetCollisionsInternalHeightBoxExt(map, heightColExt);  

  // First check if there is collision with an object over the tiles
  //printf("[ComputeCollisions] Checking collisions with platforms\n");
  vector<Platform*> *platforms = map->GetPlatforms();
  for (vector<Platform*>::iterator it = platforms->begin() ; it != platforms->end(); ++it) {
    down_left_x = pos_x;
    down_right_x = pos_x + width;
    down_y = pos_y + height + 1;

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

  //printf("[ComputeCollisions] Getting simple collisions checks\n");
  // Check if there is a collision with the tiles
  inStairs = IsInsideStairs(heightColInt.GetLeftUpCol(),
                            heightColInt.GetRightUpCol(),
                            heightColInt.GetLeftDownCol(),
                            heightColInt.GetRightDownCol());

  int slope_y = pos_y;
  const bool on_slope = SlopeStandingY(map, pos_x, pos_y, 1, &slope_y);
  const int support_row = (pos_y + bb_y + bb_height) /
                          map->GetTilesetTileHeight();
  const int support_first_column = (pos_x + bb_x) /
                                   map->GetTilesetTileWidth();
  const int support_last_column = (pos_x + bb_x + bb_width - 1) /
                                  map->GetTilesetTileWidth();
  overStairs = IsTileEdgeBlocked(
      support_first_column, support_last_column,
      [&](int column) {
        return map->GetTile(column, support_row)->GetType() == TILE_STAIRS_TOP;
      });
  const bool supported_by_tile = IsTileEdgeBlocked(
      support_first_column, support_last_column,
      [&](int column) { return map->IsTileCollisionableDown(column, support_row); });
  inFloor = inPlatform || on_slope || supported_by_tile;

  inAir = !inPlatform && !on_slope && !supported_by_tile;

  inAirInt = ((heightColInt.GetLeftDownCol() == 0) &&
              (heightColInt.GetRightDownCol() == 0));

  // - Collision with head on collisionable tile
  collisionHead = (heightColExt.GetLeftUpCol() == TILE_COL) ||
                  (heightColExt.GetRightUpCol() == TILE_COL);

  collisionHeadOrig = (heightColExtOrig.GetLeftUpCol() == TILE_COL) ||
                      (heightColExtOrig.GetRightUpCol() == TILE_COL);

  overStairsRight = (extColExt.GetLeftDownCol() == TILE_COL) &&
                    (heightColExt.GetLeftDownCol() == TILE_COL) &&
                    (heightColExt.GetRightDownCol() == TILE_STAIRS_TOP);                    

  overStairsLeft = (extColExt.GetRightDownCol() == TILE_COL) &&
                   (heightColExt.GetRightDownCol() == TILE_COL) &&
                   (heightColExt.GetLeftDownCol() == TILE_STAIRS_TOP);
}

// Helper function to reset direction based on keyboard
void Character::FixHorizontalDirection(Keyboard& keyboard) {
  if (keyboard.PressedRight()) {
    direction |= CHAR_DIR_RIGHT;
    direction &= ~CHAR_DIR_LEFT;
  } else if (keyboard.PressedLeft()) {
    direction |= CHAR_DIR_LEFT;
    direction &= ~CHAR_DIR_RIGHT;
  } else {
    direction &= ~CHAR_DIR_LEFT;
    direction &= ~CHAR_DIR_RIGHT;
  }
}

int Character::GroundActionState(Keyboard& keyboard) const {
  if (!keyboard.PressedSpace()) return -1;
  if (keyboard.PressedUp()) return action_up_state;
  if (keyboard.PressedDown()) return action_down_state;
  if (keyboard.PressedLeft() || keyboard.PressedRight())
    return action_horizontal_state;
  return action_neutral_state;
}

bool Character::IsActionStatePressed(int action_state,
                                     Keyboard& keyboard) const {
  if (!keyboard.PressedSpace()) return false;
  return (action_up_state == action_state && keyboard.PressedUp()) ||
         (action_down_state == action_state && keyboard.PressedDown()) ||
         (action_horizontal_state == action_state &&
          (keyboard.PressedLeft() || keyboard.PressedRight())) ||
         (action_neutral_state == action_state && !keyboard.PressedUp() &&
          !keyboard.PressedDown() && !keyboard.PressedLeft() &&
          !keyboard.PressedRight());
}

bool Character::AlignToStairs(World* map) {
  const int tile_width = map->GetTilesetTileWidth();
  const int tile_height = map->GetTilesetTileHeight();
  if (tile_width <= 0 || tile_height <= 0 || bb_width <= 0) return false;

  const int collision_x = pos_x + bb_x;
  const int center_x = collision_x + bb_width / 2;
  if (center_x < 0 || center_x >= map->GetMapWidth() * tile_width) return false;

  const int sample_y[] = {
    pos_y + bb_y + bb_height / 2,
    pos_y + bb_y + bb_height - 1,
    pos_y + bb_y + bb_height + 1
  };
  int row = -1;
  int column = -1;
  const int first_body_column = collision_x / tile_width;
  const int last_body_column = (collision_x + bb_width - 1) / tile_width;
  for (unsigned int i = 0; i < sizeof(sample_y) / sizeof(sample_y[0]); ++i) {
    if (sample_y[i] < 0 ||
        sample_y[i] >= map->GetMapHeight() * tile_height) continue;
    const int candidate_row = sample_y[i] / tile_height;
    for (int candidate_column = first_body_column;
         candidate_column <= last_body_column; ++candidate_column) {
      if (candidate_column < 0 || candidate_column >= map->GetMapWidth())
        continue;
      if (IsStairCollisionTile(
              map->GetTile(candidate_column, candidate_row)->GetType())) {
        row = candidate_row;
        column = candidate_column;
        break;
      }
    }
    if (column >= 0) break;
  }
  if (row < 0 || column < 0) return false;

  int left_column = column;
  int right_column = column;
  while (left_column > 0 &&
         IsStairCollisionTile(map->GetTile(left_column - 1, row)->GetType())) {
    --left_column;
  }
  while (right_column + 1 < map->GetMapWidth() &&
         IsStairCollisionTile(map->GetTile(right_column + 1, row)->GetType())) {
    ++right_column;
  }

  const int target_collision_x = StairAlignmentTargetX(
      collision_x, bb_width, tile_width, left_column, right_column);
  if (target_collision_x == collision_x) return false;
  const int previous_x = pos_x;
  SetPosX(map, target_collision_x - bb_x);
  return pos_x != previous_x;
}

void Character::ComputeNextState(World* map, Keyboard& keyboard) {
  bool created = false;
  int prevDirection;
  const int action_state = GroundActionState(keyboard);
  
  // Save current state before computing next state
  prevState = state;
  // Save current direction before computing next state and direction
  prevDirection = direction;

  //printf("Pre: State = %d, direction = %d, face = %d\n", state, direction, face);

  // No matter what is the state update, if rick is being killed, then
  // the kill takes precedence
  if (killed) {
    killed = false;
    state = CHAR_STATE_DYING;
    direction = CHAR_DIR_UP;
    direction |= CHAR_DIR_RIGHT;
    // Save pos y
    pos_y_chk = pos_y;
  } else {    
    switch(state) {
      case CHAR_STATE_STOP:
      case CHAR_STATE_RUNNING:

        if (inAir) {
          state = CHAR_STATE_JUMPING;
          direction = CHAR_DIR_DOWN;
        } else if (action_state >= 0) {
          state = action_state;
          if (keyboard.PressedLeft()) direction = CHAR_DIR_LEFT;
          else if (keyboard.PressedRight()) direction = CHAR_DIR_RIGHT;
          else if (state == CHAR_STATE_HITTING) direction = face;
        } else if (keyboard.PressedUp()) {
          if (can_climb && inStairs) {
            // In stairs
            state = CHAR_STATE_CLIMBING;
            direction = CHAR_DIR_UP;
          } else {
            if (can_jump && !inAir) {
              // Start jump
              state = CHAR_STATE_JUMPING;
              direction = CHAR_DIR_UP;
              // Save pos y
              pos_y_chk = pos_y;
            } else if (can_jump) {
              state = CHAR_STATE_JUMPING;
              direction = CHAR_DIR_DOWN;
            } else {
              state = CHAR_STATE_STOP;
              direction = CHAR_DIR_STOP;
            }
          }
        } else if (keyboard.PressedDown()) {
            if (can_climb && overStairs) {
              state = CHAR_STATE_CLIMBING;
              direction = CHAR_DIR_DOWN;
            } else if (overStairsRight && (face == CHAR_DIR_RIGHT)) {
              state = CHAR_STATE_RUNNING;
              direction = CHAR_DIR_RIGHT;
            } else if (overStairsLeft && (face == CHAR_DIR_LEFT)) {              
              state = CHAR_STATE_RUNNING;
              direction = CHAR_DIR_LEFT;
            } else if (can_crouch) {
              const int crouch_height = crouching_height;
              pos_y += height_orig - crouch_height;
              height = crouch_height;
              bb_height = crouch_height;
              state = CHAR_STATE_CROUCHING;
              direction = CHAR_DIR_STOP;
            } else {
              state = CHAR_STATE_STOP;
              direction = CHAR_DIR_STOP;
            }
        } else if (keyboard.PressedRight()) {
          state = CHAR_STATE_RUNNING;
          direction = CHAR_DIR_RIGHT;
        } else if (keyboard.PressedLeft()) {
          state = CHAR_STATE_RUNNING;
          direction = CHAR_DIR_LEFT;
        } else {
          state = CHAR_STATE_STOP;
          direction = CHAR_DIR_STOP;
        }
  
        break;
  
      case CHAR_STATE_JUMPING:
        if ((direction & CHAR_DIR_DOWN)) {
          if (!inAir) {
            // Factor keyboard to keep running without transitioning through stop
            if (keyboard.PressedRight() || keyboard.PressedLeft()) {
              state = CHAR_STATE_RUNNING;
            } else {
              state = CHAR_STATE_STOP;
              direction = CHAR_DIR_STOP;
            }
          }
        } else if (direction & CHAR_DIR_UP) {
          if (collisionHead ||
              (abs(pos_y_chk - pos_y) >= jump_height)) {
            direction = CHAR_DIR_DOWN;
          }
        }
  
        // Take stairs if pressing up when jumping
        if (can_climb && keyboard.PressedUp() &&
            inStairs) {
          state = CHAR_STATE_CLIMBING;
          direction = CHAR_DIR_UP;
        }
  
        // Fix horizontal direction based on keyboard input
        this->FixHorizontalDirection(keyboard);
        break;
  
      case CHAR_STATE_CROUCHING:
        if ((!collisionHeadOrig && !keyboard.PressedDown()) || inAir) {          
          pos_y = pos_y - (height_orig - height);
          height = height_orig;
          bb_height = bb_height_orig;
          state = CHAR_STATE_STOP;
        }
  
        // Fix horizontal direction based on keyboard input
        this->FixHorizontalDirection(keyboard);
        break;
  
      case CHAR_STATE_CLIMBING:
  
        if (inAirInt && !overStairs && !inStairs) {
          // height rectangle is out of the stairs. Make Rick to fall
          state = CHAR_STATE_JUMPING;
          direction = CHAR_DIR_DOWN;
        } else if (ShouldExitStairsHorizontally(inFloor,
                                                keyboard.PressedLeft(),
                                                keyboard.PressedRight())) {
          state = CHAR_STATE_RUNNING;
          direction = keyboard.PressedRight() ? CHAR_DIR_RIGHT : CHAR_DIR_LEFT;
        } else if (keyboard.PressedUp()) {
          if (inAirInt && overStairs) {
          // Just arrived at the top of the stairs
          state = CHAR_STATE_STOP;
          direction = CHAR_DIR_STOP;
          } else {
            // If on stairs, and pressed key up, then keep climbing up
            direction = CHAR_DIR_UP;
          }
        } else if (keyboard.PressedDown()) {
          if (ShouldStopDescendingStairs(inFloor, overStairs)) {
          // No in stairs, stop player because it was previously in stairs
            state = CHAR_STATE_STOP;
            direction = CHAR_DIR_STOP;
          } else {
            direction = CHAR_DIR_DOWN;
          }
        } else {
          // No up and down keyboard pressed
          direction = CHAR_DIR_STOP;
        }
  
        // Fix horizontal direction based on keyboard input. This also keeps the
        // selected direction when the state just changed to RUNNING.
        this->FixHorizontalDirection(keyboard);
        break;

      case CHAR_STATE_SHOOTING:
        if (face == CHAR_DIR_RIGHT) {
          created = map->CreateNewShoot(pos_x + 23, pos_y + 8, OBJ_DIR_RIGHT);
        } else {
          created = map->CreateNewShoot(pos_x - 10, pos_y + 8, OBJ_DIR_LEFT);
        }
        if (created) {
          const int slot = GetRuntimeAudioBindings().shot;
          if (slot >= 0) sound_handler->PlaySound(slot, false);
        }
        if (!IsActionStatePressed(CHAR_STATE_SHOOTING, keyboard)) {
          state = CHAR_STATE_STOP;
        }
        break;

      case CHAR_STATE_BOMBING:
        if (keyboard.PressedLeft()) {              
          direction = CHAR_DIR_LEFT;
          created = map->CreateNewBomb(pos_x, pos_y, OBJ_DIR_LEFT);
        } else if (keyboard.PressedRight()) {
          direction = CHAR_DIR_RIGHT;
          created = map->CreateNewBomb(pos_x, pos_y, OBJ_DIR_RIGHT);
        } else {
          direction = CHAR_DIR_STOP;
          created = map->CreateNewBomb(pos_x, pos_y, OBJ_DIR_STOP);
        }

        if (created) {
          const int slot = GetRuntimeAudioBindings().bomb;
          if (slot >= 0) sound_handler->PlaySound(slot, false);
        }
        if (!IsActionStatePressed(CHAR_STATE_BOMBING, keyboard)) {
          state = CHAR_STATE_STOP;
        }
        break;

      case CHAR_STATE_HITTING:
        if (IsActionStatePressed(CHAR_STATE_HITTING, keyboard) &&
            (stepsInState < hit_hold_ticks)) {
          state = CHAR_STATE_HITTING;
          if (keyboard.PressedLeft()) direction = CHAR_DIR_LEFT;
          else if (keyboard.PressedRight()) direction = CHAR_DIR_RIGHT;
          else direction = face;
        } else {
          state = CHAR_STATE_STOP;
        }
        break;

      case CHAR_STATE_DYING:
        if (direction & CHAR_DIR_UP) {
          if (ShouldStartDeathFall(pos_y_chk, pos_y, death_rise)) {
            direction &= ~CHAR_DIR_UP;
            direction |=  CHAR_DIR_DOWN;
          }
        } else if (direction & CHAR_DIR_DOWN) {
          int camera_y;
          if (camera)
            camera_y = camera->GetPosY();
          else
            camera_y = map->GetMapHeight()*map->GetTilesetTileHeight() -
                       GetCameraConfig().height;
          if (HasCrossedDeathBoundary(pos_y, camera_y,
                                      GetCameraConfig().height)) {
            if (respawn_from_checkpoint) state = CHAR_STATE_DEAD;
            else direction = CHAR_DIR_STOP;
          }
        }
        break;

      case CHAR_STATE_DEAD:
        this->Reset();
        break;
      default:
        break;
    }
  }

  // Increment steps in state if no change in state
  if (prevState == state)
    stepsInState++;
  else
    stepsInState = 0;

  if ((prevDirection == direction)) { 
    if ((direction == CHAR_DIR_LEFT) || (direction == CHAR_DIR_RIGHT)) {      
      stepsInDirectionX++;
    } else {
      stepsInDirectionY++;
    }
  } else {
    stepsInDirectionX = 0;
    stepsInDirectionY = 0;
  }

  // keep last direction in face
  if (direction & CHAR_DIR_LEFT) {
    face = CHAR_DIR_LEFT;
  } else if (direction & CHAR_DIR_RIGHT) {
    face = CHAR_DIR_RIGHT;
  }

  //printf("Post: State = %d, direction = %d, face = %d\n", state, direction, face);
  //printf("Steps in state = %d, steps in direction x = %d, steps in direction y = %d\n", stepsInState, stepsInDirectionX, stepsInDirectionY);
}

void Character::ComputeNextPosition(World* map) {
  int direction_old;
  //printf("PRE: pos_x = %d pos_y %d\n", pos_x, pos_y);
  //printf("pos_x = %d, pos_y = %d, speed_x = %f, speed_y = %f\n", pos_x, pos_y, speed_x, speed_y);

  // First check if on platform
  // REVISIT: platform should be revisited once they will be properly implemented
  if (inPlatform) {
    // Correct y to be on top of platform
    SetPosY(map, GetPosY() - (GetPosY() + GetHeight() - inPlatformPtr->GetY()), false);
    if (inPlatformPtr->GetDirection() == OBJ_DIR_RIGHT) {
      SetPosX(map, GetPosX() + inPlatformPtr->GetSpeedPixelsPerTick());
    } else if (inPlatformPtr->GetDirection() == OBJ_DIR_LEFT) {
      SetPosX(map, GetPosX() - inPlatformPtr->GetSpeedPixelsPerTick());
    }
  }

  // If player is collisioning with a block, then
  // we need to avoid the player to move.  
  if (stop_move_block_col) {
    direction_old = direction;
    direction &= ~CHAR_DIR_RIGHT;
    direction &= ~CHAR_DIR_LEFT;
  }

  switch(state) {
    case CHAR_STATE_STOP:
      break;
    case CHAR_STATE_RUNNING:      
    case CHAR_STATE_CROUCHING:
      if (direction & CHAR_DIR_RIGHT) {
        SetPosX(map, GetPosX() + speed_x);
        SnapToSlope(map, static_cast<int>(speed_x) + 1);
      } else if (direction & CHAR_DIR_LEFT) {
        SetPosX(map, GetPosX() - speed_x);
        SnapToSlope(map, static_cast<int>(speed_x) + 1);
      }
      break;
    case CHAR_STATE_JUMPING:
      
      // Correct first the horizontal movement because
      // it may affect where the vertical movement is placed
      // at the end.
      // Special case: if collisioning with head but moving down,
      // then avoid correcting position x. Otherwise, the correction
      // may try to move the player to a previous position where
      // it collides again
      if (!(collisionHead && (direction & CHAR_DIR_DOWN))) {
        if (direction & CHAR_DIR_RIGHT)
          SetPosX(map, GetPosX() + speed_x);
        else if (direction & CHAR_DIR_LEFT)
          SetPosX(map, GetPosX() - speed_x);
      }

      if (direction & CHAR_DIR_UP)
        SetPosY(map, GetPosY() - speed_y, false);
      else if (direction & CHAR_DIR_DOWN) {
        SetPosY(map, GetPosY() + speed_y, true);
      }

      break;
    case CHAR_STATE_CLIMBING:
      if (direction & CHAR_DIR_UP) {
        // Enter the complete ladder span before vertical collision checks. A
        // partially aligned box otherwise catches the wall beside the shaft.
        AlignToStairs(map);
        SetPosY(map, GetPosY() - speed_y, false);
      } else if (direction & CHAR_DIR_DOWN) {
        AlignToStairs(map);
        SetPosY(map, GetPosY() + speed_y, false);
      }
      if (direction & CHAR_DIR_RIGHT) {
        SetPosX(map, GetPosX() + speed_x);
      } else if (direction & CHAR_DIR_LEFT) {
        SetPosX(map, GetPosX() - speed_x);
      }
      break;
    case CHAR_STATE_DYING:
      if (direction & CHAR_DIR_UP) {
        pos_y -= speed_y;
      } else if (direction & CHAR_DIR_DOWN) {
        pos_y += speed_y;
      }

      if (direction & CHAR_DIR_RIGHT)
        pos_x += speed_x;
      else if (direction & CHAR_DIR_LEFT)
        pos_x -= speed_x;
    default:
      break;
  }

  if (stop_move_block_col) {
    direction = direction_old;
  }
  //printf("POST: pos_x = %d pos_y %d\n", pos_x, pos_y);
}

void Character::ComputeNextPositionBasedOnBlocks(World* map, Keyboard& keyboard) {
  // If no block coliision then return
  bool blockCollision = blockCollisionLeft || blockCollisionRight;

  stop_move_block_col = false;

  if (!blockCollision) return;

  if (blockCollisionRight && (direction & CHAR_DIR_RIGHT)) {
    SetPosX(map, GetPosX() - (pos_x + bb_x + bb_width - blockCollisionPtr->GetX()));
    // Stop movement in this direction
    stop_move_block_col = true;
  } else if (blockCollisionLeft && (direction & CHAR_DIR_LEFT)) {
    SetPosX(map, GetPosX() + (blockCollisionPtr->GetX() + blockCollisionPtr->GetWidth() - (pos_x + bb_x)));
    // Stop movement in this direction
    stop_move_block_col = true;
  }
}

void Character::ComputeNextSpeed() {
  
  switch (state) {
    case CHAR_STATE_STOP:
      speed_x = 0.0;
      speed_y = 0.0;
      break;
    case CHAR_STATE_RUNNING:
      speed_x = speed_x_max;
      break;
    case CHAR_STATE_JUMPING:
        if (!stepsInState) {
          if (direction & CHAR_DIR_UP)
            speed_y = speed_y_max;
          else
            speed_y = speed_y_min;
        } else if ((direction & CHAR_DIR_UP) && (stepsInDirectionY > 0)) {
          if (speed_y > speed_y_min)
            speed_y = speed_y - speed_y_step;
          else
            speed_y = speed_y_min;
        } else if ((direction & CHAR_DIR_DOWN) && (stepsInDirectionY > 0)) {
          if (speed_y < speed_y_max)
            speed_y = speed_y + speed_y_step;
          else
            speed_y = speed_y_max;
        }

        speed_x = speed_x_max;
      break;

    case CHAR_STATE_CLIMBING:
      speed_x = speed_x_max;
      speed_y = climb_speed;
      break;

    case CHAR_STATE_DYING:
      if (!stepsInState) {
        if (direction & CHAR_DIR_UP)
          speed_y = death_speed_multiplier*speed_y_max;
        else
          speed_y = death_speed_multiplier*speed_y_min;
      } else if ((direction & CHAR_DIR_UP) && (stepsInDirectionY > 0)) {
        if (speed_y > death_speed_multiplier*speed_y_min)
          speed_y = speed_y - death_speed_multiplier*speed_y_step;
        else
          speed_y = speed_y_min;
      } else if ((direction & CHAR_DIR_DOWN) && (stepsInDirectionY > 0)) {
        if (speed_y < death_speed_multiplier*speed_y_max)
          speed_y = speed_y + death_speed_multiplier*speed_y_step;
        else
          speed_y = death_speed_multiplier*speed_y_max;
      }

      speed_x = speed_x_max;
      break;
    default:      
      speed_x = speed_x_max;
      speed_y = speed_y_max;
      break;
  }

  //printf("speed_y = %f\n", speed_y);
}

void Character::ComputeNextSound() {
  if (type != CHARACTER_PLAYER)
    return;

  if (prevState != state) {
    //if (state == CHAR_STATE_RUNNING) {      
    //  sound_handler->PlaySound(FX_WALK, true);
    //} else if (prevState == CHAR_STATE_RUNNING) {
    //  sound_handler->StopSound(FX_WALK);
    //}

    if (state == CHAR_STATE_DYING) {
      const int slot = GetRuntimeAudioBindings().death;
      if (slot >= 0) sound_handler->PlaySound(slot, false);
    }
  }
}

void Character::CharacterStep(World* map, Keyboard& keyboard) {
  const int previous_animation_state = AnimationState();
  // Collisions with world and platforms
  //printf("[CharacterStep] ComputeCollisions\n");
  this->ComputeCollisions(map);
  this->ComputeCollisionBlocks(map);
  // Compute next state
  //printf("[CharacterStep] ComputeNextState\n");
  this->ComputeNextState(map, keyboard);
  // Compute next position 
  //printf("[CharacterStep] ComputeNextPosition\n");
  this->ComputeNextPositionBasedOnBlocks(map, keyboard);
  this->ComputeNextPosition(map);
  // Compute sound based on state
  this->ComputeNextSound();
  // Re-calulate speed
  //printf("[CharacterStep] ComputeNextSpeed\n");
  this->ComputeNextSpeed();
  // Compute next animation frame
  //printf("[CharacterStep] ComputeNextAnimation\n");
  const int animation_state = AnimationState();
  if (state != CHAR_STATE_DEAD) {
    Animation* animation = AnimationForState(animation_state);
    if (previous_animation_state != animation_state) {
      animation->ResetAnim();
    } else if (ShouldAnimateCharacterOnce(state, direction)) {
      animation->AnimStepOnce();
    } else if (direction == CHAR_DIR_STOP) {
      animation->ResetAnim();
    } else {
      animation->AnimStep();
      if (animation->GetCurrentAnim() == 0 && animation->GetStepsInAnim() == 0)
        OnAnimationCycleComplete();
    }
  }

  // Animation scaling factor is only used when dying
  if (state == CHAR_STATE_DYING && scale_during_death)
    animation_scaling_factor += 0.1;
  else if (state == CHAR_STATE_DEAD)
    animation_scaling_factor = 1.0;
  
  //printf("[CharacterStep] End CharacterStep\n");
}

ALLEGRO_BITMAP* Character::GetCurrentAnimationBitmap() {
  Animation* animation = AnimationForState(AnimationState());
  sprite_ptr sprite = animation->sprites[animation->GetCurrentAnim()];
  return sprite->GetBitmap();
}

int Character::GetCurrentAnimationBitmapAttributes() {
  if (face == CHAR_DIR_LEFT) {
    return ALLEGRO_FLIP_HORIZONTAL;
  }
  return 0;
}

int Character::GetCurrentAnimationWidth() {
  Animation* animation = AnimationForState(AnimationState());
  return animation->sprites[animation->GetCurrentAnim()]->width;
}

int Character::GetCurrentAnimationHeight() {
  Animation* animation = AnimationForState(AnimationState());
  return animation->sprites[animation->GetCurrentAnim()]->height;
}

Animation* Character::AnimationForState(int state_id) const {
  map<int, Animation*>::const_iterator animation = animations.find(state_id);
  if (animation == animations.end() || !animation->second) {
    throw DataLoadError("Missing character animation for state " +
                        std::to_string(state_id));
  }
  return animation->second;
}

float Character::GetCurrentAnimationScalingFactor() {
  return animation_scaling_factor * visual_scale;
}

std::string Character::GetCombatStateName() const {
  switch (state) { case CHAR_STATE_STOP: return "CHAR_STATE_STOP"; case CHAR_STATE_RUNNING: return "CHAR_STATE_RUNNING"; case CHAR_STATE_JUMPING: return "CHAR_STATE_JUMPING"; case CHAR_STATE_CROUCHING: return "CHAR_STATE_CROUCHING"; case CHAR_STATE_CLIMBING: return "CHAR_STATE_CLIMBING"; case CHAR_STATE_SHOOTING: return "CHAR_STATE_SHOOTING"; case CHAR_STATE_BOMBING: return "CHAR_STATE_BOMBING"; case CHAR_STATE_HITTING: return "CHAR_STATE_HITTING"; case CHAR_STATE_DYING: return "CHAR_STATE_DYING"; default: return "CHAR_STATE_DEAD"; }
}
