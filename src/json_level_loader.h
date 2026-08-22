#ifndef JSON_LEVEL_LOADER_H
#define JSON_LEVEL_LOADER_H
#include <string>
#include <vector>
#include <nlohmann/json.hpp>
bool IsJsonLevelFile(const char* file);
void LoadLevelPackage(const char* file);
const nlohmann::json& GetAnimationDefinition(const char* key);
const nlohmann::json& GetLevelMap();
const nlohmann::json& GetLevelEntities(const char* group);
const std::string& GetPlayerDefinition();
const std::string& GetProjectileDefinition(const char* projectile);
const std::vector<std::string>& GetLevelMusicFiles();
const std::vector<std::string>& GetLevelEffectFiles();
#endif
