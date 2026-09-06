#ifndef COMBAT_H
#define COMBAT_H

#include <map>
#include <set>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

struct CombatBox { std::string id; double x, y, width, height; std::vector<std::string> states; std::vector<int> frames; std::string damage_type; int damage; bool hit_once, facing_only; double knockback_x, knockback_y; std::vector<std::string> damage_types; };
struct CombatProfile { std::string id, faction; int max_health, invulnerability_ticks; std::vector<CombatBox> hurtboxes, attacks, guards; };
struct CombatPose { double x, y, width; bool facing_left; std::string state; int frame, activation; };
struct WorldCombatBox { std::string id; double x, y, width, height; };
struct CombatHit { std::string attack, damage_type; bool blocked, applied; int damage; double knockback_x, knockback_y; };

class CombatCatalog {
 public:
  explicit CombatCatalog(const nlohmann::json& definition = nlohmann::json::object());
  const CombatProfile* Find(const std::string& id) const;
 private:
  std::map<std::string, CombatProfile> profiles_;
};

class CombatantState {
 public:
  explicit CombatantState(const CombatProfile* profile = NULL);
  void Reset(); void Step(); bool Alive() const; int Health() const; const CombatProfile* Profile() const;
  bool CanHit(const std::string& attack, int activation) const; void RecordHit(const std::string& attack, int activation); bool Receive(const CombatHit& hit);
 private:
  const CombatProfile* profile_; int health_, invulnerability_; std::set<std::string> hits_;
};

std::vector<WorldCombatBox> ActiveHurtboxes(const CombatProfile& profile, const CombatPose& pose);
std::vector<WorldCombatBox> ActiveAttackboxes(const CombatProfile& profile, const CombatPose& pose);
std::vector<WorldCombatBox> ActiveGuardboxes(const CombatProfile& profile, const CombatPose& pose);
bool ResolveCombat(CombatantState& attacker, const CombatPose& attacker_pose, CombatantState& defender, const CombatPose& defender_pose, CombatHit* hit, bool friendly_fire = false);

#endif
