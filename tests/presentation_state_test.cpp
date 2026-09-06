#include "../src/presentation_state.h"
#include <cassert>
#include <cmath>
#include <iostream>

int main() {
  const nlohmann::json definition = nlohmann::json::parse(R"({"parallaxLayers":[{"id":"stars","image":"stars.png","plane":"back","factorX":0.25,"factorY":0.1}],"messages":[{"id":"warning","text":"Danger ahead","durationTicks":2}],"effects":[{"id":"flash","kind":"flash","color":"#ffffff","durationTicks":4}]})");
  PresentationState state(definition);
  state.Execute(nlohmann::json::parse(R"({"type":"setCamera","mode":"fixed","x":100,"y":50,"durationTicks":2})"), 0, 0);
  state.Step(); assert(std::abs(state.CameraX(9) - 50) < .001); assert(std::abs(state.CameraY(9) - 25) < .001);
  state.Step(); assert(std::abs(state.CameraX(9) - 100) < .001);
  state.Execute(nlohmann::json::parse(R"({"type":"showMessage","message":"warning"})"), 0, 0); state.Step(); assert(!state.Message().is_null()); state.Step(); assert(state.Message().is_null());
  state.Execute(nlohmann::json::parse(R"({"type":"playEffect","effect":"flash"})"), 0, 0); assert(state.EffectDuration() == 4);
  bool rejected = false; try { state.Execute(nlohmann::json::parse(R"({"type":"showMessage","message":"missing"})"), 0, 0); } catch (...) { rejected = true; } assert(rejected);
  std::cout << "presentation state ok\n";
}
