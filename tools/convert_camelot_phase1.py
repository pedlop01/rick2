#!/usr/bin/env python3
"""Convert the historical Camelot phase 1 into a deterministic project."""

import argparse
import binascii
import hashlib
import json
import re
import math
import struct
import zlib
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

import jsonschema


ROOT = Path(__file__).parents[1]
DEFAULT_LEGACY_ROOT = Path("/home/plopez/proj/camelot/game")
FIXED_DATE = (2020, 1, 1, 0, 0, 0)
LEVEL_PATH = "levels/phase-1/level.json"
LEGACY_MOVEMENT_PER_TICK = 8
LEGACY_VISUAL_SCALE = 4
LEGACY_PLAYER_CONTACT_OFFSET = 25
LEGACY_PLAYER_CONTACT_WIDTH_TRIM = 50
LEGACY_PLAYER_CONTACT_HEIGHT_TRIM = 65
EFFECT_FILES = [
    "player_walk.wav", "sword.wav", "hit.wav", "mort.wav",
    "item_appear.wav", "granota.wav", "fire.wav",
]

STATE_IDS = {
    "WARRIOR_PARADO": "idle", "WARRIOR_CAMINANDO": "walking",
    "WARRIOR_SALTANDO": "jumping", "WARRIOR_CAYENDO": "falling",
    "WARRIOR_COGER_ESPADA": "drawing-sword", "WARRIOR_GOLPEANDO": "striking",
    "WARRIOR_EN_GUARDIA": "guarding", "WARRIOR_AGACHADO": "crouching",
    "WARRIOR_EN_ESCALERAS_LEFT_PARADO": "stairs-idle",
    "WARRIOR_EN_ESCALERAS_LEFT_CAMINANDO": "stairs-moving",
    "WARRIOR_EN_ESCALERAS_RIGHT_PARADO": "stairs-idle",
    "WARRIOR_EN_ESCALERAS_RIGHT_CAMINANDO": "stairs-moving",
    "WARRIOR_RANA_PARADO": "idle", "WARRIOR_RANA_CAMINANDO": "walking",
    "WARRIOR_RANA_SALTANDO": "jumping", "WARRIOR_RANA_CAYENDO": "falling",
}


def json_bytes(value):
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")


def parse_phase_script_records(path):
    tokens = path.read_text().split()
    if tokens[:2] != ["num_scripts", "12"]:
        raise ValueError("Unexpected phase-1 script count")
    index, records = 2, []
    for _ in range(12):
        x, y, width, height = map(int, tokens[index:index + 4]); index += 4
        if tokens[index] not in ("num_input_vars", "input_vars"):
            raise ValueError("Unexpected script input marker")
        count = int(tokens[index + 1]); index += 2
        inputs = {tokens[index + 2 * item]: int(tokens[index + 2 * item + 1]) for item in range(count)}
        index += 2 * count
        if tokens[index] not in ("num_output_vars", "output_vars"):
            raise ValueError("Unexpected script output marker")
        count = int(tokens[index + 1]); index += 2
        outputs = {tokens[index + 2 * item]: int(tokens[index + 2 * item + 1]) for item in range(count)}
        index += 2 * count
        records.append({"bounds": (x, y, width, height), "inputs": inputs, "outputs": outputs})
    if index != len(tokens):
        raise ValueError("Unexpected phase-1 script inventory")
    return records


def parse_forced_state_zone(path):
    matches = [record for record in parse_phase_script_records(path) if "forceStateUpdate" in record["outputs"]]
    if len(matches) != 1 or matches[0]["inputs"] or matches[0]["outputs"] != {
            "forceStateUpdate": 1, "previous_state": 1, "current_state": 3}:
        raise ValueError("Unexpected forced-state script inventory")
    return matches[0]["bounds"]


def parse_keep_moving_zones(path):
    matches = [record for record in parse_phase_script_records(path) if "keepMoving" in record["outputs"]]
    if len(matches) != 6 or any(record["inputs"] or record["outputs"] != {"keepMoving": 1} for record in matches):
        raise ValueError("Unexpected keep-moving script inventory")
    return [record["bounds"] for record in matches]


def read_phase(root):
    result = {}
    for line in (root / "data/levels/phase1.txt").read_text().splitlines():
        parts = line.split(None, 1)
        if len(parts) == 2:
            result[parts[0]] = parts[1].strip()
    return result


def legacy_path(root, value):
    path = (root / value.removeprefix("./")).resolve()
    path.relative_to(root.resolve())
    if not path.is_file():
        raise ValueError(f"Missing historical input: {value}")
    return path


def parse_world(path):
    text = path.read_text()
    header, body = re.split(r"\n\s*map\s*\n", text, maxsplit=1)
    values = {}
    scrolls = []
    plane = None
    for raw in header.splitlines():
        parts = raw.split()
        if not parts:
            continue
        if parts[0] == "num_scroll_planes_back":
            plane = "back"
        elif parts[0] == "num_scroll_planes_front":
            plane = "front"
        elif parts[0].startswith("scroll") and len(parts) == 2 and parts[0].count("_") == 0:
            scrolls.append({"source": parts[1], "plane": plane})
        elif parts[0].startswith("scroll") and scrolls and len(parts) == 2:
            suffix = parts[0].split("_", 1)[1]
            scrolls[-1][suffix] = int(parts[1])
        elif len(parts) == 2:
            values[parts[0]] = parts[1]
    rows = [re.findall(r"(\d+)\s+(\d+)\s+(\d+)", line) for line in body.splitlines() if line.strip()]
    if len(rows) != 48 or {len(row) for row in rows} != {128}:
        raise ValueError("Expected the phase-1 map to contain 128x48 triples")
    triples = [(int(gid), int(collision), int(front)) for row in rows for gid, collision, front in row]
    if any(collision not in (0, 1, 2, 3) or front not in (0, 1) for _, collision, front in triples):
        raise ValueError("Unsupported historical map cell")
    return values, scrolls, triples


def collision_gid(collision, tile_count):
    return {0: 0, 1: tile_count + 1, 2: tile_count + 5, 3: tile_count + 6}[collision]


def parse_zones(path):
    numbers = {key: int(value) for key, value in re.findall(r"(zone\d+_(?:start|world_size)_[xy])\s+(\d+)", path.read_text())}
    zones = []
    for index in range(1, 7):
        zones.append({"id": index - 1, "left_up_x": numbers[f"zone{index}_start_x"],
                      "left_up_y": numbers[f"zone{index}_start_y"],
                      "right_down_x": numbers[f"zone{index}_start_x"] + numbers[f"zone{index}_world_size_x"],
                      "right_down_y": numbers[f"zone{index}_start_y"] + numbers[f"zone{index}_world_size_y"]})
    return zones


def parse_checkpoints(path, initial_face):
    lines = [line.split() for line in path.read_text().splitlines() if line.strip()]
    if len(lines[0]) != 2 or lines[0][0].lower() != "numcheckpoints":
        raise ValueError("Invalid historical checkpoint header")
    expected = int(lines[0][1])
    records = []
    for index, parts in enumerate(lines[1:]):
        values = [int(value) for value in parts]
        if len(values) < 8 or values[-1] != 0:
            raise ValueError(f"Checkpoint {index} lacks its zero link terminator")
        checkpoint_id, left, top, right, bottom, spawn_x, spawn_y = values[:7]
        if checkpoint_id != index or right < left or bottom < top:
            raise ValueError(f"Invalid historical checkpoint record {checkpoint_id}")
        records.append({"id": checkpoint_id, "chk_x": left, "chk_y": top,
                        "chk_width": right - left + 1, "chk_height": bottom - top + 1,
                        "pl_x": spawn_x, "pl_y": spawn_y,
                        "pl_face": initial_face if checkpoint_id == 0 else "preserve",
                        "activation": "disabled" if checkpoint_id == expected - 1 else "topLeft",
                        "nxt_chks": values[7:-1]})
    if len(records) != expected:
        raise ValueError(f"Expected {expected} historical checkpoints, found {len(records)}")
    ids = {record["id"] for record in records}
    if any(target not in ids for record in records for target in record["nxt_chks"]):
        raise ValueError("Historical checkpoint graph contains a broken link")
    return records


def parse_enemy_records(path):
    lines = [line.split() for line in path.read_text().splitlines() if line.strip()]
    if len(lines[0]) != 2 or lines[0][0].lower() != "numenemies":
        raise ValueError("Invalid historical enemy header")
    records = []
    for parts in lines[1:]:
        if len(parts) != 11:
            raise ValueError("Invalid historical enemy record")
        values = [int(value) for value in parts[:10]]
        records.append(dict(zip(
            ["id", "type", "state", "direction", "verticalDirection", "x", "y", "distanceX", "distanceY", "speed"],
            values), definition=parts[10]))
    if len(records) != int(lines[0][1]):
        raise ValueError("Historical enemy count does not match its records")
    return records


def enemy_definition(path, bitmap, movement_index=1):
    lines = [line.split() for line in path.read_text().splitlines()
             if line.strip() and not line.lstrip().startswith("#")]
    animations = []
    index = 0
    while index < len(lines):
        if lines[index][0] != "animacion":
            index += 1
            continue
        frame_count = int(lines[index + 1][1])
        speed = int(lines[index + 2][1])
        frames = []
        for offset in range(frame_count):
            values = [int(value) for value in lines[index + 3 + offset][1:5]]
            frames.append({"x": values[0], "y": values[1],
                           "width": values[2] - values[0] + 1,
                           "height": values[3] - values[1] + 1})
        animations.append({"speed": speed, "frames": frames})
        index += 3 + frame_count
    running = animations[movement_index] if len(animations) > movement_index and animations[movement_index]["frames"] else animations[0]
    dying = animations[8] if len(animations) > 8 and animations[8]["frames"] else running
    make_state = lambda name, state_id, animation: {"name": name, "id": state_id, "animation": {
        "bitmap": bitmap, "frameDurationTicks": max(1, round(animation["speed"] / 20)),
        "sprites": animation["frames"]}}
    return ({"kind": "character", "name": path.stem, "states": [
                make_state("CHAR_STATE_STOP", 0, running),
                make_state("CHAR_STATE_RUNNING", 2, running),
                make_state("CHAR_STATE_DYING", 8, dying)]},
            running["frames"][0])


def parse_animations(path):
    lines = [line.strip() for line in path.read_text().splitlines() if line.strip() and not line.lstrip().startswith("#")]
    animations = []
    current = None
    for line in lines:
        parts = line.split()
        if parts[0] == "animacion":
            current = {"name": parts[1], "states": [], "frames": [], "speed": 0}
            animations.append(current)
        elif current and parts[0] == "velocidad":
            current["speed"] = int(parts[1])
        elif current and parts[0] == "frame" and len(parts) >= 5:
            x1, y1, x2, y2 = map(int, parts[1:5])
            current["frames"].append({"x": x1, "y": y1, "width": x2 - x1 + 1, "height": y2 - y1 + 1})
        elif current and parts[0].startswith("WARRIOR_"):
            current["states"].extend(parts)
    return animations


def parse_machinimia(path):
    entries = []
    for raw in path.read_text().splitlines():
        parts = raw.split()
        if len(parts) == 3 and parts[0] in {"par", "sec"}:
            entries.append({"composition": parts[0], "object": parts[1], "repetitions": int(parts[2])})
    return entries


def object_definition(path, bitmap):
    animation = parse_animations(path)[0]
    animation_data = {"bitmap": bitmap, "frameDurationTicks": max(1, round(animation["speed"] / 20)),
                      "sprites": animation["frames"]}
    if animation["speed"] and animation["speed"] % 20:
        animation_data["frameDurationMs"] = animation["speed"]
    return {"kind": "object", "name": path.stem, "states": [
        {"id": state_id, "name": state_name, "animation": animation_data}
        for state_id, state_name in [(0, "OBJ_STATE_STOP"), (1, "OBJ_STATE_MOVING"), (2, "OBJ_STATE_DYING")]
    ]}


def animation_cycle_ticks(definition, repetitions=1):
    animation = definition["states"][0]["animation"]
    if "frameDurationMs" in animation:
        return math.ceil(animation["frameDurationMs"] * len(animation["sprites"]) * repetitions / 20)
    return animation["frameDurationTicks"] * len(animation["sprites"]) * repetitions


def definition_and_forms(animations):
    states = []
    form_states = {"primary": {}, "alternate": {}}
    seen = set()
    for animation in animations:
        emitted_name = animation["name"].replace("_", "-")
        animation_data = {
            "bitmap": "../../assets/characters/player.bmp",
            "frameDurationTicks": max(1, round(animation["speed"] / 20)),
            "sprites": animation["frames"],
        }
        if animation["speed"] and animation["speed"] % 20:
            animation_data["frameDurationMs"] = animation["speed"]
        states.append({"name": emitted_name, "id": len(states), "animation": animation_data})
        for legacy_state in animation["states"]:
            if legacy_state not in STATE_IDS:
                continue
            form = "alternate" if "_RANA_" in legacy_state else "primary"
            state_id = STATE_IDS[legacy_state]
            if state_id not in form_states[form]:
                form_states[form][state_id] = {"id": state_id, "behavior": behavior(state_id),
                                                   "animation": emitted_name, "transitions": []}
            seen.add(legacy_state)
    missing = sorted(set(STATE_IDS) - seen)
    for entries in form_states.values():
        entries["dead"] = {"id": "dead", "behavior": "dead",
                           "animation": entries["idle"]["animation"], "transitions": []}
    forms = []
    for form_id, entries in form_states.items():
        for state_id, entry in entries.items():
            entry["transitions"] = form_transitions(state_id, form_id == "primary")
            if form_id == "primary" and state_id != "dead":
                entry["transitions"].insert(0, {"to": state_id,
                    "conditions": [{"type": "event", "event": "scene-finished"}],
                    "actions": [{"type": "setForm", "form": "alternate"}]})
            if state_id != "dead":
                entry["transitions"].insert(0, {"to": "dead",
                    "conditions": [{"type": "event", "event": "killed"}]})
        source_width = 16 if form_id == "primary" else 32
        source_height = 40 if form_id == "primary" else 32
        forms.append({"id": form_id, "visualScale": LEGACY_VISUAL_SCALE, "definition": "characters/player", "controller": {
            "spriteWidth": source_width * LEGACY_VISUAL_SCALE,
            "collisionWidth": source_width * LEGACY_VISUAL_SCALE,
            "collisionOffsetX": 0,
            "standingHeight": source_height * LEGACY_VISUAL_SCALE,
            "crouchingHeight": source_height * LEGACY_VISUAL_SCALE,
            "runSpeed": LEGACY_MOVEMENT_PER_TICK / 2,
            "airControl": False,
            "minimumVerticalSpeed": LEGACY_MOVEMENT_PER_TICK / 2,
            "maximumVerticalSpeed": LEGACY_MOVEMENT_PER_TICK / 2,
            "verticalAcceleration": 0.1,
            "climbSpeed": LEGACY_MOVEMENT_PER_TICK,
            "jumpHeight": 184 if form_id == "primary" else 192,
            "jumpDistanceX": 184 if form_id == "primary" else 192,
        }, "capabilities": {"climb": form_id == "primary", "hit": form_id == "primary"},
            "combatProfile": "player-primary" if form_id == "primary" else "player-alternate",
            "stateMachine": {"initialState": "walking", "states": list(entries.values())}})
    return {"kind": "character", "name": "player", "states": states}, forms, missing


def behavior(state):
    return {"walking": "running", "jumping": "jumping", "falling": "jumping",
            "crouching": "crouching", "stairs-idle": "climbing", "stairs-moving": "climbing",
            "striking": "hitting"}.get(state, "stop")


def form_transitions(state, primary):
    grounded = {"type": "signal", "signal": "grounded", "value": True}
    airborne = {"type": "signal", "signal": "grounded", "value": False}
    left = {"type": "control", "control": "left", "pressed": True}
    right = {"type": "control", "control": "right", "pressed": True}
    up = {"type": "control", "control": "up", "pressed": True}
    down = {"type": "control", "control": "down", "pressed": True}
    still = [{"type": "control", "control": key, "pressed": False}
             for key in ["left", "right", "up", "down", "action"]]
    if state in ["idle", "walking"]:
        result = [{"to": "falling", "conditions": [airborne]}]
        if primary:
            result += [{"to": "drawing-sword", "conditions": [{"type": "action", "action": "hitting", "active": True}]},
                       {"to": "crouching", "conditions": [up, grounded]}]
        else:
            result += [{"to": "jumping", "conditions": [up, grounded]}]
        result += [{"to": "walking", "conditions": [left]}, {"to": "walking", "conditions": [right]},
                   {"to": "idle", "conditions": still}]
        return result
    if state == "crouching":
        elapsed = {"type": "elapsedTicks", "comparison": "greaterOrEqual", "value": 5}
        return [{"to": "idle", "conditions": [elapsed, {"type": "previousState", "comparison": "equal", "state": "falling"}]},
                {"to": "jumping", "conditions": [elapsed, {"type": "previousState", "comparison": "notEqual", "state": "falling"}]}]
    if state == "falling":
        return [{"to": "crouching" if primary else "idle", "conditions": [grounded]}]
    if state == "jumping":
        return [{"to": "falling", "conditions": [{"type": "signal", "signal": "descending", "value": True}]}]
    if state == "drawing-sword":
        elapsed = {"type": "elapsedTicks", "comparison": "greaterOrEqual", "value": 5}
        return [{"to": "idle", "conditions": [elapsed, {"type": "previousState", "comparison": "equal", "state": "striking"}]},
                {"to": "striking", "conditions": [elapsed, {"type": "previousState", "comparison": "notEqual", "state": "striking"}]}]
    if state == "striking":
        elapsed = {"type": "elapsedTicks", "comparison": "greaterOrEqual", "value": 5}
        return [{"to": "drawing-sword", "conditions": [elapsed, {"type": "previousState", "comparison": "equal", "state": "guarding"}]},
                {"to": "guarding", "conditions": [elapsed, {"type": "previousState", "comparison": "notEqual", "state": "guarding"}]}]
    if state == "guarding":
        return [{"to": "striking", "conditions": [{"type": "action", "action": "hitting", "active": False}]}]
    if state == "stairs-moving":
        return [{"to": "stairs-idle", "conditions": [{"type": "control", "control": "up", "pressed": False}, {"type": "control", "control": "down", "pressed": False}]}]
    if state == "stairs-idle":
        return [{"to": "stairs-moving", "conditions": [up]}, {"to": "stairs-moving", "conditions": [down]}]
    return []


def archive_asset(files, source, destination):
    files[destination] = source.read_bytes()
    return "../../" + destination


def archive_masked_bmp(files, source, destination):
    data = source.read_bytes()
    if data[:2] != b"BM":
        raise ValueError(f"Expected a BMP image: {source}")
    pixel_offset = struct.unpack_from("<I", data, 10)[0]
    width, height = struct.unpack_from("<ii", data, 18)
    planes, bits = struct.unpack_from("<HH", data, 26)
    compression = struct.unpack_from("<I", data, 30)[0]
    if width <= 0 or height == 0 or planes != 1 or bits != 24 or compression != 0:
        raise ValueError(f"Unsupported historical BMP format: {source}")
    row_stride = (width * 3 + 3) & ~3
    rows = []
    for output_y in range(abs(height)):
        source_y = abs(height) - 1 - output_y if height > 0 else output_y
        row = bytearray([0])
        for x in range(width):
            start = pixel_offset + source_y * row_stride + x * 3
            blue, green, red = data[start:start + 3]
            row.extend((red, green, blue,
                        0 if (red, green, blue) == (255, 0, 255) else 255))
        rows.append(bytes(row))

    def chunk(kind, payload):
        checksum = binascii.crc32(kind + payload) & 0xffffffff
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)

    files[destination] = (b"\x89PNG\r\n\x1a\n" +
                          chunk(b"IHDR", struct.pack(">IIBBBBB", width, abs(height), 8, 6, 0, 0, 0)) +
                          chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) +
                          chunk(b"IEND", b""))
    return "../../" + destination


def archive_composite_bmp(files, source, destination, width, height, pieces):
    data = source.read_bytes()
    pixel_offset = struct.unpack_from("<I", data, 10)[0]
    source_width, source_height = struct.unpack_from("<ii", data, 18)
    row_stride = (source_width * 3 + 3) & ~3
    pixels = [[(255, 0, 255, 0) for _ in range(width)] for _ in range(height)]
    for sx, sy, piece_width, piece_height, dx, dy in pieces:
        for py in range(piece_height):
            source_y = abs(source_height) - 1 - (sy + py) if source_height > 0 else sy + py
            for px in range(piece_width):
                start = pixel_offset + source_y * row_stride + (sx + px) * 3
                blue, green, red = data[start:start + 3]
                pixels[dy + py][dx + px] = (red, green, blue, 0 if (red, green, blue) == (255, 0, 255) else 255)
    raw = b"".join(bytes([0]) + bytes(channel for pixel in row for channel in pixel) for row in pixels)
    def chunk(kind, payload):
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", binascii.crc32(kind + payload) & 0xffffffff)
    files[destination] = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    return "../../" + destination


def convert(legacy_root, output):
    legacy_root = legacy_root.resolve()
    phase = read_phase(legacy_root)
    world_source = legacy_path(legacy_root, phase["world_description"])
    world, scrolls, triples = parse_world(world_source)
    checkpoint_source = legacy_path(legacy_root, phase["checkpoint_description"])
    initial_face = "right" if int(phase["warrior_dir"]) == 1 else "left"
    checkpoints = parse_checkpoints(checkpoint_source, initial_face)
    enemy_source = legacy_path(legacy_root, phase["enemies_description"])
    enemy_records = parse_enemy_records(enemy_source)
    animations = parse_animations(legacy_root / "data/characters/warrior.txt")
    declared_states = set(re.findall(
        r"^#define\s+(WARRIOR_[A-Z_]+)",
        (legacy_root / "data/characters/warrior_def_states.txt").read_text(), re.MULTILINE))
    unknown_states = sorted(declared_states - set(STATE_IDS))
    if unknown_states:
        raise ValueError("State IDs lack an explicit mapping: " + ", ".join(unknown_states))
    referenced_states = {state for animation in animations for state in animation["states"]}
    definition, forms, missing_states = definition_and_forms(animations)
    files = {}
    assets = {}
    assets["tileset"] = archive_asset(files, world_source.with_name(world["file"]), "assets/maps/tileset.bmp")
    assets["player"] = archive_asset(files, legacy_root / "data/characters/warrior.bmp", "assets/characters/player.bmp")
    sword_bitmap = archive_composite_bmp(files, legacy_root / "data/characters/warrior.bmp",
                                         "assets/characters/player-striking.png", 48, 40,
                                         [(87, 76, 16, 40, 16, 0), (104, 76, 16, 40, 32, 0)])
    striking = next(state for state in definition["states"] if state["name"] == "golpear")
    striking["animation"]["bitmap"] = sword_bitmap
    striking["animation"]["sprites"] = [{"x": 0, "y": 0, "width": 48, "height": 40}]
    assets["music"] = archive_asset(files, legacy_path(legacy_root, phase["song"]), "assets/music/phase.wav")
    effect_references = []
    for index, name in enumerate(EFFECT_FILES):
        effect_references.append(archive_asset(
            files, legacy_root / "data/fx" / name, f"assets/fx/effect-{index}.wav"))
    parallax = []
    for index, scroll in enumerate(scrolls):
        destination = f"assets/maps/parallax-{index}.png"
        image = archive_masked_bmp(files, world_source.with_name(scroll["source"]), destination)
        divisor_x, divisor_y = scroll.get("vel_x", 1), scroll.get("vel_y", 1)
        parallax.append({"id": f"layer-{index}", "image": image, "plane": scroll["plane"],
                         "factorX": 1 / divisor_x if scroll["plane"] == "back" else divisor_x,
                         "factorY": 0 if scroll["plane"] == "back" else divisor_y,
                         "repeatX": True, "repeatY": scroll["plane"] == "front"})
    object_specs = [
        (0, 411, 1244, False, "explosion"), (1, 781, 290, True, "bombilla"),
        (2, 415, 1413, False, "bombilla"), (3, 327, 1300, False, "rayo"),
    ]
    object_definitions = {}
    for _, _, _, _, name in object_specs:
        key = f"objects/{name}"
        if key in object_definitions:
            continue
        bitmap = archive_asset(files, legacy_root / "data/objects" / f"{name}.bmp", f"assets/objects/{name}.bmp")
        object_definitions[key] = object_definition(legacy_root / "data/objects" / f"{name}.txt", bitmap)
    converted_enemies = []
    enemy_definitions = {}
    for legacy_id in range(1, 17):
        record = next(item for item in enemy_records if item["id"] == legacy_id)
        name = Path(record["definition"]).stem
        key = f"enemies/{name}"
        if key not in enemy_definitions:
            bitmap = archive_asset(files, enemy_source.with_name(f"{name}.bmp"), f"assets/enemies/{name}.bmp")
            enemy_definitions[key], frame = enemy_definition(enemy_source.with_name(record["definition"]), bitmap, 2 if record["type"] == 7 else 1)
            enemy_definitions[key]["frameSize"] = frame
        frame = enemy_definitions[key]["frameSize"]
        direction = "left" if record["direction"] == 1 else "right"
        visible_speed = record["speed"] * 4
        behavior = ({"type": "verticalPatrol", "distance": abs(record["distanceY"]) + visible_speed,
                     "initialDirection": "up" if record["verticalDirection"] == 1 else "down",
                     "loop": False, "onLimit": "die", "respawnDelayTicks": 251} if record["type"] == 7 else
                    {"type": "xyPatrol", "distanceX": abs(record["distanceX"]),
                     "distanceY": abs(record["distanceY"]), "stepsPerTick": visible_speed,
                     "initialDirectionX": direction,
                     "initialDirectionY": "up" if record["state"] == 2 else "down",
                     "respawnDelayTicks": 251} if record["type"] == 6 else
                    {"type": "idle"} if record["type"] in (4, 5) else
                    {"type": "patrol", "distance": abs(record["distanceX"]),
                     "turnAtEdges": True, "turnAtWalls": True}
                    if record["type"] in (1, 3) else
                    {"type": "flyPatrol", "axis": "horizontal", "distance": abs(record["distanceX"]),
                     "phaseTicks": max(1, math.ceil(abs(record["distanceX"]) / visible_speed)),
                     "initialDirection": direction})
        behavior["deathMotion"] = "stationary"
        converted_enemies.append({"id": record["id"], "x": record["x"], "y": record["y"],
            "bb_x": 0, "bb_y": 0, "bb_width": frame["width"] * LEGACY_VISUAL_SCALE,
            "bb_height": frame["height"] * LEGACY_VISUAL_SCALE - (1 if record["type"] == 1 else 0), "direction": direction,
            "speed_x": 0 if record["type"] == 7 else visible_speed,
            "speed_y": visible_speed if record["type"] in (6, 7) else 0 if record["type"] in (2, 4, 5) else 3,
            "definition": key, "visualScale": LEGACY_VISUAL_SCALE,
            "combatProfile": f"enemy-{legacy_id}", "behavior": behavior})
    for enemy_definition_data in enemy_definitions.values():
        del enemy_definition_data["frameSize"]
    scene_entries = parse_machinimia(legacy_root / "data/machinimia/phase1.txt")
    object_ids = {name: object_id for object_id, _, _, visible, name in object_specs if not visible}
    scene_steps = [{"type": "action", "action": {"type": "setPlayerMode", "visible": True, "controllable": False}}]
    parallel_steps = []
    player_concealed = False
    for entry in scene_entries:
        name = entry["object"]
        definition_key = f"objects/{name.removesuffix('2')}"
        branch = {"type": "serial", "steps": [
            {"type": "action", "action": {"type": "setEntityVisible", "entityType": "backgroundObject",
             "id": object_ids[name.removesuffix("2")], "visible": True, "restartAnimation": True}},
            {"type": "wait", "ticks": animation_cycle_ticks(object_definitions[definition_key], entry["repetitions"])},
            {"type": "action", "action": {"type": "setEntityVisible", "entityType": "backgroundObject",
             "id": object_ids[name.removesuffix("2")], "visible": False}},
        ]}
        if entry["composition"] == "par":
            parallel_steps.append(branch)
        else:
            if parallel_steps:
                scene_steps.append({"type": "parallel", "steps": parallel_steps})
                parallel_steps = []
            if not player_concealed:
                scene_steps.append({"type": "action", "action": {"type": "setPlayerMode", "visible": False, "controllable": False}})
                player_concealed = True
            scene_steps.append(branch)
    if parallel_steps:
        scene_steps.append({"type": "parallel", "steps": parallel_steps})
    scene_steps.extend([
        {"type": "action", "action": {"type": "setFlag", "flag": "alternate-form", "value": True}},
        {"type": "action", "action": {"type": "emitEvent", "event": "scene-finished"}},
        {"type": "action", "action": {"type": "setPlayerMode", "visible": True, "controllable": True}},
    ])
    empty_entities = {key: [] for key in ["platforms", "items", "backgroundObjects", "blocks", "hazards", "lasers", "triggers", "enemies"]}
    for object_id, x, y, visible, name in object_specs:
        definition_key = f"objects/{name}"
        sprite = object_definitions[definition_key]["states"][0]["animation"]["sprites"][0]
        attributes = {"ini_x": x, "ini_y": y,
                      "width": sprite["width"] * LEGACY_VISUAL_SCALE,
                      "height": sprite["height"] * LEGACY_VISUAL_SCALE,
                      "definition": definition_key, "visualScale": LEGACY_VISUAL_SCALE}
        if object_id == 1:
            empty_entities["items"].append({"id": object_id,
                "attributes": {**attributes, "physics": "fixed"},
                "onCollect": [{"type": "setFlag", "flag": "item-collected", "value": True},
                              {"type": "showMessage", "message": "item-message"}]})
        else:
            empty_entities["backgroundObjects"].append({"id": object_id, "attributes": {**attributes, "skip_num_anims": 0, "visible": int(visible)}})
    empty_entities["triggers"] = [
        {"id": 1, "attributes": {"x": 408, "y": 1344, "width": 100, "height": 100, "recursive": 0, "onehot": 1, "action": "enters", "face": "any"},
         "gameplay": {"conditions": [{"type": "flag", "flag": "item-collected", "comparison": "equal", "value": True}], "sequence": "light-scene"}},
        {"id": 2, "attributes": {"x": 3744, "y": 1350, "width": 188, "height": 182, "recursive": 0, "onehot": 1, "action": "enters", "face": "any"},
         "gameplay": {"conditions": [{"type": "flag", "flag": "alternate-form", "comparison": "equal", "value": False}],
                      "actions": [{"type": "emitEvent", "event": "killed"}]}},
    ]
    force_x, force_y, force_width, force_height = parse_forced_state_zone(legacy_root / phase["scripts"].removeprefix("./"))
    empty_entities["triggers"].append({"id": 3, "attributes": {"x": force_x, "y": force_y, "width": force_width,
        "height": force_height, "recursive": 0, "onehot": 0, "action": "stays", "face": "any",
        "activation": "continuousPoint"},
        "gameplay": {"actions": [{"type": "forcePlayerState", "state": "falling", "previousState": "walking"}]}})
    keep_zones = parse_keep_moving_zones(legacy_root / phase["scripts"].removeprefix("./"))
    for index, (zone_x, zone_y, zone_width, zone_height) in enumerate(keep_zones, 4):
        empty_entities["triggers"].append({"id": index, "attributes": {"x": zone_x, "y": zone_y,
            "width": zone_width, "height": zone_height, "recursive": 0, "onehot": 0,
            "action": "stays", "face": "any", "activation": "continuousPoint"},
            "gameplay": {"actions": [{"type": "keepPlayerMoving"}]}})
    empty_entities["cameraViews"] = parse_zones(legacy_root / "data/levels/scroll_zones_phase1.txt")
    empty_entities["enemies"] = converted_enemies
    if (checkpoints[0]["pl_x"], checkpoints[0]["pl_y"]) != (int(phase["x_ini"]), int(phase["y_ini"])):
        raise ValueError("Initial checkpoint spawn disagrees with the phase description")
    empty_entities["checkpoints"] = checkpoints
    tiles = [0 if front else gid for gid, _, front in triples]
    level = {
        "formatVersion": 1, "kind": "rick2.level", "id": "phase-1",
        "units": {"simulationTicksPerSecond": 50, "duration": "ticks", "distance": "pixels", "speed": "pixelsPerTick"},
        "display": {"width": 1024, "height": 768}, "session": {"initialLives": 3},
        "camera": {"x": 0, "y": 0, "width": 1024, "height": 768},
        "map": {"width": 128, "height": 48, "tileWidth": 32, "tileHeight": 32,
                "tileset": {"image": assets["tileset"], "tileCount": 453, "columns": 22,
                            "imageWidth": int(world["screen_tiles_x"]), "imageHeight": int(world["screen_tiles_y"])},
                "layers": {"tiles": tiles, "frontTiles": [gid if front else 0 for gid, _, front in triples],
                           "collisions": [collision_gid(collision, 453) for _, collision, _ in triples]}},
        "entities": empty_entities, "player": {"definition": "characters/player", "combatProfile": "player-primary"},
        "projectiles": {"shoot": {"definition": "characters/player", "width": 1, "height": 1, "yOffset": 0},
                        "bomb": {"definition": "characters/player", "width": 1, "height": 1, "yOffset": 0}},
        "definitions": {"characters/player": definition, **object_definitions, **enemy_definitions},
        "audio": {"initialMusic": 0, "playback": {"initialLoop": True, "followUpMusic": None, "followUpLoop": True},
                  "music": [assets["music"]], "effects": effect_references},
        "runtimeProfile": {"characterForms": {"initialForm": "primary", "forms": forms},
                           "capabilities": {"shoot": False, "bomb": False, "hit": True},
                           "actionBindings": {"neutral": "hitting", "up": None, "down": None, "horizontal": None},
                           "session": {"deathAudioSlot": 3},
                           "bindings": {"audio": {"explosion": 6, "bonusPickup": 4,
                                                   "itemPickup": 4, "shot": 1, "bomb": 2}}},
        "combat": {"damageTypes": [{"id": "contact"}], "profiles": [
            {"id": "player-primary", "faction": "player", "maxHealth": 1,
             "hurtboxes": [{"id": "body", "x": LEGACY_PLAYER_CONTACT_OFFSET,
                            "y": LEGACY_PLAYER_CONTACT_OFFSET,
                            "width": 16 * LEGACY_VISUAL_SCALE - LEGACY_PLAYER_CONTACT_WIDTH_TRIM,
                            "height": 40 * LEGACY_VISUAL_SCALE - LEGACY_PLAYER_CONTACT_HEIGHT_TRIM}],
             "attacks": [{"id": "melee", "states": ["golpear"], "frames": [0], "x": 64, "y": 24,
                          "width": 64, "height": 28, "damageType": "contact", "damage": 1}],
             "guards": [{"id": "guard", "states": ["guarding"], "x": 12, "y": 2, "width": 8, "height": 36,
                         "damageTypes": ["contact"], "facingOnly": True}]},
            {"id": "player-alternate", "faction": "player", "maxHealth": 1,
             "hurtboxes": [{"id": "body", "x": LEGACY_PLAYER_CONTACT_OFFSET,
                            "y": LEGACY_PLAYER_CONTACT_OFFSET,
                            "width": 32 * LEGACY_VISUAL_SCALE - LEGACY_PLAYER_CONTACT_WIDTH_TRIM,
                            "height": 32 * LEGACY_VISUAL_SCALE - LEGACY_PLAYER_CONTACT_HEIGHT_TRIM}]},
            *[{"id": f"enemy-{enemy['id']}", "faction": "enemies", "maxHealth": 1,
               "hurtboxes": [{"id": "body", "x": 0, "y": 0, "width": enemy["bb_width"], "height": enemy["bb_height"]}],
               "attacks": [{"id": "contact", "states": ["CHAR_STATE_RUNNING", "CHAR_STATE_STOP"], "x": 0, "y": 0,
                            "width": enemy["bb_width"], "height": enemy["bb_height"],
                            "damageType": "contact", "damage": 1, "hitOnce": False}],
               **({"guards": [{"id": "sword-immunity", "states": ["CHAR_STATE_RUNNING", "CHAR_STATE_STOP"],
                               "x": 0, "y": 0, "width": enemy["bb_width"], "height": enemy["bb_height"],
                               "damageTypes": ["contact"], "facingOnly": False}]}
                  if enemy["id"] == 11 else {})}
              for enemy in converted_enemies],
        ]},
        "gameplay": {"flags": [{"id": "item-collected", "type": "boolean", "initial": False},
                                  {"id": "alternate-form", "type": "boolean", "initial": False}],
                     "events": [{"id": "scene-started"}, {"id": "scene-finished"}],
                     "sequences": [{"id": "light-scene", "steps": scene_steps}]},
        "presentation": {"parallaxLayers": parallax,
                         "messages": [{"id": "item-message", "text": "An unusual light source was collected.", "durationTicks": 50}],
                         "effects": [{"id": "transformation", "kind": "flash", "color": "#FFFFFF", "durationTicks": 10}]},
        "objective": {"type": "reachZone", "x": 3744, "y": 1400, "width": 188, "height": 132, "onComplete": "freeze"},
    }
    input_paths = ["data/levels/phase1.txt", "data/maps/world1_transparencia.txt",
                   "data/characters/warrior_def_states.txt", "data/characters/warrior.txt",
                   "data/scripts/phase1.txt", "data/machinimia/phase1.txt",
                   "data/levels/scroll_zones_phase1.txt", phase["enemies_description"].removeprefix("./"),
                   phase["checkpoint_description"].removeprefix("./"), phase["objects"].removeprefix("./"),
                   phase["song"].removeprefix("./"), "data/characters/warrior.bmp",
                   "data/maps/" + world["file"]]
    input_paths.extend("data/maps/" + scroll["source"] for scroll in scrolls)
    input_paths.extend("data/fx/" + name for name in EFFECT_FILES)
    input_paths.extend(f"data/objects/{name}.{extension}" for name in ["bombilla", "rayo", "explosion"] for extension in ["txt", "bmp"])
    input_paths.extend(f"data/characters/{name}.{extension}" for name in ["bolita", "mosca", "hipopotamo", "planta", "bombolles", "bombolla", "buho"] for extension in ["txt", "bmp"])
    inventory = [{"path": name, "sha256": hashlib.sha256((legacy_root / name).read_bytes()).hexdigest()} for name in input_paths]
    losses = [
        {"code": "STATE_TRANSITIONS_DEFERRED", "source": "./data/characters/warrior_def_states.txt", "detail": "State IDs and animations are preserved; the legacy transition grammar is not ported."},
    ]
    undeclared_states = sorted(referenced_states - declared_states)
    if undeclared_states:
        losses.append({"code": "LEGACY_UNDECLARED_STATES", "source": "./data/characters/warrior.txt",
                       "detail": "Animation associations reference states absent from the legacy definition file: " + ", ".join(undeclared_states)})
    if missing_states:
        losses.append({"code": "UNMAPPED_STATES", "source": "./data/characters/warrior.txt", "detail": ", ".join(missing_states)})
    losses.sort(key=lambda item: item["code"])
    report = {"formatVersion": 1, "inputs": inventory, "losses": losses}
    manifest = {"formatVersion": 1, "kind": "rick2.project", "id": "camelot-phase-1",
                "name": "Camelot Warriors - Phase 1", "initialLevel": LEVEL_PATH, "levels": [LEVEL_PATH]}
    files["project.json"] = json_bytes(manifest)
    files["game.json"] = json_bytes({"formatVersion": 1, "kind": "rick2.game", "initialLevel": LEVEL_PATH})
    files[LEVEL_PATH] = json_bytes(level)
    files["loss-report.json"] = json_bytes(report)
    validate(manifest, level, files)
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w") as archive:
        for name, data in sorted(files.items()):
            info = ZipInfo(name, FIXED_DATE); info.compress_type = ZIP_DEFLATED; info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return report


def validate(manifest, level, files):
    project_schema = json.loads((ROOT / "schema/project.schema.json").read_text())
    level_schema = json.loads((ROOT / "schema/level.schema.json").read_text())
    jsonschema.Draft202012Validator(project_schema).validate(manifest)
    jsonschema.Draft202012Validator(level_schema).validate(level)
    if len(level["audio"]["effects"]) != 7:
        raise ValueError("Native runtime requires exactly seven audio effect slots")
    cell_count = level["map"]["width"] * level["map"]["height"]
    if any(len(layer) != cell_count for layer in level["map"]["layers"].values()):
        raise ValueError("Converted tile layers do not match the map dimensions")
    references = [level["map"]["tileset"]["image"], *level["audio"]["music"], *level["audio"]["effects"]]
    references.extend(layer["image"] for layer in level["presentation"]["parallaxLayers"])
    references.extend(state["animation"]["bitmap"] for definition in level["definitions"].values()
                      for state in definition["states"])
    level_dir = PurePosixPath(LEVEL_PATH).parent
    for reference in references:
        resolved = level_dir.joinpath(reference)
        parts = []
        for part in resolved.parts:
            if part == "..":
                if not parts:
                    raise ValueError(f"Asset reference escapes project: {reference}")
                parts.pop()
            elif part != ".":
                parts.append(part)
        if "/".join(parts) not in files:
            raise ValueError(f"Asset is not packaged: {reference}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--legacy-root", type=Path, default=DEFAULT_LEGACY_ROOT)
    parser.add_argument("--output", type=Path, default=ROOT / "build/camelot-phase-1.rick2-project")
    args = parser.parse_args()
    report = convert(args.legacy_root, args.output)
    print(f"Created {args.output} with {len(report['losses'])} reported losses")


if __name__ == "__main__":
    main()
