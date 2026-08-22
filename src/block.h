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
    void UpdateFSMState(World* map) override;
    void ComputeCollisions(World* map, Character* player) override;
    void ComputeNextPosition(World* map) override;

  public:
    Block();
    Block(int _type_id);
    ~Block() override;

    void SetTriggered(bool _trigger) { trigger = _trigger; };

    void Init(const char* _file, int _x, int _y, int _width, int _height, bool _exploits);

    int GetTypeId() override { return type_id; };
};

#endif // BLOCK_H
