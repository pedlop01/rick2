#include "../src/json_level_loader.h"
#include "../src/data_loading.h"
#include <algorithm>
#include <cassert>
#include <cstdio>
#include <fstream>
#include <string>

int main() {
  assert(GetInitialLevelFromGamePackage("game.json") ==
         "./levels/level1/level.json");
  LoadLevelPackage("levels/level1/level.json");
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

  nlohmann::json reordered;
  {
    std::ifstream input("levels/level1/level.json");
    input >> reordered;
  }
  nlohmann::json& player_states =
      reordered["definitions"]["characters/rick"]["states"];
  std::reverse(player_states.begin(), player_states.end());
  const char* reordered_file = "/tmp/rick2-reordered-states.json";
  {
    std::ofstream output(reordered_file);
    output << reordered;
  }
  LoadLevelPackage(reordered_file);
  assert(GetAnimationDefinition("characters/rick").at("states").front().at("id") == 8);

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
  std::remove(reordered_file);
  std::remove(duplicate_file);

  LoadLevelPackage("levels/level1/level.json");
  bool failed = false;
  try { LoadLevelPackage("tests/does-not-exist.json"); }
  catch (const DataLoadError& error) {
    failed = std::string(error.what()).find("does-not-exist.json") != std::string::npos;
  }
  assert(failed);
  return 0;
}
