#!/usr/bin/env python3
"""Replace Coutura / Mona contact / footer with Ngoc's clothes branding across static HTML."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAND = "Ngoc's clothes"
FOOTER_HTML = f'<div class="mona-footer-media">© Thiết kế và lập trình bởi {BRAND} 2026</div>'

OLD_CONTACT = (
    "<strong>Địa chỉ:</strong> 1073/23 Cách Mạng Tháng 8, P.7, Q.Tân Bình, TP.HCM</div></li>"
    '<li class="media"><div class="contact-text"><strong>Số điện thoại:</strong> <a href="tel:0313728397">(+84) 0313-728-397</a></div>'
    '<div class="contact-text"><strong>Email:</strong> <a href="mailto:info@themona.global" title="Email">info@themona.global</a></div></ul>'
)
NEW_CONTACT = (
    "<strong>Địa chỉ:</strong> 313 Lĩnh Nam, Hoàng Mai, Hà Nội</div></li>"
    '<li class="media"><div class="contact-text"><strong>Số điện thoại:</strong> <a href="tel:0392540143">0392 540 143</a></div>'
    '<div class="contact-text"><strong>Email:</strong> <a href="mailto:laithihongngoc9@gmail.com" title="Email">laithihongngoc9@gmail.com</a></div></ul>'
)

FOOTER_RE = re.compile(
    r'<div class="mona-footer-media">© Thiết kế và lập trình bởi <img\s+src="[^"]*logo-mona-thu-gon\.png"\s+alt="MonaMedia"\s*/></div>'
)


def process_file(path: Path) -> bool:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="utf-8", errors="replace")
    orig = text
    text = FOOTER_RE.sub(FOOTER_HTML, text)
    text = text.replace(OLD_CONTACT, NEW_CONTACT)
    text = text.replace("Coutura", BRAND)
    if text == orig:
        return False
    path.write_text(text, encoding="utf-8")
    return True


def main() -> int:
    updated = 0
    for pattern in ("*.html", "*.htm"):
        for p in ROOT.rglob(pattern):
            if process_file(p):
                updated += 1
    print(f"Updated {updated} files under {ROOT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
