#ifndef STATIC_OBJECT_H
#define STATIC_OBJECT_H

#include <stdio.h>
#include <stdlib.h>
#include <vector>

#include "rick_params.h"
#include "object.h"

class StaticObject : public Object {
  private:
    int type_id;

  public:
    StaticObject();
    StaticObject(int _type_id);
    ~StaticObject();

    int GetTypeId() { return type_id; }

    void Init(const char* _file, int _x, int _y, int _width, int _height, int _anim_step);
    void StaticObjectStep();
};

#endif // STATIC_OBJECT_H