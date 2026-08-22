#include "../src/json_level_loader.h"
#include "../src/data_loading.h"
#include <cassert>
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
  bool failed = false;
  try { LoadLevelPackage("tests/does-not-exist.json"); }
  catch (const DataLoadError& error) {
    failed = std::string(error.what()).find("does-not-exist.json") != std::string::npos;
  }
  assert(failed);
  return 0;
}
