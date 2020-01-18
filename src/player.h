#ifndef PLAYER_H
#define PLAYER_H

#include <stdio.h>
#include <vector>

#include "rick_params.h"
#include "character.h"

class Player : public Character {
  private:

  public:    
	  Player();    // class constructor
    Player(const char* file);    

    ~Player();   // class desructor
};

#endif // PLAYER_H
