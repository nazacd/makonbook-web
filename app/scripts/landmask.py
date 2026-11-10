#!/usr/bin/env python3
"""Draws public/globe/land.png, the land mask the onboarding globe samples.

    python3 scripts/landmask.py ne_50m_land.geojson public/globe/land.png

The input is Natural Earth's 1:50m land polygons (public domain,
naturalearthdata.com; ne_50m_land.geojson in nvkelso/natural-earth-vector).
The output is a 2048 x 1024 black-and-white equirectangular map: white is land.
Needs Pillow.
"""
import json
import sys

from PIL import Image, ImageDraw

W, H = 2048, 1024


def main():
    src, out = sys.argv[1], sys.argv[2]
    data = json.load(open(src, encoding="utf-8"))
    img = Image.new("L", (W, H), 0)
    draw = ImageDraw.Draw(img)

    def px(lon, lat):
        return ((lon + 180) / 360 * W, (90 - lat) / 180 * H)

    for f in data["features"]:
        g = f["geometry"]
        polygons = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for polygon in polygons:
            for i, ring in enumerate(polygon):
                draw.polygon([px(*p[:2]) for p in ring], fill=255 if i == 0 else 0)
    img.convert("1").save(out, optimize=True)


if __name__ == "__main__":
    main()
