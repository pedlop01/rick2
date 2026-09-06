#!/usr/bin/env python3
"""Regression checks for the Rick2 Engine task-16 architecture baseline."""

import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
LEVEL = ROOT / "levels/level1/level.json"
CATALOG = ROOT / "docs/EDITOR_DATA_CATALOG.md"


class EditorContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.level = json.loads(LEVEL.read_text(encoding="utf-8"))
        cls.catalog = CATALOG.read_text(encoding="utf-8")

    def test_level1_baseline_matches_catalog(self):
        expected_counts = {
            "platforms": 17,
            "items": 18,
            "backgroundObjects": 32,
            "blocks": 8,
            "hazards": 21,
            "checkpoints": 8,
            "lasers": 32,
            "triggers": 42,
            "enemies": 25,
            "cameraViews": 5,
        }
        self.assertEqual(
            {name: len(values) for name, values in self.level["entities"].items()},
            expected_counts,
        )
        self.assertEqual(len(self.level["definitions"]), 24)
        self.assertEqual(
            (self.level["map"]["width"], self.level["map"]["height"]),
            (160, 255),
        )
        for group in expected_counts:
            self.assertIn(f"`{group}`", self.catalog)

    def test_every_referenced_asset_exists(self):
        paths = [self.level["map"]["tileset"]["image"]]
        paths.extend(self.level["audio"]["music"])
        paths.extend(self.level["audio"]["effects"])
        for definition in self.level["definitions"].values():
            paths.extend(
                state["animation"]["bitmap"] for state in definition["states"]
            )
        for relative_path in paths:
            self.assertTrue(
                (LEVEL.parent / relative_path).resolve().is_file(),
                f"Missing asset: {relative_path}",
            )

    def test_project_manifest_schema_accepts_the_documented_shape(self):
        schema = json.loads(
            (ROOT / "schema/project.schema.json").read_text(encoding="utf-8")
        )
        manifest = {
            "formatVersion": 1,
            "kind": "rick2.project",
            "id": "my-game",
            "name": "My game",
            "initialLevel": "levels/level1/level.json",
            "levels": ["levels/level1/level.json"],
        }
        self.assertEqual(manifest["formatVersion"], schema["properties"]["formatVersion"]["const"])
        self.assertEqual(manifest["kind"], schema["properties"]["kind"]["const"])
        pattern = schema["$defs"]["safeRelativeJsonPath"]["pattern"]
        self.assertRegex(manifest["initialLevel"], re.compile(pattern))
        self.assertNotRegex("../outside.json", re.compile(pattern))
        self.assertIn(manifest["initialLevel"], manifest["levels"])

    def test_campaign_contract_uses_paths_and_explicit_completion_rules(self):
        schema = json.loads(
            (ROOT / "schema/project.schema.json").read_text(encoding="utf-8")
        )
        campaign = schema["$defs"]["campaign"]
        self.assertEqual(campaign["required"], ["order", "unlockRules"])
        rule = schema["$defs"]["unlockRule"]
        self.assertEqual(rule["required"], ["level", "requiresCompleted"])
        self.assertEqual(rule["properties"]["level"]["$ref"], "#/$defs/safeRelativeJsonPath")


if __name__ == "__main__":
    unittest.main()
