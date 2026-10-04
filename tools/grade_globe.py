"""Grade the NASA globe textures into public/globe/ (run from the repo root). Bases: docs/sources/globe-base/.

day.webp   Blue Marble NG, July 2004 (record 74092): oceans lifted to a clear mid blue, land brightened
night.webp Black Marble 2016 (record 144898): city light kept warm over a near-neutral dark base
data.webp  r: land relief (halved), g: land mask, b: clouds — r is rescaled in place
"""
import numpy as np
from PIL import Image, ImageFilter

SRC = 'docs/sources/nasa/'
W, H = 4096, 2048
data = Image.open('docs/sources/globe-base/data.webp').convert('RGB')
r, g, b = [np.asarray(c, np.float32) for c in data.split()]

day = np.asarray(Image.open(SRC + 'world.200407.3x5400x2700.jpg').convert('RGB').resize((W, H), Image.LANCZOS), np.float32) / 255
lum = day @ np.array([0.3, 0.59, 0.11], np.float32)
# water from the photo itself (dark and bluer than red) at full resolution, so coastlines stay crisp
water = np.clip((0.2 - lum) / 0.08, 0, 1) * np.clip((day[..., 2] - day[..., 0]) / 0.04, 0, 1)
land = 1 - water
ocean = np.stack([0.11, 0.23, 0.47]) + (lum[..., None] - 0.06) * np.array([0.6, 0.9, 1.2])
day_land = np.clip(day ** 0.82 * 1.12, 0, 1)
out = day_land * land[..., None] + np.clip(ocean, 0, 1) * (1 - land[..., None])
Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save('public/globe/day.webp', quality=88, method=6)

night = np.asarray(Image.open('docs/sources/globe-base/night.webp').convert('RGB'), np.float32)
lum = night @ np.array([0.3, 0.59, 0.11], np.float32)
# city light is what rises above the terrain floor, tinted warm; the base is a flat land/ocean dark
# morphological opening: small bright points (cities) vanish, broad bright terrain keeps its edges
floor_raw = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(11)), np.float32)
floor = floor_raw
floor = np.minimum(floor, 40)
excess = np.clip(lum - np.minimum(floor_raw, 45) * 1.05 - 12, 0, None)
excess = 255 * (np.clip(excess / 150, 0, 1) ** 1.05)      # thin the halo, keep the points
mask = (g / 255)[..., None]
base = mask * np.array([13, 15, 24]) + (1 - mask) * np.array([5, 7, 15]) + floor[..., None] * np.array([0.1, 0.12, 0.2])
night = base + excess[..., None] * np.array([1.0, 0.86, 0.55])
Image.fromarray(np.clip(night, 0, 255).astype(np.uint8)).save('public/globe/night.webp', quality=88, method=6)

r2 = r * 0.5
Image.merge('RGB', [Image.fromarray(c.astype(np.uint8)) for c in (r2, g, b)]).save('public/globe/data.webp', quality=90, method=6)
print('ok')
