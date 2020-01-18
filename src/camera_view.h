#ifndef CAMERA_VIEW_H
#define CAMERA_VIEW_H

#include <stdio.h>
#include <vector>

#include "rick_params.h"

using namespace std;

class CameraView {
  private:
    int view_id;

    // View area
    int left_up_x;
    int left_up_y;
    int right_down_x;
    int right_down_y;

  public:
    CameraView(int _view_id, int _left_up_x, int _left_up_y, int _right_down_x, int _right_down_y);
    ~CameraView();

    int GetId();
    int GetLeftUpX();
    int GetLeftUpY();
    int GetRightDownX();
    int GetRightDownY();
};

#endif // CAMERA_VIEW_H