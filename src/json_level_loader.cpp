#include "json_level_loader.h"
#include <fstream>
#include <map>
#include "data_loading.h"

namespace {
using json = nlohmann::json;
json package_data;
std::vector<std::string> music_files;
std::vector<std::string> effect_files;
std::string player_definition;
std::map<std::string, std::string> projectile_definitions;

const json& Require(const json& object, const char* key, const char* file) {
  if (!object.is_object() || !object.contains(key))
    throw DataLoadError(std::string("Invalid '") + file + "': missing '" + key + "'");
  return object.at(key);
}

void ValidatePackage(const json& package, const char* file) {
  const json& map = Require(package, "map", file);
  const int width = Require(map, "width", file).get<int>();
  const int height = Require(map, "height", file).get<int>();
  if (width <= 0 || height <= 0 || Require(map, "tileWidth", file).get<int>() <= 0 ||
      Require(map, "tileHeight", file).get<int>() <= 0)
    throw DataLoadError(std::string("Invalid '") + file + "': invalid map dimensions");
  const json& tileset = Require(map, "tileset", file);
  Require(tileset, "image", file); Require(tileset, "tileCount", file);
  Require(tileset, "columns", file);
  const json& layers = Require(map, "layers", file);
  const std::size_t cells = static_cast<std::size_t>(width) * height;
  const char* layer_names[] = {"tiles", "frontTiles", "collisions"};
  for (const char* name : layer_names) {
    const json& layer = Require(layers, name, file);
    if (!layer.is_array() || layer.size() != cells)
      throw DataLoadError(std::string("Invalid '") + file + "': invalid layer " + name);
  }
  const json& entities = Require(package, "entities", file);
  const char* groups[] = {"platforms", "items", "backgroundObjects", "blocks",
                          "hazards", "checkpoints", "lasers", "triggers",
                          "enemies", "cameraViews"};
  for (const char* group : groups)
    if (!Require(entities, group, file).is_array())
      throw DataLoadError(std::string("Invalid '") + file + "': invalid group " + group);
  const json& definitions = Require(package, "definitions", file);
  if (!definitions.is_object() || definitions.empty())
    throw DataLoadError(std::string("Invalid '") + file + "': missing definitions");
  for (json::const_iterator definition = definitions.begin(); definition != definitions.end(); ++definition) {
    Require(definition.value(), "name", file); Require(definition.value(), "kind", file);
    const json& states = Require(definition.value(), "states", file);
    if (!states.is_array() || states.empty())
      throw DataLoadError(std::string("Invalid '") + file + "': definition without states");
    for (json::const_iterator state = states.begin(); state != states.end(); ++state) {
      Require(*state, "name", file); Require(*state, "id", file);
      const json& animation = Require(*state, "animation", file);
      Require(animation, "bitmap", file); Require(animation, "speed", file);
      const json& sprites = Require(animation, "sprites", file);
      if (!sprites.is_array() || sprites.empty())
        throw DataLoadError(std::string("Invalid '") + file + "': animation without sprites");
      for (json::const_iterator sprite = sprites.begin(); sprite != sprites.end(); ++sprite) {
        Require(*sprite, "x", file); Require(*sprite, "y", file);
        if (Require(*sprite, "width", file).get<int>() <= 0 ||
            Require(*sprite, "height", file).get<int>() <= 0)
          throw DataLoadError(std::string("Invalid '") + file + "': invalid sprite size");
      }
    }
  }
}
}

bool IsJsonLevelFile(const char* file) {
  const std::string path(file);
  return path.size() >= 5 && path.substr(path.size() - 5) == ".json";
}

void LoadLevelPackage(const char* file) {
  if (!IsJsonLevelFile(file)) throw DataLoadError("Runtime levels must use JSON");
  try {
    std::ifstream input(file);
    if (!input) throw DataLoadError(std::string("Cannot load '") + file + "'");
    json value; input >> value;
    if (value.value("formatVersion", 0) != 1 || value.value("kind", "") != "rick2.level")
      throw DataLoadError(std::string("Invalid '") + file + "': unsupported format");
    ValidatePackage(value, file);
    const json& audio = value.at("audio");
    music_files = audio.at("music").get<std::vector<std::string> >();
    effect_files = audio.at("effects").get<std::vector<std::string> >();
    player_definition = value.at("player").at("definition").get<std::string>();
    projectile_definitions =
        value.at("projectiles").get<std::map<std::string, std::string> >();
    package_data = value;
  } catch (const DataLoadError&) { throw; }
  catch (const std::exception& error) {
    throw DataLoadError(std::string("Invalid '") + file + "': " + error.what());
  }
}

const nlohmann::json& GetAnimationDefinition(const char* key) {
  try { return package_data.at("definitions").at(key); }
  catch (const std::exception&) { throw DataLoadError(std::string("Missing definition '") + key + "'"); }
}
const nlohmann::json& GetLevelMap() { return package_data.at("map"); }
const nlohmann::json& GetLevelEntities(const char* group) {
  try { return package_data.at("entities").at(group); }
  catch (const std::exception&) { throw DataLoadError(std::string("Missing entity group '") + group + "'"); }
}
const std::string& GetPlayerDefinition() { return player_definition; }
const std::string& GetProjectileDefinition(const char* projectile) {
  try { return projectile_definitions.at(projectile); }
  catch (const std::exception&) {
    throw DataLoadError(std::string("Missing projectile definition '") + projectile + "'");
  }
}
const std::vector<std::string>& GetLevelMusicFiles() { return music_files; }
const std::vector<std::string>& GetLevelEffectFiles() { return effect_files; }
