#ifndef JSON_LEVEL_LOADER_H
#define JSON_LEVEL_LOADER_H

#include <string>
#include <vector>

#include <nlohmann/json.hpp>
#include "pugixml.hpp"

bool IsJsonLevelFile(const char* file);
void LoadWorldData(pugi::xml_document& document, const char* file);
void LoadReferencedData(pugi::xml_document& document, const char* file);
const std::vector<std::string>& GetLevelMusicFiles();
const std::vector<std::string>& GetLevelEffectFiles();
const nlohmann::json& GetAnimationDefinition(const char* key);

#endif
