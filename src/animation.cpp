#include "animation.h" // class's header file
#include "animation_rules.h"

// class constructor
Animation::Animation() {
  source_bitmap = nullptr;
  frame_duration_ticks = 1;
  frame_duration_ms = 0;
  elapsed_frame_ms = 0;
  prev_anim = 0;
  current_anim = 0;
  steps_in_anim = 0;
}

Animation::Animation(const BitmapResource& _source_bitmap,
                     unsigned int _frame_duration_ticks,
                     unsigned int _frame_duration_ms) {
  source_bitmap = _source_bitmap;
  frame_duration_ticks = _frame_duration_ticks;
  frame_duration_ms = _frame_duration_ms;
  elapsed_frame_ms = 0;
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
  if (frame_duration_ms) {
    const MillisecondAnimationStep next = AdvanceLoopingAnimationMilliseconds(
        current_anim, elapsed_frame_ms, static_cast<int>(sprites.size()),
        static_cast<int>(frame_duration_ms));
    steps_in_anim++;
    if (next.frame != current_anim) {
      prev_anim = current_anim;
      steps_in_anim = 0;
    }
    current_anim = next.frame;
    elapsed_frame_ms = next.elapsed_ms;
    return;
  }
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
  if (frame_duration_ms)
    return current_anim == static_cast<int>(sprites.size() - 1) && elapsed_frame_ms + 20 >= frame_duration_ms;
  return ((steps_in_anim + 1 == frame_duration_ticks) &&
          (current_anim == (sprites.size() - 1)));
}

void Animation::ResetAnim() {
  prev_anim = current_anim;
  current_anim = 0;
  steps_in_anim = 0;
  elapsed_frame_ms = 0;
}
