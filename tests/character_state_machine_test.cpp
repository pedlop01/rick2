#include <cassert>
#include <iostream>
#include <stdexcept>
#include <fstream>
#include "../src/character_state_machine.h"

int main() {
  nlohmann::json forms; std::ifstream fixture("tests/fixtures/character_forms.json"); fixture >> forms;
  ValidateCharacterForms(forms); assert(forms["forms"][0]["visualScale"] == 4);
  CharacterStateMachine machine(forms["forms"][0]["stateMachine"]); CharacterStateContext context; context.controls["right"] = true; context.x = 10;
  CharacterStateSnapshot first = machine.Step(context); assert(first.state == "walking" && first.origin_x == 10);
  machine.Force("walking", "idle"); assert(machine.Snapshot().state == "walking" && machine.Snapshot().previous_state == "idle");
  bool invalid_force = false; try { machine.Force("missing", "idle"); } catch (const std::runtime_error&) { invalid_force = true; } assert(invalid_force);
  context.x = 18; CharacterStateSnapshot second = machine.Step(context); assert(second.state == "transforming" && second.requested_form == "frog");
  CharacterForms runtime_forms(forms); context.x = 10; runtime_forms.Step(context); context.x = 18; runtime_forms.Step(context); assert(runtime_forms.ActiveForm() == "frog"); assert(runtime_forms.ActiveDefinition().at("controller").at("standingHeight") == 31);
  nlohmann::json event_forms = forms; event_forms["forms"][0]["stateMachine"]["states"][0]["transitions"].insert(event_forms["forms"][0]["stateMachine"]["states"][0]["transitions"].begin(), nlohmann::json::parse(R"({"to":"idle","conditions":[{"type":"event","event":"sceneComplete"}],"actions":[{"type":"setForm","form":"frog"}]})")); CharacterForms event_runtime(event_forms); CharacterStateContext event_context; event_context.x = 50; event_context.y = 60; event_context.events.insert("sceneComplete"); event_runtime.Evaluate(event_context); assert(event_runtime.ActiveForm() == "frog"); assert(event_runtime.Snapshot().state == "idle"); assert(event_runtime.Snapshot().origin_x == 50); assert(event_runtime.Snapshot().origin_y == 60);
  nlohmann::json death_forms = forms; death_forms["forms"][0]["stateMachine"]["states"].push_back(nlohmann::json::parse(R"({"id":"dead","behavior":"dead","transitions":[]})")); death_forms["forms"][0]["stateMachine"]["states"][0]["transitions"].insert(death_forms["forms"][0]["stateMachine"]["states"][0]["transitions"].begin(), nlohmann::json::parse(R"({"to":"dead","conditions":[{"type":"event","event":"killed"}]})")); CharacterForms death_runtime(death_forms); CharacterStateContext death_context; death_context.events.insert("killed"); death_runtime.Evaluate(death_context); assert(death_runtime.Snapshot().state == "dead");
  nlohmann::json invalid = forms; invalid["forms"][0]["visualScale"] = 0; bool rejected = false; try { ValidateCharacterForms(invalid); } catch (const std::runtime_error&) { rejected = true; } assert(rejected);
  const nlohmann::json landing_graph = nlohmann::json::parse(R"({"initialState":"falling","states":[{"id":"falling","transitions":[{"to":"crouching","conditions":[{"type":"signal","signal":"grounded","value":true}]}]},{"id":"crouching","transitions":[{"to":"idle","conditions":[{"type":"elapsedTicks","comparison":"greaterOrEqual","value":5},{"type":"previousState","comparison":"equal","state":"falling"}]}]},{"id":"idle","transitions":[]}]})");
  CharacterStateMachine landing(landing_graph); CharacterStateContext landing_context; landing_context.signals["grounded"] = true;
  assert(landing.Step(landing_context).state == "crouching");
  for (int tick = 0; tick < 5; ++tick) assert(landing.Step(landing_context).state == "crouching");
  assert(landing.Step(landing_context).state == "idle");
  const nlohmann::json apex_graph = nlohmann::json::parse(R"({"initialState":"jumping","states":[{"id":"jumping","transitions":[{"to":"falling","conditions":[{"type":"signal","signal":"descending","value":true}]}]},{"id":"falling","transitions":[]}]})");
  CharacterStateMachine apex(apex_graph); CharacterStateContext apex_context;
  assert(apex.Step(apex_context).state == "jumping");
  apex_context.signals["descending"] = true;
  assert(apex.Step(apex_context).state == "falling" && apex.Snapshot().previous_state == "jumping");
  std::cout << "character state machine ok\n";
}
