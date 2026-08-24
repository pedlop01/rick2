#!/usr/bin/env python3
"""Verify that every state emitted by the C++ runtime has level-1 artwork."""

import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
LEVEL = json.loads((ROOT / "levels/level1/level.json").read_text())

OBJ = {
    "stop": (0, "OBJ_STATE_STOP"),
    "moving": (1, "OBJ_STATE_MOVING"),
    "dying": (2, "OBJ_STATE_DYING"),
}
CHAR = {
    "stop": (0, "CHAR_STATE_STOP"),
    "jumping": (1, "CHAR_STATE_JUMPING"),
    "running": (2, "CHAR_STATE_RUNNING"),
    "climbing": (3, "CHAR_STATE_CLIMBING"),
    "dying": (8, "CHAR_STATE_DYING"),
}
RICK = {
    name: (state_id, f"RICK_STATE_{name.upper()}")
    for name, state_id in {
        "stop": 0, "jumping": 1, "running": 2, "climbing": 3,
        "crouching": 4, "shooting": 5, "bombing": 6,
        "hitting": 7, "dying": 8,
    }.items()
}


def attributes(entity):
    return entity.get("attributes", entity)


class NativeAnimationContractTest(unittest.TestCase):
    def require(self, definition, expected_states):
        states = LEVEL["definitions"][definition]["states"]
        actual = {state["id"]: state for state in states}
        for state_id, state_name in expected_states:
            with self.subTest(definition=definition, state=state_name):
                self.assertIn(state_id, actual)
                self.assertEqual(actual[state_id]["name"], state_name)
                animation = actual[state_id]["animation"]
                self.assertGreaterEqual(animation["frameDurationTicks"], 1)
                self.assertGreaterEqual(len(animation["sprites"]), 1)

    def test_character_states_emitted_by_cpp(self):
        self.require(LEVEL["player"]["definition"], RICK.values())
        emitted = [CHAR[name] for name in
                   ("stop", "jumping", "running", "climbing", "dying")]
        for enemy in LEVEL["entities"]["enemies"]:
            self.require(attributes(enemy)["definition"], emitted)

    def test_object_states_emitted_by_cpp(self):
        for platform in LEVEL["entities"]["platforms"]:
            self.require(attributes(platform)["definition"],
                         (OBJ["stop"], OBJ["moving"]))

        for item in LEVEL["entities"]["items"]:
            self.require(attributes(item)["definition"], OBJ.values())

        for background in LEVEL["entities"]["backgroundObjects"]:
            self.require(attributes(background)["definition"],
                         (OBJ["moving"],))

        for block in LEVEL["entities"]["blocks"]:
            attrs = attributes(block)
            terminal = OBJ["dying"] if attrs["exploits"] else OBJ["moving"]
            self.require(attrs["definition"], (OBJ["stop"], terminal))

        moving_directions = {"left", "right", "up", "down"}
        for hazard in LEVEL["entities"]["hazards"]:
            actions = hazard.get("actions", {}).get("action", [])
            if isinstance(actions, dict):
                actions = [actions]
            emitted = [OBJ["stop"]]
            if any(action["direction"] in moving_directions for action in actions):
                emitted.append(OBJ["moving"])
            self.require(attributes(hazard)["definition"], emitted)

        for laser in LEVEL["entities"]["lasers"]:
            self.require(attributes(laser)["definition"], OBJ.values())

        projectiles = LEVEL["projectiles"]
        self.require(projectiles["shoot"]["definition"], (OBJ["moving"],))
        self.require(projectiles["bomb"]["definition"],
                     (OBJ["moving"], OBJ["dying"]))


if __name__ == "__main__":
    unittest.main()
