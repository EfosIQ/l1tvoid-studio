#!/usr/bin/env python3
"""Create a cinematic vertical Apollo 11 archive film from authentic NASA stills."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter, ImageOps
import math

W, H = 540, 960
FPS = 24
OUT = Path("output")
ASSET = OUT / "assets"
OUT.mkdir(exist_ok=True)

SCENES = [
    dict(file="launch.jpg", frames=156, date="16 ИЮЛЯ 1969", title="СТАРТ К ЛУНЕ",
         sub="КЕННЕДИ • 09:32 EDT", photo="NASA PHOTO S69-39525",
         focus=(0.50, 0.43), pan=(0.46, 0.48), zoom=(1.00, 1.10)),
    dict(file="earth_far.jpg", frames=144, date="98 000 МИЛЬ ОТ ЗЕМЛИ", title="ЗЕМЛЯ В\nИЛЛЮМИНАТОРЕ",
         sub="ТРАНСЛУННАЯ ТРАЕКТОРИЯ", photo="NASA PHOTO AS11-36-5355",
         focus=(0.50, 0.50), pan=(0.52, 0.46), zoom=(1.02, 1.15)),
    dict(file="earthrise.jpg", frames=144, date="ЧЕТЫРЕ ДНЯ В ПУТИ", title="ЗЕМЛЯ НАД\nЛУННЫМ КРАЕМ",
         sub="ВИД С ЛУННОЙ ОРБИТЫ", photo="NASA PHOTO AS11-44-6550",
         focus=(0.51, 0.48), pan=(0.47, 0.55), zoom=(1.01, 1.14)),
    dict(file="aldrin_exit.jpg", frames=192, date="20 ИЮЛЯ 1969", title="ПЕРВЫЙ ВЫХОД\nНА ЛУНУ",
         sub="БАЗЗ ОЛДРИН ПОКИДАЕТ «ОРЁЛ»", photo="NASA PHOTO AS11-40-5863",
         focus=(0.53, 0.48), pan=(0.50, 0.50), zoom=(1.02, 1.13)),
    dict(file="flag.jpg", frames=156, date="МОРЕ СПОКОЙСТВИЯ", title="ЧЕЛОВЕК НА\nДРУГОМ МИРЕ",
         sub="АЛДРИН • ФЛАГ • ЛУННЫЙ МОДУЛЬ", photo="NASA PHOTO AS11-40-5875",
         focus=(0.53, 0.52), pan=(0.49, 0.52), zoom=(1.02, 1.12)),
    dict(file="footprint.jpg", frames=96, date="ЛУННАЯ ПОВЕРХНОСТЬ", title="СЛЕД В ИСТОРИИ",
         sub="СЛЕД БОТИНКА В ЛУННОМ РЕГОЛИТЕ", photo="NASA PHOTO AS11-40-5880",
         focus=(0.50, 0.50), pan=(0.52, 0.48), zoom=(1.00, 1.16)),
    dict(file="earthrise.jpg", frames=72, date="16—24 ИЮЛЯ 1969", title="АПОЛЛОН-11",
         sub="ПЕРВАЯ ВЫСАДКА ЧЕЛОВЕКА НА ЛУНУ", photo="АРХИВНЫЕ ФОТОГРАФИИ: NASA / JSC",
         focus=(0.51, 0.48), pan=(0.49, 0.50), zoom=(1.08, 1.16), final=True),
]

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
font_label = ImageFont.truetype(FONT_BOLD, 14)
font_date = ImageFont.truetype(FONT_BOLD, 17)
font_title = ImageFont.truetype(FONT_BOLD, 44)
font_sub = ImageFont.truetype(FONT_REG, 17)
font_footer = ImageFont.truetype(FONT_REG, 12)

def load_photo(name):
    path = ASSET / name
    if not path.exists():
        raise FileNotFoundError(f"Missing NASA archive asset: {path}")
    im = Image.open(path).convert("RGB")
    if im.width < 700 or im.height < 700:
        raise ValueError(f"Archive image too small: {path} {im.size}")
    return ImageEnhance.Sharpness(ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(0.94)).enhance(1.10)).enhance(1.08)

PHOTOS = {s["file"]: load_photo(s["file"]) for s in SCENES}

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))

def ease(t):
    t = clamp(t)
    return t * t * (3.0 - 2.0 * t)

def fit_with_motion(photo, scene, progress):
    z0, z1 = scene["zoom"]
    zoom = z0 + (z1 - z0) * ease(progress)
    cw, ch = int(W * zoom), int(H * zoom)
    focus_x, focus_y = scene["focus"]
    # Gentle drift keeps the archival still alive without distracting from its subject.
    pan_x, pan_y = scene["pan"]
    cx = clamp(focus_x + (progress - 0.5) * (pan_x - 0.5) * 0.12)
    cy = clamp(focus_y + (progress - 0.5) * (pan_y - 0.5) * 0.12)
    fitted = ImageOps.fit(photo, (cw, ch), method=Image.Resampling.LANCZOS, centering=(cx, cy))
    dx = int((cw - W) * (0.5 + (progress - 0.5) * (pan_x - 0.5) * 0.5))
    dy = int((ch - H) * (0.5 + (progress - 0.5) * (pan_y - 0.5) * 0.5))
    dx = max(0, min(cw - W, dx))
    dy = max(0, min(ch - H, dy))
    return fitted.crop((dx, dy, dx + W, dy + H))

def add_gradients(im):
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    for y in range(350):
        a = int(172 * (1 - y / 350) ** 1.35)
        d.line((0, y, W, y), fill=(2, 7, 14, a))
    for y in range(560, H):
        a = int(195 * ((y - 560) / (H - 560)) ** 1.55)
        d.line((0, y, W, y), fill=(2, 6, 12, a))
    return Image.alpha_composite(im.convert("RGBA"), overlay)

def add_vignette(im):
    mask = Image.new("L", (W, H), 160)
    md = ImageDraw.Draw(mask)
    md.ellipse((-int(W*0.28), -int(H*0.16), int(W*1.28), int(H*1.16)), fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(65))
    black = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    black.putalpha(mask.point(lambda p: int(p * 0.48)))
    return Image.alpha_composite(im, black)

def draw_graphics(im, scene, frame_index, overall_progress):
    d = ImageDraw.Draw(im, "RGBA")
    gold = (236, 190, 112, 245)
    white = (246, 246, 239, 245)
    muted = (221, 228, 235, 218)
    # Fine editorial framing; restrained rather than a busy game HUD.
    d.rounded_rectangle((34, 39, 506, 91), radius=7, outline=(255,255,255,65), width=1)
    d.ellipse((52, 59, 62, 69), fill=gold)
    d.text((76, 55), "АПОЛЛОН 11", font=font_label, fill=white)
    d.text((360, 55), "АРХИВ NASA", font=font_label, fill=muted)
    d.text((50, 119), scene["date"], font=font_date, fill=gold)
    title_y = 151
    # Scale headings that may contain two lines so none run into the frame edge.
    title = scene["title"]
    size = 44
    while size > 32:
        f = ImageFont.truetype(FONT_BOLD, size)
        bbox = d.multiline_textbbox((0, 0), title, font=f, spacing=2, stroke_width=0)
        if bbox[2] - bbox[0] <= 450:
            break
        size -= 2
    d.multiline_text((48, title_y), title, font=f, fill=white, spacing=1,
                     stroke_width=1, stroke_fill=(0,0,0,110))
    title_box = d.multiline_textbbox((48, title_y), title, font=f, spacing=1)
    line_y = min(315, title_box[3] + 18)
    d.line((50, line_y, 148, line_y), fill=gold, width=3)
    d.text((50, line_y + 15), scene["sub"], font=font_sub, fill=muted)
    # Small mission-photo identifier in the lower safe zone, above burned-in subtitles.
    d.text((48, 900), scene["photo"], font=font_footer, fill=(238, 239, 237, 205))
    d.text((460, 900), f"{frame_index / FPS:05.1f}s", font=font_footer, fill=(238, 239, 237, 180))
    # Minimal timeline with an animated marker.
    d.line((48, 931, 492, 931), fill=(255,255,255,75), width=2)
    d.line((48, 931, int(48 + 444 * overall_progress), 931), fill=gold, width=3)
    d.rectangle((48, 941, 492, 943), fill=(255,255,255,38))
    return im

def render_photo(scene, progress):
    photo = PHOTOS[scene["file"]]
    im = fit_with_motion(photo, scene, progress)
    im = add_gradients(im)
    im = add_vignette(im)
    return im.convert("RGBA")

def main():
    total = sum(s["frames"] for s in SCENES)
    if total != 40 * FPS:
        raise RuntimeError(f"Timeline is {total} frames, expected {40*FPS}")
    starts = []
    cursor = 0
    for scene in SCENES:
        starts.append(cursor)
        cursor += scene["frames"]
    crossfade = 16
    print(f"Rendering {total} archive-motion frames at {W}x{H}, 24 fps")
    for frame in range(total):
        idx = max(i for i, start in enumerate(starts) if start <= frame)
        start = starts[idx]
        scene = SCENES[idx]
        local = frame - start
        p = local / max(1, scene["frames"] - 1)
        image = render_photo(scene, p)
        # Cross-dissolve photographs only; draw one clean title layer after the transition.
        if idx < len(SCENES) - 1 and local >= scene["frames"] - crossfade:
            alpha = (local - (scene["frames"] - crossfade)) / crossfade
            next_scene = SCENES[idx + 1]
            next_image = render_photo(next_scene, min(0.08, alpha * 0.08))
            image = Image.blend(image, next_image, clamp(alpha))
        image = draw_graphics(image, scene, frame, frame / (total - 1)).convert("RGB")
        image.save(OUT / f"frame_{frame:04d}.jpg", "JPEG", quality=91, optimize=True, subsampling=0)
        if frame % 120 == 0 or frame == total - 1:
            print(f"[frames] {frame + 1}/{total}")
    print(f"Rendered {total} archive-motion frames.")

if __name__ == "__main__":
    main()
