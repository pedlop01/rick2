#!/usr/bin/env python3
import json
import sys
import tempfile
import unittest
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))
from package_editor_project import ROOT, package_level


class PackageEditorProjectTest(unittest.TestCase):
    def test_level1_package_is_deterministic_and_self_contained(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.rick2-project"
            second = Path(directory) / "second.rick2-project"
            package_level(ROOT / "levels/level1/level.json", first)
            package_level(ROOT / "levels/level1/level.json", second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with ZipFile(first) as archive:
                names = set(archive.namelist())
                manifest = json.loads(archive.read("project.json"))
                level = json.loads(archive.read(manifest["initialLevel"]))
                references = [level["map"]["tileset"]["image"]]
                for definition in level["definitions"].values():
                    references.extend(
                        state["animation"]["bitmap"] for state in definition["states"]
                    )
                references.extend(level["audio"]["music"])
                references.extend(level["audio"]["effects"])
                base = PurePosixPath(manifest["initialLevel"]).parent
                for reference in references:
                    resolved = normalize(base, reference)
                    self.assertIn(resolved, names)


def normalize(base, reference):
    parts = list(base.parts)
    for part in PurePosixPath(reference).parts:
        if part == "..":
            parts.pop()
        elif part != ".":
            parts.append(part)
    return "/".join(parts)


if __name__ == "__main__":
    unittest.main()
