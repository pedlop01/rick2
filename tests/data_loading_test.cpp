#include "../src/data_loading.h"

#include <cassert>
#include <string>

template <typename Function>
std::string ErrorFrom(Function function)
{
  try {
    function();
  } catch (const DataLoadError& error) {
    return error.what();
  }
  assert(false && "Expected DataLoadError");
  return "";
}

int main()
{
  pugi::xml_document missing;
  pugi::xml_parse_result missing_result =
      missing.load_file("/this/file/does/not/exist.xml");
  std::string missing_error = ErrorFrom(
      [&]() { RequireXmlDocument(missing_result, "missing.xml"); });
  assert(missing_error.find("missing.xml") != std::string::npos);

  pugi::xml_document document;
  pugi::xml_parse_result malformed = document.load_string("<map>");
  std::string malformed_error =
      ErrorFrom([&]() { RequireXmlDocument(malformed, "broken.tmx"); });
  assert(malformed_error.find("broken.tmx") != std::string::npos);

  pugi::xml_document incomplete;
  pugi::xml_parse_result loaded = incomplete.load_string("<map width='10'/>");
  RequireXmlDocument(loaded, "incomplete.tmx");
  pugi::xml_node map = RequireXmlChild(incomplete, "map", "incomplete.tmx");

  std::string child_error =
      ErrorFrom([&]() { RequireXmlChild(map, "tileset", "incomplete.tmx"); });
  assert(child_error.find("tileset") != std::string::npos);

  std::string attribute_error = ErrorFrom(
      [&]() { RequireXmlAttribute(map, "height", "incomplete.tmx"); });
  assert(attribute_error.find("height") != std::string::npos);

  pugi::xml_document optional_empty;
  optional_empty.load_string("<checkpoint nxt_chks=''/>");
  RequireXmlAttributePresent(optional_empty.child("checkpoint"), "nxt_chks",
                             "checkpoints.xml");

  pugi::xml_document invalid_number;
  invalid_number.load_string("<map width='0'/>");
  std::string number_error = ErrorFrom([&]() {
    RequirePositiveXmlInt(invalid_number.child("map"), "width", "zero.tmx");
  });
  assert(number_error.find("positive integer") != std::string::npos);

  pugi::xml_document children;
  children.load_string("<data><tile/><tile/><!-- ignored --></data>");
  assert(CountXmlChildren(children.child("data")) == 2);

  return 0;
}
