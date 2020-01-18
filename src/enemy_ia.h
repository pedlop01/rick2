#ifndef ENEMYIA_H
#define ENEMYIA_H

#include <stdio.h>
#include <stdlib.h>
#include <vector>
#include <time.h>

#include "rick_params.h"
#include "keyboard.h"
#include "colbox.h"

#define ENEMY_IA_WALKER 0
#define ENEMY_IA_CHASER 1

#define STEPS_IN_HOR_DIRECTION 200
#define RANDOM_DECISION_VALUE  15

class Player;
class Enemy;

class EnemyIA {
  private:
    int  type;
    bool random_decisions;
    int  orig_x;
    int  orig_y;
    int  initial_x;
    int  initial_y;
    int  limit_x;
    int  limit_y;
    bool limited_hor;
    bool limited_ver;
    int  randomness;
    int  block_steps;

    int  wait_for_decision;

  private:
    bool RandomDecision(Keyboard& keyboard, int direction, int steps_in_x);
    bool WalkerDecision(Keyboard& keyboard, int direction, bool col_right, bool col_left, bool no_floor_right, bool no_floor_left);  // Returns true if change of direction
    void ChaserDecision(Keyboard& keyboard, bool block_hor, int player_x, int player_y, int enemy_x, int enemy_y, int _enemy_state, bool over_stairs, bool in_floor);
    bool CorrectDecisionBasedOnLimits(Keyboard& keyboard, int x, int y, int direction);

  public:    
	  EnemyIA();
    EnemyIA(int _type,
            int _random_decisions, int _randomness, int _block_steps,
            int _initial_x, int _initial_y, int _orig_x, int _orig_y,
            int limit_x, int limit_y);
    ~EnemyIA();

    int  GetType();
    int  GetOrigX();
    int  GetOrigY();
    int  GetLimitX();
    int  GetLimitY();
    bool IsLimited();

    bool OnIALimits(int player_x, int player_y);

    void SetKeyboardBasedOnDirection(Keyboard& keyboard, int direction);

    void IAStepWalker(Keyboard &keyboard,
                      Player* player, Enemy* enemy);

    void IAStepChaser(Keyboard &keyboard,
                      Player* player, Enemy* enemy);

    void IAStep(Keyboard &keyboard,
                Player* player, Enemy* enemy);
};

#endif // ENEMYIA_H
