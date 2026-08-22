#include "sprite.h" // class's header file

// class constructor
Sprite::Sprite() {
  sprite_bitmap = nullptr;
  x = 0;
  y = 0;
  width = 0;
  height = 0;
}

Sprite::Sprite(const BitmapResource& _sprite_bitmap, int _x, int _y, int _width, int _height) {
  sprite_bitmap = _sprite_bitmap;
  x = _x;
  y = _y;
  width = _width;
  height = _height;	
}

// class destructor
Sprite::~Sprite() {
}
