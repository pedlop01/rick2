#ifndef BOMB_H
#define BOMB_H

#include <stdio.h>
#include <stdlib.h>

#include "rick_params.h"
#include "object.h"

class Bomb : public Object {
  private:
    void UpdateFSMState(World* map);

  public:
    Bomb();
    Bomb(const char* file, int _x, int _y, int _width, int _height, int _direction);
    ~Bomb();

    void ComputeNextPosition(World* map);

    int GetTypeId() { return obj_id; };
};

#endif // BOMB_H