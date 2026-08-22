#ifndef JSON_LEVEL_LOADER_H
#define JSON_LEVEL_LOADER_H

#include <string>
#include <vector>

#include "pugixml.hpp"

bool IsJsonLevelFile(const char* file);
void LoadWorldData(pugi::xml_document& document, const char* file);
void LoadReferencedData(pugi::xml_document& document, const char* file);
const std::vector<std::string>& GetLevelMusicFiles();
const std::vector<std::string>& GetLevelEffectFiles();

#endif
