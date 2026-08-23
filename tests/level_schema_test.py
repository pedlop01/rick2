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


if __name__ == "__main__":
    unittest.main()
