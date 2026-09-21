#include "../src/json_level_loader.h"
#include "../src/data_loading.h"
#include "../src/rick_params.h"
#include <algorithm>
#include <cassert>
#include <cstdio>
#include <fstream>
#include <string>

int main() {
  assert(GetInitialLevelFromGamePackage("game.json") ==
         "./levels/level1/level.json");
  LoadLevelPackage("levels/level1/level.json");
  assert(GetRuntimeProfile().empty());
  const PlayerControllerConfig default_controller =
      GetRuntimePlayerControllerConfig();
  assert(default_controller.run_speed == 2.0f);
  assert(default_controller.air_control);
  assert(default_controller.ceiling_ends_ascent);
  assert(default_controller.jump_ascent_ticks == -1);
  assert(default_controller.collision_width == 13);
  const nlohmann::json& map = GetLevelMap();
  assert(map.at("width").get<int>() == 160);
  assert(map.at("height").get<int>() == 255);
  assert(map.at("layers").at("tiles").size() == 160U * 255U);
  assert(GetLevelEntities("platforms").size() == 17);
  assert(GetAnimationDefinition(GetPlayerDefinition().c_str()).at("name") == "rick");
  const nlohmann::json& bomb = GetProjectileDefinition("bomb");
  assert(GetAnimationDefinition(bomb.at("definition").get<std::string>().c_str()).at("kind") == "object");
  assert(bomb.at("width").get<int>() == 25);
  assert(GetDisplayConfig().width == 1280);
  assert(GetCameraConfig().height == 200);
  assert(GetInitialMusic() == 0);
  assert(!GetInitialMusicLoop());

  nlohmann::json reordered;
  {
    std::ifstream input("levels/level1/level.json");
    input >> reordered;
  }
  nlohmann::json& player_states =
      reordered["definitions"]["characters/rick"]["states"];
  std::reverse(player_states.begin(), player_states.end());
  const int tile_count = reordered["map"]["tileset"]["tileCount"].get<int>();
  reordered["map"]["layers"]["collisions"][0] = tile_count + 5;
  reordered["map"]["layers"]["collisions"][1] = tile_count + 6;
  reordered["audio"]["playback"]["initialLoop"] = true;
  const char* reordered_file = "/tmp/rick2-reordered-states.json";
  {
    std::ofstream output(reordered_file);
    output << reordered;
  }
  LoadLevelPackage(reordered_file);
  assert(GetAnimationDefinition("characters/rick").at("states").front().at("id") == 8);
  assert(GetInitialMusicLoop());

  nlohmann::json invalid_collision = reordered;
  invalid_collision["map"]["layers"]["collisions"][0] = tile_count + 7;
  const char* invalid_collision_file = "/tmp/rick2-invalid-collision.json";
  {
    std::ofstream output(invalid_collision_file);
    output << invalid_collision;
  }
  bool invalid_collision_failed = false;
  try { LoadLevelPackage(invalid_collision_file); }
  catch (const DataLoadError& error) {
    invalid_collision_failed = std::string(error.what()).find("GID outside range") !=
                               std::string::npos;
  }
  assert(invalid_collision_failed);

  reordered["runtimeProfile"] = {
      {"controller", {{"runSpeed", 4}, {"airControl", false}, {"ceilingEndsAscent", false}, {"jumpAscentTicks", 46}, {"collisionWidth", 9},
                      {"jumpHeight", 48}, {"climbSpeed", 1.5}}},
      {"capabilities", {{"bomb", false}}},
      {"actionBindings", {{"up", "hitting"}, {"down", nullptr}}},
      {"session", {{"deathAudioSlot", nullptr}, {"initialLives", 5},
                   {"damageEnabled", false}, {"respawn", "none"},
                   {"resetTriggersOnDeath", false}}},
      {"bindings", {
          {"playerStates", {{"running", "HERO_RUN"}}},
          {"enemyStates", {{"climbing", "ENEMY_LADDER"}}},
          {"objectStates", {{"dying", "BROKEN"}}},
          {"audio", {{"shot", 5}, {"bomb", nullptr}}}}}};
  {
    std::ifstream forms_input("tests/fixtures/character_forms.json");
    forms_input >> reordered["runtimeProfile"]["characterForms"];
  }
  reordered["definitions"]["characters/warrior"] = reordered["definitions"]["characters/rick"];
  reordered["definitions"]["characters/frog"] = reordered["definitions"]["characters/rick"];
  reordered["definitions"]["characters/warrior"]["states"][0]["name"] = "WARRIOR_IDLE";
  reordered["definitions"]["characters/warrior"]["states"][1]["name"] = "WARRIOR_WALK";
  reordered["definitions"]["characters/warrior"]["states"][2]["name"] = "WARRIOR_TRANSFORM";
  reordered["definitions"]["characters/frog"]["states"][0]["name"] = "FROG_IDLE";
  reordered["objective"] = {{"type", "reachZone"}, {"x", 10}, {"y", 20},
                            {"width", 16}, {"height", 24},
                            {"onComplete", "freeze"}};
  for (nlohmann::json& state : reordered["definitions"]["characters/rick"]["states"])
    if (state["name"] == "RICK_STATE_RUNNING") state["name"] = "HERO_RUN";
  {
    std::ofstream output(reordered_file);
    output << reordered;
  }
  LoadLevelPackage(reordered_file);
  assert(GetRuntimeProfile().at("controller").at("runSpeed").get<int>() == 4);
  assert(GetRuntimeProfile().at("characterForms").at("initialForm") == "warrior");
  const PlayerControllerConfig custom_controller =
      GetRuntimePlayerControllerConfig();
  assert(custom_controller.run_speed == 4.0f);
  assert(!custom_controller.air_control);
  assert(!custom_controller.ceiling_ends_ascent);
  assert(custom_controller.jump_ascent_ticks == 46);
  assert(custom_controller.collision_width == 9);
  assert(custom_controller.jump_height == 48);
  assert(custom_controller.climb_speed == 1.5f);
  const PlayerGameplayConfig custom_gameplay =
      GetRuntimePlayerGameplayConfig();
  assert(!custom_gameplay.bomb);
  assert(custom_gameplay.action_up == CHAR_STATE_HITTING);
  assert(custom_gameplay.action_down == -1);
  assert(ResolveCharacterAnimationStateId("characters/rick", "HERO_RUN", 99) ==
         CHAR_STATE_RUNNING);
  assert(ResolveCharacterAnimationStateId("characters/enemy", "ENEMY_LADDER", 99) ==
         CHAR_STATE_CLIMBING);
  assert(ResolveObjectAnimationStateId("BROKEN", 99) == 2);
  const RuntimeAudioBindings custom_audio = GetRuntimeAudioBindings();
  assert(custom_audio.shot == 5);
  assert(custom_audio.bomb == -1);
  assert(custom_audio.death == -1);
  const RuntimeSessionRules custom_session = GetRuntimeSessionRules();
  assert(custom_session.initial_lives == 5);
  assert(!custom_session.damage_enabled);
  assert(!custom_session.respawn_from_checkpoint);
  assert(!custom_session.reset_triggers_on_death);
  const LevelObjectiveConfig objective = GetLevelObjectiveConfig();
  assert(objective.enabled);
  assert(objective.x == 10 && objective.y == 20);
  assert(objective.width == 16 && objective.height == 24);
  assert(objective.freeze_on_complete);
  assert(objective.conditions.empty());

  player_states[1]["id"] = player_states[0]["id"];
  const char* duplicate_file = "/tmp/rick2-duplicate-state.json";
  {
    std::ofstream output(duplicate_file);
    output << reordered;
  }
  bool duplicate_failed = false;
  try { LoadLevelPackage(duplicate_file); }
  catch (const DataLoadError& error) {
    duplicate_failed = std::string(error.what()).find("animation state") !=
                       std::string::npos;
  }
  assert(duplicate_failed);

  reordered["units"]["simulationTicksPerSecond"] = 60;
  const char* incompatible_units_file = "/tmp/rick2-incompatible-units.json";
  {
    std::ofstream output(incompatible_units_file);
    output << reordered;
  }
  bool incompatible_units_failed = false;
  try { LoadLevelPackage(incompatible_units_file); }
  catch (const DataLoadError& error) {
    incompatible_units_failed = std::string(error.what()).find("gameplay units") !=
                                std::string::npos;
  }
  assert(incompatible_units_failed);
  std::remove(reordered_file);
  std::remove(duplicate_file);
  std::remove(incompatible_units_file);
  std::remove(invalid_collision_file);

  LoadLevelPackage("levels/level1/level.json");
  bool failed = false;
  try { LoadLevelPackage("tests/does-not-exist.json"); }
  catch (const DataLoadError& error) {
    failed = std::string(error.what()).find("does-not-exist.json") != std::string::npos;
  }
  assert(failed);
  return 0;
}
