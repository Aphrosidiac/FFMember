// bake_card.mjs — paint the member card's faces in a browser (fonts, Path2D, canvas) and save them
// to public/card/. Re-run after changing paintCardFaces in src/js/gl/card.js. Needs the dev server.
//   node tools/bake_card.mjs [http://localhost:3180]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { launch } from './browser.mjs';
const base = process.argv[2] || 'http://localhost:3180';
fs.mkdirSync('public/card', { recursive: true });
const browser = await launch();
const page = await browser.newPage();
await page.goto(base + '/404.html', { waitUntil: 'load' });
const maps = await page.evaluate(async () => {
  const m = await import('/src/js/gl/card.js');
  const f = await m.paintCardFaces();
  const out = {};
  for (const side of ['front', 'back']) for (const k of ['colour', 'orm', 'normal']) out[`${side}-${k}`] = f[side][k].toDataURL('image/png');
  return out;
});
await browser.close();
for (const [name, url] of Object.entries(maps)) {
  const png = `public/card/${name}.png`;
  fs.writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'));
  // colour is lossy; finish and normal maps are data, so lossless
  execFileSync('python3', ['-c', `from PIL import Image; Image.open('${png}').convert('RGB').save('public/card/${name}.webp', ${name.endsWith('colour') ? 'quality=92' : 'lossless=True'}, method=6)`]);
  fs.rmSync(png);
}
console.log(fs.readdirSync('public/card').map((f) => `${f} ${(fs.statSync('public/card/' + f).size / 1024).toFixed(0)} kB`).join('\n'));
