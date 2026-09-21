#ifndef PLAYER_H
#define PLAYER_H

#include <stdio.h>
#include <vector>

#include "rick_params.h"
#include "character.h"
#include "character_state_machine.h"

class Player : public Character {
  private:
    void ApplyRuntimeControllerProfile();
    void ApplyFormProfile(const nlohmann::json& form);
    void LoadFormAnimations(const std::string& definition);
    void SelectFormAnimation();
    int AnimationState() const override;
    std::unique_ptr<CharacterForms> forms;
    std::string loaded_form_definition;
    int form_animation_state = CHAR_STATE_STOP;
    bool air_control = true;
    int jump_distance_x = -1;
    int jump_ascent_ticks = -1;
    int jump_ascent_elapsed = 0;
    bool ceiling_ends_ascent = true;
    bool scene_visible = true;
    bool scene_controllable = true;
    bool forced_state_pending = false;
    bool keep_moving = false;
    void OnAnimationCycleComplete() override { keep_moving = false; }

  public:    
	  Player();    // class constructor
    Player(const char* file);    

    ~Player() override;
    void SpawnAtCheckpoint(World* world);
    void Reset() override;
    void ComputeNextState(World* map, Keyboard& keyboard) override;
    void DispatchGameplayEvent(const std::string& event);
    void ForceState(const std::string& state, const std::string& previous_state);
    void KeepMoving() { keep_moving = true; }
    void SetSceneMode(bool visible, bool controllable) { scene_visible = visible; scene_controllable = controllable; }
    bool SceneVisible() const { return scene_visible; }
    bool SceneControllable() const { return scene_controllable; }
    std::string GetCombatStateName() const override;
};

#endif // PLAYER_H
