#!/usr/bin/env python3
"""Check that the committed JSON package is a reproducible lossless conversion."""

import json
from pathlib import Path

from convert_level import convert


def main():
    project_root = Path(__file__).parents[1]
    expected = convert(
        project_root,
        Path("maps/level1/Map1_prueba.tmx"),
        Path("levels/level1"),
        Path("characters/rick.xml"),
    )
    committed = json.loads((project_root / "levels/level1/level.json").read_text())
    if committed != expected:
        raise SystemExit("level.json is stale; rerun tools/convert_level.py")

    cell_count = expected["map"]["width"] * expected["map"]["height"]
    for name, values in expected["map"]["layers"].items():
        if len(values) != cell_count:
            raise SystemExit(f"layer {name} contains {len(values)}, expected {cell_count}")
    print("Canonical level package matches all legacy sources")


if __name__ == "__main__":
    main()
