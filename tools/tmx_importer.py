"""Validated importer for the TMX subset supported by the Rick2 engine."""

from pathlib import Path
import xml.etree.ElementTree as ET


class TmxImportError(ValueError):
    pass


REQUIRED_LAYERS = ("Tiles", "FrontTiles", "Collisions")
FLIP_FLAGS = 0xF0000000


def positive_int(element, attribute, context):
    try:
        value = int(element.attrib[attribute])
    except (KeyError, ValueError) as error:
        raise TmxImportError(f"{context}: invalid or missing '{attribute}'") from error
    if value <= 0:
        raise TmxImportError(f"{context}: '{attribute}' must be positive")
    return value


def parse_tileset(element, map_tile_width, map_tile_height):
    if "source" in element.attrib:
        raise TmxImportError("external TSX tilesets are not supported")
    first_gid = positive_int(element, "firstgid", "tileset")
    tile_count = positive_int(element, "tilecount", "tileset")
    columns = positive_int(element, "columns", "tileset")
    tile_width = positive_int(element, "tilewidth", "tileset")
    tile_height = positive_int(element, "tileheight", "tileset")
    if tile_width != map_tile_width or tile_height != map_tile_height:
        raise TmxImportError("tileset tile dimensions must match the map")
    image = element.find("image")
    if image is None or not image.attrib.get("source"):
        raise TmxImportError("embedded tileset is missing its image")
    image_width = positive_int(image, "width", "tileset image")
    image_height = positive_int(image, "height", "tileset image")
    if int(element.attrib.get("margin", "0")) != 0 or \
       int(element.attrib.get("spacing", "0")) != 0:
        raise TmxImportError("tileset margin and spacing are not supported")
    if image_width < columns * tile_width or \
       image_height < ((tile_count + columns - 1) // columns) * tile_height:
        raise TmxImportError("tileset image is too small for its declared tiles")
    return {
        "firstGid": first_gid,
        "lastGid": first_gid + tile_count - 1,
        "tileCount": tile_count,
        "columns": columns,
        "image": image.attrib["source"],
        "imageWidth": image_width,
        "imageHeight": image_height,
    }


def parse_layer(element, map_width, map_height):
    name = element.attrib.get("name", "<unnamed>")
    if positive_int(element, "width", f"layer '{name}'") != map_width or \
       positive_int(element, "height", f"layer '{name}'") != map_height:
        raise TmxImportError(f"layer '{name}' dimensions do not match the map")
    data = element.find("data")
    if data is None:
        raise TmxImportError(f"layer '{name}' has no data")
    if data.attrib.get("compression"):
        raise TmxImportError(f"layer '{name}': compressed data is not supported")
    encoding = data.attrib.get("encoding")
    if encoding is None:
        try:
            gids = [int(tile.attrib["gid"]) for tile in data.findall("tile")]
        except (KeyError, ValueError) as error:
            raise TmxImportError(f"layer '{name}' contains an invalid GID") from error
    elif encoding == "csv":
        try:
            gids = [int(value.strip()) for value in (data.text or "").split(",")
                    if value.strip()]
        except ValueError as error:
            raise TmxImportError(f"layer '{name}' contains invalid CSV data") from error
    else:
        raise TmxImportError(f"layer '{name}': encoding '{encoding}' is not supported")
    expected = map_width * map_height
    if len(gids) != expected:
        raise TmxImportError(
            f"layer '{name}' contains {len(gids)} cells, expected {expected}"
        )
    return gids


def import_tmx(path):
    path = Path(path)
    try:
        root = ET.parse(path).getroot()
    except (ET.ParseError, OSError) as error:
        raise TmxImportError(f"cannot read TMX '{path}': {error}") from error
    if root.tag != "map":
        raise TmxImportError("TMX root element must be 'map'")
    if root.attrib.get("orientation") != "orthogonal":
        raise TmxImportError("only orthogonal TMX maps are supported")
    if root.attrib.get("infinite", "0") != "0":
        raise TmxImportError("infinite TMX maps are not supported")

    width = positive_int(root, "width", "map")
    height = positive_int(root, "height", "map")
    tile_width = positive_int(root, "tilewidth", "map")
    tile_height = positive_int(root, "tileheight", "map")
    tilesets = [parse_tileset(element, tile_width, tile_height)
                for element in root.findall("tileset")]
    if not tilesets:
        raise TmxImportError("TMX map must contain an embedded tileset")
    tilesets.sort(key=lambda item: item["firstGid"])
    if tilesets[0]["firstGid"] != 1:
        raise TmxImportError("the visual tileset must start at GID 1")
    for previous, current in zip(tilesets, tilesets[1:]):
        if current["firstGid"] <= previous["lastGid"]:
            raise TmxImportError("tileset GID ranges overlap")

    layer_elements = {}
    for element in root.findall("layer"):
        name = element.attrib.get("name")
        if name in layer_elements:
            raise TmxImportError(f"duplicate TMX layer: {name}")
        layer_elements[name] = element
    missing = [name for name in REQUIRED_LAYERS if name not in layer_elements]
    if missing:
        raise TmxImportError("missing TMX layer: " + ", ".join(missing))

    layers = {name: parse_layer(layer_elements[name], width, height)
              for name in REQUIRED_LAYERS}
    visual_range = range(tilesets[0]["firstGid"], tilesets[0]["lastGid"] + 1)
    all_ranges = [range(item["firstGid"], item["lastGid"] + 1)
                  for item in tilesets]
    for name, gids in layers.items():
        for gid in gids:
            if gid < 0 or gid & FLIP_FLAGS:
                raise TmxImportError(f"layer '{name}' uses unsupported GID flags")
            if gid and not any(gid in valid_range for valid_range in all_ranges):
                raise TmxImportError(f"layer '{name}' references unknown GID {gid}")
            if name != "Collisions" and gid and gid not in visual_range:
                raise TmxImportError(f"layer '{name}' uses a non-visual tileset")
            if name == "Collisions" and gid and gid in visual_range:
                raise TmxImportError("layer 'Collisions' uses the visual tileset")

    return {
        "width": width,
        "height": height,
        "tileWidth": tile_width,
        "tileHeight": tile_height,
        "tilesets": tilesets,
        "layers": layers,
    }
