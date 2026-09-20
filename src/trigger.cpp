#include "trigger.h"
#include "trigger_rules.h"

TriggerTarget::TriggerTarget(Object* _target,
                              int _delay,
                              bool _set_trigger,
                              bool _set_trigger_cond) {
  target = _target;
  delay_ticks = _delay;
  set_trigger = _set_trigger;
  set_trigger_cond = _set_trigger_cond;
  triggered = false;
}

TriggerTarget::~TriggerTarget() {

}

Trigger::Trigger(
  int _id,
  int _x, int _y, int _width, int _height,
  int _action_event, int _action_face, bool _recursive) {

  id      = _id;
  x       = _x;
  y       = _y;
  width   = _width;
  height  = _height;

  action_event = _action_event;
  action_face  = _action_face;

  recursive = _recursive;

  player_was_in_trigger = false;
  already_triggered = false;
  trigger_targets = false;

  player_prev_state = CHAR_STATE_STOP;

  steps = 0;
  gameplay_program = NULL;
}

Trigger::~Trigger() {
  for (vector<TriggerTarget*>::iterator it = targets.begin(); it != targets.end(); it++) {
    delete *it;
  }
}

void Trigger::Reset() {
  player_was_in_trigger = false;
  player_prev_state = CHAR_STATE_STOP;
  already_triggered = false;
  trigger_targets = false;

  for (vector<TriggerTarget*>::iterator it = targets.begin(); it != targets.end(); it++) {
    TriggerTarget* trigger_target = *it;
    trigger_target->SetTriggered(false);
  }

  steps = 0;
}

void Trigger::AddTarget(Object* _object, int _delay, bool _trigger, bool _trigger_cond) {
  TriggerTarget* trigger_target = new TriggerTarget(_object,
                                                   _delay,
                                                   _trigger,
                                                   _trigger_cond);
  targets.push_back(trigger_target);
}

void Trigger::ConfigureGameplay(GameplayProgram* program, const nlohmann::json& definition) { gameplay_program = program; gameplay_definition = definition; if (gameplay_program) gameplay_program->ValidateTrigger(gameplay_definition); }

bool Trigger::InTrigger(int _x, int _y, int _width, int _height) {
  return RectanglesOverlap(_x, _y, _width, _height,
                           x, y, width, height);
}

void Trigger::TriggerStep(int _x, int _y, int _width, int _height,
                          int _face, int _state) {

  if ((_state == CHAR_STATE_DYING) || (_state == CHAR_STATE_DEAD))
    return;

  if (continuous_point) {
    if (PointInInclusiveZone(_x, _y, x, y, width, height) &&
        DoesTriggerFaceMatch(action_face, _face) && gameplay_program) {
      bool matches = true;
      if (gameplay_definition.contains("conditions"))
        for (const auto& condition : gameplay_definition.at("conditions"))
          if (!gameplay_program->Matches(condition)) matches = false;
      if (matches && gameplay_definition.contains("actions"))
        for (const auto& action : gameplay_definition.at("actions")) gameplay_program->Execute(action);
    }
    return;
  }

  if (!trigger_targets) {
    //printf("[Trigger %d] No trigger target. In analysis!\n", id);

    // Recursive triggers keep triggering all the time.
    // This is the same piece of code than the regular one for
    // initiating triggers. Not moved there to avoid all the 
    // next unnecessary computations.
    if (recursive && already_triggered) {
      steps = 0;
      trigger_targets = true;
      //printf("[Trigger %d] Initiate targets for this recursive trigger already triggered trigger!\n", id);
      return;
    }
      
    bool player_in_trigger = false;
    bool expected_face     = false;
    bool expected_event    = false;

    player_in_trigger = InTrigger(_x, _y, _width, _height);

    expected_face = DoesTriggerFaceMatch(action_face, _face);
    expected_event = DoesTriggerEventMatch(action_event,
                                            player_in_trigger,
                                            player_was_in_trigger,
                                            _state,
                                            player_prev_state);

    player_was_in_trigger = player_in_trigger;
    player_prev_state = _state;

    bool gameplay_matches = true;
    if (gameplay_program && gameplay_definition.contains("conditions")) for (nlohmann::json::const_iterator condition = gameplay_definition.at("conditions").begin(); condition != gameplay_definition.at("conditions").end(); ++condition) if (!gameplay_program->Matches(*condition)) gameplay_matches = false;
    if (expected_event && expected_face && gameplay_matches) {
      if (gameplay_program && gameplay_definition.contains("actions")) for (nlohmann::json::const_iterator action = gameplay_definition.at("actions").begin(); action != gameplay_definition.at("actions").end(); ++action) gameplay_program->Execute(*action);
      if (gameplay_program && gameplay_definition.contains("sequence")) gameplay_program->StartSequence(gameplay_definition.at("sequence").get<std::string>());
      steps = 0;
      trigger_targets = true;
      //printf("[Trigger %d] Initiate targets for this trigger!\n", id);
    }
  } else {
    int num_target = 0;
    for (vector<TriggerTarget*>::iterator it = targets.begin(); it != targets.end(); it++) {
      Object* object = (*it)->GetTarget();
      if ((steps >= targets[num_target]->GetDelayTicks()) &&
          !targets[num_target]->GetTriggered()) {
        // Set trigger on for object. Objects shall put trigger to false once
        // the action has been taken. Note that, recursive triggers may keep setting
        // object trigger continously.
        if (targets[num_target]->GetSetTrigger()) {
          object->SetTrigger();
        } else {
          object->UnsetTrigger();
        }

        // Enable or disable conditional actions on object
        object->SetCondActions(targets[num_target]->GetSetTriggerCond() && !object->GetCondActions());


        targets[num_target]->SetTriggered(true);
      }
      num_target++;
    }

    // Check if all triggers have been set.
    bool all_completed = true;
    for (vector<TriggerTarget*>::iterator it = targets.begin(); (it != targets.end()) && all_completed; it++) {
      TriggerTarget* trigger_target = *it;
      if (!(trigger_target->GetTriggered())) {
        all_completed = false;
      }
    }
    if (all_completed) {
      already_triggered = true;
      //printf("[Trigger %d] Completed targets for this trigger!\n", id);
      for (vector<TriggerTarget*>::iterator it = targets.begin(); it != targets.end(); it++) {
        TriggerTarget* trigger_target = *it;
        trigger_target->SetTriggered(false);
      }
      trigger_targets = false;
      steps = 0;
    } else {
      steps++;
    }
  }
}
