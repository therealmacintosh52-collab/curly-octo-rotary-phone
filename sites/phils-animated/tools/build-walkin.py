#!/usr/bin/env python3
"""Inline the shop photographs into the walk-in renderer.

The template carries the edit; this only swaps each __MEDIA_<name>__ token
for a data URI so the page is one self-contained file you can open from a
phone, a USB stick or an artifact link with no server behind it.
"""
import base64
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
MEDIA = HERE.parent / "public" / "media"
TEMPLATE = HERE / "walkin.template.html"
OUT = HERE / "render-walkthrough-video.html"


def main():
    html = TEMPLATE.read_text()
    wanted = re.findall(r"__MEDIA_([A-Za-z0-9_-]+)__", html)
    if not wanted:
        sys.exit("no media tokens in the template")

    for name in dict.fromkeys(wanted):
        src = MEDIA / (name + ".jpg")
        if not src.exists():
            sys.exit("missing photograph: %s" % src)
        uri = "data:image/jpeg;base64," + base64.b64encode(src.read_bytes()).decode()
        html = html.replace("__MEDIA_%s__" % name, uri)

    assert "__MEDIA_" not in html, "a media token was left unreplaced"
    OUT.write_text(html)
    print("%s — %d shots, %.1f MB" % (OUT.name, len(dict.fromkeys(wanted)), len(html) / 1048576))


if __name__ == "__main__":
    main()
