#include "sprite.h" // class's header file

// class constructor
Sprite::Sprite() {
	// insert your code here
}

Sprite::Sprite(ALLEGRO_BITMAP* _sprite_bitmap, int _x, int _y, int _width, int _height) {
  sprite_bitmap = _sprite_bitmap;
  x = _x;
  y = _y;
  width = _width;
  height = _height;	
}

// class destructor
Sprite::~Sprite() {
  al_destroy_bitmap(sprite_bitmap);
}
