#!/usr/bin/env python3
"""Fetch archival Apollo 11 photographs from NASA public archives."""
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image
from io import BytesIO

OUT = Path("output/assets")
OUT.mkdir(parents=True, exist_ok=True)

ASSETS = {
    "launch": [
        "https://images-assets.nasa.gov/image/s69-39525/s69-39525~orig.jpg",
        "https://planetary.s3.amazonaws.com/web/assets/pictures/20170216_apollo-11-liftoff.jpg",
    ],
    "earth_far": [
        "https://eol.jsc.nasa.gov/DatabaseImages/ISD/highres/AS11/AS11-36-5355.JPG",
    ],
    "earthrise": [
        "https://eol.jsc.nasa.gov/DatabaseImages/ISD/highres/AS11/AS11-44-6550.JPG",
    ],
    "aldrin_exit": [
        "https://eol.jsc.nasa.gov/DatabaseImages/ISD/highres/AS11/AS11-40-5863.JPG",
    ],
    "flag": [
        "https://eol.jsc.nasa.gov/DatabaseImages/ISD/highres/AS11/AS11-40-5875.JPG",
    ],
    "footprint": [
        "https://eol.jsc.nasa.gov/DatabaseImages/ISD/highres/AS11/AS11-40-5880.JPG",
        "https://assets.science.nasa.gov/dynamicimage/assets/science/psd/lunar-science/2023/09/GPN-2001-000014.jpg?crop=faces%2Cfocalpoint&fit=crop&h=2382&w=2961",
    ],
}

def fetch(name, urls):
    errors = []
    for url in urls:
        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; Apollo11Documentary/1.0)"})
            with urlopen(req, timeout=60) as response:
                data = response.read()
            if len(data) < 20_000:
                raise ValueError(f"image too small ({len(data)} bytes)")
            im = Image.open(BytesIO(data))
            im.verify()
            path = OUT / f"{name}.jpg"
            path.write_bytes(data)
            print(f"[asset] {name}: {len(data):,} bytes from {url}")
            return
        except Exception as exc:
            errors.append(f"{url}: {exc}")
    raise RuntimeError(f"Unable to fetch {name}:\n" + "\n".join(errors))

for key, candidates in ASSETS.items():
    fetch(key, candidates)
print("All NASA archive images are ready.")
