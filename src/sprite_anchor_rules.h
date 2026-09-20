#ifndef SPRITE_ANCHOR_RULES_H
#define SPRITE_ANCHOR_RULES_H

struct SpriteDrawPosition {
  float x;
  float y;
};

inline SpriteDrawPosition AnchoredSpritePosition(float body_x,
                                                 float body_y,
                                                 float body_width,
                                                 float body_height,
                                                 float sprite_width,
                                                 float sprite_height,
                                                 float scale) {
  if (scale == 1.0f) return {body_x, body_y};
  return {body_x + (body_width - sprite_width * scale) / 2.0f,
          body_y + body_height - sprite_height * scale};
}

#endif  // SPRITE_ANCHOR_RULES_H
