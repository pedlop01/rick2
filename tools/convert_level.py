#!/usr/bin/env python3
"""Convert the legacy level-1 TMX/XML files into one canonical JSON package."""

import argparse
import json
from pathlib import Path
import xml.etree.ElementTree as ET


FORMAT_VERSION = 1
ENTITY_FILES = {
    "platforms": "platforms.xml",
    "items": "items.xml",
    "backgroundObjects": "anim_tiles.xml",
    "blocks": "blocks.xml",
    "hazards": "hazards.xml",
    "checkpoints": "checkpoints.xml",
    "lasers": "lasers.xml",
    "triggers": "triggers.xml",
    "enemies": "enemies.xml",
    "cameraViews": "camera_views.xml",
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


def animation_definition(path, project_root):
    root = ET.parse(project_root / path).getroot()
    states = []
    for state in root.find("states"):
        animation = state.find("animation")
        states.append({
            "name": state.attrib["name"],
            "id": int(state.attrib["id"]),
            "animation": {
                "bitmap": animation.attrib["bitmap"],
                "speed": int(animation.attrib["speed"]),
                "sprites": [attributes(sprite) for sprite in animation],
            },
        })
    return {"kind": root.tag, "name": root.attrib["name"], "states": states}


def entity_group(path):
    root = ET.parse(path).getroot()
    return [xml_element(element) for element in root]


def layer(map_root, name):
    element = next(
        (candidate for candidate in map_root.findall("layer")
         if candidate.attrib.get("name") == name),
        None,
    )
    if element is None:
        raise ValueError(f"missing TMX layer: {name}")
    return [int(tile.attrib["gid"]) for tile in element.find("data")]


def convert(project_root, tmx_path, level_dir, player_path):
    map_root = ET.parse(project_root / tmx_path).getroot()
    tileset = map_root.find("tileset")
    image = tileset.find("image")

    entities = {}
    definitions = {}
    for group_name, filename in ENTITY_FILES.items():
        group = entity_group(project_root / level_dir / filename)
        entities[group_name] = group
        for entity in group:
            definition_path = entity.get("file")
            if definition_path is None and isinstance(entity.get("attributes"), dict):
                definition_path = entity["attributes"].get("file")
            if definition_path and definition_path not in definitions:
                definitions[definition_path] = animation_definition(
                    definition_path.removeprefix("../"), project_root
                )

    player_key = "../" + player_path.as_posix()
    definitions[player_key] = animation_definition(player_path, project_root)
    for definition_path in ("../designs/shoot/shoot.xml",
                            "../designs/bomb/bomb.xml"):
        definitions[definition_path] = animation_definition(
            definition_path.removeprefix("../"), project_root
        )

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
                "image": "../maps/level1/" + image.attrib["source"],
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
        "player": {"definition": player_key},
        "definitions": definitions,
        "audio": {
            "music": ["../music/level1.ogg"],
            "effects": [
                "../fx/walk.wav", "../fx/zap.wav", "../fx/kickbomb.wav",
                "../fx/waaaaaa1.wav", "../fx/bonus.wav", "../fx/ring.wav",
                "../fx/explosion.wav",
            ],
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, default=Path(__file__).parents[1])
    parser.add_argument("--tmx", type=Path, default=Path("maps/level1/Map1_prueba.tmx"))
    parser.add_argument("--level-dir", type=Path, default=Path("levels/level1"))
    parser.add_argument("--player", type=Path, default=Path("characters/rick.xml"))
    parser.add_argument("--output", type=Path, default=Path("levels/level1/level.json"))
    args = parser.parse_args()
    package = convert(args.project_root, args.tmx, args.level_dir, args.player)
    output = args.project_root / args.output
    output.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
