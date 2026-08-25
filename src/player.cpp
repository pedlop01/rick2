#include "player.h" // class's header file
#include "json_level_loader.h"

void Player::ApplyRuntimeControllerProfile() {
  const PlayerControllerConfig config = GetRuntimePlayerControllerConfig();
  width = config.sprite_width;
  height = config.standing_height;
  width_orig = width;
  height_orig = height;
  bb_x = config.collision_offset_x;
  bb_y = 0;
  bb_width = config.collision_width;
  bb_width_orig = bb_width;
  bb_height = config.standing_height;
  bb_height_orig = bb_height;
  speed_x_max = config.run_speed;
  speed_x_min = config.run_speed;
  speed_x_step = 0.0f;
  speed_y_min = config.minimum_vertical_speed;
  speed_y_max = config.maximum_vertical_speed;
  speed_y_step = config.vertical_acceleration;
  climb_speed = config.climb_speed;
  jump_height = config.jump_height;
  death_rise = config.death_rise;
  death_speed_multiplier = config.death_speed_multiplier;
  crouching_height = config.crouching_height;
  hit_hold_ticks = config.hit_hold_ticks;
  speed_x = speed_x_max;
  speed_y = speed_y_max;
  initial_speed_x = speed_x;
  initial_speed_y = speed_y;
  const PlayerGameplayConfig gameplay = GetRuntimePlayerGameplayConfig();
  can_jump = gameplay.jump;
  can_crouch = gameplay.crouch;
  can_climb = gameplay.climb;
  action_up_state = gameplay.action_up;
  action_down_state = gameplay.action_down;
  action_horizontal_state = gameplay.action_horizontal;
  const RuntimeSessionRules session = GetRuntimeSessionRules();
  damage_enabled = session.damage_enabled;
  respawn_from_checkpoint = session.respawn_from_checkpoint;
}

// class constructor
Player::Player() : Character() {
  type = CHARACTER_PLAYER;

  pos_x = 264;  // REVISIT: should be 0
  pos_y = 2000; // REVISIT: should be 0

  using_bb = true;
  height = 21;  // REVISIT: should be 0
  width  = 23;  // REVISIT: should be 0
  height_orig = height;
  width_orig = width;

  // REVISIT: think on how to pass this information automatically
  bb_x = 5;
  bb_y = 0;
  bb_width = 13;
  bb_width_orig = bb_width;
  bb_height = 21;
  bb_height_orig = bb_height;
  ApplyRuntimeControllerProfile();
}

Player::Player(const char* file) : Character(file) {
  type = CHARACTER_PLAYER;

  pos_x = 264;  // REVISIT: should be 0
  pos_y = 2000; // REVISIT: should be 0

  using_bb = true;
  height = 21;  // REVISIT: should be 0
  width  = 23;  // REVISIT: should be 0
  height_orig = height;
  width_orig = width;

  // REVISIT: think on how to pass this information automatically
  bb_x = 5;
  bb_y = 0;
  bb_width = 13;
  bb_width_orig = bb_width;
  bb_height = 21;
  bb_height_orig = bb_height;
  ApplyRuntimeControllerProfile();
}

// class destructor
Player::~Player() {  

}
