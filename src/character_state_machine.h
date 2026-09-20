#ifndef CHARACTER_STATE_MACHINE_H
#define CHARACTER_STATE_MACHINE_H

#include <map>
#include <set>
#include <string>
#include <memory>
#include <nlohmann/json.hpp>

struct CharacterStateContext {
  std::map<std::string, bool> controls;
  std::map<std::string, bool> signals;
  std::set<std::string> actions;
  std::set<std::string> events;
  double x;
  double y;
  CharacterStateContext() : x(0), y(0) {}
};

struct CharacterStateSnapshot {
  std::string state;
  std::string previous_state;
  int ticks_in_state;
  std::string facing;
  double origin_x;
  double origin_y;
  bool transitioned;
  std::string requested_form;
};

class CharacterStateMachine {
 public:
  explicit CharacterStateMachine(const nlohmann::json& definition,
                                 const std::string& facing = "right");
  CharacterStateSnapshot Step(const CharacterStateContext& context);
  CharacterStateSnapshot Evaluate(const CharacterStateContext& context);
  void Reset(double x = 0, double y = 0, const std::string& facing = "");
  void Force(const std::string& state, const std::string& previous_state);
  const CharacterStateSnapshot& Snapshot() const { return snapshot_; }

 private:
  CharacterStateSnapshot Run(const CharacterStateContext& context, bool advance);
  bool Matches(const nlohmann::json& condition,
               const CharacterStateContext& context) const;
  nlohmann::json definition_;
  std::map<std::string, nlohmann::json> states_;
  CharacterStateSnapshot snapshot_;
};

void ValidateCharacterForms(const nlohmann::json& definition);

class CharacterForms {
 public:
  explicit CharacterForms(const nlohmann::json& definition,
                          const std::string& facing = "right");
  CharacterStateSnapshot Step(const CharacterStateContext& context);
  CharacterStateSnapshot Evaluate(const CharacterStateContext& context);
  void Reset(double x = 0, double y = 0, const std::string& facing = "");
  void ForceState(const std::string& state, const std::string& previous_state);
  const std::string& ActiveForm() const { return active_form_; }
  const nlohmann::json& ActiveDefinition() const;
  const CharacterStateSnapshot& Snapshot() const { return machine_->Snapshot(); }
 private:
  void Activate(const std::string& id, const CharacterStateContext& context);
  nlohmann::json definition_;
  std::map<std::string, nlohmann::json> forms_;
  std::string active_form_;
  std::unique_ptr<CharacterStateMachine> machine_;
};

#endif
