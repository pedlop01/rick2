#!/usr/bin/env python3
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]


class FormatCompatibilityTest(unittest.TestCase):
    def test_runtime_editor_and_schemas_share_write_versions(self):
        versions = json.loads((ROOT / "schema/format_versions.json").read_text())
        header = (ROOT / "src/format_versions.h").read_text()
        native = {
            "rick2.game": int(re.search(r"GAME = (\d+)", header).group(1)),
            "rick2.level": int(re.search(r"LEVEL = (\d+)", header).group(1)),
        }
        for kind, version in native.items():
            self.assertEqual(version, versions[kind]["write"])
            self.assertIn(version, versions[kind]["read"])
        schemas = {
            "rick2.game": "game.schema.json",
            "rick2.level": "level.schema.json",
            "rick2.project": "project.schema.json",
        }
        for kind, filename in schemas.items():
            schema = json.loads((ROOT / "schema" / filename).read_text())
            self.assertEqual(
                schema["properties"]["formatVersion"]["const"],
                versions[kind]["write"],
            )


if __name__ == "__main__":
    unittest.main()
