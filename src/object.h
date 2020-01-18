#ifndef OBJECT_H
#define OBJECT_H

#include <stdio.h>
#include <vector>

#include "rick_params.h"
#include "pugixml.hpp"
#include "animation.h"
#include "colbox.h"
#include "sound_handler.h"

// Object types
#define OBJ_NONE         0
#define OBJ_PLATFORM     1
#define OBJ_ITEM         2
#define OBJ_LASER        3
#define OBJ_BOMB         4
#define OBJ_HAZARD       5
#define OBJ_BLOCK        6
#define OBJ_STATIC       7
#define OBJ_SHOOT        8

// Object states
#define OBJ_STATE_STOP   0
#define OBJ_STATE_MOVING 1
#define OBJ_STATE_DYING  2
#define OBJ_STATE_DEAD   3

// Object directions
#define OBJ_DIR_STOP  0b0000
#define OBJ_DIR_RIGHT 0b0001
#define OBJ_DIR_LEFT  0b0010
#define OBJ_DIR_UP    0b0100
#define OBJ_DIR_DOWN  0b1000

// Forward declaration
class World;
class Character;
class Enemy;

// Some objects use Actions.
// REVISIT: should we define this in a different file?
class Action {
  private:
   int   direction;
   int   desp;
   int   wait;
   float speed;
   bool  enabled;
   int   condition;

  public:
    Action();
    ~Action();

    Action(int _direction, int _desp, int _wait, float _speed, int _cond);

    int   GetDirection() { return direction; }
    int   GetDesp()      { return desp;      }
    int   GetWait()      { return wait;      }
    float GetSpeed()     { return speed;     }
    int   GetCondition() { return condition; }

    // It is possible to make an object inactive through an action,
    // however, actions by default set enbaled to true
    void SetEnabled(bool _enabled) { enabled = _enabled; }
    bool GetEnabled()              { return enabled;    }
};


class Object {
  protected:
    static int id;

    char name[40];

    int x;
    int y;
    int width;
    int height;

    // Bounding box
    // Not all object will implement bounding boxes. They are only
    // relevant for objects where the collision limits are not
    // the same as the sprite size
    bool using_bb;
    int  bb_x;
    int  bb_y;
    int  bb_width;
    int  bb_height;

    int obj_id;

    bool visible;
    bool active;

    // State variables
    int prev_state;
    int state;
    int steps_in_state;

    // Movement variables
    int   direction;
    int   prev_direction;
    int   face;
    float speed_x;
    float speed_x_step;
    float speed_x_max;
    float speed_x_min;
    float speed_y;
    float speed_y_max;
    float speed_y_min;
    float speed_y_step;
    int   steps_in_direction_x;
    int   steps_in_direction_y;    

    int obj_type;

    bool killed;

    // Initial values for main variables
    int  initial_x;
    int  initial_y;
    bool initial_visible;
    bool intial_active;
    int  initial_direction;
    int  initial_speed_x;
    int  initial_speed_y;
    int  initial_state;

    // Collisions
    Colbox     extColExt;     // Collision with world
    Colbox     widthColExt;   // Collision with world
    Colbox     heightColExt;  // Collision with world
    bool       playerCol;
    bool       blockColRight;
    bool       blockColLeft;
    bool       blockColUp;
    bool       blockColDown;    
    bool       inPlatform;
    bool       itemCol;
    bool       enemyCol;
    Character* playerPtr;
    Object*    blockColPtr;
    Object*    inPlatformPtr;
    Object*    itemColPtr;
    Enemy*     enemyPtr;

    vector<Animation*> animations;

    pugi::xml_document obj_file;

    SoundHandler* sound_handler;

  public:

    Object();
    Object(int _x, int _y, int _width, int _height, int _visible, int _active);
    ~Object();

    int GetType()  { return obj_type; }
    int GetState() { return state;    }

    void Init(const char* file,
              int _x,
              int _y,
              int _width,
              int _height,
              bool _visible,
              bool _active,
              int _state,
              int _direction,
              float _speed_x_step,
              float _speed_x_max,
              float _speed_x_min,
              float _speed_y_step,
              float _speed_y_max,
              float _speed_y_min);

    void Reset();

    virtual void SetTrigger() {;};
    virtual void UnsetTrigger() {;};

    virtual bool GetCondActions() {;}
    virtual void SetCondActions(bool _cond_action) {;};

    void SetX(int _x)              { x = _x;              };
    void SetY(int _y)              { y = _y;              };
    void SetWidth(int _width)      { width = _width;      };
    void SetHeight(int _height)    { height = _height;    };
    void SetVisible(bool _visible) { visible = _visible;  };
    void SetActive(bool _active)   { active = _active;    };

    // Differ from previous than this ones take into account the world collisions
    void SetX(World* map, int _x);
    void SetY(World* map, int _y);

    int GetId()       { return obj_id;                          };
    int GetX()        { return x;                               };
    int GetY()        { return y;                               };
    int GetWidth()    { return width;                           };
    int GetHeight()   { return height;                          };
    int GetBBX()      { return (using_bb ? bb_x      : 0);      };
    int GetBBY()      { return (using_bb ? bb_y      : 0);      };
    int GetBBWidth()  { return (using_bb ? bb_width  : width);  };
    int GetBBHeight() { return (using_bb ? bb_height : height); };
    bool GetVisible() { return visible;                         };
    bool GetActive()  { return active;                          };

    virtual int GetTypeId() {;};

    void SetSpeedX(float _speed_x)          { speed_x = _speed_x;           };
    void SetSpeedXMax(float _speed_x_max)   { speed_x_max = _speed_x_max;   };
    void SetSpeedXMin(float _speed_x_min)   { speed_x_min = _speed_x_min;   };
    void SetSpeedXStep(float _speed_x_step) { speed_x_step = _speed_x_step; };
    void SetSpeedY(float _speed_y)          { speed_y = _speed_y;           };
    void SetSpeedYMax(float _speed_y_max)   { speed_y_max = _speed_y_max;   };
    void SetSpeedYMin(float _speed_y_min)   { speed_y_min = _speed_y_min;   };
    void SetSpeedYStep(float _speed_y_step) { speed_y_step = _speed_y_step; };
    void SetSpeeds(float _speed_x_max,
                   float _speed_x_min,
                   float _speed_x_step,                   
                   float _speed_y_max,
                   float _speed_y_min,
                   float _speed_y_step)     { speed_x_max = _speed_x_max;
                                              speed_x_min = _speed_x_min;
                                              speed_x_step = _speed_x_step;
                                              speed_y_max = _speed_y_max;
                                              speed_y_min = _speed_y_min;
                                              speed_y_step = _speed_y_step; };

    void SetBoundingBox(int _bb_x, int _bb_y, int _bb_width, int _bb_height);
    void UnsetBoundingBox();
    bool IsUsingBoundingBox();

    void ComputeCollisionBlocks(World* map);
    void ComputeCollisionPlatforms(World* map);
    void ComputeCollisionObjects(World* map);

    virtual void ComputeCollisions(World* map, Character* player);
    void ComputeNextState(World* map);
    virtual void ComputeNextPosition(World* map);
    void ComputeNextSpeed();

    void ObjectStep(World* map, Character* player);

    Animation*      GetCurrentAnimation();
    ALLEGRO_BITMAP* GetCurrentAnimationBitmap();
    int             GetCurrentAnimationBitmapAttributes();

    bool CoordsWithinObject(int _x, int _y);

    void SetKilled()   { killed = true;  }
    void UnsetKilled() { killed = false; }

    void RegisterSoundHandler(SoundHandler* _sound_handler) { sound_handler = _sound_handler; }
    
  protected:
    virtual void UpdateFSMState(World* map);

    bool BoxWithinBox(int a_x, int a_y, int a_width, int a_height, int b_x, int b_y, int b_width, int b_height);

  private:
    void GetCollisionsByCoords(World* map, Colbox &mask_col, int left_up_x, int left_up_y, int right_down_x, int right_down_y);
    void GetCollisionsExternalBoxExt(World* map, Colbox &mask_col);
    void GetCollisionsWidthBoxExt(World* map, Colbox &mask_col);
    void GetCollisionsHeightBoxExt(World* map, Colbox &mask_col);    
};

#endif // OBJECT_H