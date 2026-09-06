#include <cassert>
#include <stdexcept>
#include "../src/game_shell.h"

int main() {
  GameShell shell = GameShell::FromProject("tests/fixtures/project_campaign.json");
  assert(shell.Screen() == SHELL_INTRO);
  shell.ShowMenu();
  assert(shell.Screen() == SHELL_MENU);
  assert(shell.NewGame() == "tests/fixtures/levels/one/level.json");
  assert(!shell.IsUnlocked("tests/fixtures/levels/two/level.json"));
  assert(!shell.IsUnlocked("tests/fixtures/levels/final/level.json"));
  bool locked = false;
  try { shell.SelectLevel(4); } catch (const std::logic_error&) { locked = true; }
  assert(locked);

  assert(shell.CompleteCurrentLevel() == "tests/fixtures/levels/two/level.json");
  shell.ShowMenu();
  assert(shell.ContinueGame() == "tests/fixtures/levels/two/level.json");
  assert(shell.CompleteCurrentLevel() == "tests/fixtures/levels/three/level.json");
  assert(shell.CompleteCurrentLevel() == "tests/fixtures/levels/four/level.json");
  assert(!shell.IsUnlocked("tests/fixtures/levels/final/level.json"));
  assert(shell.CompleteCurrentLevel() == "tests/fixtures/levels/final/level.json");
  assert(shell.IsUnlocked("tests/fixtures/levels/final/level.json"));
  assert(shell.CompleteCurrentLevel().empty());
  assert(shell.Screen() == SHELL_FINISHED);

  GameShell direct = GameShell::DirectLevel("levels/level1/level.json");
  assert(direct.Screen() == SHELL_PLAYING);
  assert(direct.IsDirectLevel());
  assert(direct.IsUnlocked("levels/level1/level.json"));
  assert(direct.CompleteCurrentLevel().empty());
  assert(direct.Screen() == SHELL_PLAYING);

  GameShell levels_only = GameShell::FromProject("tests/fixtures/project_without_campaign.json");
  assert(!levels_only.IsDirectLevel());
  assert(!levels_only.HasCampaign());
  assert(levels_only.IsUnlocked("tests/fixtures/levels/two/level.json"));
  assert(levels_only.SelectLevel(1) == "tests/fixtures/levels/two/level.json");
  return 0;
}
