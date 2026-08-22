#ifndef RUNTIME_OPTIONS_H
#define RUNTIME_OPTIONS_H

#include <stdexcept>
#include <string>

struct RuntimeOptions {
  bool debug;
  bool show_help;
  std::string level_file;

  RuntimeOptions() : debug(false), show_help(false) {}
};

inline RuntimeOptions ParseRuntimeOptions(int argc, char* argv[]) {
  RuntimeOptions options;
  for (int index = 1; index < argc; ++index) {
    const std::string argument(argv[index]);
    if (argument == "--debug") {
      options.debug = true;
    } else if (argument == "--help" || argument == "-h") {
      options.show_help = true;
    } else if (!argument.empty() && argument[0] == '-') {
      throw std::invalid_argument("Unknown option: " + argument);
    } else if (options.level_file.empty()) {
      options.level_file = argument;
    } else {
      throw std::invalid_argument("Only one level package can be selected");
    }
  }
  return options;
}

#endif
