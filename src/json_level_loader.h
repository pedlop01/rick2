#ifndef JSON_LEVEL_LOADER_H
#define JSON_LEVEL_LOADER_H
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
struct ViewportConfig {
  int x;
  int y;
  int width;
  int height;
};
bool IsJsonLevelFile(const char* file);
std::string GetInitialLevelFromGamePackage(const char* file);
void LoadLevelPackage(const char* file);
const nlohmann::json& GetAnimationDefinition(const char* key);
const nlohmann::json& GetLevelMap();
const nlohmann::json& GetLevelEntities(const char* group);
const std::string& GetPlayerDefinition();
const nlohmann::json& GetProjectileDefinition(const char* projectile);
const std::vector<std::string>& GetLevelMusicFiles();
const std::vector<std::string>& GetLevelEffectFiles();
const ViewportConfig& GetDisplayConfig();
const ViewportConfig& GetCameraConfig();
int GetInitialMusic();
#endif
