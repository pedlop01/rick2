#!/usr/bin/env python3
import copy
import json
import unittest
from pathlib import Path

import jsonschema


ROOT = Path(__file__).parents[1]


class LevelSchemaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads((ROOT / "schema/level.schema.json").read_text())
        cls.level = json.loads((ROOT / "levels/level1/level.json").read_text())
        cls.validator = jsonschema.Draft202012Validator(cls.schema)
        cls.validator.check_schema(cls.schema)

    def test_level1_satisfies_typed_entity_contracts(self):
        self.assertEqual(list(self.validator.iter_errors(self.level)), [])

    def test_every_entity_group_rejects_unknown_properties(self):
        for group, entities in self.level["entities"].items():
            if not entities:
                continue
            with self.subTest(group=group):
                invalid = copy.deepcopy(self.level)
                invalid["entities"][group][0]["unknownEditorField"] = True
                self.assertTrue(list(self.validator.iter_errors(invalid)))

    def test_runtime_enums_and_action_shapes_are_typed(self):
        invalid_direction = copy.deepcopy(self.level)
        invalid_direction["entities"]["enemies"][0]["direction"] = "sideways"
        self.assertTrue(list(self.validator.iter_errors(invalid_direction)))

        invalid_action = copy.deepcopy(self.level)
        invalid_action["entities"]["platforms"][0]["actions"]["action"] = []
        self.assertTrue(list(self.validator.iter_errors(invalid_action)))

    def test_optional_runtime_profile_is_typed_without_breaking_v1_levels(self):
        configured = copy.deepcopy(self.level)
        configured["runtimeProfile"] = {
            "controller": {"runSpeed": 4},
            "capabilities": {"bomb": False},
            "actionBindings": {"up": "hitting", "down": None},
            "session": {"respawn": "none", "deathAudioSlot": None},
            "bindings": {"playerStates": {"running": "HERO_RUN"}, "audio": {"shot": 9}},
        }
        self.assertEqual(list(self.validator.iter_errors(configured)), [])

        configured["runtimeProfile"]["controller"]["runSpeed"] = -1
        self.assertTrue(list(self.validator.iter_errors(configured)))

    def test_optional_reach_zone_objective_is_typed(self):
        configured = copy.deepcopy(self.level)
        configured["objective"] = {"type": "reachZone", "x": 10, "y": 20,
                                   "width": 16, "height": 24,
                                   "onComplete": "freeze"}
        self.assertEqual(list(self.validator.iter_errors(configured)), [])
        configured["objective"]["width"] = 0
        self.assertTrue(list(self.validator.iter_errors(configured)))

    def test_character_form_visual_scale_is_positive(self):
        configured = copy.deepcopy(self.level)
        configured["runtimeProfile"] = {"characterForms": json.loads(
            (ROOT / "tests/fixtures/character_forms.json").read_text())}
        self.assertEqual(list(self.validator.iter_errors(configured)), [])
        configured["runtimeProfile"]["characterForms"]["forms"][0]["visualScale"] = 0
        self.assertTrue(list(self.validator.iter_errors(configured)))

    def test_gameplay_program_and_gameplay_only_trigger_are_typed(self):
        configured = copy.deepcopy(self.level)
        configured["gameplay"] = {
            "flags": [{"id": "doorOpen", "type": "boolean", "initial": False}],
            "events": [{"id": "doorOpened"}],
            "sequences": [{"id": "openDoor", "steps": [
                {"type": "parallel", "steps": [
                    {"type": "action", "action": {"type": "setFlag", "flag": "doorOpen", "value": True}},
                    {"type": "action", "action": {"type": "emitEvent", "event": "doorOpened"}},
                ]}
            ]}],
        }
        configured["entities"]["triggers"].append({
            "id": 999,
            "attributes": {"x": 8, "y": 8, "width": 16, "height": 16, "recursive": 0, "onehot": 1, "action": "enters", "face": "any"},
            "gameplay": {"conditions": [{"type": "flag", "flag": "doorOpen", "comparison": "equal", "value": False}], "sequence": "openDoor"},
        })
        self.assertEqual(list(self.validator.iter_errors(configured)), [])
        configured["gameplay"]["flags"][0]["initial"] = "wrong"
        self.assertTrue(list(self.validator.iter_errors(configured)))

    def test_enemy_accepts_exactly_one_ai_contract(self):
        configured = copy.deepcopy(self.level)
        enemy = configured["entities"]["enemies"][0]
        for key in ["ia_type", "ia_random", "ia_randomness", "ia_block_steps",
                    "ia_orig_x", "ia_orig_y", "ia_limit_x", "ia_limit_y"]:
            enemy.pop(key)
        enemy["behavior"] = {"type": "flyPatrol", "axis": "both", "distance": 32,
                             "phaseTicks": 20}
        self.assertEqual(list(self.validator.iter_errors(configured)), [])
        enemy["ia_type"] = "walker"
        self.assertTrue(list(self.validator.iter_errors(configured)))


if __name__ == "__main__":
    unittest.main()
