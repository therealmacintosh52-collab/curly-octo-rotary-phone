#!/usr/bin/env python3
"""Luminance-key the owner's logo (inputs/logo.jpg) to transparent PNGs.
alpha = scaled max(r,g,b); colour un-premultiplied so it composites back to the original on black.
Small isolated specks (the logo's sparkle particles) are dropped so the D-mark is clean."""
import os, sys, numpy as np
from PIL import Image
from scipy import ndimage
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "inputs", "logo.jpg")
OUT = sys.argv[2:]  # pairs of name box
im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)

def key(box, min_area, lo=26, hi=85, ysplit=None):
    x0,y0,x1,y1 = box
    c = im[y0:y1, x0:x1]
    m = c.max(axis=2)
    a = np.clip((m-lo)/(hi-lo), 0, 1)
    if ysplit is not None:  # tighter floor above this row (sparkle glow); keep text zone untouched
        a2 = np.clip((m-55)/(110-55), 0, 1)
        a[:ysplit] = a2[:ysplit]
    if min_area:
        lab, n = ndimage.label(a > 0.35, structure=np.ones((3,3)))
        sizes = ndimage.sum(np.ones_like(m), lab, index=np.arange(1, n+1))
        keep = np.zeros(n+1, bool); keep[1:] = sizes >= min_area
        f = ndimage.binary_dilation(keep[lab], iterations=3)
        if ysplit is not None: f[ysplit:] = True
        a = a * f
    rgb = np.where(a[...,None] > 0, np.clip(c / np.maximum(a[...,None], 0.04), 0, 255), 0)
    return Image.fromarray(np.dstack([rgb, a*255]).astype(np.uint8), 'RGBA')

if __name__ == '__main__':
    # lockup = D mark + wordmark + rule + tagline ; wordmark = wordmark+rule+tagline ; mark = D mark only
    boxes = {'lockup': (110, 325, 1310, 1075), 'wordmark': (110, 790, 1310, 1070), 'mark': (400, 325, 960, 790)}
    for pair in OUT:
        name, path = pair.split('=')
        if name == 'wordmark': img = key(boxes[name], 0)
        elif name == 'mark': img = key(boxes[name], 2500, ysplit=None)
        else: img = key(boxes[name], 2500, ysplit=465)
        img.save(path, optimize=True)
        print(name, '->', path)
