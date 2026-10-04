// btn_frames.mjs — hover a button from its left edge and photograph it at fixed times.
//   node tools/btn_frames.mjs <url> <selector> <out.png> [scrollSelector]
import { launch, context, sleep } from './browser.mjs';
import { PNG } from 'pngjs';
import fs from 'node:fs';
const [url, sel, out, scrollSel] = process.argv.slice(2);
const browser = await launch();
const ctx = await context(browser, { w: 1440, h: 900, init: "try{sessionStorage.setItem('ff-intro','1')}catch{}" });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await sleep(2500);
if (scrollSel) { await page.locator(scrollSel).first().scrollIntoViewIfNeeded(); await page.evaluate((s) => { const y = document.querySelector(s).getBoundingClientRect().top + scrollY - 300; if (typeof window.lenis?.scrollTo === 'function') window.lenis.scrollTo(y, { immediate: true, force: true }); scrollTo(0, y); }, scrollSel); await sleep(1500); }
const b = await page.locator(sel).first().boundingBox();
const clip = { x: Math.round(b.x - 16), y: Math.round(b.y - 16), width: Math.round(b.width + 32), height: Math.round(b.height + 32) };
await page.mouse.move(b.x - 30, b.y + b.height / 2);
await sleep(300);
const shots = [];
const t0 = Date.now();
await page.mouse.move(b.x + 6, b.y + b.height / 2);
for (const t of [60, 160, 300, 500, 900]) { await sleep(Math.max(0, t - (Date.now() - t0))); shots.push(PNG.sync.read(await page.screenshot({ clip }))); }
await page.mouse.move(b.x + b.width + 30, b.y + b.height / 2);
await sleep(250); shots.push(PNG.sync.read(await page.screenshot({ clip })));
await sleep(900); shots.push(PNG.sync.read(await page.screenshot({ clip })));
const W = shots[0].width, H = shots[0].height;
const sheet = new PNG({ width: W, height: H * shots.length });
shots.forEach((s, i) => PNG.bitblt(s, sheet, 0, 0, W, H, 0, i * H));
fs.writeFileSync(out, PNG.sync.write(sheet));
await browser.close();
