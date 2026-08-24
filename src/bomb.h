#ifndef BOMB_H
#define BOMB_H

#include <stdio.h>
#include <stdlib.h>

#include "rick_params.h"
#include "object.h"

class Block;

class Bomb : public Object {
  private:
    Block* contact_block;
    void UpdateFSMState(World* map) override;

  public:
    Bomb();
    Bomb(const char* file, int _x, int _y, int _width, int _height, int _direction);
    ~Bomb() override;

    void ComputeNextPosition(World* map) override;

    int GetTypeId() override { return obj_id; };
};

#endif // BOMB_H
