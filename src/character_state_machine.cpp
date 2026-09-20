#include "character_state_machine.h"

#include <cmath>
#include <stdexcept>

namespace {
void Require(bool condition, const std::string& message) {
  if (!condition) throw std::runtime_error(message);
}

bool Compare(double left, const std::string& op, double right) {
  if (op == "equal") return left == right;
  if (op == "notEqual") return left != right;
  if (op == "greater") return left > right;
  if (op == "greaterOrEqual") return left >= right;
  if (op == "lower") return left < right;
  if (op == "lowerOrEqual") return left <= right;
  throw std::runtime_error("unknown state-machine comparison: " + op);
}

bool Flag(const std::map<std::string, bool>& flags, const std::string& key) {
  std::map<std::string, bool>::const_iterator found = flags.find(key);
  return found != flags.end() && found->second;
}
}  // namespace

CharacterStateMachine::CharacterStateMachine(const nlohmann::json& definition,
                                             const std::string& facing)
    : definition_(definition) {
  Require(definition_.is_object(), "stateMachine must be an object");
  Require(definition_.contains("initialState") && definition_["initialState"].is_string(), "stateMachine.initialState is required");
  Require(definition_.contains("states") && definition_["states"].is_array() && !definition_["states"].empty(), "stateMachine.states cannot be empty");
  for (nlohmann::json::const_iterator it = definition_["states"].begin(); it != definition_["states"].end(); ++it) {
    Require(it->contains("id") && (*it)["id"].is_string() && !(*it)["id"].get<std::string>().empty(), "state id cannot be empty");
    const std::string id = (*it)["id"].get<std::string>(); Require(!states_.count(id), "duplicate state: " + id); states_[id] = *it;
  }
  const std::string initial = definition_["initialState"].get<std::string>(); Require(states_.count(initial), "initial state does not exist: " + initial);
  for (std::map<std::string, nlohmann::json>::const_iterator state = states_.begin(); state != states_.end(); ++state) {
    const nlohmann::json transitions = state->second.value("transitions", nlohmann::json::array()); Require(transitions.is_array(), "state transitions must be an array");
    for (nlohmann::json::const_iterator transition = transitions.begin(); transition != transitions.end(); ++transition) {
      const std::string target = transition->value("to", ""); Require(states_.count(target), "transition target does not exist: " + target);
      Require(transition->contains("conditions") && (*transition)["conditions"].is_array() && !(*transition)["conditions"].empty(), "transition conditions cannot be empty");
    }
  }
  snapshot_.state = initial; snapshot_.ticks_in_state = 0; snapshot_.facing = facing; snapshot_.origin_x = snapshot_.origin_y = 0; snapshot_.transitioned = false;
}

void CharacterStateMachine::Reset(double x, double y, const std::string& facing) {
  snapshot_.state = definition_["initialState"].get<std::string>(); snapshot_.previous_state.clear(); snapshot_.ticks_in_state = 0; snapshot_.origin_x = x; snapshot_.origin_y = y; snapshot_.transitioned = false; snapshot_.requested_form.clear(); if (!facing.empty()) snapshot_.facing = facing;
}

void CharacterStateMachine::Force(const std::string& state, const std::string& previous_state) {
  Require(states_.count(state) && states_.count(previous_state), "forced state does not exist");
  snapshot_.state = state; snapshot_.previous_state = previous_state;
  snapshot_.ticks_in_state = 0; snapshot_.transitioned = true; snapshot_.requested_form.clear();
}

CharacterStateSnapshot CharacterStateMachine::Step(const CharacterStateContext& context) { return Run(context, true); }
CharacterStateSnapshot CharacterStateMachine::Evaluate(const CharacterStateContext& context) { return Run(context, false); }

CharacterStateSnapshot CharacterStateMachine::Run(const CharacterStateContext& context, bool advance) {
  snapshot_.transitioned = false; snapshot_.requested_form.clear();
  const nlohmann::json transitions = states_[snapshot_.state].value("transitions", nlohmann::json::array());
  for (nlohmann::json::const_iterator transition = transitions.begin(); transition != transitions.end(); ++transition) {
    bool matches = true; for (nlohmann::json::const_iterator condition = (*transition)["conditions"].begin(); condition != (*transition)["conditions"].end(); ++condition) if (!Matches(*condition, context)) { matches = false; break; }
    if (!matches) continue;
    snapshot_.previous_state = snapshot_.state; snapshot_.state = (*transition)["to"].get<std::string>(); snapshot_.ticks_in_state = 0; snapshot_.transitioned = true;
    const nlohmann::json actions = transition->value("actions", nlohmann::json::array());
    for (nlohmann::json::const_iterator action = actions.begin(); action != actions.end(); ++action) {
      const std::string type = action->value("type", "");
      if (type == "setFacing") { const std::string value = action->value("value", ""); snapshot_.facing = value == "input" ? Flag(context.controls, "left") ? "left" : Flag(context.controls, "right") ? "right" : snapshot_.facing : value; }
      else if (type == "capturePosition") { const std::string axis = action->value("axis", ""); if (axis != "y") snapshot_.origin_x = context.x; if (axis != "x") snapshot_.origin_y = context.y; }
      else if (type == "setForm") snapshot_.requested_form = action->value("form", "");
    }
    return snapshot_;
  }
  if (advance) ++snapshot_.ticks_in_state;
  return snapshot_;
}

bool CharacterStateMachine::Matches(const nlohmann::json& condition, const CharacterStateContext& context) const {
  const std::string type = condition.value("type", "");
  if (type == "control") return Flag(context.controls, condition.value("control", "")) == condition.value("pressed", false);
  if (type == "signal") return Flag(context.signals, condition.value("signal", "")) == condition.value("value", false);
  if (type == "action") return (context.actions.count(condition.value("action", "")) != 0) == condition.value("active", false);
  if (type == "event") return context.events.count(condition.value("event", "")) != 0;
  if (type == "elapsedTicks") return Compare(snapshot_.ticks_in_state, condition.value("comparison", ""), condition.value("value", 0.0));
  if (type == "distance") return Compare(std::fabs((condition.value("axis", "") == "x" ? context.x - snapshot_.origin_x : context.y - snapshot_.origin_y)), condition.value("comparison", ""), condition.value("value", 0.0));
  if (type == "previousState") return (snapshot_.previous_state == condition.value("state", "")) == (condition.value("comparison", "") == "equal");
  throw std::runtime_error("unknown state-machine condition: " + type);
}

void ValidateCharacterForms(const nlohmann::json& definition) {
  Require(definition.is_object() && definition.contains("forms") && definition["forms"].is_array() && !definition["forms"].empty(), "characterForms.forms cannot be empty");
  std::set<std::string> forms;
  for (nlohmann::json::const_iterator form = definition["forms"].begin(); form != definition["forms"].end(); ++form) { const std::string id = form->value("id", ""); Require(!id.empty(), "form id cannot be empty"); Require(!forms.count(id), "duplicate form: " + id); Require(!form->contains("visualScale") || (form->at("visualScale").is_number() && form->at("visualScale").get<double>() > 0), "form visualScale must be positive"); forms.insert(id); CharacterStateMachine machine(form->at("stateMachine")); }
  const std::string initial = definition.value("initialForm", ""); Require(forms.count(initial), "initial form does not exist: " + initial);
  for (nlohmann::json::const_iterator form = definition["forms"].begin(); form != definition["forms"].end(); ++form) {
    for (nlohmann::json::const_iterator state = (*form)["stateMachine"]["states"].begin(); state != (*form)["stateMachine"]["states"].end(); ++state) {
      for (nlohmann::json::const_iterator transition = (*state)["transitions"].begin(); transition != (*state)["transitions"].end(); ++transition) {
        const nlohmann::json actions = transition->value("actions", nlohmann::json::array());
        for (nlohmann::json::const_iterator action = actions.begin(); action != actions.end(); ++action) if (action->value("type", "") == "setForm") Require(forms.count(action->value("form", "")), "form transition target does not exist: " + action->value("form", ""));
      }
    }
  }
}

CharacterForms::CharacterForms(const nlohmann::json& definition,
                               const std::string& facing)
    : definition_(definition), active_form_(definition.value("initialForm", "")) {
  ValidateCharacterForms(definition_);
  for (nlohmann::json::const_iterator form = definition_["forms"].begin(); form != definition_["forms"].end(); ++form) forms_[form->at("id").get<std::string>()] = *form;
  machine_.reset(new CharacterStateMachine(forms_.at(active_form_).at("stateMachine"), facing));
}

const nlohmann::json& CharacterForms::ActiveDefinition() const { return forms_.at(active_form_); }

void CharacterForms::ForceState(const std::string& state, const std::string& previous_state) { machine_->Force(state, previous_state); }

void CharacterForms::Activate(const std::string& id, const CharacterStateContext& context) {
  const std::string facing = machine_->Snapshot().facing; active_form_ = id;
  machine_.reset(new CharacterStateMachine(forms_.at(id).at("stateMachine"), facing));
  machine_->Reset(context.x, context.y, facing);
}

CharacterStateSnapshot CharacterForms::Step(const CharacterStateContext& context) {
  CharacterStateSnapshot result = machine_->Step(context); if (!result.requested_form.empty()) Activate(result.requested_form, context); return result;
}

CharacterStateSnapshot CharacterForms::Evaluate(const CharacterStateContext& context) {
  CharacterStateSnapshot result = machine_->Evaluate(context); if (!result.requested_form.empty()) Activate(result.requested_form, context); return result;
}

void CharacterForms::Reset(double x, double y, const std::string& facing) {
  active_form_ = definition_.at("initialForm").get<std::string>(); const std::string resolved_facing = facing.empty() && machine_ ? machine_->Snapshot().facing : facing.empty() ? "right" : facing;
  machine_.reset(new CharacterStateMachine(forms_.at(active_form_).at("stateMachine"), resolved_facing)); machine_->Reset(x, y, resolved_facing);
}
