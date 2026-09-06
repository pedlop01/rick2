#ifndef GAME_SHELL_H
#define GAME_SHELL_H

#include <cstddef>
#include <set>
#include <string>
#include <vector>

enum GameShellScreen { SHELL_INTRO, SHELL_MENU, SHELL_LEVEL_SELECT, SHELL_PLAYING, SHELL_FINISHED };

struct CampaignUnlockRule {
  std::string level;
  std::vector<std::string> requires_completed;
};

class GameShell {
 public:
  static GameShell FromProject(const std::string& project_file);
  static GameShell DirectLevel(const std::string& level_file);

  GameShellScreen Screen() const { return screen_; }
  bool IsDirectLevel() const { return direct_level_; }
  bool HasCampaign() const { return has_campaign_; }
  const std::vector<std::string>& Levels() const { return levels_; }
  const std::vector<std::string>& CampaignOrder() const { return campaign_order_; }
  const std::string& CurrentLevel() const { return current_level_; }
  const std::set<std::string>& CompletedLevels() const { return completed_levels_; }

  void ShowMenu() { if (!direct_level_) screen_ = SHELL_MENU; }
  void ShowLevelSelect() { if (!direct_level_) screen_ = SHELL_LEVEL_SELECT; }
  std::string NewGame();
  std::string ContinueGame();
  std::string SelectLevel(std::size_t index);
  std::string CompleteCurrentLevel();
  bool IsUnlocked(const std::string& level) const;
  std::size_t ResumeIndex() const;

 private:
  GameShell();
  bool direct_level_;
  bool has_campaign_;
  GameShellScreen screen_;
  std::string initial_level_;
  std::string current_level_;
  std::vector<std::string> levels_;
  std::vector<std::string> campaign_order_;
  std::vector<CampaignUnlockRule> unlock_rules_;
  std::set<std::string> completed_levels_;
};

#endif
