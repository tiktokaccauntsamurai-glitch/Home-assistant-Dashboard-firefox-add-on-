"""
build.py — package the extension for addons.mozilla.org.

  python build.py

Creates release/custom-new-tab-dashboard-<version>.zip. The version comes from
manifest.json. Only the files listed below go into the package.
"""

import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RELEASE = ROOT / "release"

EXTENSION_FILES = [
    "manifest.json",
    "background.js",
    "crypto.js",
    "ha-format.js",
    "newtab.html",
    "newtab.js",
    "options.html",
    "options.js",
    "icons/icon-48.svg",
    "icons/icon-96.svg",
]


def main():
    missing = [f for f in EXTENSION_FILES if not (ROOT / f).is_file()]
    if missing:
        raise SystemExit("missing files: " + ", ".join(missing))

    version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))["version"]
    RELEASE.mkdir(exist_ok=True)
    zip_path = RELEASE / f"custom-new-tab-dashboard-{version}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for f in EXTENSION_FILES:
            z.write(ROOT / f, f)  # manifest.json must sit at the root of the archive
    print(f"version {version}")
    print(f"package: {zip_path.relative_to(ROOT)} ({zip_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
