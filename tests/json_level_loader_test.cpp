#include "../src/json_level_loader.h"
#include "../src/data_loading.h"

#include <cassert>
#include <string>

int main()
{
  pugi::xml_document map_document;
  LoadWorldData(map_document, "levels/level1/level.json");
  pugi::xml_node map = map_document.child("map");
  assert(map.attribute("width").as_int() == 160);
  assert(map.attribute("height").as_int() == 255);

  pugi::xml_node tiles =
      map.find_child_by_attribute("layer", "name", "Tiles").child("data");
  assert(CountXmlChildren(tiles) == 160U * 255U);

  pugi::xml_document platforms;
  LoadReferencedData(platforms, "../levels/level1/platforms.xml");
  assert(CountXmlChildren(platforms.child("platforms")) == 17);

  pugi::xml_document player;
  LoadReferencedData(player, "../characters/rick.xml");
  assert(player.child("character").attribute("name").as_string() ==
         std::string("rick"));
  assert(CountXmlChildren(player.child("character").child("states")) == 9);

  bool missing_failed = false;
  try {
    pugi::xml_document missing;
    LoadWorldData(missing, "tests/does-not-exist.json");
  } catch (const DataLoadError& error) {
    missing_failed = std::string(error.what()).find("does-not-exist.json") !=
                     std::string::npos;
  }
  assert(missing_failed);
  return 0;
}
