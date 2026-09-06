#!/usr/bin/env python3
import subprocess
import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from package_editor_project_test import ROOT
from package_editor_project import package_level


class NativeProjectArchiveTest(unittest.TestCase):
    def test_editor_export_reopens_and_loads_in_native_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "level.rick2-project"
            executable = root / "project-archive-test"
            package_level(ROOT / "levels/level1/level.json", archive)
            subprocess.run([
                "g++", "-std=c++11", "tests/project_archive_test.cpp",
                "src/project_archive.cpp", "src/game_shell.cpp",
                "src/json_level_loader.cpp", "src/character_state_machine.cpp",
                "src/combat.cpp", "-lz", "-o", str(executable),
            ], cwd=ROOT, check=True)
            subprocess.run([str(executable), str(archive)], cwd=ROOT, check=True)

            malicious = root / "traversal.rick2-project"
            with ZipFile(malicious, "w", ZIP_DEFLATED) as package:
                package.writestr("../outside.txt", "unsafe")
                package.writestr("project.json", "{}")
            subprocess.run(
                [str(executable), "--reject", str(malicious)], cwd=ROOT, check=True
            )
            self.assertFalse((root.parent / "outside.txt").exists())

            escaped_asset = root / "escaped-asset.rick2-project"
            with ZipFile(archive) as source, ZipFile(
                escaped_asset, "w", ZIP_DEFLATED
            ) as target:
                manifest = json.loads(source.read("project.json"))
                level_path = manifest["initialLevel"]
                for name in source.namelist():
                    data = source.read(name)
                    if name == level_path:
                        level = json.loads(data)
                        level["map"]["tileset"]["image"] = "../../../../etc/passwd"
                        data = json.dumps(level).encode()
                    target.writestr(name, data)
            subprocess.run(
                [str(executable), "--reject-load", str(escaped_asset)],
                cwd=ROOT,
                check=True,
            )


if __name__ == "__main__":
    unittest.main()
