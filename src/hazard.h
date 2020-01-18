#ifndef HAZARD_H
#define HAZARD_H

#include <stdio.h>
#include <stdlib.h>
#include <list>

#include "rick_params.h"
#include "character.h"
#include "object.h"

class Hazard : public Object {
  private:
    int  hazard_id;
    int  ini_x;
    int  ini_y;    

    int  current_desp;
    int  current_wait_time;    

    bool trigger;
    bool always_trigger;
    bool stop_inactive;
    bool completed_trigger;

    bool cond_actions;

    // List of actions
    list<Action*> actions;
    list<Action*>::iterator current_action;

  public:
    Hazard();
    Hazard(const char* file,
           int _id,
           int _x,
           int _y,
           int _width,
           int _height,
           bool _trigger,
           bool _stop_inactive);
    ~Hazard();

    // Add new action
    void AddAction(int direction, int desp, int wait, float speed, bool enabled, int cond);

    // Set the onehot trigger
    void SetTrigger() { trigger = true; }

    // Enable or disable conditional action execution
    void SetCondActions(bool _cond_actions) { cond_actions = _cond_actions; }
    bool GetCondActions()                   { return cond_actions; }

    int  GetID()      { return obj_id;    }
    int  GetTypeId()  { return hazard_id; };

    void ComputeCollisionsPlayer(World* map, Character* player);
    void HazardStep(World* map, Character* player);

    void HandleConditionalActions(list<Action*>::iterator &_current_action);
};

#endif // HAZARD_H