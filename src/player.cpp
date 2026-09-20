#include "player.h" // class's header file
#include "json_level_loader.h"
#include "data_loading.h"
#include "resource_cache.h"
#include "death_rules.h"
#include "camera.h"
#include "player_spawn_rules.h"
#include "player_jump_rules.h"
#include "player_motion_rules.h"

namespace {
int BehaviorState(const nlohmann::json& state) {
  const std::string behavior = state.value("behavior", state.value("id", ""));
  if (behavior == "stop") return CHAR_STATE_STOP;
  if (behavior == "running") return CHAR_STATE_RUNNING;
  if (behavior == "jumping") return CHAR_STATE_JUMPING;
  if (behavior == "climbing") return CHAR_STATE_CLIMBING;
  if (behavior == "crouching") return CHAR_STATE_CROUCHING;
  if (behavior == "shooting") return CHAR_STATE_SHOOTING;
  if (behavior == "bombing") return CHAR_STATE_BOMBING;
  if (behavior == "hitting") return CHAR_STATE_HITTING;
  if (behavior == "dead") return CHAR_STATE_DYING;
  throw DataLoadError("Unknown character state behavior: " + behavior);
}

const nlohmann::json& ActiveState(const CharacterForms& forms) {
  const nlohmann::json& machine = forms.ActiveDefinition().at("stateMachine");
  const std::string id = forms.Snapshot().state;
  for (nlohmann::json::const_iterator state = machine.at("states").begin(); state != machine.at("states").end(); ++state)
    if (state->at("id") == id) return *state;
  throw DataLoadError("Active character state definition is missing");
}
}  // namespace

void Player::ApplyRuntimeControllerProfile() {
  const PlayerControllerConfig config = GetRuntimePlayerControllerConfig();
  width = config.sprite_width;
  height = config.standing_height;
  width_orig = width;
  height_orig = height;
  bb_x = config.collision_offset_x;
  bb_y = 0;
  bb_width = config.collision_width;
  bb_width_orig = bb_width;
  bb_height = config.standing_height;
  bb_height_orig = bb_height;
  speed_x_max = config.run_speed;
  air_control = config.air_control;
  speed_x_min = config.run_speed;
  speed_x_step = 0.0f;
  speed_y_min = config.minimum_vertical_speed;
  speed_y_max = config.maximum_vertical_speed;
  speed_y_step = config.vertical_acceleration;
  climb_speed = config.climb_speed;
  jump_height = config.jump_height;
  jump_distance_x = GetRuntimeProfile().value("controller", nlohmann::json::object()).value("jumpDistanceX", -1);
  death_rise = config.death_rise;
  death_speed_multiplier = config.death_speed_multiplier;
  crouching_height = config.crouching_height;
  hit_hold_ticks = config.hit_hold_ticks;
  speed_x = speed_x_max;
  speed_y = speed_y_max;
  initial_speed_x = speed_x;
  initial_speed_y = speed_y;
  const PlayerGameplayConfig gameplay = GetRuntimePlayerGameplayConfig();
  can_jump = gameplay.jump;
  can_crouch = gameplay.crouch;
  can_climb = gameplay.climb;
  action_neutral_state = gameplay.action_neutral;
  action_up_state = gameplay.action_up;
  action_down_state = gameplay.action_down;
  action_horizontal_state = gameplay.action_horizontal;
  const RuntimeSessionRules session = GetRuntimeSessionRules();
  damage_enabled = session.damage_enabled;
  respawn_from_checkpoint = session.respawn_from_checkpoint;
}

void Player::ApplyFormProfile(const nlohmann::json& form) {
  if (form.contains("definition")) LoadFormAnimations(form.at("definition").get<std::string>());
  visual_scale = form.value("visualScale", 1.0f);
  const nlohmann::json controller = form.value("controller", nlohmann::json::object());
  const int feet = pos_y + height;
  width = controller.value("spriteWidth", width_orig); width_orig = width;
  height_orig = controller.value("standingHeight", height_orig); height = height_orig; pos_y = feet - height;
  bb_x = controller.value("collisionOffsetX", bb_x); bb_width = controller.value("collisionWidth", bb_width_orig); bb_width_orig = bb_width; bb_height = height; bb_height_orig = height;
  speed_x_max = controller.value("runSpeed", speed_x_max); speed_x_min = speed_x_max; speed_x_step = 0;
  air_control = controller.value("airControl", air_control);
  speed_y_min = controller.value("minimumVerticalSpeed", speed_y_min); speed_y_max = controller.value("maximumVerticalSpeed", speed_y_max); speed_y_step = controller.value("verticalAcceleration", speed_y_step);
  climb_speed = controller.value("climbSpeed", climb_speed); jump_height = controller.value("jumpHeight", jump_height); jump_distance_x = controller.value("jumpDistanceX", -1); death_rise = controller.value("deathRise", death_rise); death_speed_multiplier = controller.value("deathSpeedMultiplier", death_speed_multiplier); crouching_height = controller.value("crouchingHeight", crouching_height); hit_hold_ticks = controller.value("hitHoldTicks", hit_hold_ticks);
  const nlohmann::json capabilities = form.value("capabilities", nlohmann::json::object());
  can_jump = capabilities.value("jump", can_jump); can_crouch = capabilities.value("crouch", can_crouch); can_climb = capabilities.value("climb", can_climb);
  const bool can_shoot = capabilities.value("shoot", true), can_bomb = capabilities.value("bomb", true), can_hit = capabilities.value("hit", true);
  const nlohmann::json bindings = form.value("actionBindings", nlohmann::json::object());
  const auto binding = [](const nlohmann::json& values, const char* key, int fallback) { if (!values.contains(key)) return fallback; if (values.at(key).is_null()) return -1; const std::string value = values.at(key).get<std::string>(); return value == "shooting" ? CHAR_STATE_SHOOTING : value == "bombing" ? CHAR_STATE_BOMBING : value == "hitting" ? CHAR_STATE_HITTING : -1; };
  action_neutral_state = binding(bindings, "neutral", action_neutral_state); action_up_state = binding(bindings, "up", action_up_state); action_down_state = binding(bindings, "down", action_down_state); action_horizontal_state = binding(bindings, "horizontal", action_horizontal_state);
  if (!can_shoot) { if (action_neutral_state == CHAR_STATE_SHOOTING) action_neutral_state = -1; if (action_up_state == CHAR_STATE_SHOOTING) action_up_state = -1; if (action_down_state == CHAR_STATE_SHOOTING) action_down_state = -1; if (action_horizontal_state == CHAR_STATE_SHOOTING) action_horizontal_state = -1; }
  if (!can_bomb) { if (action_neutral_state == CHAR_STATE_BOMBING) action_neutral_state = -1; if (action_up_state == CHAR_STATE_BOMBING) action_up_state = -1; if (action_down_state == CHAR_STATE_BOMBING) action_down_state = -1; if (action_horizontal_state == CHAR_STATE_BOMBING) action_horizontal_state = -1; }
  if (!can_hit) { if (action_neutral_state == CHAR_STATE_HITTING) action_neutral_state = -1; if (action_up_state == CHAR_STATE_HITTING) action_up_state = -1; if (action_down_state == CHAR_STATE_HITTING) action_down_state = -1; if (action_horizontal_state == CHAR_STATE_HITTING) action_horizontal_state = -1; }
  const std::string combat_profile = form.value("combatProfile", GetPlayerConfig().value("combatProfile", "")); ConfigureCombat(GetCombatCatalog().Find(combat_profile));
}

void Player::LoadFormAnimations(const std::string& definition_id) {
  if (definition_id == loaded_form_definition) return;
  const nlohmann::json& definition = GetAnimationDefinition(definition_id.c_str());
  std::map<int, Animation*> next;
  try {
    for (nlohmann::json::const_iterator state_value = definition.at("states").begin(); state_value != definition.at("states").end(); ++state_value) {
      const nlohmann::json& animation = state_value->at("animation"); const std::string bitmap_file = animation.at("bitmap").get<std::string>(); BitmapResource bitmap = ResourceCache::Instance().LoadBitmap(bitmap_file);
      if (!bitmap) throw DataLoadError("Cannot load form animation bitmap '" + bitmap_file + "'");
      Animation* value = new Animation(bitmap, animation.at("frameDurationTicks").get<unsigned int>(), animation.value("frameDurationMs", 0u));
      for (nlohmann::json::const_iterator sprite = animation.at("sprites").begin(); sprite != animation.at("sprites").end(); ++sprite) {
        BitmapResource frame = ResourceCache::Instance().LoadSubBitmap(bitmap_file, bitmap, sprite->at("x").get<int>(), sprite->at("y").get<int>(), sprite->at("width").get<int>(), sprite->at("height").get<int>());
        if (!frame) { delete value; throw DataLoadError("Invalid form animation sprite in '" + definition_id + "'"); }
        value->AddSprite(frame, sprite->at("x").get<int>(), sprite->at("y").get<int>(), sprite->at("width").get<int>(), sprite->at("height").get<int>());
      }
      const int id = state_value->at("id").get<int>(); if (!next.insert(std::make_pair(id, value)).second) { delete value; throw DataLoadError("Duplicate form animation id in '" + definition_id + "'"); }
    }
  } catch (...) { for (std::map<int, Animation*>::iterator it = next.begin(); it != next.end(); ++it) delete it->second; throw; }
  for (std::map<int, Animation*>::iterator it = animations.begin(); it != animations.end(); ++it) delete it->second;
  animations.swap(next); loaded_form_definition = definition_id;
}

void Player::SelectFormAnimation() {
  if (!forms) { form_animation_state = state; return; }
  const nlohmann::json& declared = ActiveState(*forms); if (!declared.contains("animation") || !forms->ActiveDefinition().contains("definition")) { form_animation_state = state; return; }
  const nlohmann::json& definition = GetAnimationDefinition(forms->ActiveDefinition().at("definition").get<std::string>().c_str()); const std::string name = declared.at("animation").get<std::string>();
  for (nlohmann::json::const_iterator visual = definition.at("states").begin(); visual != definition.at("states").end(); ++visual) if (visual->at("name") == name) { form_animation_state = visual->at("id").get<int>(); return; }
  throw DataLoadError("Active character form animation is missing: " + name);
}

int Player::AnimationState() const { return forms ? form_animation_state : Character::AnimationState(); }

// class constructor
Player::Player() : Character() {
  type = CHARACTER_PLAYER;

  pos_x = 264;  // REVISIT: should be 0
  pos_y = 2000; // REVISIT: should be 0

  using_bb = true;
  height = 21;  // REVISIT: should be 0
  width  = 23;  // REVISIT: should be 0
  height_orig = height;
  width_orig = width;

  // REVISIT: think on how to pass this information automatically
  bb_x = 5;
  bb_y = 0;
  bb_width = 13;
  bb_width_orig = bb_width;
  bb_height = 21;
  bb_height_orig = bb_height;
  ApplyRuntimeControllerProfile();
  ConfigureCombat(GetCombatCatalog().Find(GetPlayerConfig().value("combatProfile", "")));
  const nlohmann::json& profile = GetRuntimeProfile(); if (profile.contains("characterForms")) { forms.reset(new CharacterForms(profile.at("characterForms"), "right")); ApplyFormProfile(forms->ActiveDefinition()); SelectFormAnimation(); }
}

Player::Player(const char* file) : Character(file) {
  type = CHARACTER_PLAYER;

  pos_x = 264;  // REVISIT: should be 0
  pos_y = 2000; // REVISIT: should be 0

  using_bb = true;
  height = 21;  // REVISIT: should be 0
  width  = 23;  // REVISIT: should be 0
  height_orig = height;
  width_orig = width;

  // REVISIT: think on how to pass this information automatically
  bb_x = 5;
  bb_y = 0;
  bb_width = 13;
  bb_width_orig = bb_width;
  bb_height = 21;
  bb_height_orig = bb_height;
  ApplyRuntimeControllerProfile();
  ConfigureCombat(GetCombatCatalog().Find(GetPlayerConfig().value("combatProfile", "")));
  const nlohmann::json& profile = GetRuntimeProfile(); if (profile.contains("characterForms")) { forms.reset(new CharacterForms(profile.at("characterForms"), "right")); ApplyFormProfile(forms->ActiveDefinition()); SelectFormAnimation(); }
}

// class destructor
Player::~Player() {  

}

void Player::SpawnAtCheckpoint(World* world) {
  forced_state_pending = false;
  keep_moving = false;
  if (!world || !world->GetCurrentCheckpoint())
    throw DataLoadError("Cannot spawn player without an initial checkpoint");
  const PlayerSpawnState spawn = InitialPlayerSpawn(*world->GetCurrentCheckpoint());
  pos_x = initial_x = spawn.x;
  pos_y = initial_y = spawn.y;
  face = initial_direction = spawn.face;
  direction = spawn.direction;
  if (forms) {
    forms->Reset(pos_x, pos_y, face == CHAR_DIR_LEFT ? "left" : "right");
    ApplyFormProfile(forms->ActiveDefinition());
    state = initial_state = BehaviorState(ActiveState(*forms));
    SelectFormAnimation();
  }
}

std::string Player::GetCombatStateName() const { if (forms) { const nlohmann::json& active = ActiveState(*forms); if (active.contains("animation")) return active.at("animation").get<std::string>(); } return Character::GetCombatStateName(); }

void Player::Reset() {
  Character::Reset();
  forced_state_pending = false;
  keep_moving = false;
  scene_visible = true; scene_controllable = true;
  if (forms) { forms->Reset(pos_x, pos_y, face == CHAR_DIR_LEFT ? "left" : "right"); ApplyFormProfile(forms->ActiveDefinition()); pos_y = initial_y; state = BehaviorState(ActiveState(*forms)); SelectFormAnimation(); }
}

void Player::DispatchGameplayEvent(const std::string& event) {
  if (!forms) return;
  CharacterStateContext context; context.x = pos_x; context.y = pos_y;
  context.signals["grounded"] = !inAir; context.signals["onStairs"] = inStairs;
  context.signals["canDescendStairs"] = overStairs; context.signals["canStand"] = !collisionHeadOrig;
  context.signals["ceilingBlocked"] = collisionHeadOrig; context.events.insert(event);
  const std::string previous_form = forms->ActiveForm(); forms->Evaluate(context);
  if (forms->ActiveForm() != previous_form) { const int old_width = width; ApplyFormProfile(forms->ActiveDefinition()); pos_x += (old_width - width) / 2; }
  state = BehaviorState(ActiveState(*forms)); SelectFormAnimation();
}

void Player::ForceState(const std::string& current, const std::string& previous) {
  if (!forms) throw DataLoadError("Forced player state requires character forms");
  forms->ForceState(current, previous);
  forced_state_pending = true;
  state = BehaviorState(ActiveState(*forms));
  if (state == CHAR_STATE_JUMPING) { direction = CHAR_DIR_DOWN; pos_y_chk = pos_y; }
  SelectFormAnimation();
}

void Player::ComputeNextState(World* map, Keyboard& keyboard) {
  if (!forms) { Character::ComputeNextState(map, keyboard); return; }
  Keyboard effective_keyboard = keyboard;
  const int automatic_direction = KeepMovingDirection(keep_moving, !inAir, keyboard.GetKeys() == 0, face == CHAR_DIR_LEFT);
  if (automatic_direction) effective_keyboard.SetKeys(automatic_direction < 0 ? KEY_LEFT : KEY_RIGHT);
  const int old_state = state, old_direction = direction; prevState = state;
  CharacterStateContext context; context.x = pos_x; context.y = pos_y;
  context.controls["left"] = effective_keyboard.PressedLeft(); context.controls["right"] = effective_keyboard.PressedRight(); context.controls["up"] = effective_keyboard.PressedUp(); context.controls["down"] = effective_keyboard.PressedDown(); context.controls["action"] = effective_keyboard.PressedSpace();
  context.signals["grounded"] = !inAir; context.signals["onStairs"] = inStairs; context.signals["canDescendStairs"] = overStairs; context.signals["canStand"] = !collisionHeadOrig; context.signals["ceilingBlocked"] = collisionHeadOrig; context.signals["descending"] = old_state == CHAR_STATE_JUMPING && (direction & CHAR_DIR_DOWN);
  const int requested = GroundActionState(effective_keyboard); if (requested == CHAR_STATE_SHOOTING) context.actions.insert("shooting"); else if (requested == CHAR_STATE_BOMBING) context.actions.insert("bombing"); else if (requested == CHAR_STATE_HITTING) context.actions.insert("hitting");
  const bool killed_this_step = killed;
  if (killed) { context.events.insert("killed"); killed = false; pos_y_chk = pos_y; }
  if (old_state == CHAR_STATE_JUMPING && (direction & CHAR_DIR_DOWN) && !inAir) context.events.insert("landed");
  const std::string previous_form = forms->ActiveForm(); if (forced_state_pending && !killed_this_step) forced_state_pending = false; else { forced_state_pending = false; forms->Step(context); } if (forms->ActiveForm() != previous_form) { const int old_width = width; ApplyFormProfile(forms->ActiveDefinition()); pos_x += (old_width - width) / 2; }
  state = BehaviorState(ActiveState(*forms));
  SelectFormAnimation();
  if (state == CHAR_STATE_RUNNING) direction = effective_keyboard.PressedLeft() ? CHAR_DIR_LEFT : effective_keyboard.PressedRight() ? CHAR_DIR_RIGHT : CHAR_DIR_STOP;
  else if (state == CHAR_STATE_STOP || state == CHAR_STATE_CROUCHING) { direction = CHAR_DIR_STOP; FixHorizontalDirection(effective_keyboard); }
  else if (state == CHAR_STATE_CLIMBING) direction = effective_keyboard.PressedUp() ? CHAR_DIR_UP : effective_keyboard.PressedDown() ? CHAR_DIR_DOWN : CHAR_DIR_STOP;
  else if (state == CHAR_STATE_JUMPING) { if (old_state != CHAR_STATE_JUMPING) { direction = InitialJumpDirection(context.signals["grounded"], air_control, face); pos_x_chk = pos_x; pos_y_chk = pos_y; } else if ((direction & CHAR_DIR_UP) && (collisionHead || abs(pos_y_chk - pos_y) >= jump_height || (jump_distance_x >= 0 && abs(pos_x_chk - pos_x) > jump_distance_x))) direction = StartJumpFall(direction); if (air_control) FixHorizontalDirection(effective_keyboard); }
  else if (state == CHAR_STATE_SHOOTING) { direction = face; const bool created = map->CreateNewShoot(face == CHAR_DIR_RIGHT ? pos_x + 23 : pos_x - 10, pos_y + 8, face == CHAR_DIR_RIGHT ? OBJ_DIR_RIGHT : OBJ_DIR_LEFT); if (created && GetRuntimeAudioBindings().shot >= 0) sound_handler->PlaySound(GetRuntimeAudioBindings().shot, false); }
  else if (state == CHAR_STATE_BOMBING) { direction = effective_keyboard.PressedLeft() ? CHAR_DIR_LEFT : effective_keyboard.PressedRight() ? CHAR_DIR_RIGHT : CHAR_DIR_STOP; const bool created = map->CreateNewBomb(pos_x, pos_y, direction == CHAR_DIR_LEFT ? OBJ_DIR_LEFT : direction == CHAR_DIR_RIGHT ? OBJ_DIR_RIGHT : OBJ_DIR_STOP); if (created && GetRuntimeAudioBindings().bomb >= 0) sound_handler->PlaySound(GetRuntimeAudioBindings().bomb, false); }
  else if (state == CHAR_STATE_HITTING) direction = effective_keyboard.PressedLeft() ? CHAR_DIR_LEFT : effective_keyboard.PressedRight() ? CHAR_DIR_RIGHT : face;
  else if (state == CHAR_STATE_DYING) {
    direction = old_state == CHAR_STATE_DYING ? old_direction : CHAR_DIR_UP | CHAR_DIR_RIGHT;
    if ((direction & CHAR_DIR_UP) && ShouldStartDeathFall(pos_y_chk, pos_y, death_rise)) { direction &= ~CHAR_DIR_UP; direction |= CHAR_DIR_DOWN; }
    else if (direction & CHAR_DIR_DOWN) { const int camera_y = camera ? camera->GetPosY() : map->GetMapHeight() * map->GetTilesetTileHeight() - GetCameraConfig().height; if (HasCrossedDeathBoundary(pos_y, camera_y, GetCameraConfig().height)) { Reset(); return; } }
  }
  if (old_state != CHAR_STATE_CROUCHING && state == CHAR_STATE_CROUCHING) { pos_y += height_orig - crouching_height; height = crouching_height; bb_height = crouching_height; }
  else if (old_state == CHAR_STATE_CROUCHING && state != CHAR_STATE_CROUCHING) { pos_y -= height_orig - height; height = height_orig; bb_height = bb_height_orig; }
  stepsInState = old_state == state ? stepsInState + 1 : 0; if (old_direction == direction) { if (direction == CHAR_DIR_LEFT || direction == CHAR_DIR_RIGHT) ++stepsInDirectionX; else ++stepsInDirectionY; } else { stepsInDirectionX = 0; stepsInDirectionY = 0; }
  if (direction & CHAR_DIR_LEFT) face = CHAR_DIR_LEFT; else if (direction & CHAR_DIR_RIGHT) face = CHAR_DIR_RIGHT;
}
