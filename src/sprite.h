#ifndef SPRITE_H
#define SPRITE_H

#include <allegro5/allegro.h>
#include "resource_cache.h"

typedef class Sprite* sprite_ptr; 
class Sprite {
  private:
    BitmapResource sprite_bitmap;

  public:
    int    x;
    int    y;
    int    width;
    int    height;
    
  public:    
	  Sprite();    // class constructor	
    Sprite(const BitmapResource& _sprite_bitmap, int _x, int _y, int _width, int _height);
	  ~Sprite();   // class desructor

  ALLEGRO_BITMAP* GetBitmap() { return sprite_bitmap.get(); }
};

#endif // SPRITE_H
