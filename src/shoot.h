#ifndef SHOOT_H
#define SHOOT_H

#include <stdio.h>
#include <stdlib.h>

#include "rick_params.h"
#include "object.h"

class Shoot : public Object {
  private:
    void UpdateFSMState(World* map) override;

  public:
    Shoot();
    Shoot(const char* file, int _x, int _y, int _width, int _height, int _direction);
    ~Shoot() override;

    int GetTypeId() override { return obj_id; };
};

#endif // SHOOT_H
