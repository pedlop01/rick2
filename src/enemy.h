#ifndef ENEMY_H
#define ENEMY_H

#include <stdio.h>
#include <vector>

#include "pugixml.hpp"
#include "rick_params.h"
#include "character.h"
#include "enemy_ia.h"
#include "colbox.h"


class World;
class Enemy : public Character {
  private:
    int id;
    EnemyIA* ia;
    Colbox weightColExt;

    int  steps_freezed;
    bool freezed;

  private:
    bool BoxWithinBox(int a_x, int a_y, int a_width, int a_height,
                      int b_x, int b_y, int b_width, int b_height);

  public:    
	  Enemy();
    Enemy(const char* file,
          int _id,
          int _x, int _y,
          int _bb_x, int _bb_y, int _bb_width, int _bb_height,
          int _direction, float _speed_x, float _speed_y,
          int _ia_type, bool _ia_random, int _ia_randomness, int _block_steps,
          int _orig_x, int _orig_y, int _ia_limit_x, int _ia_limit_y);

    ~Enemy();

    int GetId() { return id; }

    bool CheckCollisionPlayer(World* map, Character* player);

    void CharacterStep(World* map, Character* player);

    Colbox* GetWeightColExt();
    Colbox* GetHeightColExt();

    void SetKilled();
    bool GetOverStairs();
    bool GetInFloor();
    bool GetFreezed() { return freezed; }

    EnemyIA* GetEnemyIA();
};

#endif // ENEMY_H
