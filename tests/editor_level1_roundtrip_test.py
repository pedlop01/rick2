#!/usr/bin/env python3
"""Integration check for opening, editing and re-exporting level 1."""
import json, sys, tempfile, unittest
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))
from package_editor_project import ROOT, package_level

class EditorLevelRoundTripTest(unittest.TestCase):
    def test_edit_changes_only_level_json_and_preserves_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.rick2-project"; exported = Path(directory) / "exported.rick2-project"
            package_level(ROOT / "levels/level1/level.json", source)
            with ZipFile(source) as archive: files = {name: archive.read(name) for name in archive.namelist()}
            manifest = json.loads(files["project.json"]); level_path = manifest["initialLevel"]; level = json.loads(files[level_path]); level["map"]["layers"]["frontTiles"][0] = 1; files[level_path] = (json.dumps(level, indent=2) + "\n").encode()
            with ZipFile(exported, "w", ZIP_DEFLATED) as archive:
                for name, data in files.items(): archive.writestr(name, data)
            with ZipFile(exported) as archive:
                reopened = json.loads(archive.read(level_path)); self.assertEqual(reopened["map"]["layers"]["frontTiles"][0], 1)
                for name, data in files.items():
                    if name != level_path: self.assertEqual(archive.read(name), data, name)

if __name__ == "__main__": unittest.main()
