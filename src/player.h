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

  public:    
	  Player();    // class constructor
    Player(const char* file);    

    ~Player() override;
    void Reset() override;
    void ComputeNextState(World* map, Keyboard& keyboard) override;
    void DispatchGameplayEvent(const std::string& event);
    std::string GetCombatStateName() const override;
};

#endif // PLAYER_H
