#ifndef BLOCK_H
#define BLOCK_H

#include <stdio.h>
#include <stdlib.h>
#include <vector>

#include "rick_params.h"
#include "object.h"

class Block : public Object {
  private:
    int  type_id;
    int  start_x;
    bool exploits;
    bool trigger;

  private:
    void UpdateFSMState(World* map);
    void ComputeCollisions(World* map, Character* player);
    void ComputeNextPosition(World* map);

  public:
    Block();
    Block(int _type_id);
    ~Block();

    void SetTrigger(bool _trigger) { trigger = _trigger; };

    void Init(const char* _file, int _x, int _y, int _width, int _height, bool _exploits);

    int GetTypeId() { return type_id; };
};

#endif // BLOCK_H