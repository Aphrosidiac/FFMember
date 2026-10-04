// card_edges.mjs — the hero card's outline at Retina 2x, three pointer positions, blown up 3x
// nearest-neighbour (the TBP latte-bottle check). Look for dashes, stair-steps, bright or dark pips.
//   node tools/card_edges.mjs <url> <out.png>
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { PNG } from 'pngjs';
const pw = createRequire(path.join(process.cwd(), 'noop.js'))('playwright');
const [url, out] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.addInitScript(() => { try { sessionStorage.setItem('ff-intro', '1'); } catch {} });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelector('[data-hero-gl]')?.dataset.drawn === '1', null, { timeout: 30000 });
await sleep(4000);
// crops (CSS px): top-left corner, top edge, right edge, bottom-right corner
const crops = [[480, 380, 120, 60], [640, 382, 160, 40], [900, 420, 60, 140], [880, 630, 90, 70]];
const rows = [];
for (const px of [0.15, 0.5, 0.85]) {
  await page.mouse.move(1440 * px, 450);
  await sleep(2200);
  const shot = PNG.sync.read(await page.screenshot());
  const tiles = crops.map(([x, y, w, h]) => {
    const t = new PNG({ width: w * 2 * 3, height: h * 2 * 3 });
    for (let j = 0; j < t.height; j++) for (let i = 0; i < t.width; i++) {
      const s = ((y * 2 + Math.floor(j / 3)) * shot.width + (x * 2 + Math.floor(i / 3))) * 4;
      const d = (j * t.width + i) * 4;
      for (let c = 0; c < 4; c++) t.data[d + c] = shot.data[s + c];
    }
    return t;
  });
  rows.push(tiles);
}
const W = rows[0].reduce((a, t) => a + t.width + 12, 0);
const H = rows.reduce((a, r) => a + Math.max(...r.map((t) => t.height)) + 12, 0);
const sheet = new PNG({ width: W, height: H });
sheet.data.fill(200);
let y = 0;
for (const r of rows) { let x = 0; for (const t of r) { PNG.bitblt(t, sheet, 0, 0, t.width, t.height, x, y); x += t.width + 12; } y += Math.max(...r.map((t) => t.height)) + 12; }
fs.writeFileSync(out, PNG.sync.write(sheet));
await browser.close();
