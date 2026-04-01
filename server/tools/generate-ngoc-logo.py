"""Generate header/footer logo PNGs for Ngoc's clothes (replaces coutura mona artwork)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path(__file__).resolve().parent.parent / "wp-content" / "uploads" / "2024" / "04"
TEXT = "Ngoc's clothes"
DOT = "#e85d75"
FG = "#1a1a1a"
BG = "#ffffff"

# Windows common bold sans
FONT_CANDIDATES = [
    Path(r"C:\Windows\Fonts\arialbd.ttf"),
    Path(r"C:\Windows\Fonts\calibrib.ttf"),
    Path(r"C:\Windows\Fonts\segoeuib.ttf"),
]


def pick_font() -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for p in FONT_CANDIDATES:
        if p.exists():
            return ImageFont.truetype(str(p), size=32)
    return ImageFont.load_default()


def pick_font_2x() -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for p in FONT_CANDIDATES:
        if p.exists():
            return ImageFont.truetype(str(p), size=64)
    return ImageFont.load_default()


def draw_logo(size: tuple[int, int], font: ImageFont.FreeTypeFont | ImageFont.ImageFont) -> Image.Image:
    w, h = size
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), TEXT, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = 2
    y = (h - th) // 2 - bbox[1]
    draw.text((x, y), TEXT, fill=FG, font=font)
    dot_r = max(4, h // 12)
    cx = x + tw + max(10, h // 5)
    cy = h // 2
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=DOT)
    return img


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img1 = draw_logo((453, 58), pick_font())
    img1.save(OUT_DIR / "ngoc-clothes-logo.png", optimize=True)
    img2 = draw_logo((906, 116), pick_font_2x())
    img2.save(OUT_DIR / "ngoc-clothes-logo-2x.png", optimize=True)
    print("Wrote", OUT_DIR / "ngoc-clothes-logo.png")
    print("Wrote", OUT_DIR / "ngoc-clothes-logo-2x.png")


if __name__ == "__main__":
    main()
