#ifndef DATA_LOADING_H
#define DATA_LOADING_H

#include <stdexcept>
#include <string>
#include <initializer_list>

#include "pugixml.hpp"

class DataLoadError : public std::runtime_error
{
  public:
    explicit DataLoadError(const std::string& message)
      : std::runtime_error(message) { }
};

inline void RequireXmlDocument(const pugi::xml_parse_result& result,
                               const char* file)
{
  if (!result) {
    throw DataLoadError(std::string("Cannot load '") + file + "': " +
                        result.description());
  }
}

inline pugi::xml_node RequireXmlChild(const pugi::xml_node& parent,
                                      const char* child_name,
                                      const char* file)
{
  pugi::xml_node child = parent.child(child_name);
  if (!child) {
    throw DataLoadError(std::string("Invalid '") + file +
                        "': missing <" + child_name + ">");
  }
  return child;
}

inline pugi::xml_attribute RequireXmlAttribute(const pugi::xml_node& node,
                                               const char* attribute_name,
                                               const char* file)
{
  pugi::xml_attribute attribute = node.attribute(attribute_name);
  if (!attribute || attribute.value()[0] == '\0') {
    throw DataLoadError(std::string("Invalid '") + file +
                        "': <" + node.name() + "> is missing attribute '" +
                        attribute_name + "'");
  }
  return attribute;
}

inline pugi::xml_attribute RequireXmlAttributePresent(
    const pugi::xml_node& node, const char* attribute_name, const char* file)
{
  pugi::xml_attribute attribute = node.attribute(attribute_name);
  if (!attribute) {
    throw DataLoadError(std::string("Invalid '") + file +
                        "': <" + node.name() + "> is missing attribute '" +
                        attribute_name + "'");
  }
  return attribute;
}

inline int RequirePositiveXmlInt(const pugi::xml_node& node,
                                 const char* attribute_name,
                                 const char* file)
{
  pugi::xml_attribute attribute =
      RequireXmlAttribute(node, attribute_name, file);
  const int value = attribute.as_int();
  if (value <= 0) {
    throw DataLoadError(std::string("Invalid '") + file + "': attribute '" +
                        attribute_name + "' in <" + node.name() +
                        "> must be a positive integer");
  }
  return value;
}

inline void RequireXmlAttributes(
    const pugi::xml_node& node, const char* file,
    std::initializer_list<const char*> attribute_names)
{
  for (std::initializer_list<const char*>::const_iterator it =
           attribute_names.begin();
       it != attribute_names.end(); ++it) {
    RequireXmlAttribute(node, *it, file);
  }
}

inline unsigned int CountXmlChildren(const pugi::xml_node& parent)
{
  unsigned int count = 0;
  for (pugi::xml_node child = parent.first_child(); child;
       child = child.next_sibling()) {
    if (child.type() == pugi::node_element) {
      ++count;
    }
  }
  return count;
}

inline void ValidateAnimationXml(const pugi::xml_document& document,
                                 const char* root_name, const char* file)
{
  pugi::xml_node root = RequireXmlChild(document, root_name, file);
  RequireXmlAttribute(root, "name", file);
  pugi::xml_node states = RequireXmlChild(root, "states", file);
  if (CountXmlChildren(states) == 0) {
    throw DataLoadError(std::string("Invalid '") + file +
                        "': <states> must contain at least one state");
  }

  for (pugi::xml_node state = states.first_child(); state;
       state = state.next_sibling()) {
    RequireXmlAttributes(state, file, {"name", "id"});
    pugi::xml_node animation = RequireXmlChild(state, "animation", file);
    RequireXmlAttributes(animation, file, {"bitmap", "speed"});
    if (CountXmlChildren(animation) == 0) {
      throw DataLoadError(std::string("Invalid '") + file +
                          "': <animation> must contain at least one sprite");
    }
    for (pugi::xml_node sprite = animation.first_child(); sprite;
         sprite = sprite.next_sibling()) {
      RequireXmlAttributes(sprite, file, {"x", "y", "width", "height"});
      RequirePositiveXmlInt(sprite, "width", file);
      RequirePositiveXmlInt(sprite, "height", file);
    }
  }
}

#endif
