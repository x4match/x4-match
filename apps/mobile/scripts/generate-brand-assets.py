#!/usr/bin/env python3
"""Generate x4 match brand icons and Play Store graphics."""

from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"

# Brand
BG = (0, 0, 0)
BG_ELEVATED = (10, 10, 10)
PRIMARY = (245, 197, 24)
PRIMARY_DARK = (212, 160, 23)
WHITE = (250, 250, 250)
MUTED = (163, 163, 163)


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    if not bold:
        candidates = [p.replace("Bold", "") for p in candidates] + candidates

    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_gradient_bg(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    for y in range(h):
        t = y / max(h - 1, 1)
        color = tuple(int(BG[i] * (1 - t) + BG_ELEVATED[i] * t) for i in range(3))
        draw.line([(0, y), (w, y)], fill=color)


def draw_padel_ball(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    radius: float,
) -> None:
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.ellipse(bbox, fill=PRIMARY)

    # Soft highlight
    highlight_r = radius * 0.55
    hx, hy = cx - radius * 0.28, cy - radius * 0.32
    hb = [hx - highlight_r, hy - highlight_r, hx + highlight_r, hy + highlight_r]
    draw.ellipse(hb, fill=(255, 230, 120))

    # Re-draw main ball on top partially - simpler: just seams
    draw.ellipse(bbox, fill=PRIMARY)
    seam = max(4, int(radius * 0.07))
    seam_color = PRIMARY_DARK

    # Curved seams like a padel ball
    draw.arc(
        [cx - radius * 0.72, cy - radius * 0.95, cx + radius * 0.72, cy + radius * 0.95],
        start=300,
        end=120,
        fill=seam_color,
        width=seam,
    )
    draw.arc(
        [cx - radius * 0.55, cy - radius * 1.05, cx + radius * 0.95, cy + radius * 0.55],
        start=120,
        end=300,
        fill=seam_color,
        width=seam,
    )


def create_app_icon(size: int = 1024) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)
    draw_gradient_bg(draw, size, size)

    # Subtle radial glow
    glow_cx, glow_cy = size * 0.5, size * 0.52
    for i in range(int(size * 0.35), 0, -2):
        alpha = int(28 * (i / (size * 0.35)))
        color = (PRIMARY[0], PRIMARY[1], max(0, PRIMARY[2] - alpha))
        draw.ellipse(
            [glow_cx - i, glow_cy - i, glow_cx + i, glow_cy + i],
            fill=color,
        )

    draw_padel_ball(draw, size * 0.5, size * 0.5, size * 0.28)

    # Small "x4" mark bottom-right of ball area
    font = load_font(int(size * 0.11))
    text = "x4"
    tw = draw.textlength(text, font=font)
    tx = size * 0.5 + size * 0.08
    ty = size * 0.5 + size * 0.12
    draw.text((tx, ty), text, font=font, fill=WHITE)

    return img


def create_adaptive_foreground(size: int = 1024) -> Image.Image:
    """Transparent foreground for Android adaptive icon (safe zone)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_padel_ball(draw, size * 0.5, size * 0.48, size * 0.22)

    font = load_font(int(size * 0.09))
    text = "x4"
    tx = size * 0.5 + size * 0.06
    ty = size * 0.48 + size * 0.1
    draw.text((tx, ty), text, font=font, fill=(*WHITE, 255))
    return img


def create_feature_graphic(width: int = 1024, height: int = 500) -> Image.Image:
    img = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(img)
    draw_gradient_bg(draw, width, height)

    # Accent top bar
    draw.rectangle([0, 0, width, 5], fill=PRIMARY)

    # Right glow
    for i in range(140, 0, -2):
        cx, cy = width * 0.78, height * 0.5
        color = (PRIMARY[0], PRIMARY[1], max(0, PRIMARY[2] - int(40 * i / 140)))
        draw.ellipse([cx - i, cy - i * 0.7, cx + i, cy + i * 0.7], fill=color)

    # Court outline right
    court = [width * 0.58, height * 0.14, width * 0.94, height * 0.86]
    draw.rounded_rectangle(court, radius=20, outline=(35, 35, 35), width=3)
    draw.line([(court[0], height * 0.5), (court[2], height * 0.5)], fill=(35, 35, 35), width=2)
    draw.line([(width * 0.76, court[1]), (width * 0.76, court[3])], fill=(35, 35, 35), width=2)

    draw_padel_ball(draw, width * 0.17, height * 0.5, height * 0.16)

    title_font = load_font(72)
    sub_font = load_font(28)
    feat_font = load_font(20)

    draw.text((width * 0.30, height * 0.28), "x4 match", font=title_font, fill=WHITE)
    draw.text(
        (width * 0.30, height * 0.46),
        "Pádel competitivo, partidos reales.",
        font=sub_font,
        fill=MUTED,
    )

    features = ["Partidos abiertos", "Ranking", "Reservas en clubes"]
    y = height * 0.60
    for feat in features:
        draw.ellipse([width * 0.30, y + 6, width * 0.30 + 12, y + 18], fill=PRIMARY)
        draw.text((width * 0.30 + 22, y), feat, font=feat_font, fill=WHITE)
        y += 34

    return img


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)

    icon = create_app_icon(1024)
    icon.save(ASSETS / "icon.png", "PNG", optimize=True)

    # Adaptive: composite foreground on black for preview file;
    # Expo uses foregroundImage on backgroundColor #000
    fg = create_adaptive_foreground(1024)
    adaptive = Image.new("RGB", (1024, 1024), BG)
    adaptive.paste(fg, (0, 0), fg)
    adaptive.save(ASSETS / "adaptive-icon.png", "PNG", optimize=True)

    play_icon = icon.resize((512, 512), Image.Resampling.LANCZOS)
    play_icon.save(ASSETS / "play-store-icon.png", "PNG", optimize=True)

    feature = create_feature_graphic(1024, 500)
    feature.save(ASSETS / "play-store-feature.png", "PNG", optimize=True)

    for name in ["icon.png", "adaptive-icon.png", "play-store-icon.png", "play-store-feature.png"]:
        path = ASSETS / name
        with Image.open(path) as im:
            print(f"{name}: {im.size[0]}x{im.size[1]}, {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
