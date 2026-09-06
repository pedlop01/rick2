#ifndef PRESENTATION_STATE_H
#define PRESENTATION_STATE_H
#include <nlohmann/json.hpp>
class PresentationState {
 public:
  explicit PresentationState(const nlohmann::json& definition = nlohmann::json::object());
  void Reset(); void Step(); void Execute(const nlohmann::json& action, double camera_x, double camera_y);
  void ValidateAction(const nlohmann::json& action) const;
  void ValidateProgram(const nlohmann::json& program) const;
  double CameraX(double follow_x) const; double CameraY(double follow_y) const; bool FollowsPlayer() const;
  const nlohmann::json& Definition() const { return definition_; }
  const nlohmann::json& Message() const { return message_; }
  const nlohmann::json& Effect() const { return effect_; }
  int EffectTicks() const { return effect_ticks_; }
  int EffectDuration() const { return effect_.is_null() ? 0 : effect_.value("durationTicks", 0); }
 private:
  nlohmann::json definition_, message_, effect_; bool follow_; double camera_x_, camera_y_, start_x_, start_y_; int camera_ticks_, camera_elapsed_, message_ticks_, effect_ticks_;
};
#endif
