#!/usr/bin/env python3
"""Build a deterministic portable Rick2 Engine project from a canonical level."""

import argparse
import copy
import json
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).parents[1]
FIXED_DATE = (2020, 1, 1, 0, 0, 0)


def json_bytes(value):
    return (json.dumps(value, indent=2) + "\n").encode("utf-8")


def safe_asset_destination(source, project_root):
    relative = source.resolve().relative_to(project_root.resolve())
    return PurePosixPath("assets", relative.as_posix()).as_posix()


def package_level(level_path, output, project_root=ROOT):
    level_path = level_path.resolve()
    original = json.loads(level_path.read_text(encoding="utf-8"))
    level = copy.deepcopy(original)
    files = {}

    def import_asset(reference):
        source = (level_path.parent / reference).resolve()
        if not source.is_file():
            raise ValueError(f"Missing asset: {reference}")
        destination = safe_asset_destination(source, project_root)
        files[destination] = source.read_bytes()
        # level.json is stored at levels/<id>/level.json.
        return "../../" + destination

    level["map"]["tileset"]["image"] = import_asset(
        level["map"]["tileset"]["image"]
    )
    for definition in level["definitions"].values():
        for state in definition["states"]:
            animation = state["animation"]
            animation["bitmap"] = import_asset(animation["bitmap"])
    level["audio"]["music"] = [import_asset(path) for path in level["audio"]["music"]]
    level["audio"]["effects"] = [import_asset(path) for path in level["audio"]["effects"]]

    level_id = level["id"]
    portable_level_path = f"levels/{level_id}/level.json"
    manifest = {
        "formatVersion": 1,
        "kind": "rick2.project",
        "id": f"rick2-{level_id}",
        "name": f"Rick2 {level_id}",
        "initialLevel": portable_level_path,
        "levels": [portable_level_path],
    }
    game = {
        "formatVersion": 1,
        "kind": "rick2.game",
        "initialLevel": portable_level_path,
    }
    files["project.json"] = json_bytes(manifest)
    files["game.json"] = json_bytes(game)
    files[portable_level_path] = json_bytes(level)

    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w") as archive:
        for name, data in sorted(files.items()):
            info = ZipInfo(name, FIXED_DATE)
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return files


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", type=Path, default=ROOT / "levels/level1/level.json")
    parser.add_argument("--output", type=Path, default=ROOT / "build/rick2-level1.rick2-project")
    args = parser.parse_args()
    files = package_level(args.level, args.output)
    print(f"Created {args.output} with {len(files)} files")


if __name__ == "__main__":
    main()
