# Sources

Globe textures in public/globe/ are graded by tools/grade_globe.py from NASA Visible Earth (public domain):
- Blue Marble Next Generation, July 2004 (record 74092) → day.webp (oceans lifted to a clear blue)
- Black Marble 2016 (record 144898) → night.webp (city light over a flat dark base)
- Cloud combined (record 57747) → blue channel of data.webp; green is a land mask, red a halved land relief
Ungraded bases live in docs/sources/globe-base/.

Work screenshots in public/work/ are FF Dev Studio's own projects, copied from PhantomClone/public/media.
Fonts: Instrument Sans, SIL OFL (public/fonts). Marks: ffdevstudio/brand-system.

Hero rock wall in public/hero/ is packed by tools/pack_rock.py from Poly Haven "Rock Face 03"
(https://polyhaven.com/a/rock_face_03, CC0; photography Dario Barresi, processing Rico Cilliers):
4k diffuse, OpenGL normal, roughness, displacement and AO in docs/sources/polyhaven/ (git-ignored).
