#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="${TMPDIR:-/tmp}/rick2-check"
mkdir -p "$build_dir"
cd "$project_root"
python3 tools/check_level_conversion.py
python3 tests/tmx_importer_test.py
python3 tests/editor_contract_test.py
python3 tests/level_schema_test.py
python3 tests/format_compatibility_test.py
python3 tests/package_editor_project_test.py
python3 tests/editor_level1_roundtrip_test.py
g++ -std=c++11 tests/game_time_test.cpp -o "$build_dir/game-time"
"$build_dir/game-time"
g++ -std=c++11 tests/container_utils_test.cpp -o "$build_dir/container-utils"
"$build_dir/container-utils"
g++ -std=c++11 tests/tile_bounds_test.cpp -o "$build_dir/tile-bounds"
"$build_dir/tile-bounds"
g++ -std=c++11 tests/tile_gid_test.cpp -o "$build_dir/tile-gid"
"$build_dir/tile-gid"
g++ -std=c++11 tests/runtime_options_test.cpp -o "$build_dir/runtime-options"
"$build_dir/runtime-options"
g++ -std=c++11 tests/json_level_loader_test.cpp src/json_level_loader.cpp -o "$build_dir/json-loader"
"$build_dir/json-loader"
cd editor
npm ci
npm run check
cd "$project_root"
python3 tests/package_editor_release_test.py
python3 tools/package_editor_project.py
python3 tools/package_editor_release.py
