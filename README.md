# Rick Dangerous 2 Remake

Rick Dangerous 2 remake game

## Build and run on Linux

The game currently uses Allegro 5 and `pkg-config`. On Debian/Ubuntu, install a
C++ compiler, Make, pkg-config and the Allegro development packages required by
the modules listed in `bin/Makefile`.

Build from a clean state:

```sh
cd bin
make clean
make -j2
```

Run the executable from `bin/`. The default level is selected by `game.json`;
assets referenced by a level are resolved relative to that level package:

```sh
./rick2
```

To load another level package without recompiling:

```sh
./rick2 ../levels/another-level/level.json
```

Controls implemented by the current prototype include the arrow keys, Space,
`A`, `K`, `M`, `Z` and Escape.

## Diagnostic build

To check the initial load with AddressSanitizer and UndefinedBehaviorSanitizer:

```sh
g++ -std=c++11 -O1 -g -fno-omit-frame-pointer \
  -fsanitize=address,undefined -Wall -Wextra -Werror=return-type \
  src/*.cpp -o /tmp/rick2-sanitized \
  $(pkg-config --cflags --libs allegro-5 allegro_primitives-5 \
    allegro_image-5 allegro_font-5 allegro_ttf-5 allegro_audio-5 \
    allegro_acodec-5)

cd bin
/tmp/rick2-sanitized
```

The current Makefile does not track header dependencies. Until the build system
is modernized, use `make clean` after changing a header to avoid linking stale
object files.

To load and release all game resources without entering the graphical loop,
run the sanitized binary from `bin/` with:

```sh
RICK2_RESOURCE_CHECK=1 \
LSAN_OPTIONS=suppressions=../tests/lsan-wsl.supp \
/tmp/rick2-sanitized
```

The suppression file only covers process-wide Mesa/GLX caches reported by WSLg;
leaks originating in the game remain visible.

The fixed-timestep clock has a standalone timing check:

```sh
g++ -std=c++11 -pthread tests/timer_test.cpp src/timer.cpp \
  -o /tmp/rick2-timer-test
/tmp/rick2-timer-test
```

The gameplay unit conversions and named durations have a fast regression test:

```sh
g++ -std=c++11 tests/game_time_test.cpp -o /tmp/rick2-game-time-test
/tmp/rick2-game-time-test
```

The container-removal regression test verifies consecutive and final-element
erasure:

```sh
g++ -std=c++11 tests/container_utils_test.cpp \
  -o /tmp/rick2-container-utils-test
/tmp/rick2-container-utils-test
```

Tile-boundary checks, including negative coordinates and both upper limits, have
a standalone regression test:

```sh
g++ -std=c++11 tests/tile_bounds_test.cpp \
  -o /tmp/rick2-tile-bounds-test
/tmp/rick2-tile-bounds-test
```

Level 1 is loaded from the canonical, versioned JSON package. Regenerate and
compare it with its JSON sources and imported TMX map using:

```sh
python3 tools/convert_level.py
python3 tools/check_level_conversion.py
python3 tests/tmx_importer_test.py
```

Validate the C++ JSON loader independently of Allegro:

```sh
g++ -std=c++11 tests/json_level_loader_test.cpp \
  src/json_level_loader.cpp \
  -o /tmp/rick2-json-loader-test
/tmp/rick2-json-loader-test
```

The graphics resource cache has a standalone reuse check:

```sh
g++ -std=c++11 tests/resource_cache_test.cpp src/resource_cache.cpp \
  -o /tmp/rick2-resource-cache-test \
  $(pkg-config --cflags --libs allegro-5 allegro_image-5 \
    allegro_audio-5 allegro_acodec-5)
/tmp/rick2-resource-cache-test
```

Debug overlays are disabled during normal play. Start the game with `--debug`
to draw collision boxes, checkpoints, triggers, camera views and entity IDs.
While this mode is active, holding the left mouse button prints its correctly
scaled world coordinates:

```sh
cd bin
./rick2 --debug
./rick2 --debug ../levels/level1/level.json
```

The command-line mode has a standalone parsing check:

```sh
g++ -std=c++11 tests/runtime_options_test.cpp \
  -o /tmp/rick2-runtime-options-test
/tmp/rick2-runtime-options-test
```

The format and versioning policy are documented in `docs/LEVEL_FORMAT.md`; its
machine-readable contract is `schema/level.schema.json`. Building requires the
header-only `nlohmann/json` library (`nlohmann-json3-dev` on Debian/Ubuntu).

Rick2 Engine's offline architecture, portable project format and editable data
catalog are documented in `docs/ENGINE_ARCHITECTURE.md` and
`docs/EDITOR_DATA_CATALOG.md`. Check their level-1 baseline with:

```sh
python3 tests/editor_contract_test.py
python3 tests/level_schema_test.py
python3 tests/format_compatibility_test.py
```

Build and test the offline web application shell with Node.js 22 or newer:

```sh
cd editor
npm ci
npm run check
```

Then open `editor/dist/index.html` directly; it does not need a web server.

Build the current level and all referenced assets as a deterministic portable
editor project with:

```sh
python3 tools/package_editor_project.py
```

The ignored output is `build/rick2-level1.rick2-project`.
