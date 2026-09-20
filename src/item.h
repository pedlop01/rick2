#ifndef ITEM_H
#define ITEM_H

#include <stdio.h>
#include <stdlib.h>
#include <vector>

#include "rick_params.h"
#include "object.h"
#include "gameplay_program.h"

class Item : public Object {
  private:
    int type_id;
    int steps_dying;
    bool affected_by_gravity;
    GameplayProgram* gameplay_program;
    nlohmann::json on_collect;

  private:
    void UpdateFSMState(World* map) override;

  public:
    Item();
    Item(int _type_id);
    ~Item() override;

    int GetTypeId() override { return type_id; }

    // Re-write computeation of next position
    void ComputeNextPosition(World* map) override;
    // Re-write step from parent class
    void ObjectStep(World* map, Character* player);
    void SetAffectedByGravity(bool value) { affected_by_gravity = value; }
    void ConfigureCollection(GameplayProgram* program, const nlohmann::json& actions);
};

#endif // PLATFORM_H
