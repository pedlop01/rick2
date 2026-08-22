#ifndef DATA_LOADING_H
#define DATA_LOADING_H
#include <stdexcept>
#include <string>
class DataLoadError : public std::runtime_error {
 public:
  explicit DataLoadError(const std::string& message) : std::runtime_error(message) { }
};
#endif
