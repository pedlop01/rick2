#include "../src/json_level_loader.h"
#include "../src/data_loading.h"
#include <cassert>
#include <string>

int main() {
  LoadLevelPackage("levels/level1/level.json");
  const nlohmann::json& map = GetLevelMap();
  assert(map.at("width").get<int>() == 160);
  assert(map.at("height").get<int>() == 255);
  assert(map.at("layers").at("tiles").size() == 160U * 255U);
  assert(GetLevelEntities("platforms").size() == 17);
  assert(GetAnimationDefinition(GetPlayerDefinition().c_str()).at("name") == "rick");
  assert(GetAnimationDefinition(GetProjectileDefinition("bomb").c_str()).at("kind") == "object");
  bool failed = false;
  try { LoadLevelPackage("tests/does-not-exist.json"); }
  catch (const DataLoadError& error) {
    failed = std::string(error.what()).find("does-not-exist.json") != std::string::npos;
  }
  assert(failed);
  return 0;
}
