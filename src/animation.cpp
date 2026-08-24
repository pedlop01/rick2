#include "animation.h" // class's header file
#include "animation_rules.h"

// class constructor
Animation::Animation() {
  source_bitmap = nullptr;
  frame_duration_ticks = 1;
  prev_anim = 0;
  current_anim = 0;
  steps_in_anim = 0;
}

Animation::Animation(const BitmapResource& _source_bitmap,
                     unsigned int _frame_duration_ticks) {
  source_bitmap = _source_bitmap;
  frame_duration_ticks = _frame_duration_ticks;
  prev_anim = 0;
  current_anim = 0;
  steps_in_anim = 0;
}

// class destructor
Animation::~Animation()
{
    for (vector<sprite_ptr>::iterator it = sprites.begin() ; it != sprites.end() ; it++ ) {
        delete *it;
    }
    sprites.clear();

}

void Animation::AddSprite(const BitmapResource& _sprite_bitmap, int _x, int _y, int _width, int _height) {
  sprite_ptr sprite = new Sprite(_sprite_bitmap, _x, _y, _width, _height);
  sprites.push_back(sprite);
}

void Animation::AnimStep() {
  steps_in_anim++;
  if (steps_in_anim >= frame_duration_ticks) {
    prev_anim = current_anim;
    current_anim = (current_anim + 1) % sprites.size();
    steps_in_anim = 0;
  }
}

void Animation::AnimStepOnce() {
  const AnimationClockStep next = AdvanceAnimationOnce(
      current_anim, steps_in_anim, static_cast<int>(sprites.size()),
      static_cast<int>(frame_duration_ticks));
  prev_anim = current_anim;
  current_anim = next.frame;
  steps_in_anim = next.ticks;
}

bool Animation::CompletedLastAnim() {
  return ((steps_in_anim + 1 == frame_duration_ticks) &&
          (current_anim == (sprites.size() - 1)));
}

void Animation::ResetAnim() {
  prev_anim = current_anim;
  current_anim = 0;
  steps_in_anim = 0;
}
