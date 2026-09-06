#include "../src/runtime_options.h"

#include <cassert>
#include <stdexcept>

int main() {
  char program[] = "rick2";
  char debug[] = "--debug";
  char level[] = "levels/level1/level.json";
  char* debug_arguments[] = {program, debug, level};
  const RuntimeOptions debug_options = ParseRuntimeOptions(3, debug_arguments);
  assert(debug_options.debug);
  assert(debug_options.level_file == level);

  char* normal_arguments[] = {program, level};
  const RuntimeOptions normal_options = ParseRuntimeOptions(2, normal_arguments);
  assert(!normal_options.debug);
  assert(normal_options.level_file == level);

  char project_flag[] = "--project";
  char project[] = "project.json";
  char* project_arguments[] = {program, project_flag, project};
  const RuntimeOptions project_options = ParseRuntimeOptions(3, project_arguments);
  assert(project_options.project_file == project);
  assert(project_options.level_file.empty());

  char unknown[] = "--unknown";
  char* invalid_arguments[] = {program, unknown};
  bool rejected = false;
  try { ParseRuntimeOptions(2, invalid_arguments); }
  catch (const std::invalid_argument&) { rejected = true; }
  assert(rejected);
  return 0;
}
