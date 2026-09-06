#ifndef RUNTIME_OPTIONS_H
#define RUNTIME_OPTIONS_H

#include <stdexcept>
#include <string>

struct RuntimeOptions {
  bool debug;
  bool show_help;
  std::string level_file;
  std::string project_file;

  RuntimeOptions() : debug(false), show_help(false) {}
};

inline RuntimeOptions ParseRuntimeOptions(int argc, char* argv[]) {
  RuntimeOptions options;
  for (int index = 1; index < argc; ++index) {
    const std::string argument(argv[index]);
    if (argument == "--debug") {
      options.debug = true;
    } else if (argument == "--project") {
      if (++index >= argc || options.project_file.size())
        throw std::invalid_argument("--project needs one project.json path");
      options.project_file = argv[index];
    } else if (argument == "--help" || argument == "-h") {
      options.show_help = true;
    } else if (!argument.empty() && argument[0] == '-') {
      throw std::invalid_argument("Unknown option: " + argument);
    } else if (options.level_file.empty()) {
      if (!options.project_file.empty()) throw std::invalid_argument("A project and a direct level cannot be selected together");
      if (argument.size() >= 14 && argument.substr(argument.size() - 14) == ".rick2-project")
        options.project_file = argument;
      else
        options.level_file = argument;
    } else {
      throw std::invalid_argument("Only one level package can be selected");
    }
  }
  if (!options.project_file.empty() && !options.level_file.empty())
    throw std::invalid_argument("A project and a direct level cannot be selected together");
  return options;
}

#endif
