#include "enemy.h"
#include "character.h"
#include "world.h"

// class constructor
Enemy::Enemy() : Character() {
  type = CHARACTER_ENEMY;
  freezed = false;
  steps_freezed = 0;
}

Enemy::Enemy(const char* file,
             int _id,
             int _x, int _y,
             int _bb_x, int _bb_y, int _bb_width, int _bb_height,
             int _direction, float _speed_x, float _speed_y,
             int _ia_type, bool _ia_random, int _ia_randomness, int _ia_block_steps,
             int _ia_orig_x, int _ia_orig_y, int _ia_limit_x, int _ia_limit_y) : Character(file) {
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
  steps_freezed = 0;

  ia = new EnemyIA(_ia_type, _ia_random, _ia_randomness, _ia_block_steps, pos_x, pos_y, _ia_orig_x, _ia_orig_y, _ia_limit_x, _ia_limit_y);
}

// class destructor
Enemy::~Enemy() {  

}

void Enemy::CharacterStep(World* map, Character* player) {
  Keyboard keyboard_enemy;

  if (state == CHAR_STATE_DEAD)
    return;

  keyboard_enemy.SetKeys(0);

  if (!freezed) {
    if (state != CHAR_STATE_DYING) {

      this->GetCollisionsInternalWeightBoxExt(map, weightColExt);

      // Check if there is a collision with the player
      this->CheckCollisionPlayer(map, player);

      ia->IAStep(keyboard_enemy,
                 (Player*)player, this);
    }
  } else {
    steps_freezed++;
    if (steps_freezed > 100) {
      steps_freezed = 0;
      freezed = false;
    }
  }

  Character::CharacterStep(map, keyboard_enemy);
}

void Enemy::SetKilled() {
  killed = true;
}

bool Enemy::GetOverStairs() {
  return overStairs;
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