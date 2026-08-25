#include "json_level_loader.h"
#include <fstream>
#include <map>
#include <set>
#include "data_loading.h"
#include "game_time.h"
#include "format_versions.h"
#include "rick_params.h"

namespace {
using json = nlohmann::json;
json package_data;
std::vector<std::string> music_files;
std::vector<std::string> effect_files;
std::string player_definition;
json projectile_definitions;
json runtime_profile;
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
  if (package.contains("runtimeProfile") && !package.at("runtimeProfile").is_object())
    throw DataLoadError(std::string("Invalid '") + file + "': invalid runtime profile");
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
  if (package.contains("runtimeProfile")) {
    const json& profile = package.at("runtimeProfile");
    if (profile.contains("bindings") &&
        profile.at("bindings").contains("playerStates")) {
      std::set<std::string> available_states;
      for (json::const_iterator state = definitions.at(player).at("states").begin();
           state != definitions.at(player).at("states").end(); ++state)
        available_states.insert(state->at("name").get<std::string>());
      const json& configured = profile.at("bindings").at("playerStates");
      for (json::const_iterator state = configured.begin(); state != configured.end(); ++state)
        if (!available_states.count(state.value().get<std::string>()))
          throw DataLoadError(std::string("Invalid '") + file +
                              "': player animation binding does not exist");
    }
  }
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
  if (package.contains("runtimeProfile")) {
    const json& profile = package.at("runtimeProfile");
    const auto validate_slots = [&](const json& slots) {
      for (json::const_iterator slot = slots.begin(); slot != slots.end(); ++slot)
        if (!slot.value().is_null() &&
            (slot.value().get<int>() < 0 ||
             static_cast<std::size_t>(slot.value().get<int>()) >= effects.size()))
          throw DataLoadError(std::string("Invalid '") + file +
                              "': runtime audio binding does not exist");
    };
    if (profile.contains("bindings") && profile.at("bindings").contains("audio"))
      validate_slots(profile.at("bindings").at("audio"));
    if (profile.contains("session") && profile.at("session").contains("deathAudioSlot"))
      validate_slots(json{{"deathAudioSlot", profile.at("session").at("deathAudioSlot")}});
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
    runtime_profile = value.value("runtimeProfile", json::object());
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
const nlohmann::json& GetRuntimeProfile() { return runtime_profile; }
PlayerControllerConfig GetRuntimePlayerControllerConfig() {
  PlayerControllerConfig config = {23, 13, 21, 15, 5, 2.0f, 1.0f, 3.0f,
                                   0.1f, 2.0f, 40, 80, 2.0f, 70, 20};
  if (runtime_profile.empty() || !runtime_profile.contains("controller"))
    return config;
  const json& value = runtime_profile.at("controller");
  config.sprite_width = value.value("spriteWidth", config.sprite_width);
  config.collision_width = value.value("collisionWidth", config.collision_width);
  config.standing_height = value.value("standingHeight", config.standing_height);
  config.crouching_height = value.value("crouchingHeight", config.crouching_height);
  config.collision_offset_x = value.value("collisionOffsetX", config.collision_offset_x);
  config.run_speed = value.value("runSpeed", config.run_speed);
  config.minimum_vertical_speed = value.value("minimumVerticalSpeed", config.minimum_vertical_speed);
  config.maximum_vertical_speed = value.value("maximumVerticalSpeed", config.maximum_vertical_speed);
  config.vertical_acceleration = value.value("verticalAcceleration", config.vertical_acceleration);
  config.climb_speed = value.value("climbSpeed", config.climb_speed);
  config.jump_height = value.value("jumpHeight", config.jump_height);
  config.death_rise = value.value("deathRise", config.death_rise);
  config.death_speed_multiplier = value.value("deathSpeedMultiplier", config.death_speed_multiplier);
  config.death_respawn_ticks = value.value("deathRespawnTicks", config.death_respawn_ticks);
  config.hit_hold_ticks = value.value("hitHoldTicks", config.hit_hold_ticks);
  if (config.sprite_width <= 0 || config.collision_width <= 0 ||
      config.standing_height <= 0 || config.crouching_height <= 0 ||
      config.crouching_height > config.standing_height ||
      config.collision_offset_x < 0 || config.run_speed < 0 ||
      config.minimum_vertical_speed <= 0 || config.maximum_vertical_speed <= 0 ||
      config.minimum_vertical_speed > config.maximum_vertical_speed ||
      config.vertical_acceleration <= 0 || config.climb_speed < 0 ||
      config.jump_height < 0 || config.death_rise < 0 ||
      config.death_speed_multiplier <= 0 || config.death_respawn_ticks <= 0 ||
      config.hit_hold_ticks < 0)
    throw DataLoadError("Invalid runtime player controller profile");
  return config;
}
PlayerGameplayConfig GetRuntimePlayerGameplayConfig() {
  PlayerGameplayConfig config = {true, true, true, true, true, true,
                                 CHAR_STATE_SHOOTING, CHAR_STATE_BOMBING,
                                 CHAR_STATE_HITTING};
  if (runtime_profile.empty()) return config;
  if (runtime_profile.contains("capabilities")) {
    const json& value = runtime_profile.at("capabilities");
    config.jump = value.value("jump", config.jump);
    config.crouch = value.value("crouch", config.crouch);
    config.climb = value.value("climb", config.climb);
    config.shoot = value.value("shoot", config.shoot);
    config.bomb = value.value("bomb", config.bomb);
    config.hit = value.value("hit", config.hit);
  }
  const auto action_state = [](const json& value, const char* key,
                               int fallback) {
    if (!value.contains(key)) return fallback;
    if (value.at(key).is_null()) return -1;
    const std::string action = value.at(key).get<std::string>();
    if (action == "shooting") return CHAR_STATE_SHOOTING;
    if (action == "bombing") return CHAR_STATE_BOMBING;
    if (action == "hitting") return CHAR_STATE_HITTING;
    throw DataLoadError("Invalid runtime player action binding");
  };
  if (runtime_profile.contains("actionBindings")) {
    const json& value = runtime_profile.at("actionBindings");
    config.action_up = action_state(value, "up", config.action_up);
    config.action_down = action_state(value, "down", config.action_down);
    config.action_horizontal = action_state(value, "horizontal",
                                            config.action_horizontal);
  }
  if (!config.shoot) {
    if (config.action_up == CHAR_STATE_SHOOTING) config.action_up = -1;
    if (config.action_down == CHAR_STATE_SHOOTING) config.action_down = -1;
    if (config.action_horizontal == CHAR_STATE_SHOOTING) config.action_horizontal = -1;
  }
  if (!config.bomb) {
    if (config.action_up == CHAR_STATE_BOMBING) config.action_up = -1;
    if (config.action_down == CHAR_STATE_BOMBING) config.action_down = -1;
    if (config.action_horizontal == CHAR_STATE_BOMBING) config.action_horizontal = -1;
  }
  if (!config.hit) {
    if (config.action_up == CHAR_STATE_HITTING) config.action_up = -1;
    if (config.action_down == CHAR_STATE_HITTING) config.action_down = -1;
    if (config.action_horizontal == CHAR_STATE_HITTING) config.action_horizontal = -1;
  }
  return config;
}
namespace {
std::string RuntimeStateName(const char* group, const char* semantic,
                             const char* fallback) {
  if (runtime_profile.contains("bindings")) {
    const json& bindings = runtime_profile.at("bindings");
    if (bindings.contains(group) && bindings.at(group).contains(semantic))
      return bindings.at(group).at(semantic).get<std::string>();
  }
  return fallback;
}
}

int ResolveCharacterAnimationStateId(const char* definition,
                                     const std::string& state_name,
                                     int authored_id) {
  if (player_definition == definition) {
    struct Binding { const char* semantic; const char* fallback; int id; };
    const Binding bindings[] = {
      {"stop", "RICK_STATE_STOP", CHAR_STATE_STOP},
      {"jumping", "RICK_STATE_JUMPING", CHAR_STATE_JUMPING},
      {"running", "RICK_STATE_RUNNING", CHAR_STATE_RUNNING},
      {"climbing", "RICK_STATE_CLIMBING", CHAR_STATE_CLIMBING},
      {"crouching", "RICK_STATE_CROUCHING", CHAR_STATE_CROUCHING},
      {"shooting", "RICK_STATE_SHOOTING", CHAR_STATE_SHOOTING},
      {"bombing", "RICK_STATE_BOMBING", CHAR_STATE_BOMBING},
      {"hitting", "RICK_STATE_HITTING", CHAR_STATE_HITTING},
      {"dead", "RICK_STATE_DYING", CHAR_STATE_DYING}
    };
    for (const Binding& binding : bindings)
      if (state_name == RuntimeStateName("playerStates", binding.semantic,
                                         binding.fallback))
        return binding.id;
  } else {
    struct Binding { const char* semantic; const char* fallback; int id; };
    const Binding bindings[] = {
      {"running", "CHAR_STATE_RUNNING", CHAR_STATE_RUNNING},
      {"climbing", "CHAR_STATE_CLIMBING", CHAR_STATE_CLIMBING},
      {"dying", "CHAR_STATE_DYING", CHAR_STATE_DYING}
    };
    for (const Binding& binding : bindings)
      if (state_name == RuntimeStateName("enemyStates", binding.semantic,
                                         binding.fallback))
        return binding.id;
  }
  return authored_id;
}

int ResolveObjectAnimationStateId(const std::string& state_name,
                                  int authored_id) {
  struct Binding { const char* semantic; const char* fallback; int id; };
  const Binding bindings[] = {{"stop", "OBJ_STATE_STOP", 0},
                              {"moving", "OBJ_STATE_MOVING", 1},
                              {"dying", "OBJ_STATE_DYING", 2}};
  for (const Binding& binding : bindings)
    if (state_name == RuntimeStateName("objectStates", binding.semantic,
                                       binding.fallback))
      return binding.id;
  return authored_id;
}

RuntimeAudioBindings GetRuntimeAudioBindings() {
  RuntimeAudioBindings result = {1, 2, 3, 6, 4, 5};
  const auto slot = [](const json& value, const char* key, int fallback) {
    if (!value.contains(key)) return fallback;
    return value.at(key).is_null() ? -1 : value.at(key).get<int>();
  };
  if (runtime_profile.contains("bindings") &&
      runtime_profile.at("bindings").contains("audio")) {
    const json& audio = runtime_profile.at("bindings").at("audio");
    result.shot = slot(audio, "shot", result.shot);
    result.bomb = slot(audio, "bomb", result.bomb);
    result.explosion = slot(audio, "explosion", result.explosion);
    result.bonus_pickup = slot(audio, "bonusPickup", result.bonus_pickup);
    result.item_pickup = slot(audio, "itemPickup", result.item_pickup);
  }
  if (runtime_profile.contains("session"))
    result.death = slot(runtime_profile.at("session"), "deathAudioSlot",
                        result.death);
  const int values[] = {result.shot, result.bomb, result.death,
                        result.explosion, result.bonus_pickup,
                        result.item_pickup};
  for (int value : values)
    if (value < -1 || (value >= 0 &&
        static_cast<std::size_t>(value) >= effect_files.size()))
      throw DataLoadError("Invalid runtime audio binding");
  return result;
}

RuntimeSessionRules GetRuntimeSessionRules() {
  RuntimeSessionRules result = {3, true, true, true};
  if (runtime_profile.empty() || !runtime_profile.contains("session"))
    return result;
  const json& value = runtime_profile.at("session");
  result.initial_lives = value.value("initialLives", result.initial_lives);
  result.damage_enabled = value.value("damageEnabled", result.damage_enabled);
  result.reset_triggers_on_death = value.value(
      "resetTriggersOnDeath", result.reset_triggers_on_death);
  result.respawn_from_checkpoint =
      value.value("respawn", std::string("checkpoint")) == "checkpoint";
  if (result.initial_lives <= 0)
    throw DataLoadError("Invalid runtime session rules");
  return result;
}

LevelObjectiveConfig GetLevelObjectiveConfig() {
  LevelObjectiveConfig result = {false, 0, 0, 0, 0, false};
  if (!package_data.contains("objective") ||
      package_data.at("objective").value("type", std::string("none")) == "none")
    return result;
  const json& value = package_data.at("objective");
  if (value.value("type", std::string()) != "reachZone")
    throw DataLoadError("Invalid level objective");
  result.enabled = true;
  result.x = value.at("x").get<int>();
  result.y = value.at("y").get<int>();
  result.width = value.at("width").get<int>();
  result.height = value.at("height").get<int>();
  result.freeze_on_complete =
      value.at("onComplete").get<std::string>() == "freeze";
  if (result.width <= 0 || result.height <= 0)
    throw DataLoadError("Invalid level objective zone");
  return result;
}
const std::vector<std::string>& GetLevelMusicFiles() { return music_files; }
const std::vector<std::string>& GetLevelEffectFiles() { return effect_files; }
const ViewportConfig& GetDisplayConfig() { return display_config; }
const ViewportConfig& GetCameraConfig() { return camera_config; }
int GetInitialMusic() { return initial_music; }
