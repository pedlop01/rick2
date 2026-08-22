#!/usr/bin/env python3
"""Convert the legacy level-1 TMX/XML files into one canonical JSON package."""

import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET


FORMAT_VERSION = 1
ENTITY_FILES = {
    "platforms": "platforms.json",
    "items": "items.json",
    "backgroundObjects": "anim_tiles.json",
    "blocks": "blocks.json",
    "hazards": "hazards.json",
    "checkpoints": "checkpoints.json",
    "lasers": "lasers.json",
    "triggers": "triggers.json",
    "enemies": "enemies.json",
    "cameraViews": "camera_views.json",
}


def scalar(value):
    if value == "true":
        return True
    if value == "false":
        return False
    try:
        return int(value)
    except ValueError:
        try:
            return float(value)
        except ValueError:
            return value


def attributes(element):
    return {key: scalar(value) for key, value in element.attrib.items()}


def xml_element(element):
    result = attributes(element)
    grouped = {}
    for child in element:
        grouped.setdefault(child.tag, []).append(xml_element(child))
    for tag, values in grouped.items():
        result[tag] = values if len(values) != 1 else values[0]
    return result


def package_asset_path(path):
    """Store assets relative to levels/<id>/ instead of the bin directory."""
    return "../../" + str(path).removeprefix("../")


def animation_definition(path, project_root):
    definition = json.loads((project_root / path).read_text(encoding="utf-8"))
    for state in definition["states"]:
        state["animation"]["bitmap"] = package_asset_path(
            state["animation"]["bitmap"]
        )
    return definition


def definition_id(path):
    return Path(path.removeprefix("../")).with_suffix("").as_posix()


def entity_group(path):
    return json.loads(path.read_text(encoding="utf-8"))["entities"]


def layer(map_root, name):
    element = next(
        (candidate for candidate in map_root.findall("layer")
         if candidate.attrib.get("name") == name),
        None,
    )
    if element is None:
        raise ValueError(f"missing TMX layer: {name}")
    return [int(tile.attrib["gid"]) for tile in element.find("data")]


def convert(project_root, tmx_path, level_dir, config_path):
    map_root = ET.parse(project_root / tmx_path).getroot()
    tileset = map_root.find("tileset")
    image = tileset.find("image")
    config = json.loads((project_root / config_path).read_text(encoding="utf-8"))

    entities = {}
    definitions = {}
    for group_name, filename in ENTITY_FILES.items():
        group = entity_group(project_root / level_dir / filename)
        entities[group_name] = group
        for entity in group:
            attrs = entity.get("attributes") if isinstance(entity.get("attributes"), dict) else entity
            key = attrs.get("definition")
            if key:
                if key not in definitions:
                    definitions[key] = animation_definition(
                        Path(key + ".json"), project_root
                    )

    player_key = config["player"]["definition"]
    definitions[player_key] = animation_definition(
        Path(player_key + ".json"), project_root
    )
    for projectile in config["projectiles"].values():
        key = projectile["definition"]
        definition_path = Path(key + ".json")
        definitions[key] = animation_definition(
            definition_path, project_root
        )

    audio = config["audio"].copy()
    audio["music"] = [package_asset_path(path) for path in audio["music"]]
    audio["effects"] = [package_asset_path(path) for path in audio["effects"]]

    return {
        "formatVersion": FORMAT_VERSION,
        "kind": "rick2.level",
        "id": level_dir.name,
        "map": {
            "width": int(map_root.attrib["width"]),
            "height": int(map_root.attrib["height"]),
            "tileWidth": int(map_root.attrib["tilewidth"]),
            "tileHeight": int(map_root.attrib["tileheight"]),
            "tileset": {
                "image": "../../" + (tmx_path.parent / image.attrib["source"]).as_posix(),
                "tileCount": int(tileset.attrib["tilecount"]),
                "columns": int(tileset.attrib["columns"]),
                "imageWidth": int(image.attrib["width"]),
                "imageHeight": int(image.attrib["height"]),
            },
            "layers": {
                "tiles": layer(map_root, "Tiles"),
                "frontTiles": layer(map_root, "FrontTiles"),
                "collisions": layer(map_root, "Collisions"),
            },
        },
        "entities": entities,
        "display": config["display"],
        "camera": config["camera"],
        "player": config["player"],
        "projectiles": config["projectiles"],
        "definitions": definitions,
        "audio": audio,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=Path(__file__).parents[1])
    parser.add_argument("--tmx", type=Path, default=Path("maps/level1/Map1_prueba.tmx"))
    parser.add_argument("--level-dir", type=Path, default=Path("levels/level1"))
    parser.add_argument("--config", type=Path, default=Path("levels/level1/config.json"))
    parser.add_argument("--output", type=Path, default=Path("levels/level1/level.json"))
    args = parser.parse_args()
    package = convert(args.project_root, args.tmx, args.level_dir, args.config)
    output = args.project_root / args.output
    output.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
