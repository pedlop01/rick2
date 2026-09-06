#include "enemy.h"
#include "character.h"
#include "world.h"
#include "game_time.h"
#include "animation_rules.h"
#include "enemy_behavior_rules.h"
#include <algorithm>
#include <cmath>

// class constructor
Enemy::Enemy() : Character() {
  type = CHARACTER_ENEMY;
  freezed = false;
  freeze_elapsed_ticks = 0;
}

Enemy::Enemy(const char* file,
             int _id,
             int _x, int _y,
             int _bb_x, int _bb_y, int _bb_width, int _bb_height,
             int _direction, float _speed_x, float _speed_y,
             int _ia_type, bool _ia_random, int _ia_randomness, int _ia_block_steps,
             int _ia_orig_x, int _ia_orig_y, int _ia_limit_x, int _ia_limit_y,
             const nlohmann::json& _behavior, const std::string& combat_profile) : Character(file) {
  id = _id;
  type = CHARACTER_ENEMY;

  pos_x = _x;
  pos_y = _y;

  using_bb    = true;
  width       = _bb_width;
  height      = _bb_height;
  width_orig  = width;
  height_orig = height;

  bb_x = _bb_x;
  bb_y = _bb_y;
  bb_width = _bb_width;
  bb_width_orig = bb_width;
  bb_height = _bb_height;
  bb_height_orig = bb_height;

  direction = _direction;

  speed_x_max = _speed_x;
  speed_y_max = _speed_y;

  freezed = false;
  freeze_elapsed_ticks = 0;
  behavior = _behavior; behavior_ticks = 0; behavior_started = false; behavior_vertical_speed = 0;
  ConfigureCombat(GetCombatCatalog().Find(combat_profile));

  ia = new EnemyIA(_ia_type, _ia_random, _ia_randomness, _ia_block_steps,
                   id, pos_x, pos_y, _ia_orig_x, _ia_orig_y,
                   _ia_limit_x, _ia_limit_y);
}

// class destructor
Enemy::~Enemy() {  
  delete ia;
}

void Enemy::CharacterStep(World* map, Character* player) {
  Keyboard keyboard_enemy;

  if (state == CHAR_STATE_DEAD)
    return;

  keyboard_enemy.SetKeys(0);

  const std::string behavior_type = behavior.value("type", "");
  if (behavior_type == "jumper") { ++behavior_ticks; int keys = direction == CHAR_DIR_LEFT ? KEY_LEFT : KEY_RIGHT; if (behavior_ticks >= behavior.at("intervalTicks").get<int>() && inFloor) { keys |= KEY_UP; behavior_ticks = 0; } jump_height = behavior.at("jumpHeight").get<int>(); speed_x_max = behavior.value("horizontalSpeed", speed_x_max); keyboard_enemy.SetKeys(keys); Character::CharacterStep(map, keyboard_enemy); return; }
  if (behavior_type == "flyPatrol" || behavior_type == "verticalPatrol" || behavior_type == "bossSequence") {
    if (behavior_type == "bossSequence") { if (!behavior_started) { map->StartGameplaySequence(behavior.at("sequence").get<std::string>()); behavior_started = true; } }
    else if (behavior_type == "flyPatrol") { const int phase = behavior.value("phaseTicks", std::max(1, static_cast<int>(behavior.at("distance").get<double>() / std::max(1.0f, std::max(speed_x_max, speed_y_max))))), sign = PatrolPhaseDirection(behavior_ticks, phase); const std::string axis = behavior.at("axis").get<std::string>(); if (axis != "vertical") pos_x += sign * speed_x_max; if (axis != "horizontal") pos_y += sign * speed_y_max; direction = sign > 0 ? CHAR_DIR_RIGHT : CHAR_DIR_LEFT; }
    else if (behavior_type == "verticalPatrol") { const int distance = behavior.at("distance").get<int>(), phase = std::max(1, static_cast<int>(distance / std::max(1.0f, speed_y_max))), sign0 = behavior.value("initialDirection", "down") == "up" ? -1 : 1, sign = PatrolPhaseDirection(behavior_ticks, phase, sign0); pos_y += sign * speed_y_max; }
    ++behavior_ticks; Animation* animation = AnimationForState(state); if (animation) animation->AnimStep(); return;
  }

  // Lethal hits have priority over the freeze pause. Objects are stepped
  // before enemies, so a laser can set killed during this same world tick.
  if (killed) {
    freezed = false;
    freeze_elapsed_ticks = 0;
    Character::CharacterStep(map, keyboard_enemy);
    return;
  }

  if (!ShouldPauseFrozenEnemy(freezed, killed)) {
    if (state != CHAR_STATE_DYING) {

      this->GetCollisionsInternalWeightBoxExt(map, weightColExt);

      // Check if there is a collision with the player
      if (!GetCombatState() || !player->GetCombatState()) this->CheckCollisionPlayer(map, player);

      ia->IAStep(keyboard_enemy,
                 (Player*)player, this);
    }
  } else {
    freeze_elapsed_ticks++;
    if (freeze_elapsed_ticks >= GameTime::ENEMY_FREEZE_DURATION_TICKS) {
      freeze_elapsed_ticks = 0;
      freezed = false;
    }
    // Frozen enemies preserve state, position and animation frame. Resume the
    // normal simulation on the following tick after the timer expires.
    return;
  }

  Character::CharacterStep(map, keyboard_enemy);
}

void Enemy::SetKilled() {
  killed = true;
}

bool Enemy::GetOverStairs() {
  return overStairs;
}

bool Enemy::GetInStairs() {
  return inStairs;
}

bool Enemy::GetInFloor() {
  return inFloor;
}

Colbox* Enemy::GetWeightColExt() {
  return &weightColExt;
}

Colbox* Enemy::GetHeightColExt() {
  return &heightColExt;
}

bool Enemy::CheckCollisionPlayer(World* map, Character* player) {
  int col_x;
  int col_y;
  int col_width;
  int col_height;
  bool playerCol;

  if (using_bb) {
    col_x      = pos_x + bb_x;
    col_y      = pos_y + bb_y;
    col_width  = bb_width;
    col_height = bb_height;
  } else {
    col_x      = pos_x;
    col_y      = pos_y;
    col_width  = width;
    col_height = height;
  }

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
    if ((player->GetState() == CHAR_STATE_HITTING) &&
        (player->GetDirection() == CHAR_DIR_RIGHT) &&
        (player->GetPosX() < pos_x)) {
      freezed = true;
    } else if ((player->GetState() == CHAR_STATE_HITTING) &&
               (player->GetDirection() == CHAR_DIR_LEFT) &&
               (player->GetPosX() > pos_x)) {
      freezed = true;
    } else {
      player->SetKilled(map);
    }
  }

  return playerCol;
}

EnemyIA* Enemy::GetEnemyIA() {
  return ia;
}

bool Enemy::BoxWithinBox(int a_x, int a_y, int a_width, int a_height,
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
