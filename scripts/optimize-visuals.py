"""Regenerate lightweight gallery images: python3 scripts/optimize-visuals.py (Pillow required)."""
from pathlib import Path
from PIL import Image, ImageOps
import hashlib
import re

root = Path(__file__).resolve().parents[1] / 'public'
page = root / 'visuals.html'
html = page.read_text()
originals = re.findall(r'<div class="sticker-item" data-src="([^"]+)"', html)
output = root / 'visuals' / 'optimized'
output.mkdir(exist_ok=True)

for index, original in enumerate(originals):
    source = root / original
    # Content-derived names allow browser caching without stale images after replacement.
    digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        width, height = image.size
        paths = {}
        for size, quality in [(320, 80), (960, 86)]:
            copy = image.copy()
            copy.thumbnail((size, round(size * height / width)), Image.Resampling.LANCZOS)
            target = output / f'{source.stem}-{digest}-{size}.webp'
            copy.save(target, 'WEBP', quality=quality, method=6)
            paths[size] = target.relative_to(root).as_posix()
    pattern = r'(<div class="sticker-item" data-src="' + re.escape(original) + r'">)<img\b[^>]*>'
    match = re.search(pattern, html)
    if not match:
        raise ValueError(f'Missing gallery image: {original}')
    alt = re.search(r'alt="([^"]*)"', match[0])[1]
    loading = 'eager' if index < 4 else 'lazy'
    priority = ' fetchpriority="high"' if index < 2 else ''
    replacement = (match[1] + f'<img src="{paths[320]}" data-preview-src="{paths[960]}" '
                   f'alt="{alt}" width="{width}" height="{height}" loading="{loading}" decoding="async"{priority}>')
    html = html[:match.start()] + replacement + html[match.end():]
page.write_text(html)
thumbs = sum(p.stat().st_size for p in output.glob('*-320.webp'))
previews = sum(p.stat().st_size for p in output.glob('*-960.webp'))
print(f'{len(originals)} images: thumbnails {thumbs / 1e6:.2f} MB, previews {previews / 1e6:.2f} MB')
