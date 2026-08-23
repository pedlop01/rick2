#include "json_level_loader.h"
#include <fstream>
#include <map>
#include <set>
#include "data_loading.h"
#include "game_time.h"
#include "format_versions.h"

namespace {
using json = nlohmann::json;
json package_data;
std::vector<std::string> music_files;
std::vector<std::string> effect_files;
std::string player_definition;
json projectile_definitions;
ViewportConfig display_config;
ViewportConfig camera_config;
int initial_music;

std::string ParentPath(const std::string& path) {
  const std::string::size_type separator = path.find_last_of("/\\");
  return separator == std::string::npos ? "." : path.substr(0, separator);
}

std::string ResolvePath(const std::string& base, const std::string& path) {
  if (path.empty() || path[0] == '/' ||
      (path.size() > 1 && path[1] == ':')) {
    return path;
  }
  return base + "/" + path;
}

const json& Require(const json& object, const char* key, const char* file) {
  if (!object.is_object() || !object.contains(key))
    throw DataLoadError(std::string("Invalid '") + file + "': missing '" + key + "'");
  return object.at(key);
}

void ValidatePackage(const json& package, const char* file) {
  const json& units = Require(package, "units", file);
  if (Require(units, "simulationTicksPerSecond", file).get<unsigned int>() !=
          GameTime::TICKS_PER_SECOND ||
      Require(units, "duration", file).get<std::string>() != "ticks" ||
      Require(units, "distance", file).get<std::string>() != "pixels" ||
      Require(units, "speed", file).get<std::string>() != "pixelsPerTick") {
    throw DataLoadError(std::string("Invalid '") + file +
                        "': unsupported gameplay units");
  }
  const json& display = Require(package, "display", file);
  const json& camera = Require(package, "camera", file);
  if (Require(display, "width", file).get<int>() <= 0 ||
      Require(display, "height", file).get<int>() <= 0 ||
      Require(camera, "width", file).get<int>() <= 0 ||
      Require(camera, "height", file).get<int>() <= 0) {
    throw DataLoadError(std::string("Invalid '") + file + "': invalid viewport dimensions");
  }
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
    std::set<int> state_ids;
    std::set<std::string> state_names;
    for (json::const_iterator state = states.begin(); state != states.end(); ++state) {
      const std::string state_name = Require(*state, "name", file).get<std::string>();
      const int state_id = Require(*state, "id", file).get<int>();
      if (state_name.empty() || state_id < 0 ||
          !state_ids.insert(state_id).second ||
          !state_names.insert(state_name).second) {
        throw DataLoadError(std::string("Invalid '") + file +
                            "': duplicate or invalid animation state in '" +
                            definition.key() + "'");
      }
      const json& animation = Require(*state, "animation", file);
      Require(animation, "bitmap", file);
      if (Require(animation, "frameDurationTicks", file).get<int>() <= 0)
        throw DataLoadError(std::string("Invalid '") + file +
                            "': animation duration must be positive");
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
  const std::string player = Require(Require(package, "player", file),
                                     "definition", file).get<std::string>();
  if (!definitions.contains(player))
    throw DataLoadError(std::string("Invalid '") + file + "': missing player definition");
  const json& projectiles = Require(package, "projectiles", file);
  const char* projectile_names[] = {"shoot", "bomb"};
  for (const char* name : projectile_names) {
    const json& projectile = Require(projectiles, name, file);
    const std::string definition = Require(projectile, "definition", file).get<std::string>();
    if (!definitions.contains(definition) ||
        Require(projectile, "width", file).get<int>() <= 0 ||
        Require(projectile, "height", file).get<int>() <= 0) {
      throw DataLoadError(std::string("Invalid '") + file +
                          "': invalid projectile " + name);
    }
    Require(projectile, "yOffset", file);
  }
  const json& audio = Require(package, "audio", file);
  const json& music = Require(audio, "music", file);
  const json& effects = Require(audio, "effects", file);
  const int initial_music_index = Require(audio, "initialMusic", file).get<int>();
  if (!music.is_array() || music.empty() || !effects.is_array() ||
      effects.size() != 7 || initial_music_index < 0 ||
      static_cast<std::size_t>(initial_music_index) >= music.size()) {
    throw DataLoadError(std::string("Invalid '") + file + "': invalid audio configuration");
  }
}
}

bool IsJsonLevelFile(const char* file) {
  const std::string path(file);
  return path.size() >= 5 && path.substr(path.size() - 5) == ".json";
}

std::string GetInitialLevelFromGamePackage(const char* file) {
  try {
    std::ifstream input(file);
    if (!input) throw DataLoadError(std::string("Cannot load '") + file + "'");
    json game; input >> game;
    if (game.value("formatVersion", 0) != FormatVersions::GAME ||
        game.value("kind", "") != "rick2.game" ||
        !game.contains("initialLevel") ||
        !game["initialLevel"].is_string() ||
        game["initialLevel"].get<std::string>().empty()) {
      throw DataLoadError(std::string("Invalid '") + file + "': unsupported game package");
    }
    return ResolvePath(ParentPath(file),
                       game["initialLevel"].get<std::string>());
  } catch (const DataLoadError&) { throw; }
  catch (const std::exception& error) {
    throw DataLoadError(std::string("Invalid '") + file + "': " + error.what());
  }
}

void LoadLevelPackage(const char* file) {
  if (!IsJsonLevelFile(file)) throw DataLoadError("Runtime levels must use JSON");
  try {
    std::ifstream input(file);
    if (!input) throw DataLoadError(std::string("Cannot load '") + file + "'");
    json value; input >> value;
    if (value.value("formatVersion", 0) != FormatVersions::LEVEL ||
        value.value("kind", "") != "rick2.level")
      throw DataLoadError(std::string("Invalid '") + file + "': unsupported format");
    ValidatePackage(value, file);
    const std::string package_directory = ParentPath(file);
    value["map"]["tileset"]["image"] = ResolvePath(
        package_directory, value["map"]["tileset"]["image"].get<std::string>());
    for (json::iterator definition = value["definitions"].begin();
         definition != value["definitions"].end(); ++definition) {
      for (json::iterator state = definition.value()["states"].begin();
           state != definition.value()["states"].end(); ++state) {
        (*state)["animation"]["bitmap"] = ResolvePath(
            package_directory,
            (*state)["animation"]["bitmap"].get<std::string>());
      }
    }
    json& audio = value["audio"];
    for (json::iterator path = audio["music"].begin(); path != audio["music"].end(); ++path)
      *path = ResolvePath(package_directory, path->get<std::string>());
    for (json::iterator path = audio["effects"].begin(); path != audio["effects"].end(); ++path)
      *path = ResolvePath(package_directory, path->get<std::string>());
    music_files = audio.at("music").get<std::vector<std::string> >();
    effect_files = audio.at("effects").get<std::vector<std::string> >();
    initial_music = audio.at("initialMusic").get<int>();
    player_definition = value.at("player").at("definition").get<std::string>();
    projectile_definitions = value.at("projectiles");
    const json& display = value.at("display");
    display_config = {0, 0, display.at("width").get<int>(),
                      display.at("height").get<int>()};
    const json& camera = value.at("camera");
    camera_config = {camera.at("x").get<int>(), camera.at("y").get<int>(),
                     camera.at("width").get<int>(), camera.at("height").get<int>()};
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
const nlohmann::json& GetProjectileDefinition(const char* projectile) {
  try { return projectile_definitions.at(projectile); }
  catch (const std::exception&) {
    throw DataLoadError(std::string("Missing projectile definition '") + projectile + "'");
  }
}
const std::vector<std::string>& GetLevelMusicFiles() { return music_files; }
const std::vector<std::string>& GetLevelEffectFiles() { return effect_files; }
const ViewportConfig& GetDisplayConfig() { return display_config; }
const ViewportConfig& GetCameraConfig() { return camera_config; }
int GetInitialMusic() { return initial_music; }
