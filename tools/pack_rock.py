"""Pack the Poly Haven rock_face_03 scan (CC0) into the hero's wall textures (run from the repo root).

rock-albedo.webp  graphite: the photo desaturated, darkened, with its AO baked in (1024)
rock-normal.webp  OpenGL tangent normal (2048)
rock-data.webp    r: displacement (feeds displacementMap), g: roughness (2048)
"""
import numpy as np
from PIL import Image

SRC = 'docs/sources/polyhaven/rock_face_03_{}_4k.jpg'
OUT = 'public/hero/'
load = lambda m: Image.open(SRC.format(m))

diff = np.asarray(load('diff').convert('RGB').resize((1024, 1024), Image.LANCZOS), np.float32) / 255
ao = np.asarray(load('ao').convert('L').resize((1024, 1024), Image.LANCZOS), np.float32) / 255
lum = diff @ np.array([0.3, 0.59, 0.11], np.float32)
lum = (lum / lum.mean()) * 0.32                    # normalise the photo's exposure, then pull to dark stone
g = np.clip(lum * ao ** 1.4, 0, 1)
albedo = np.stack([g * 0.97, g * 0.98, g * 1.0], -1)  # a breath of cool so it reads as slate, not ash
Image.fromarray((albedo ** (1 / 2.2) * 255 + 0.5).astype(np.uint8)).save(OUT + 'rock-albedo.webp', quality=90, method=6)

load('nor_gl').convert('RGB').resize((2048, 2048), Image.LANCZOS).save(OUT + 'rock-normal.webp', quality=92, method=6)

disp = load('disp').convert('L').resize((2048, 2048), Image.LANCZOS)
rough = load('rough').convert('L').resize((2048, 2048), Image.LANCZOS)
Image.merge('RGB', [disp, rough, Image.new('L', (2048, 2048), 0)]).save(OUT + 'rock-data.webp', quality=92, method=6)
print('ok')
