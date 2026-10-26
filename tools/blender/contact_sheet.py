"""Combine render views into one sheet: python tools/blender/contact_sheet.py <prefix> [cols]"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
prefix = sys.argv[1]
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 3
files = sorted(glob.glob(os.path.join(ROOT, 'docs', 'renders', f'{prefix}_*.png')))
files = [f for f in files if not f.endswith('_sheet.png')]
imgs = [Image.open(f).convert('RGB') for f in files]
w, h = imgs[0].size
rows = (len(imgs) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), (30, 30, 30))
for i, im in enumerate(imgs):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
out = os.path.join(ROOT, 'docs', 'renders', f'{prefix}_sheet.png')
sheet.thumbnail((1500, 1500))
sheet.save(out)
print(out, [os.path.basename(f) for f in files])
