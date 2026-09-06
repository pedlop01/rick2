#include <cassert>
#include <string>
#include <unistd.h>
#include "../src/data_loading.h"
#include "../src/game_shell.h"
#include "../src/json_level_loader.h"
#include "../src/project_archive.h"

int main(int argc, char** argv) {
  assert(argc == 2 || argc == 3);
  if (argc == 3 && std::string(argv[1]) == "--reject") {
    try { ProjectArchive archive = ProjectArchive::Open(argv[2]); }
    catch (const DataLoadError&) { return 0; }
    return 1;
  }
  if (argc == 3 && std::string(argv[1]) == "--reject-load") {
    try {
      ProjectArchive archive = ProjectArchive::Open(argv[2]);
      SetProjectRoot(archive.Root());
      GameShell shell = GameShell::FromProject(archive.ManifestPath());
      LoadLevelPackage(shell.CurrentLevel().c_str());
    } catch (const DataLoadError&) { return 0; }
    return 1;
  }
  std::string root;
  {
    ProjectArchive archive = ProjectArchive::Open(argv[1]);
    root = archive.Root();
    assert(access(archive.ManifestPath().c_str(), F_OK) == 0);
    SetProjectRoot(archive.Root());
    GameShell shell = GameShell::FromProject(archive.ManifestPath());
    assert(!shell.CurrentLevel().empty());
    LoadLevelPackage(shell.CurrentLevel().c_str());
    assert(GetDisplayConfig().width > 0);
    assert(!GetPlayerDefinition().empty());
  }
  assert(access(root.c_str(), F_OK) != 0);
  return 0;
}
