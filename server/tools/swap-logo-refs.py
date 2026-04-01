"""Point HTML img/srcset from coutura PNG to ngoc-clothes-logo PNGs (files containing OLD only)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OLD = "coutura.-2-e1712566927312.png"
NEW_1X = "ngoc-clothes-logo.png"
NEW_2X = "ngoc-clothes-logo-2x.png"

_SRCSET_PAIRS = [
    (
        f"/wp-content/uploads/2024/04/{OLD} 1x, /wp-content/uploads/2024/04/{OLD} 2x",
        f"/wp-content/uploads/2024/04/{NEW_1X} 1x, /wp-content/uploads/2024/04/{NEW_2X} 2x",
    ),
    (
        f"wp-content/uploads/2024/04/{OLD} 1x, wp-content/uploads/2024/04/{OLD} 2x",
        f"wp-content/uploads/2024/04/{NEW_1X} 1x, wp-content/uploads/2024/04/{NEW_2X} 2x",
    ),
]


def patch(text: str) -> str:
    for a, b in _SRCSET_PAIRS:
        text = text.replace(a, b)
    text = text.replace(OLD, NEW_1X)
    return text


def list_candidates() -> list[Path]:
    # Windows: only HTML paths that still reference the old asset
    r = subprocess.run(
        f'cd /d "{ROOT}" && findstr /s /m "{OLD}" *.html',
        shell=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    paths: list[Path] = []
    for line in r.stdout.splitlines():
        line = line.strip().strip("\r")
        if not line:
            continue
        paths.append(ROOT / line)
    return paths


def main() -> int:
    candidates = list_candidates()
    n = 0
    for path in candidates:
        if not path.is_file():
            continue
        raw = path.read_text(encoding="utf-8")
        out = patch(raw)
        if out != raw:
            path.write_text(out, encoding="utf-8")
            n += 1
    print(f"Patched {n} of {len(candidates)} candidate HTML files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
