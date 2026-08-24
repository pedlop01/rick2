#ifndef TRIGGER_H
#define TRIGGER_H

#include <stdio.h>
#include <vector>

#include "rick_params.h"
#include "character.h"
#include "object.h"
#include "trigger_rules.h"

using namespace std;

class TriggerTarget {
  private:
    Object* target;

    int delay_ticks;
    bool set_trigger;
    bool set_trigger_cond;
    bool triggered;

  public:
    TriggerTarget(Object* _target,
                  int _delay,
                  bool _set_trigger,
                  bool _set_trigger_cond);
    ~TriggerTarget();

    Object* GetTarget()      { return target;           }
    int GetDelayTicks()      { return delay_ticks;      }
    bool GetSetTrigger()     { return set_trigger;      }
    bool GetSetTriggerCond() { return set_trigger_cond; }
    bool GetTriggered()      { return triggered;        }

    void SetTriggered(bool _triggered) { triggered = _triggered; }
};

class Trigger {
  private:
    int id;

    // Trigger area
    int x;
    int y;
    int width;
    int height;

    int action_event;
    int action_face;

    bool recursive;

    // Associated delays for target
    vector<TriggerTarget*> targets;

    bool player_was_in_trigger;
    bool already_triggered;
    bool trigger_targets;

    // Previous state is used for triggers which may depend on player state to
    // avoid sending multiple triggers in a row
    int  player_prev_state;

    int steps;

  public:
    Trigger(int _id,
            int _x, int _y, int _width, int _height,
            int _action_event, int _action_face, bool _recursive);
    ~Trigger();

    void Reset();

    void AddTarget(Object* _object, int _delay, bool _trigger, bool _trigger_cond);

    // Read methods
    int GetId()     { return id;     }
    int GetX()      { return x;      }
    int GetY()      { return y;      }
    int GetWidth()  { return width;  }
    int GetHeight() { return height; }

    int GetActionEvent() { return action_event; }
    int GetActionFace()  { return action_face;  }

    bool InTrigger(int x, int y, int width, int height);

    void TriggerStep(int _x, int _y, int _width, int _height,
                     int _face, int _state);

};

#endif // TRIGGER_H
