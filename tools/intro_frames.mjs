// intro_frames.mjs — film the first-visit intro: a screenshot every `step` ms into a contact sheet.
//   node tools/intro_frames.mjs <url> <out.png> [WxH] [step=300] [total=6600]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PNG } from 'pngjs';
const pw = createRequire(path.join(process.cwd(), 'noop.js'))('playwright');
const [url, out, wh = '1440x900', step = '300', total = '6600'] = process.argv.slice(2);
const [w, h] = wh.split('x').map(Number);
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 700, hasTouch: w < 700 })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' || /^\[(hero|intro)\]/.test(m.text())) console.log('[console]', m.text()); });
await page.goto(url, { waitUntil: 'domcontentloaded' });
const t0 = Date.now();
const frames = [];
while (Date.now() - t0 < +total) {
  const t = Date.now() - t0;
  const png = PNG.sync.read(await page.screenshot({ scale: 'css' }));
  frames.push({ t, png });
  const next = (Math.floor(t / +step) + 1) * +step;
  await new Promise((r) => setTimeout(r, Math.max(0, next - (Date.now() - t0))));
}
console.log('intro gone at end:', await page.evaluate(() => !document.querySelector('.intro')));
await browser.close();
// sheet: 4 across, each frame scaled to 1/3
const s = 3, fw = Math.floor(w / s), fh = Math.floor(h / s), cols = 4, rows = Math.ceil(frames.length / cols);
const sheet = new PNG({ width: cols * (fw + 6), height: rows * (fh + 6) });
sheet.data.fill(255);
frames.forEach(({ png }, i) => {
  const ox = (i % cols) * (fw + 6), oy = Math.floor(i / cols) * (fh + 6);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    const si = ((y * s) * png.width + x * s) * 4, di = ((oy + y) * sheet.width + ox + x) * 4;
    for (let c = 0; c < 4; c++) sheet.data[di + c] = png.data[si + c];
  }
});
fs.writeFileSync(out, PNG.sync.write(sheet));
console.log(frames.map((f) => f.t).join(' '));
