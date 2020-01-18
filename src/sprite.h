#ifndef SPRITE_H
#define SPRITE_H

#include <allegro5/allegro.h>

typedef class Sprite* sprite_ptr; 
class Sprite {
  private:
    ALLEGRO_BITMAP* sprite_bitmap;

  public:
    int    x;
    int    y;
    int    width;
    int    height;
    
  public:    
	  Sprite();    // class constructor	
    Sprite(ALLEGRO_BITMAP* _sprite_bitmap, int _x, int _y, int _width, int _height);
	  ~Sprite();   // class desructor

  ALLEGRO_BITMAP* GetBitmap() { return sprite_bitmap; }
};

#endif // SPRITE_H
