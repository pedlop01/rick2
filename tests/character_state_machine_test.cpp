#include <cassert>
#include <iostream>
#include <fstream>
#include "../src/character_state_machine.h"

int main() {
  nlohmann::json forms; std::ifstream fixture("tests/fixtures/character_forms.json"); fixture >> forms;
  ValidateCharacterForms(forms);
  CharacterStateMachine machine(forms["forms"][0]["stateMachine"]); CharacterStateContext context; context.controls["right"] = true; context.x = 10;
  CharacterStateSnapshot first = machine.Step(context); assert(first.state == "walking" && first.origin_x == 10);
  context.x = 18; CharacterStateSnapshot second = machine.Step(context); assert(second.state == "transforming" && second.requested_form == "frog");
  CharacterForms runtime_forms(forms); context.x = 10; runtime_forms.Step(context); context.x = 18; runtime_forms.Step(context); assert(runtime_forms.ActiveForm() == "frog"); assert(runtime_forms.ActiveDefinition().at("controller").at("standingHeight") == 31);
  std::cout << "character state machine ok\n";
}
