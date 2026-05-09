# -*- coding: utf-8 -*-
"""Resize+recompress catalog photos into a thumbs/ folder so the catalog grid
loads ~10x faster.  Originals stay untouched (used by product.html lightbox).

Two outputs per source image:
  thumbs/<name>.jpg  — 800px wide, JPEG q82, used as <img src=>
  thumbs/<name>.webp — same dimensions, WebP q78, used in <picture><source>

Re-run safely; existing thumbs are skipped unless source is newer."""
import os, sys, io
from PIL import Image, ImageOps

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(ROOT, '2025-2026-named-top5')
OUT_DIR = os.path.join(SRC_DIR, 'thumbs')
os.makedirs(OUT_DIR, exist_ok=True)

MAX_W = 800     # widest dimension of the resized thumbnail
JPEG_Q = 82
WEBP_Q = 78

EXT = ('.jpg', '.jpeg', '.png')
done, skipped, total_in, total_out = 0, 0, 0, 0

for fname in sorted(os.listdir(SRC_DIR)):
    if not fname.lower().endswith(EXT):
        continue
    src = os.path.join(SRC_DIR, fname)
    base, _ = os.path.splitext(fname)
    out_jpg = os.path.join(OUT_DIR, base + '.jpg')
    out_webp = os.path.join(OUT_DIR, base + '.webp')

    src_mtime = os.path.getmtime(src)
    if os.path.exists(out_jpg) and os.path.exists(out_webp) \
       and os.path.getmtime(out_jpg) >= src_mtime \
       and os.path.getmtime(out_webp) >= src_mtime:
        skipped += 1
        continue

    try:
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im).convert('RGB')
            if im.width > MAX_W:
                ratio = MAX_W / im.width
                im = im.resize((MAX_W, int(im.height * ratio)), Image.LANCZOS)
            im.save(out_jpg, 'JPEG', quality=JPEG_Q, optimize=True, progressive=True)
            im.save(out_webp, 'WEBP', quality=WEBP_Q, method=6)
        total_in  += os.path.getsize(src)
        total_out += os.path.getsize(out_jpg) + os.path.getsize(out_webp)
        done += 1
        if done % 50 == 0:
            print(f'  ... {done} done')
    except Exception as e:
        print(f'  ! skip {fname}: {e}')

print(f'\nThumbs: {done} processed, {skipped} up-to-date')
if total_in:
    print(f'Avg shrink: {total_in/1e6:.1f} MB → {total_out/1e6:.1f} MB '
          f'({100*total_out/total_in:.0f}%)')
