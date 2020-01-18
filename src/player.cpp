#include "player.h" // class's header file

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
}

// class destructor
Player::~Player() {  

}
