#!/usr/bin/env python3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "tools"))
from tmx_importer import TmxImportError, import_tmx


def layer(name, gids, width=2, height=1, encoding=None):
    if encoding == "csv":
        data = f'<data encoding="csv">{",".join(map(str, gids))}</data>'
    elif encoding:
        data = f'<data encoding="{encoding}">ignored</data>'
    else:
        data = "<data>" + "".join(f'<tile gid="{gid}"/>' for gid in gids) + "</data>"
    return f'<layer name="{name}" width="{width}" height="{height}">{data}</layer>'


def tmx(layers, orientation="orthogonal", tilesets=None):
    if tilesets is None:
        tilesets = """
        <tileset firstgid="1" tilewidth="8" tileheight="8" tilecount="1" columns="1">
          <image source="visual.png" width="8" height="8"/>
        </tileset>
        <tileset firstgid="2" tilewidth="8" tileheight="8" tilecount="1" columns="1">
          <image source="collision.png" width="8" height="8"/>
        </tileset>"""
    return f'<map orientation="{orientation}" width="2" height="1" tilewidth="8" tileheight="8">{tilesets}{layers}</map>'


class TmxImporterTest(unittest.TestCase):
    def import_text(self, content):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "map.tmx"
            path.write_text(content, encoding="utf-8")
            return import_tmx(path)

    def valid_layers(self, encoding=None):
        return (layer("Tiles", [0, 1], encoding=encoding) +
                layer("FrontTiles", [1, 0], encoding=encoding) +
                layer("Collisions", [0, 2], encoding=encoding))

    def test_preserves_empty_gid_and_first_tile(self):
        result = self.import_text(tmx(self.valid_layers()))
        self.assertEqual(result["layers"]["Tiles"], [0, 1])

    def test_accepts_csv_data(self):
        result = self.import_text(tmx(self.valid_layers("csv")))
        self.assertEqual(result["layers"]["Collisions"], [0, 2])

    def test_rejects_missing_or_wrong_sized_layers(self):
        with self.assertRaisesRegex(TmxImportError, "missing TMX layer"):
            self.import_text(tmx(layer("Tiles", [0, 1])))
        wrong = (layer("Tiles", [0, 1], width=1) +
                 layer("FrontTiles", [0, 0]) + layer("Collisions", [0, 2]))
        with self.assertRaisesRegex(TmxImportError, "dimensions"):
            self.import_text(tmx(wrong))

    def test_rejects_unknown_and_flipped_gids(self):
        for invalid_gid in (3, 0x80000001):
            layers = (layer("Tiles", [0, invalid_gid]) +
                      layer("FrontTiles", [0, 0]) +
                      layer("Collisions", [0, 2]))
            with self.assertRaises(TmxImportError):
                self.import_text(tmx(layers))

    def test_rejects_tilesets_in_the_wrong_layer(self):
        visual_collision = (layer("Tiles", [0, 1]) +
                            layer("FrontTiles", [0, 0]) +
                            layer("Collisions", [0, 1]))
        with self.assertRaisesRegex(TmxImportError, "visual tileset"):
            self.import_text(tmx(visual_collision))
        collision_graphic = (layer("Tiles", [0, 2]) +
                             layer("FrontTiles", [0, 0]) +
                             layer("Collisions", [0, 2]))
        with self.assertRaisesRegex(TmxImportError, "non-visual"):
            self.import_text(tmx(collision_graphic))

    def test_rejects_unsupported_map_and_encoding_variants(self):
        with self.assertRaisesRegex(TmxImportError, "orthogonal"):
            self.import_text(tmx(self.valid_layers(), orientation="isometric"))
        unsupported = (layer("Tiles", [0, 1], encoding="base64") +
                       layer("FrontTiles", [0, 0]) + layer("Collisions", [0, 2]))
        with self.assertRaisesRegex(TmxImportError, "encoding"):
            self.import_text(tmx(unsupported))

    def test_rejects_external_tilesets(self):
        external = '<tileset firstgid="1" source="visual.tsx"/>'
        with self.assertRaisesRegex(TmxImportError, "external TSX"):
            self.import_text(tmx(self.valid_layers(), tilesets=external))


if __name__ == "__main__":
    unittest.main()
