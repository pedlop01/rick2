#ifndef COLBOX_H
#define COLBOX_H

#include <iostream>
#include <allegro5/allegro.h>
#include <allegro5/allegro_image.h>
#include <allegro5/allegro_primitives.h>

#include <stdio.h>

using namespace std;

class Colbox
{
  private:
    int left_up_col;
    int right_up_col;
    int left_down_col;
    int right_down_col;

  public:
    Colbox();
    ~Colbox();

    int GetLeftUpCol()    { return left_up_col;    }
    int GetRightUpCol()   { return right_up_col;   }
    int GetLeftDownCol()  { return left_down_col;  }
    int GetRightDownCol() { return right_down_col; }

    void SetLeftUpCol(int col)    { left_up_col = col;    }
    void SetRightUpCol(int col)   { right_up_col = col;   }
    void SetLeftDownCol(int col)  { left_down_col = col;  }
    void SetRightDownCol(int col) { right_down_col = col; }
};

#endif // COLBOX_H