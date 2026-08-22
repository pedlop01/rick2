#include "json_level_loader.h"

#include <fstream>
#include <map>
#include <sstream>
#include <string>

#include <nlohmann/json.hpp>

#include "data_loading.h"

namespace {

using json = nlohmann::json;
std::map<std::string, std::string> referenced_documents;
std::vector<std::string> music_files;
std::vector<std::string> effect_files;

const json& RequireJsonMember(const json& value, const char* member,
                              const char* file)
{
  if (!value.is_object() || !value.contains(member)) {
    throw DataLoadError(std::string("Invalid '") + file +
                        "': missing JSON member '" + member + "'");
  }
  return value.at(member);
}

std::string ScalarText(const json& value)
{
  if (value.is_string()) return value.get<std::string>();
  if (value.is_boolean()) return value.get<bool>() ? "true" : "false";
  if (value.is_number_float()) return std::to_string(value.get<double>());
  if (value.is_number_integer()) return std::to_string(value.get<long long>());
  throw DataLoadError("JSON attributes must be strings, numbers or booleans");
}

void AppendJsonElement(pugi::xml_node parent, const char* name,
                       const json& value)
{
  pugi::xml_node node = parent.append_child(name);
  for (json::const_iterator it = value.begin(); it != value.end(); ++it) {
    if (it.value().is_primitive()) {
      node.append_attribute(it.key().c_str()).set_value(
          ScalarText(it.value()).c_str());
    }
  }
  for (json::const_iterator it = value.begin(); it != value.end(); ++it) {
    if (it.value().is_object()) {
      AppendJsonElement(node, it.key().c_str(), it.value());
    } else if (it.value().is_array()) {
      std::string child_name = it.key();
      if (!child_name.empty() && child_name[child_name.size() - 1] == 's') {
        child_name.erase(child_name.size() - 1);
      }
      for (json::const_iterator child = it.value().begin();
           child != it.value().end(); ++child) {
        AppendJsonElement(node, child_name.c_str(), *child);
      }
    }
  }
}

std::string SerializeDocument(const pugi::xml_document& document)
{
  std::ostringstream output;
  document.save(output, "  ", pugi::format_raw);
  return output.str();
}

void RegisterDefinitions(const json& definitions, const char* file)
{
  if (!definitions.is_object() || definitions.empty()) {
    throw DataLoadError(std::string("Invalid '") + file +
                        "': definitions must be a non-empty object");
  }
  for (json::const_iterator definition = definitions.begin();
       definition != definitions.end(); ++definition) {
    const json& value = definition.value();
    const std::string kind = RequireJsonMember(value, "kind", file).get<std::string>();
    if (kind != "object" && kind != "character") {
      throw DataLoadError(std::string("Invalid '") + file +
                          "': definition kind must be object or character");
    }
    pugi::xml_document xml;
    pugi::xml_node root = xml.append_child(kind.c_str());
    root.append_attribute("name").set_value(
        RequireJsonMember(value, "name", file).get<std::string>().c_str());
    pugi::xml_node states = root.append_child("states");
    const json& state_values = RequireJsonMember(value, "states", file);
    if (!state_values.is_array() || state_values.empty()) {
      throw DataLoadError(std::string("Invalid '") + file +
                          "': every definition requires states");
    }
    for (json::const_iterator state = state_values.begin();
         state != state_values.end(); ++state) {
      pugi::xml_node state_node = states.append_child("state");
      state_node.append_attribute("name").set_value(state->at("name").get<std::string>().c_str());
      state_node.append_attribute("id").set_value(state->at("id").get<int>());
      const json& animation = state->at("animation");
      pugi::xml_node animation_node = state_node.append_child("animation");
      animation_node.append_attribute("bitmap").set_value(animation.at("bitmap").get<std::string>().c_str());
      animation_node.append_attribute("speed").set_value(animation.at("speed").get<int>());
      for (json::const_iterator sprite = animation.at("sprites").begin();
           sprite != animation.at("sprites").end(); ++sprite) {
        AppendJsonElement(animation_node, "sprite", *sprite);
      }
    }
    referenced_documents[definition.key()] = SerializeDocument(xml);
  }
}

void RegisterEntityGroups(const json& entities, const char* file)
{
  struct Group { const char* json_name; const char* xml_file; const char* root; const char* item; };
  const Group groups[] = {
      {"platforms", "../levels/level1/platforms.xml", "platforms", "platform"},
      {"items", "../levels/level1/items.xml", "items", "item"},
      {"backgroundObjects", "../levels/level1/anim_tiles.xml", "anim_objects", "anim_object"},
      {"blocks", "../levels/level1/blocks.xml", "blocks", "block"},
      {"hazards", "../levels/level1/hazards.xml", "hazards", "hazard"},
      {"checkpoints", "../levels/level1/checkpoints.xml", "checkpoints", "checkpoint"},
      {"lasers", "../levels/level1/lasers.xml", "lasers", "laser"},
      {"triggers", "../levels/level1/triggers.xml", "triggers", "trigger"},
      {"enemies", "../levels/level1/enemies.xml", "enemies", "enemy"},
      {"cameraViews", "../levels/level1/camera_views.xml", "views", "view"}};

  for (const Group& group : groups) {
    const json& values = RequireJsonMember(entities, group.json_name, file);
    if (!values.is_array()) {
      throw DataLoadError(std::string("Invalid '") + file + "': entity group '" +
                          group.json_name + "' must be an array");
    }
    pugi::xml_document xml;
    pugi::xml_node root = xml.append_child(group.root);
    for (json::const_iterator value = values.begin(); value != values.end(); ++value) {
      AppendJsonElement(root, group.item, *value);
    }
    referenced_documents[group.xml_file] = SerializeDocument(xml);
  }
}

void BuildMapDocument(pugi::xml_document& document, const json& package,
                      const char* file)
{
  const json& map = RequireJsonMember(package, "map", file);
  const int width = map.at("width").get<int>();
  const int height = map.at("height").get<int>();
  if (width <= 0 || height <= 0) {
    throw DataLoadError(std::string("Invalid '") + file +
                        "': map dimensions must be positive");
  }
  pugi::xml_node map_node = document.append_child("map");
  map_node.append_attribute("width").set_value(width);
  map_node.append_attribute("height").set_value(height);
  map_node.append_attribute("tilewidth").set_value(map.at("tileWidth").get<int>());
  map_node.append_attribute("tileheight").set_value(map.at("tileHeight").get<int>());
  const json& tileset = map.at("tileset");
  pugi::xml_node tileset_node = map_node.append_child("tileset");
  tileset_node.append_attribute("name").set_value(tileset.at("image").get<std::string>().c_str());
  tileset_node.append_attribute("tilecount").set_value(tileset.at("tileCount").get<int>());
  tileset_node.append_attribute("columns").set_value(tileset.at("columns").get<int>());
  tileset_node.append_attribute("tilewidth").set_value(map.at("tileWidth").get<int>());
  tileset_node.append_attribute("tileheight").set_value(map.at("tileHeight").get<int>());

  const char* json_layers[] = {"tiles", "frontTiles", "collisions"};
  const char* xml_layers[] = {"Tiles", "FrontTiles", "Collisions"};
  const json& layers = map.at("layers");
  const std::size_t expected = static_cast<std::size_t>(width) * height;
  for (int index = 0; index < 3; ++index) {
    const json& values = layers.at(json_layers[index]);
    if (!values.is_array() || values.size() != expected) {
      throw DataLoadError(std::string("Invalid '") + file + "': layer '" +
                          json_layers[index] + "' has an incorrect size");
    }
    pugi::xml_node layer = map_node.append_child("layer");
    layer.append_attribute("name").set_value(xml_layers[index]);
    pugi::xml_node data = layer.append_child("data");
    for (json::const_iterator value = values.begin(); value != values.end(); ++value) {
      data.append_child("tile").append_attribute("gid").set_value(value->get<int>());
    }
  }
}

}  // namespace

bool IsJsonLevelFile(const char* file)
{
  const std::string path(file);
  return path.size() >= 5 && path.substr(path.size() - 5) == ".json";
}

void LoadWorldData(pugi::xml_document& document, const char* file)
{
  if (!IsJsonLevelFile(file)) {
    RequireXmlDocument(document.load_file(file), file);
    return;
  }
  try {
    std::ifstream input(file);
    if (!input) throw DataLoadError(std::string("Cannot load '") + file + "'");
    json package;
    input >> package;
    if (package.value("formatVersion", 0) != 1 ||
        package.value("kind", "") != "rick2.level") {
      throw DataLoadError(std::string("Invalid '") + file +
                          "': unsupported formatVersion or kind");
    }
    referenced_documents.clear();
    music_files = RequireJsonMember(RequireJsonMember(package, "audio", file),
                                    "music", file).get<std::vector<std::string> >();
    effect_files = RequireJsonMember(RequireJsonMember(package, "audio", file),
                                     "effects", file).get<std::vector<std::string> >();
    RegisterDefinitions(RequireJsonMember(package, "definitions", file), file);
    RegisterEntityGroups(RequireJsonMember(package, "entities", file), file);
    BuildMapDocument(document, package, file);
  } catch (const DataLoadError&) {
    throw;
  } catch (const std::exception& error) {
    throw DataLoadError(std::string("Invalid '") + file + "': " + error.what());
  }
}

const std::vector<std::string>& GetLevelMusicFiles()
{
  return music_files;
}

const std::vector<std::string>& GetLevelEffectFiles()
{
  return effect_files;
}

void LoadReferencedData(pugi::xml_document& document, const char* file)
{
  std::map<std::string, std::string>::const_iterator found =
      referenced_documents.find(file);
  if (found == referenced_documents.end()) {
    RequireXmlDocument(document.load_file(file), file);
    return;
  }
  RequireXmlDocument(document.load_string(found->second.c_str()), file);
}
