#!/usr/bin/env python3
"""Build the single-request published leaderboard asset from data/_list.json."""

from __future__ import annotations

import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
SAFE_NAME = re.compile(r"^[a-zA-Z0-9_-]{1,80}$")


def main() -> None:
    list_path = DATA_DIR / "_list.json"
    files = json.loads(list_path.read_text(encoding="utf-8"))
    if not isinstance(files, list):
        raise SystemExit("data/_list.json must contain a JSON array.")

    levels = {}
    for name in files:
        if not isinstance(name, str) or not SAFE_NAME.fullmatch(name):
            raise SystemExit(f"Invalid level filename in data/_list.json: {name!r}")
        level_path = DATA_DIR / f"{name}.json"
        if not level_path.is_file():
            raise SystemExit(f"Missing published level file: {level_path}")
        levels[name] = json.loads(level_path.read_text(encoding="utf-8"))

    bundle = {"files": files, "levels": levels}
    output = DATA_DIR / "_bundle.json"
    output.write_text(
        json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"Built {output} with {len(files)} levels ({output.stat().st_size} bytes).")


if __name__ == "__main__":
    main()
