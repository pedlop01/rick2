#ifndef GAMEPLAY_PROGRAM_H
#define GAMEPLAY_PROGRAM_H

#include <functional>
#include <map>
#include <memory>
#include <set>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

class GameplayProgram {
 public:
  explicit GameplayProgram(const nlohmann::json& definition = nlohmann::json::object());
  void Reset();
  void BeginTick();
  void Execute(const nlohmann::json& action);
  bool Matches(const nlohmann::json& condition) const;
  void StartSequence(const std::string& id);
  void StepSequences();
  const nlohmann::json& Flag(const std::string& id) const;
  bool HasEvent(const std::string& id) const;
  void SetEventSink(const std::function<void(const std::string&)>& sink);
  void SetActionSink(const std::function<void(const nlohmann::json&)>& sink);
  void ValidateTrigger(const nlohmann::json& definition) const;

 private:
  struct RunningStep {
    nlohmann::json definition;
    int remaining;
    size_t index;
    bool complete;
    std::vector<std::shared_ptr<RunningStep> > children;
    explicit RunningStep(const nlohmann::json& value);
  };
  nlohmann::json definition_;
  std::map<std::string, nlohmann::json> initial_flags_;
  std::map<std::string, nlohmann::json> flags_;
  std::set<std::string> declared_events_;
  std::set<std::string> events_;
  std::map<std::string, nlohmann::json> sequences_;
  std::vector<std::shared_ptr<RunningStep> > running_;
  std::function<void(const std::string&)> event_sink_;
  std::function<void(const nlohmann::json&)> action_sink_;
  bool Advance(const std::shared_ptr<RunningStep>& step);
  void ValidateAction(const nlohmann::json& action) const;
  void ValidateStep(const nlohmann::json& step) const;
};

#endif
