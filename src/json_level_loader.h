#ifndef JSON_LEVEL_LOADER_H
#define JSON_LEVEL_LOADER_H
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
#include "combat.h"
struct ViewportConfig {
  int x;
  int y;
  int width;
  int height;
};
struct PlayerControllerConfig {
  int sprite_width;
  int collision_width;
  int standing_height;
  int crouching_height;
  int collision_offset_x;
  float run_speed;
  bool air_control;
  float minimum_vertical_speed;
  float maximum_vertical_speed;
  float vertical_acceleration;
  float climb_speed;
  int jump_height;
  int death_rise;
  float death_speed_multiplier;
  int death_respawn_ticks;
  int hit_hold_ticks;
};
struct PlayerGameplayConfig {
  bool jump;
  bool crouch;
  bool climb;
  bool shoot;
  bool bomb;
  bool hit;
  int action_neutral;
  int action_up;
  int action_down;
  int action_horizontal;
};
struct RuntimeAudioBindings {
  int shot;
  int bomb;
  int death;
  int explosion;
  int bonus_pickup;
  int item_pickup;
};
struct RuntimeSessionRules {
  int initial_lives;
  bool damage_enabled;
  bool respawn_from_checkpoint;
  bool reset_triggers_on_death;
};
struct LevelObjectiveConfig {
  bool enabled;
  int x;
  int y;
  int width;
  int height;
  bool freeze_on_complete;
};
bool IsJsonLevelFile(const char* file);
std::string GetInitialLevelFromGamePackage(const char* file);
void LoadLevelPackage(const char* file);
void SetProjectRoot(const std::string& root);
const nlohmann::json& GetAnimationDefinition(const char* key);
const nlohmann::json& GetLevelMap();
const nlohmann::json& GetLevelEntities(const char* group);
const std::string& GetPlayerDefinition();
const nlohmann::json& GetProjectileDefinition(const char* projectile);
const nlohmann::json& GetRuntimeProfile();
const nlohmann::json& GetGameplayProgramDefinition();
const nlohmann::json& GetPresentationDefinition();
const nlohmann::json& GetPlayerConfig();
const CombatCatalog& GetCombatCatalog();
PlayerControllerConfig GetRuntimePlayerControllerConfig();
PlayerGameplayConfig GetRuntimePlayerGameplayConfig();
int ResolveCharacterAnimationStateId(const char* definition,
                                     const std::string& state_name,
                                     int authored_id);
int ResolveObjectAnimationStateId(const std::string& state_name,
                                  int authored_id);
RuntimeAudioBindings GetRuntimeAudioBindings();
RuntimeSessionRules GetRuntimeSessionRules();
LevelObjectiveConfig GetLevelObjectiveConfig();
const std::vector<std::string>& GetLevelMusicFiles();
const std::vector<std::string>& GetLevelEffectFiles();
const ViewportConfig& GetDisplayConfig();
const ViewportConfig& GetCameraConfig();
int GetInitialMusic();
bool GetInitialMusicLoop();
#endif
