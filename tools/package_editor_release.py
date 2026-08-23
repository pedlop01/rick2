#!/usr/bin/env python3
"""Create a deterministic ZIP containing the static offline editor release."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).parents[1]
DIST = ROOT / "editor" / "dist"
OUTPUT = ROOT / "build" / "rick2-engine-web.zip"

def package_release(output=OUTPUT):
    if not (DIST / "index.html").exists():
        raise SystemExit("editor/dist is missing; run npm run build first")
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for source in sorted(path for path in DIST.rglob("*") if path.is_file()):
            info = ZipInfo(source.relative_to(DIST).as_posix(), (2020, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED; info.external_attr = 0o644 << 16
            archive.writestr(info, source.read_bytes())
    return output

if __name__ == "__main__": print(f"Created {package_release()}")
