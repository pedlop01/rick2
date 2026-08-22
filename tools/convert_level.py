#!/usr/bin/env python3
"""Convert the legacy level-1 TMX/XML files into one canonical JSON package."""

import argparse
import json
from pathlib import Path

from tmx_importer import TmxImportError, import_tmx


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


def convert(project_root, tmx_path, level_dir, config_path):
    imported_map = import_tmx(project_root / tmx_path)
    visual_tileset = imported_map["tilesets"][0]
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
            "width": imported_map["width"],
            "height": imported_map["height"],
            "tileWidth": imported_map["tileWidth"],
            "tileHeight": imported_map["tileHeight"],
            "tileset": {
                "image": "../../" + (tmx_path.parent / visual_tileset["image"]).as_posix(),
                "tileCount": visual_tileset["tileCount"],
                "columns": visual_tileset["columns"],
                "imageWidth": visual_tileset["imageWidth"],
                "imageHeight": visual_tileset["imageHeight"],
            },
            "layers": {
                "tiles": imported_map["layers"]["Tiles"],
                "frontTiles": imported_map["layers"]["FrontTiles"],
                "collisions": imported_map["layers"]["Collisions"],
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
    try:
        package = convert(args.project_root, args.tmx, args.level_dir, args.config)
    except TmxImportError as error:
        parser.error(str(error))
    output = args.project_root / args.output
    output.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
