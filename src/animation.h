#ifndef ANIMATION_H
#define ANIMATION_H

#include <allegro5/allegro.h>
#include <vector>
#include <stdio.h>
#include "sprite.h" // inheriting class's header file

using namespace std;

typedef class Animation* animation_ptr;
class Animation
{
  private:
    int                prev_anim;

  public:
    BitmapResource    source_bitmap;
    vector<sprite_ptr> sprites;
    unsigned int       frame_duration_ticks;
    unsigned int       frame_duration_ms;
    unsigned int       elapsed_frame_ms;
    int                current_anim;
    int                steps_in_anim;

  public:
	  Animation();    // class constructor
	  ~Animation();   // class destructor

    Animation(const BitmapResource& _source_bitmap,
              unsigned int _frame_duration_ticks,
              unsigned int _frame_duration_ms = 0);

    void AddSprite(const BitmapResource& _sprite_bitmap, int _x, int _y, int _width, int _height);

    void AnimStep();
    void AnimStepOnce();
    void ResetAnim();

    int GetCurrentAnim() { return current_anim;  }
    int GetStepsInAnim() { return steps_in_anim; }

    bool IsLastAnim()        { return (current_anim == (sprites.size() - 1)); }
    bool CompletedLastAnim();
};

#endif // ANIMATION_H
