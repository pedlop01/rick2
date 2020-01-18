#include "camera_view.h"

CameraView::CameraView(int _view_id, int _left_up_x, int _left_up_y, int _right_down_x, int _right_down_y) {
  view_id = _view_id;
  left_up_x = _left_up_x;
  left_up_y = _left_up_y;
  right_down_x = _right_down_x;
  right_down_y = _right_down_y;
}

CameraView::~CameraView() {
}

int CameraView::GetId() {
  return view_id;
}

int CameraView::GetLeftUpX() {
  return left_up_x;
}

int CameraView::GetLeftUpY() {
  return left_up_y;
}

int CameraView::GetRightDownX() {
  return right_down_x;
}

int CameraView::GetRightDownY() {
  return right_down_y;
}