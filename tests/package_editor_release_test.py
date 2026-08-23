#!/usr/bin/env python3
import tempfile, unittest
from pathlib import Path
from zipfile import ZipFile
import sys
sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))
from package_editor_release import package_release

class PackageEditorReleaseTest(unittest.TestCase):
    def test_release_is_deterministic_and_offline(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.zip"; second = Path(directory) / "second.zip"; package_release(first); package_release(second); self.assertEqual(first.read_bytes(), second.read_bytes())
            with ZipFile(first) as archive:
                self.assertIn("index.html", archive.namelist()); html = archive.read("index.html").decode(); self.assertNotIn("http://", html); self.assertNotIn("https://", html)

if __name__ == "__main__": unittest.main()
