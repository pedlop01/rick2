#ifndef ITEM_H
#define ITEM_H

#include <stdio.h>
#include <stdlib.h>
#include <vector>

#include "rick_params.h"
#include "object.h"

class Item : public Object {
  private:
    int type_id;
    int steps_dying;

  private:
    void UpdateFSMState(World* map);

  public:
    Item();
    Item(int _type_id);
    ~Item();

    int GetTypeId() { return type_id; }

    // Re-write computeation of next position
    void ComputeNextPosition(World* map);
    // Re-write step from parent class
    void ObjectStep(World* map, Character* player);
};

#endif // PLATFORM_H