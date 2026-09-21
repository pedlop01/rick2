#ifndef ENEMY_H
#define ENEMY_H

#include <stdio.h>
#include <vector>
#include <nlohmann/json.hpp>

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

    unsigned int freeze_elapsed_ticks;
    bool freezed;
    nlohmann::json behavior;
    int behavior_ticks;
    bool behavior_started;
    float behavior_vertical_speed;
    int respawn_ticks;
    int patrol_anchor_x;
    int patrol_anchor_y;
    int patrol_y_direction;
    bool active;

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
          int _orig_x, int _orig_y, int _ia_limit_x, int _ia_limit_y,
          const nlohmann::json& _behavior = nlohmann::json::object(),
          const std::string& combat_profile = "");

    ~Enemy() override;

    int GetId() { return id; }
    bool IsActive() const { return active; }
    void SetActive(bool value);

    bool CheckCollisionPlayer(World* map, Character* player);

    void CharacterStep(World* map, Character* player);
    void Reset() override;

    Colbox* GetWeightColExt();
    Colbox* GetHeightColExt();

    void SetKilled();
    bool GetOverStairs();
    bool GetInStairs();
    bool GetInFloor();
    bool GetFreezed() { return freezed; }
    unsigned int GetFreezeElapsedTicks() { return freeze_elapsed_ticks; }

    EnemyIA* GetEnemyIA();
};

#endif // ENEMY_H
