#ifndef CHARACTER_H
#define CHARACTER_H

#include <stdio.h>
#include <vector>
#include <map>
#include <memory>
#include <string>

#include "rick_params.h"
#include "world.h"
#include "platform.h"
#include "block.h"
#include "keyboard.h"
#include "colbox.h"
#include "animation.h"
#include "sound_handler.h"
#include "combat.h"
#include "test_invulnerability_rules.h"

#define CHARACTER_PLAYER 0
#define CHARACTER_ENEMY  1

class Camera;
class Character {
  protected:
    int type;

    int pos_x;
    int pos_y;

    int pos_x_chk;
    int pos_y_chk;

    bool using_bb;
    int  bb_x;
    int  bb_y;
    int  bb_width;
    int  bb_width_orig;
    int  bb_height;
    int  bb_height_orig;

    int height_orig;
    int height;
    int width_orig;
    int width;    

    int prevState;
    int state;
    int direction;
    int face;

    float speed_x;
    float speed_y;

    float speed_x_max;
    float speed_x_min;
    float speed_x_step;
    float speed_y_max;
    float speed_y_min;
    float speed_y_step;
    float climb_speed;
    float death_speed_multiplier;
    int jump_height;
    int death_rise;
    int crouching_height;
    int hit_hold_ticks;
    bool can_jump;
    bool can_crouch;
    bool can_climb;
    int action_neutral_state;
    int action_up_state;
    int action_down_state;
    int action_horizontal_state;
    bool damage_enabled;
    bool test_invulnerable = false;
    bool respawn_from_checkpoint;
    bool scale_during_death = true;

    int stepsInState;
    int stepsInDirectionX;
    int stepsInDirectionY;

    bool killed;

    // Collisions
    // - bounding boxes    
    Colbox extColExt;
    Colbox extHeightColExt;   
    Colbox heightColInt;
    Colbox heightColExt;
    Colbox heightColExtOrig;
    Colbox weightColExt;

    // - status
    bool inAir;
    bool inAirInt;
    bool inStairs;
    bool inFloor;
    bool inPlatform;
    bool overStairs;
    bool collisionHead;
    bool collisionHeadOrig;
    bool overStairsLeft;
    bool overStairsRight;
    bool blockCollisionLeft;
    bool blockCollisionRight;
    // Initial values for main variables
    int  initial_x;
    int  initial_y;
    int  initial_direction;
    int  initial_speed_x;
    int  initial_speed_y;
    int  initial_state;

    bool stop_move_block_col;

    float animation_scaling_factor;
    float visual_scale;

    Platform* inPlatformPtr;
    Block*    blockCollisionPtr;


    // Animations
    map<int, Animation*> animations;

    Animation* AnimationForState(int state_id) const;
    virtual void OnAnimationCycleComplete() {}
    virtual int AnimationState() const { return state; }

    // Camera pointer
    // - Needed to localize rick in the screen. Used for some animations.
    Camera* camera;

    SoundHandler* sound_handler;
    std::unique_ptr<CombatantState> combat_state;

  public:    
	  Character();    // class constructor
    Character(const char* file);    

    virtual ~Character();   // class destructor

    virtual void Reset();

    void SetPosX(World* map, int x);
    void SetPosY(World* map, int y, bool all);    

    int  GetPosX()       { return pos_x;     }
    int  GetPosY()       { return pos_y;     }    
    int  GetHeight()     { return height;    }
    int  GetWidth()      { return width;     }
    int  GetState()      { return state;     }
    int  GetDirection()  { return direction; }
    int  GetFace()       { return face;      }
    void ConfigureCombat(const CombatProfile* profile) { combat_state.reset(profile ? new CombatantState(profile) : NULL); }
    CombatantState* GetCombatState() { return combat_state.get(); }
    void SetTestInvulnerable(bool enabled) { test_invulnerable = enabled; }
    bool IsDamageEnabled() const { return PlayerDamageEnabled(damage_enabled, test_invulnerable); }
    virtual std::string GetCombatStateName() const;
    int GetCombatFrame() const { return AnimationForState(AnimationState())->GetCurrentAnim(); }

    int  GetBBX()        { return bb_x;      }
    int  GetBBY()        { return bb_y;      }
    int  GetBBWidth()    { return bb_width;  }
    int  GetBBHeight()   { return bb_height; }

    int  GetOrigHeight() { return height_orig; }
    int  GetOrigWidth()  { return width_orig;  }

    int  GetCorrectedPosX();
    int  GetCorrectedPosY();

    void GetCollisionsByCoords(World* map, Colbox &mask_col, int left_up_x, int left_up_y, int right_down_x, int right_down_y);
    void GetCollisionsExternalBoxExt(World* map, Colbox &mask_col);
    void GetCollisionsExternalHeightBoxExt(World* map, Colbox &mask_col);    
    void GetCollisionsInternalHeightBoxExt(World* map, Colbox &mask_col);
    void GetCollisionsInternalHeightBoxExtOrig(World* map, Colbox &mask_col);    
    void GetCollisionsInternalHeightBoxInt(World* map, Colbox &mask_col);
    void GetCollisionsInternalWeightBoxExt(World* map, Colbox &mask_col);    

    bool ComputeCollisionBlocks(World* map);

    void ComputeCollisions(World* map);
    virtual void ComputeNextState(World* map, Keyboard& keyboard);
    void ComputeNextPosition(World* map);
    void ComputeNextPositionBasedOnBlocks(World* map, Keyboard& keyboard);   // REVISIT: using keyboard to test block destruction
    void ComputeNextSpeed();
    void ComputeNextSound();

    void CharacterStep(World* map, Keyboard& keyboard);

    ALLEGRO_BITMAP* GetCurrentAnimationBitmap();
    int GetCurrentAnimationBitmapAttributes();
    int GetCurrentAnimationWidth();
    int GetCurrentAnimationHeight();
    float GetCurrentAnimationScalingFactor();
    void SetVisualScale(float value) { visual_scale = value; }

    void RegisterCamera(Camera* _camera) { camera = _camera; }

    bool GetKilled() { return killed; }
    void SetKilled(World* map);

    int GetType() { return type; }

    int GetStepsInDirectionX() { return stepsInDirectionX; }
    int GetStepsInDirectionY() { return stepsInDirectionY; }

    void RegisterSoundHandler(SoundHandler* handler) { sound_handler = handler; }

  protected:
    void FixHorizontalDirection(Keyboard& keyboard);
    bool AlignToStairs(World* map);
    bool SlopeStandingY(World* map, int at_x, int at_y, int tolerance,
                        int* standing_y) const;
    bool SnapToSlope(World* map, int tolerance);
    int GroundActionState(Keyboard& keyboard) const;
    bool IsActionStatePressed(int action_state, Keyboard& keyboard) const;
};

#endif // CHARACTER_H
