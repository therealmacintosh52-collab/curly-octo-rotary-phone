#!/usr/bin/env python3
"""Prepare card artwork assets from the owner's own files (run once; outputs committed in assets/).
 - logo-wordtext.png : '916 DENT & DETAIL' wordmark only, luminance-keyed from inputs/logo.jpg
 - script-your-vehicle-our-passion.png : the gold script line, colour-keyed from the owner's printed
   card (inputs/916-card-back.pdf rendered at 300 dpi). It is the owner's lettering; no script font was
   available/licensed, so the owner's own artwork is reused as-is. Nothing from other sources.
"""
import os, sys, subprocess, tempfile, numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); IN = os.path.join(HERE, '..', '..', 'inputs')
sys.path.insert(0, os.path.join(HERE, '..', '_shared'))
import key_logo  # noqa  (sys.argv guard: module reads argv at import; give it a harmless one)
A = os.path.join(HERE, 'assets'); os.makedirs(A, exist_ok=True)
key_logo.key((110, 795, 1310, 925), 0).save(os.path.join(A, 'logo-wordtext.png'), optimize=True)
with tempfile.TemporaryDirectory() as d:
    subprocess.run(['pdftoppm', '-r', '300', '-png', os.path.join(IN, '916-card-back.pdf'), os.path.join(d, 'b')], check=True)
    im = Image.open(os.path.join(d, 'b-1.png')).convert('RGB')
c = np.asarray(im.crop((775, 415, 1030, 535))).astype(np.float32)
sat = c[..., 0] - c[..., 2]                       # gold: R >> B ; headlight greys: R ~ B
a = np.clip((sat - 45) / 70, 0, 1)
a[c.max(axis=2) < 70] = 0
rgb = np.clip(c / np.maximum(a[..., None], .05), 0, 255)
Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA').save(os.path.join(A, 'script-your-vehicle-our-passion.png'), optimize=True)
print('ok')
