# -*- coding: utf-8 -*-
"""Quét thoitrang, tải file wp-content/wp-includes còn thiếu từ coutura.monamedia.net."""
from __future__ import annotations

import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://coutura.monamedia.net"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36"

# Chỉ file có đuôi rõ ràng (tránh srcset / URL hỏng)
EXT = r"(?:jpg|jpeg|png|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|eot|mp4|webm|json|map|xml)"
# wp-content/plugins|themes|uploads hoặc wp-includes
SEG = r"[a-zA-Z0-9_./\-]+"
FILE_RE = re.compile(
    rf"(?P<u>(?:/)?(?:wp-content/(?:plugins|themes|uploads)/{SEG}\.{EXT}|wp-includes/{SEG}\.{EXT}))(?=\s|[\"'<>)\],]|$)",
    re.IGNORECASE,
)


def clean_url(raw: str) -> str | None:
    s = raw.replace("\\/", "/").strip().strip('"').strip("'")
    if not s or "://" in s or s.startswith("//") or s.startswith("data:"):
        return None
    s = s.split("?", 1)[0].split("#", 1)[0].strip()
    s = s.lstrip("/")
    if ".." in s or " " in s or "\n" in s or "," in s:
        return None
    if not (s.startswith("wp-content/") or s.startswith("wp-includes/")):
        return None
    if not re.search(rf"\.{EXT}$", s, re.I):
        return None
    return s


def collect_paths() -> set[str]:
    found: set[str] = set()
    exts = {".html", ".htm", ".css", ".js", ".json"}
    for f in ROOT.rglob("*"):
        if not f.is_file() or f.suffix.lower() not in exts:
            continue
        if "node_modules" in f.parts or ".git" in f.parts:
            continue
        try:
            text = f.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        t = text.replace("\\/", "/")
        for m in FILE_RE.finditer(t):
            u = clean_url(m.group("u"))
            if u:
                found.add(u)
    return found


def download(rel: str) -> bool:
    local = ROOT / rel
    if local.exists() and local.stat().st_size > 0:
        return True
    url = f"{BASE}/{rel}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            if resp.status != 200:
                return False
            data = resp.read()
    except urllib.error.HTTPError:
        return False
    except Exception:
        return False
    if not data:
        return False
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_bytes(data)
    return True


def main() -> int:
    paths = sorted(collect_paths())
    print(f"Unique asset paths (strict): {len(paths)}")
    ok, skip, fail = 0, 0, 0
    t0 = time.time()
    for i, rel in enumerate(paths):
        loc = ROOT / rel
        if loc.exists() and loc.stat().st_size > 0:
            skip += 1
            continue
        if download(rel):
            ok += 1
            if ok <= 40 or ok % 200 == 0:
                print(f"  + {rel}")
        else:
            fail += 1
            if fail <= 25:
                print(f"  x {rel}", file=sys.stderr)
        if (i + 1) % 400 == 0:
            print(f"  ... {i+1}/{len(paths)} (new={ok} skip={skip} fail={fail})")
        time.sleep(0.012)
    dt = time.time() - t0
    print(f"Done in {dt:.1f}s | downloaded={ok} already_had={skip} failed={fail}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
