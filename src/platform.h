#ifndef PLATFORM_H
#define PLATFORM_H

#include <stdio.h>
#include <stdlib.h>
#include <list>

#include "rick_params.h"
#include "object.h"

class Platform : public Object {
  private:
    int  platform_id;
    int  ini_state;
    int  ini_x;
    int  ini_y;    
    bool recursive;
    bool one_use;    

    bool trigger;
    int  current_desp;
    int  current_wait_time;

    bool cond_actions;

    // List of actions
    list<Action*> actions;
    list<Action*>::iterator current_action;

  public:
    Platform();
    Platform(const char* file,
             int _id,
             int _ini_state,
             int _x,
             int _y,
             int _width,
             int _height,
             bool _visible,
             bool _recursive,
             bool _one_use);
    ~Platform();

    // Add new action
    void AddAction(int direction, int desp, int wait, float speed, int cond);

    // Set the onehot trigger
    void SetTrigger() { trigger = true; }

    // Enable or disable conditional action execution
    void SetCondActions(bool _cond_actions) { cond_actions = _cond_actions; }
    bool GetCondActions()                   { return cond_actions; }

    // IDs
    int  GetID()      { return obj_id;      }
    int  GetTypeId()  { return platform_id; };

    // Get currection direction of the platform based on current action
    int   GetDirection();
    float GetSpeed();

    void PlatformStep();

    void HandleConditionalActions(list<Action*>::iterator& _current_action);
};

#endif // PLATFORM_H