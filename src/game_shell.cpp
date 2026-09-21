#include "game_shell.h"

#include <algorithm>
#include <fstream>
#include <map>
#include <stdexcept>
#include "data_loading.h"
#include "nlohmann/json.hpp"

namespace {
using nlohmann::json;

std::string ParentPath(const std::string& path) {
  const std::string::size_type separator = path.find_last_of("/\\");
  return separator == std::string::npos ? "." : path.substr(0, separator);
}

std::string ResolvePath(const std::string& base, const std::string& path) {
  return base + "/" + path;
}

std::string ProjectPath(const std::string& base, const json& value,
                        const std::string& project_file) {
  if (!value.is_string()) throw DataLoadError("Invalid '" + project_file + "': invalid project path");
  const std::string path = value.get<std::string>();
  if (path.empty() || path[0] == '/' || path.find('\\') != std::string::npos ||
      path.find(':') != std::string::npos || path.find("//") != std::string::npos)
    throw DataLoadError("Invalid '" + project_file + "': unsafe project path");
  std::size_t start = 0;
  while (start < path.size()) {
    const std::size_t slash = path.find('/', start);
    const std::string part = path.substr(start, slash == std::string::npos ? slash : slash - start);
    if (part.empty() || part == "." || part == "..")
      throw DataLoadError("Invalid '" + project_file + "': unsafe project path");
    if (slash == std::string::npos) break;
    start = slash + 1;
  }
  return ResolvePath(base, path);
}

const CampaignUnlockRule* RuleFor(const std::vector<CampaignUnlockRule>& rules,
                                  const std::string& level) {
  for (std::size_t index = 0; index < rules.size(); ++index)
    if (rules[index].level == level) return &rules[index];
  return NULL;
}
}

GameShell::GameShell()
    : direct_level_(false), has_campaign_(false), screen_(SHELL_INTRO) {}

GameShell GameShell::DirectLevel(const std::string& level_file) {
  GameShell shell;
  shell.direct_level_ = true;
  shell.screen_ = SHELL_PLAYING;
  shell.initial_level_ = level_file;
  shell.current_level_ = level_file;
  shell.levels_.push_back(level_file);
  return shell;
}

GameShell GameShell::FromProject(const std::string& project_file) {
  try {
    std::ifstream input(project_file.c_str());
    if (!input) throw DataLoadError("Cannot load '" + project_file + "'");
    json manifest; input >> manifest;
    if (manifest.value("formatVersion", 0) != 1 ||
        manifest.value("kind", "") != "rick2.project" ||
        !manifest.contains("initialLevel") || !manifest.at("initialLevel").is_string() ||
        !manifest.contains("levels") || !manifest.at("levels").is_array())
      throw DataLoadError("Invalid '" + project_file + "': unsupported project");

    GameShell shell;
    const std::string base = ParentPath(project_file);
    shell.initial_level_ = ProjectPath(base, manifest.at("initialLevel"), project_file);
    for (json::const_iterator level = manifest.at("levels").begin(); level != manifest.at("levels").end(); ++level) {
      if (!level->is_string()) throw DataLoadError("Invalid '" + project_file + "': invalid level path");
      shell.levels_.push_back(ProjectPath(base, *level, project_file));
    }
    if (shell.levels_.empty() || std::count(shell.levels_.begin(), shell.levels_.end(), shell.initial_level_) != 1)
      throw DataLoadError("Invalid '" + project_file + "': initial level is not declared");
    shell.current_level_ = shell.initial_level_;

    if (manifest.contains("campaign")) {
      const json& campaign = manifest.at("campaign");
      if (!campaign.is_object() || !campaign.contains("order") || !campaign.at("order").is_array() ||
          !campaign.contains("unlockRules") || !campaign.at("unlockRules").is_array())
        throw DataLoadError("Invalid '" + project_file + "': invalid campaign");
      shell.has_campaign_ = true;
      std::set<std::string> order_set;
      for (json::const_iterator level = campaign.at("order").begin(); level != campaign.at("order").end(); ++level) {
        const std::string path = ProjectPath(base, *level, project_file);
        if (!order_set.insert(path).second || std::find(shell.levels_.begin(), shell.levels_.end(), path) == shell.levels_.end())
          throw DataLoadError("Invalid '" + project_file + "': invalid campaign order");
        shell.campaign_order_.push_back(path);
      }
      std::set<std::string> targets;
      for (json::const_iterator raw = campaign.at("unlockRules").begin(); raw != campaign.at("unlockRules").end(); ++raw) {
        if (!raw->is_object() || !raw->contains("level") || !raw->contains("requiresCompleted") || !raw->at("requiresCompleted").is_array())
          throw DataLoadError("Invalid '" + project_file + "': invalid unlock rule");
        CampaignUnlockRule rule;
        rule.level = ProjectPath(base, raw->at("level"), project_file);
        if (!targets.insert(rule.level).second) throw DataLoadError("Invalid '" + project_file + "': duplicate unlock rule");
        for (json::const_iterator requirement = raw->at("requiresCompleted").begin(); requirement != raw->at("requiresCompleted").end(); ++requirement)
          rule.requires_completed.push_back(ProjectPath(base, *requirement, project_file));
        shell.unlock_rules_.push_back(rule);
      }
      if (shell.campaign_order_.empty() || shell.campaign_order_[0] != shell.initial_level_)
        throw DataLoadError("Invalid '" + project_file + "': campaign must start at initialLevel");
      for (std::size_t index = 0; index < shell.campaign_order_.size(); ++index) {
        const CampaignUnlockRule* rule = RuleFor(shell.unlock_rules_, shell.campaign_order_[index]);
        if (!rule) throw DataLoadError("Invalid '" + project_file + "': missing unlock rule");
        std::set<std::string> requirements;
        for (std::size_t requirement = 0; requirement < rule->requires_completed.size(); ++requirement) {
          const std::string& path = rule->requires_completed[requirement];
          const std::vector<std::string>::iterator found = std::find(shell.campaign_order_.begin(), shell.campaign_order_.end(), path);
          if (!requirements.insert(path).second || found == shell.campaign_order_.end() || static_cast<std::size_t>(found - shell.campaign_order_.begin()) >= index)
            throw DataLoadError("Invalid '" + project_file + "': unlock requirements must precede their level");
        }
        if (index && !requirements.count(shell.campaign_order_[index - 1]))
          throw DataLoadError("Invalid '" + project_file + "': unlock rule must require previous level");
      }
      if (targets.size() != shell.campaign_order_.size())
        throw DataLoadError("Invalid '" + project_file + "': unlock rule outside campaign");
      if (campaign.contains("completion")) {
        const json& completion = campaign.at("completion");
        if (!completion.is_object() || !completion.contains("image"))
          throw DataLoadError("Invalid '" + project_file + "': invalid campaign completion");
        shell.completion_image_ = ProjectPath(base, completion.at("image"), project_file);
      }
    }
    return shell;
  } catch (const DataLoadError&) { throw; }
  catch (const std::exception& error) {
    throw DataLoadError("Invalid '" + project_file + "': " + error.what());
  }
}

bool GameShell::IsUnlocked(const std::string& level) const {
  if (std::find(levels_.begin(), levels_.end(), level) == levels_.end()) return false;
  if (!has_campaign_) return true;
  const CampaignUnlockRule* rule = RuleFor(unlock_rules_, level);
  if (!rule) return false;
  for (std::size_t index = 0; index < rule->requires_completed.size(); ++index)
    if (!completed_levels_.count(rule->requires_completed[index])) return false;
  return true;
}

std::string GameShell::NewGame() {
  completed_levels_.clear();
  current_level_ = initial_level_;
  screen_ = SHELL_PLAYING;
  return current_level_;
}

std::size_t GameShell::ResumeIndex() const {
  const std::vector<std::string>& order = has_campaign_ ? campaign_order_ : levels_;
  for (std::size_t index = order.size(); index > 0; --index)
    if (IsUnlocked(order[index - 1]) && !completed_levels_.count(order[index - 1])) return index - 1;
  return order.empty() ? 0 : order.size() - 1;
}

std::string GameShell::ContinueGame() {
  const std::vector<std::string>& order = has_campaign_ ? campaign_order_ : levels_;
  current_level_ = order[ResumeIndex()];
  screen_ = SHELL_PLAYING;
  return current_level_;
}

std::string GameShell::SelectLevel(std::size_t index) {
  const std::vector<std::string>& order = has_campaign_ ? campaign_order_ : levels_;
  if (index >= order.size()) throw std::out_of_range("Level selection is outside the project");
  if (!IsUnlocked(order[index])) throw std::logic_error("Selected level is locked");
  current_level_ = order[index];
  screen_ = SHELL_PLAYING;
  return current_level_;
}

std::string GameShell::CompleteCurrentLevel() {
  if (!has_campaign_) return std::string();
  if (!IsUnlocked(current_level_)) throw std::logic_error("Completed level is locked");
  completed_levels_.insert(current_level_);
  const std::vector<std::string>::iterator current = std::find(campaign_order_.begin(), campaign_order_.end(), current_level_);
  if (current != campaign_order_.end() && current + 1 != campaign_order_.end() && IsUnlocked(*(current + 1))) {
    current_level_ = *(current + 1);
    screen_ = SHELL_PLAYING;
    return current_level_;
  }
  screen_ = SHELL_FINISHED;
  return std::string();
}
