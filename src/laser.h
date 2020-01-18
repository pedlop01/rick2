#ifndef LASER_H
#define LASER_H

#include <stdio.h>
#include <stdlib.h>

#include "rick_params.h"
#include "object.h"

#define LASER_TYPE_HORIZONTAL 0
#define LASER_TYPE_VERTICAL   1
#define LASER_TYPE_DIAGONAL   2

class Laser : public Object {
  private:
    int start_x;
    int start_y;
    int laser_type;
    bool onehot;
    int trigger;

    // Initial value for trigger passed in definition
    int initial_trigger;
    // Default value for trigger. Used for recovery once the laser has been triggered once.
    // It is the initial value but may change if the trigger is disabled later.
    int default_trigger;
    // Indicates if the laser has been already triggered once.
    int already_triggered;

  private:
    void UpdateFSMState(World* map);

  public:
    Laser();
    Laser(const char* file, int _id, int _x, int _y, int _bb_x, int _bb_y, int _bb_width, int _bb_height, int _type, bool _onehot, float _speed, int _direction, int _default_trigger);
    ~Laser();

    void Reset();

    int GetTypeId() { return obj_id; };

    void SetTrigger()   { trigger = true;  }
    void UnsetTrigger() { default_trigger = false; trigger = false; }

    void SetDefaultTrigger()   { default_trigger = true;  }
    void UnsetDefaultTrigger() { default_trigger = false; }
};

#endif // LASER_H