#!/usr/bin/env python3
import json
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path
from zipfile import ZipFile

import jsonschema

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from convert_camelot_phase1 import DEFAULT_LEGACY_ROOT, collision_gid, convert, parse_checkpoints, parse_forced_state_zone, parse_keep_moving_zones


class CamelotCollisionConversionTest(unittest.TestCase):
    def test_historical_slopes_use_generic_collision_gids(self):
        self.assertEqual([collision_gid(value, 453) for value in range(4)], [0, 454, 458, 459])


@unittest.skipUnless(DEFAULT_LEGACY_ROOT.is_dir(), "historical Camelot checkout is not available")
class CamelotPhase1ConversionTest(unittest.TestCase):
    def test_conversion_is_reproducible_schema_valid_and_reports_losses(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.rick2-project"
            second = Path(directory) / "second.rick2-project"
            convert(DEFAULT_LEGACY_ROOT, first)
            convert(DEFAULT_LEGACY_ROOT, second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with ZipFile(first) as archive:
                manifest = json.loads(archive.read("project.json"))
                level = json.loads(archive.read(manifest["initialLevel"]))
                report = json.loads(archive.read("loss-report.json"))
                jsonschema.Draft202012Validator(json.loads((ROOT / "schema/project.schema.json").read_text())).validate(manifest)
                jsonschema.Draft202012Validator(json.loads((ROOT / "schema/level.schema.json").read_text())).validate(level)
                self.assertEqual((level["map"]["width"], level["map"]["height"]), (128, 48))
                self.assertEqual(set(level["map"]["layers"]["collisions"]), {0, 454})
                self.assertTrue(level["audio"]["playback"]["initialLoop"])
                self.assertTrue(all(len(layer) == 128 * 48 for layer in level["map"]["layers"].values()))
                self.assertEqual(len(level["entities"]["cameraViews"]), 6)
                parallax = level["presentation"]["parallaxLayers"]
                self.assertEqual(
                    [(layer["plane"], layer["factorX"], layer["factorY"], layer["repeatY"])
                     for layer in parallax],
                    [("back", 1 / 3, 0, False), ("back", 1 / 10, 0, False),
                     ("front", 2, 1, True)],
                )
                transparent = []
                for layer in parallax:
                    asset = layer["image"].removeprefix("../../")
                    png = archive.read(asset)
                    self.assertTrue(asset.endswith(".png"))
                    self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
                    width, height, _, color_type = struct.unpack(">IIBB", png[16:26])
                    self.assertEqual(color_type, 6)
                    offset, compressed = 8, bytearray()
                    while offset < len(png):
                        size = struct.unpack(">I", png[offset:offset + 4])[0]
                        kind = png[offset + 4:offset + 8]
                        if kind == b"IDAT":
                            compressed.extend(png[offset + 8:offset + 8 + size])
                        offset += 12 + size
                    pixels = zlib.decompress(compressed)
                    self.assertEqual(len(pixels), height * (1 + width * 4))
                    stride = 1 + width * 4
                    transparent.append(any(0 in pixels[row * stride + 4:(row + 1) * stride:4]
                                           for row in range(height)))
                self.assertEqual(transparent, [True, False, True])
                checkpoints = level["entities"]["checkpoints"]
                self.assertEqual(len(checkpoints), 11)
                self.assertEqual([checkpoint["id"] for checkpoint in checkpoints], list(range(11)))
                self.assertEqual([checkpoint["nxt_chks"] for checkpoint in checkpoints],
                                 [[1], [2], [3], [4], [5, 6], [7], [7], [8], [9], [10], []])
                self.assertEqual((checkpoints[0]["chk_x"], checkpoints[0]["chk_y"],
                                  checkpoints[0]["chk_width"], checkpoints[0]["chk_height"]),
                                 (320, 560, 281, 129))
                self.assertEqual((checkpoints[4]["pl_x"], checkpoints[4]["pl_y"]), (811, 224))
                self.assertEqual(checkpoints[0]["pl_face"], "right")
                self.assertTrue(all(checkpoint["pl_face"] == "preserve" for checkpoint in checkpoints[1:]))
                self.assertTrue(all(checkpoint["activation"] == "topLeft" for checkpoint in checkpoints[:-1]))
                self.assertEqual(checkpoints[-1]["activation"], "disabled")
                self.assertEqual([form["visualScale"] for form in level["runtimeProfile"]["characterForms"]["forms"]], [4, 4])
                primary_controller = level["runtimeProfile"]["characterForms"]["forms"][0]["controller"]
                alternate_controller = level["runtimeProfile"]["characterForms"]["forms"][1]["controller"]
                for controller in [primary_controller, alternate_controller]:
                    self.assertEqual(controller["runSpeed"], 4)
                    self.assertEqual(controller["airControl"], False)
                    self.assertEqual(controller["minimumVerticalSpeed"], 4)
                    self.assertEqual(controller["maximumVerticalSpeed"], 4)
                    self.assertEqual(controller["verticalAcceleration"], 0.1)
                    self.assertEqual(controller["climbSpeed"], 8)
                self.assertEqual(primary_controller["jumpHeight"], 184)
                self.assertEqual(primary_controller["jumpDistanceX"], 184)
                self.assertEqual(level["runtimeProfile"]["actionBindings"],
                                 {"neutral": "hitting", "up": None,
                                  "down": None, "horizontal": None})
                primary_states = {state["id"]: state for state in
                                  level["runtimeProfile"]["characterForms"]["forms"][0]["stateMachine"]["states"]}
                alternate_states = {state["id"]: state for state in
                                    level["runtimeProfile"]["characterForms"]["forms"][1]["stateMachine"]["states"]}
                self.assertEqual(primary_states["falling"]["transitions"][-1],
                                 {"to": "crouching", "conditions": [{"type": "signal", "signal": "grounded", "value": True}]})
                self.assertEqual(alternate_states["falling"]["transitions"][-1],
                                 {"to": "idle", "conditions": [{"type": "signal", "signal": "grounded", "value": True}]})
                self.assertEqual([transition["to"] for transition in primary_states["crouching"]["transitions"][-2:]],
                                 ["idle", "jumping"])
                self.assertEqual([transition["conditions"][-1] for transition in primary_states["crouching"]["transitions"][-2:]],
                                 [{"type": "previousState", "comparison": "equal", "state": "falling"},
                                  {"type": "previousState", "comparison": "notEqual", "state": "falling"}])
                for states in [primary_states, alternate_states]:
                    self.assertEqual(states["jumping"]["transitions"][-1],
                                     {"to": "falling", "conditions": [{"type": "signal", "signal": "descending", "value": True}]})
                    idle_transition = states["walking"]["transitions"][-1]
                    self.assertEqual(idle_transition["to"], "idle")
                    self.assertEqual(idle_transition["conditions"], [
                        {"type": "control", "control": control, "pressed": False}
                        for control in ["left", "right", "up", "down", "action"]
                    ])
                self.assertEqual([transition["to"] for transition in primary_states["drawing-sword"]["transitions"][-2:]],
                                 ["idle", "striking"])
                self.assertEqual([transition["to"] for transition in primary_states["striking"]["transitions"][-2:]],
                                 ["drawing-sword", "guarding"])
                striking_definition = next(state for state in level["definitions"]["characters/player"]["states"]
                                           if state["name"] == "golpear")
                self.assertEqual(striking_definition["animation"], {
                    "bitmap": "../../assets/characters/player-striking.png",
                    "frameDurationTicks": 1,
                    "sprites": [{"x": 0, "y": 0, "width": 48, "height": 40}],
                })
                frog_walk = next(state for state in level["definitions"]["characters/player"]["states"]
                                 if state["name"] == "rana-caminar-derecha")
                self.assertEqual(frog_walk["animation"]["frameDurationTicks"], 4)
                self.assertEqual(frog_walk["animation"]["frameDurationMs"], 85)
                self.assertEqual(alternate_controller["jumpHeight"], 192)
                self.assertEqual(alternate_controller["jumpDistanceX"], 192)
                self.assertEqual(primary_controller["crouchingHeight"], primary_controller["standingHeight"])
                self.assertEqual(alternate_controller["crouchingHeight"], alternate_controller["standingHeight"])
                self.assertEqual(
                    (primary_controller["spriteWidth"], primary_controller["collisionWidth"], primary_controller["standingHeight"]),
                    (64, 64, 160),
                )
                self.assertEqual(
                    (alternate_controller["spriteWidth"], alternate_controller["collisionWidth"], alternate_controller["standingHeight"]),
                    (128, 128, 128),
                )
                sequence = level["gameplay"]["sequences"][0]
                self.assertEqual([step["type"] for step in sequence["steps"]], ["action", "parallel", "action", "serial", "action", "action", "action"])
                self.assertEqual(sequence["steps"][0]["action"],
                                 {"type": "setPlayerMode", "visible": True, "controllable": False})
                self.assertEqual(sequence["steps"][2]["action"],
                                 {"type": "setPlayerMode", "visible": False, "controllable": False})
                parallel, explosion = sequence["steps"][1], sequence["steps"][3]
                self.assertEqual([branch["steps"][1]["ticks"] for branch in parallel["steps"]], [25, 75])
                self.assertEqual(explosion["steps"][1]["ticks"], 63)
                explosion_definition = level["definitions"]["objects/explosion"]["states"][0]["animation"]
                self.assertEqual(explosion_definition["frameDurationTicks"], 12)
                self.assertEqual(explosion_definition["frameDurationMs"], 250)
                self.assertEqual(
                    [(branch["steps"][0]["action"]["id"], branch["steps"][2]["action"]["id"])
                     for branch in parallel["steps"]],
                    [(2, 2), (3, 3)],
                )
                self.assertEqual(
                    (explosion["steps"][0]["action"]["id"], explosion["steps"][2]["action"]["id"]),
                    (0, 0),
                )
                self.assertTrue(all(branch["steps"][0]["action"]["restartAnimation"] for branch in parallel["steps"]))
                self.assertTrue(explosion["steps"][0]["action"]["restartAnimation"])
                self.assertEqual(
                    [step["action"] for step in sequence["steps"][-3:]],
                    [{"flag": "alternate-form", "type": "setFlag", "value": True},
                     {"event": "scene-finished", "type": "emitEvent"},
                     {"type": "setPlayerMode", "visible": True, "controllable": True}],
                )
                self.assertEqual(len(level["entities"]["items"]), 1)
                self.assertEqual(
                    level["entities"]["items"][0]["onCollect"],
                    [{"flag": "item-collected", "type": "setFlag", "value": True},
                     {"message": "item-message", "type": "showMessage"}],
                )
                self.assertEqual(level["entities"]["items"][0]["attributes"]["physics"], "fixed")
                self.assertEqual(level["entities"]["items"][0]["attributes"]["visualScale"], 4)
                self.assertEqual(
                    (level["entities"]["items"][0]["attributes"]["width"], level["entities"]["items"][0]["attributes"]["height"]),
                    (64, 92),
                )
                self.assertEqual(len(level["entities"]["backgroundObjects"]), 3)
                enemies = level["entities"]["enemies"]
                self.assertEqual([enemy["id"] for enemy in enemies], list(range(1, 17)))
                self.assertTrue(all(enemy["behavior"].get("deathMotion") == "stationary" for enemy in enemies))
                for enemy in enemies:
                    del enemy["behavior"]["deathMotion"]
                for legacy_id, x, y, distance_x, distance_y, speed, definition in [
                    (13, 3800, 80, 124, 240, 4, "mosca"),
                    (14, 240, 300, 184, 240, 8, "buho"),
                    (15, 120, 900, 200, 310, 8, "buho"),
                ]:
                    self.assertEqual(enemies[legacy_id - 1], {
                        "id": legacy_id, "x": x, "y": y, "bb_x": 0, "bb_y": 0,
                        "bb_width": 116, "bb_height": 112, "direction": "right",
                        "speed_x": speed, "speed_y": speed, "definition": f"enemies/{definition}",
                        "visualScale": 4, "combatProfile": f"enemy-{legacy_id}",
                        "behavior": {"type": "xyPatrol", "distanceX": distance_x,
                                     "distanceY": distance_y, "stepsPerTick": speed,
                                     "initialDirectionX": "right", "initialDirectionY": "down",
                                     "respawnDelayTicks": 251},
                    })
                self.assertEqual(enemies[-1], {
                    "id": 16, "x": 3780, "y": 1400, "bb_x": 0, "bb_y": 0,
                    "bb_width": 104, "bb_height": 92, "direction": "right",
                    "speed_x": 0, "speed_y": 4, "definition": "enemies/bombolla",
                    "visualScale": 4, "combatProfile": "enemy-16",
                    "behavior": {"type": "verticalPatrol", "distance": 404,
                                 "initialDirection": "up", "loop": False, "onLimit": "die", "respawnDelayTicks": 251},
                })
                self.assertEqual(level["definitions"]["enemies/bombolla"]["states"][0]["animation"], {
                    "bitmap": "../../assets/enemies/bombolla.bmp", "frameDurationTicks": 5,
                    "sprites": [{"x": 1, "y": 1, "width": 26, "height": 23},
                                {"x": 28, "y": 1, "width": 26, "height": 23},
                                {"x": 55, "y": 1, "width": 26, "height": 23},
                                {"x": 82, "y": 1, "width": 26, "height": 23}],
                })
                self.assertEqual(level["definitions"]["enemies/bombolla"]["states"][-1]["animation"]["sprites"],
                                 [{"x": 1, "y": 25, "width": 26, "height": 23},
                                  {"x": 28, "y": 25, "width": 26, "height": 23},
                                  {"x": 55, "y": 25, "width": 26, "height": 23}])
                vertical_profile = next(profile for profile in level["combat"]["profiles"] if profile["id"] == "enemy-16")
                self.assertEqual(vertical_profile["hurtboxes"], [{"id": "body", "x": 0, "y": 0, "width": 104, "height": 92}])
                self.assertEqual(vertical_profile["attacks"][0]["damage"], 1)
                self.assertEqual(enemies[11], {
                    "id": 12, "x": 330, "y": 1350, "bb_x": 0, "bb_y": 0,
                    "bb_width": 84, "bb_height": 32, "direction": "right",
                    "speed_x": 4, "speed_y": 0, "definition": "enemies/bombolles",
                    "visualScale": 4, "combatProfile": "enemy-12",
                    "behavior": {"type": "idle"},
                })
                self.assertEqual(level["definitions"]["enemies/bombolles"]["states"][0]["animation"], {
                    "bitmap": "../../assets/enemies/bombolles.bmp", "frameDurationTicks": 8,
                    "sprites": [{"x": 1, "y": 1, "width": 21, "height": 8},
                                {"x": 23, "y": 1, "width": 22, "height": 8}],
                })
                bubbles_profile = next(profile for profile in level["combat"]["profiles"] if profile["id"] == "enemy-12")
                self.assertEqual(bubbles_profile["hurtboxes"], [{"id": "body", "x": 0, "y": 0, "width": 84, "height": 32}])
                self.assertEqual(bubbles_profile["attacks"], [{"id": "contact", "states": ["CHAR_STATE_RUNNING", "CHAR_STATE_STOP"], "x": 0, "y": 0, "width": 84, "height": 32, "damageType": "contact", "damage": 1, "hitOnce": False}])
                self.assertNotIn("guards", bubbles_profile)
                self.assertEqual(enemies[10], {
                    "id": 11, "x": 3362, "y": 1377, "bb_x": 0, "bb_y": 0,
                    "bb_width": 160, "bb_height": 128, "direction": "right",
                    "speed_x": 4, "speed_y": 0, "definition": "enemies/planta",
                    "visualScale": 4, "combatProfile": "enemy-11",
                    "behavior": {"type": "idle"},
                })
                self.assertEqual(level["definitions"]["enemies/planta"]["states"][0]["animation"], {
                    "bitmap": "../../assets/enemies/planta.bmp", "frameDurationTicks": 12,
                    "sprites": [{"x": 1, "y": 1, "width": 40, "height": 32},
                                {"x": 42, "y": 1, "width": 39, "height": 32}],
                })
                profile = next(profile for profile in level["combat"]["profiles"] if profile["id"] == "enemy-11")
                self.assertEqual(profile["hurtboxes"], [{"id": "body", "x": 0, "y": 0, "width": 160, "height": 128}])
                self.assertEqual(profile["attacks"], [{"id": "contact", "states": ["CHAR_STATE_RUNNING", "CHAR_STATE_STOP"], "x": 0, "y": 0, "width": 160, "height": 128, "damageType": "contact", "damage": 1, "hitOnce": False}])
                self.assertEqual(profile["guards"], [{"id": "sword-immunity", "states": ["CHAR_STATE_RUNNING", "CHAR_STATE_STOP"], "x": 0, "y": 0, "width": 160, "height": 128, "damageTypes": ["contact"], "facingOnly": False}])
                self.assertTrue(all(profile["attacks"][0]["hitOnce"] is False for profile in level["combat"]["profiles"] if profile["id"].startswith("enemy-")))
                self.assertEqual(enemies[1], {
                    "id": 2, "x": 570, "y": 665, "bb_x": 0, "bb_y": 0,
                    "bb_width": 64, "bb_height": 71, "direction": "left",
                    "speed_x": 8, "speed_y": 3, "definition": "enemies/bolita",
                    "visualScale": 4, "combatProfile": "enemy-2",
                    "behavior": {"type": "patrol", "distance": 182,
                                 "turnAtEdges": True, "turnAtWalls": True},
                })
                self.assertEqual(enemies[3], {
                    "id": 4, "x": 700, "y": 560, "bb_x": 0, "bb_y": 0,
                    "bb_width": 116, "bb_height": 112, "direction": "right",
                    "speed_x": 8, "speed_y": 0, "definition": "enemies/mosca",
                    "visualScale": 4, "combatProfile": "enemy-4",
                    "behavior": {"type": "flyPatrol", "axis": "horizontal",
                                 "distance": 242, "phaseTicks": 31,
                                 "initialDirection": "right"},
                })
                self.assertEqual(
                    [(enemy["id"], enemy["x"], enemy["y"], enemy["direction"],
                      enemy["speed_x"], enemy["behavior"]["distance"],
                      enemy["behavior"]["phaseTicks"])
                     for enemy in enemies[4:7]],
                    [(5, 3075, 200, "right", 8, 460, 58),
                     (6, 960, 200, "right", 24, 2030, 85),
                     (7, 3380, 1240, "right", 12, 340, 29)],
                )
                self.assertTrue(all(
                    enemy["definition"] == "enemies/mosca" and
                    enemy["visualScale"] == 4 and
                    enemy["behavior"]["type"] == "flyPatrol" and
                    enemy["behavior"]["axis"] == "horizontal" and
                    enemy["behavior"]["initialDirection"] == "right" and
                    enemy["speed_y"] == 0
                    for enemy in enemies[4:7]
                ))
                self.assertEqual(
                    [(enemy["id"], enemy["x"], enemy["y"], enemy["direction"],
                      enemy["speed_x"], enemy["bb_width"], enemy["bb_height"],
                      enemy["behavior"]["distance"])
                    for enemy in enemies[7:10]],
                    [(8, 3743, 688, "left", 4, 96, 48, 246),
                     (9, 970, 336, "right", 4, 96, 48, 2020),
                     (10, 571, 1456, "right", 4, 96, 48, 360)],
                )
                self.assertTrue(all(enemy["definition"] == "enemies/hipopotamo" and
                                    enemy["visualScale"] == 4 and
                                    enemy["behavior"]["type"] == "patrol"
                                    for enemy in enemies[7:10]))
                for definition_id in ("enemies/bolita", "enemies/mosca"):
                    states = level["definitions"][definition_id]["states"]
                    self.assertEqual(
                        [(state["name"], state["id"]) for state in states],
                        [("CHAR_STATE_STOP", 0), ("CHAR_STATE_RUNNING", 2),
                         ("CHAR_STATE_DYING", 8)],
                    )
                self.assertEqual(
                    [(enemy["id"], enemy["x"], enemy["y"], enemy["direction"],
                      enemy["speed_x"], enemy["behavior"]["distance"])
                     for enemy in (enemies[0], enemies[2])],
                    [(1, 3020, 1049, "left", 24, 1984),
                     (3, 1036, 1433, "right", 24, 1984)],
                )
                self.assertTrue(all(
                    enemy["behavior"] == {"type": "patrol", "distance": 1984,
                                           "turnAtEdges": True, "turnAtWalls": True}
                    for enemy in (enemies[0], enemies[2])
                ))
                self.assertEqual([profile["id"] for profile in level["combat"]["profiles"][-16:]],
                                 [f"enemy-{enemy_id}" for enemy_id in range(1, 17)])
                player_profiles = {profile["id"]: profile for profile in level["combat"]["profiles"][:2]}
                self.assertEqual(player_profiles["player-primary"]["hurtboxes"],
                                 [{"id": "body", "x": 25, "y": 25,
                                   "width": 14, "height": 95}])
                self.assertEqual(player_profiles["player-alternate"]["hurtboxes"],
                                 [{"id": "body", "x": 25, "y": 25,
                                   "width": 78, "height": 63}])
                self.assertEqual(player_profiles["player-primary"]["attacks"][0], {
                    "id": "melee", "states": ["golpear"], "frames": [0],
                    "x": 64, "y": 24, "width": 64, "height": 28,
                    "damageType": "contact", "damage": 1,
                })
                self.assertEqual(len(level["entities"]["triggers"]), 9)
                danger = level["entities"]["triggers"][1]
                self.assertEqual(
                    (danger["attributes"]["x"], danger["attributes"]["y"], danger["attributes"]["width"], danger["attributes"]["height"]),
                    (3744, 1350, 188, 182),
                )
                self.assertEqual(danger["gameplay"], {
                    "conditions": [{"comparison": "equal", "flag": "alternate-form", "type": "flag", "value": False}],
                    "actions": [{"event": "killed", "type": "emitEvent"}],
                })
                forced = level["entities"]["triggers"][2]
                self.assertEqual(parse_forced_state_zone(DEFAULT_LEGACY_ROOT / "data/scripts/phase1.txt"), (719, 751, 336, 16))
                self.assertEqual(forced["attributes"], {"x": 719, "y": 751, "width": 336, "height": 16,
                    "recursive": 0, "onehot": 0, "action": "stays", "face": "any", "activation": "continuousPoint"})
                self.assertEqual(forced["gameplay"], {"actions": [{"type": "forcePlayerState", "state": "falling", "previousState": "walking"}]})
                keep_bounds = [(960, 960, 74, 64), (960, 224, 74, 62),
                               (3003, 960, 74, 64), (3003, 224, 74, 64),
                               (3003, 1344, 74, 64), (960, 1344, 74, 64)]
                self.assertEqual(parse_keep_moving_zones(DEFAULT_LEGACY_ROOT / "data/scripts/phase1.txt"), keep_bounds)
                self.assertEqual([(trigger["id"], *(trigger["attributes"][key] for key in ("x", "y", "width", "height")))
                                  for trigger in level["entities"]["triggers"][3:]],
                                 [(index, *bounds) for index, bounds in enumerate(keep_bounds, 4)])
                self.assertTrue(all(trigger["attributes"]["activation"] == "continuousPoint" and
                                    trigger["gameplay"] == {"actions": [{"type": "keepPlayerMoving"}]}
                                    for trigger in level["entities"]["triggers"][3:]))
                self.assertEqual(level["presentation"]["messages"][0]["durationTicks"], 50)
                self.assertEqual([item["attributes"]["visible"] for item in level["entities"]["backgroundObjects"]], [0, 0, 0])
                self.assertTrue(all(item["attributes"]["visualScale"] == 4 for item in level["entities"]["backgroundObjects"]))
                self.assertEqual(
                    [(item["attributes"]["width"], item["attributes"]["height"]) for item in level["entities"]["backgroundObjects"]],
                    [(320, 264), (64, 92), (184, 68)],
                )
                primary = level["runtimeProfile"]["characterForms"]["forms"][0]
                self.assertTrue(any(state["transitions"] for state in primary["stateMachine"]["states"]))
                for state in primary["stateMachine"]["states"]:
                    if state["id"] == "dead":
                        self.assertEqual(state["transitions"], [])
                        continue
                    self.assertEqual(state["transitions"][0], {"to": "dead", "conditions": [{"event": "killed", "type": "event"}]})
                    transition = state["transitions"][1]
                    self.assertEqual(transition["conditions"], [{"event": "scene-finished", "type": "event"}])
                    self.assertEqual(transition["actions"], [{"form": "alternate", "type": "setForm"}])
                alternate = level["runtimeProfile"]["characterForms"]["forms"][1]
                for state in alternate["stateMachine"]["states"]:
                    self.assertEqual(state["transitions"][:1], [] if state["id"] == "dead" else [{"to": "dead", "conditions": [{"event": "killed", "type": "event"}]}])
                self.assertFalse(any(
                    transition.get("actions") == [{"form": "alternate", "type": "setForm"}]
                    for state in alternate["stateMachine"]["states"] for transition in state["transitions"]
                ))
                self.assertTrue(report["losses"])
                self.assertEqual(len(report["losses"]), 1)
                self.assertNotIn("ANIMATION_ROUNDING", {loss["code"] for loss in report["losses"]})
                self.assertNotIn("OBJECT_ANIMATION_ROUNDING", {loss["code"] for loss in report["losses"]})
                self.assertNotIn("DEFERRED_CHECKPOINT_GRAPH", {loss["code"] for loss in report["losses"]})
                self.assertEqual(report["losses"], sorted(report["losses"], key=lambda item: item["code"]))
                self.assertEqual(len(report["inputs"]), 43)
                self.assertTrue({"data/characters/planta.txt", "data/characters/planta.bmp", "data/characters/bombolles.txt", "data/characters/bombolles.bmp", "data/characters/bombolla.txt", "data/characters/bombolla.bmp"}.issubset({entry["path"] for entry in report["inputs"]}))
                self.assertNotIn("DEFERRED_ENTITY_RECORDS", {loss["code"] for loss in report["losses"]})
                self.assertTrue({"data/characters/buho.txt", "data/characters/buho.bmp"}.issubset({entry["path"] for entry in report["inputs"]}))
                self.assertEqual(len(level["audio"]["effects"]), 7)

    def test_missing_required_historical_input_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises((FileNotFoundError, ValueError)):
                convert(Path(directory), Path(directory) / "out.rick2-project")

    def test_checkpoint_parser_requires_zero_terminator(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "checkpoints.txt"
            source.write_text("NumCheckpoints 1\n0 1 2 3 4 5 6 7\n")
            with self.assertRaisesRegex(ValueError, "zero link terminator"):
                parse_checkpoints(source, "right")


if __name__ == "__main__":
    unittest.main()
