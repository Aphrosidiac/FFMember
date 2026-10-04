// intro_video.mjs — record the first-visit intro as video (screenshots stall while WebGL compiles).
//   [SEEN=1] node tools/intro_video.mjs <url> <outDir> [WxH] [seconds=8]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const pw = createRequire(path.join(process.cwd(), 'noop.js'))('playwright');
const [url, out, wh = '1440x900', secs = '8'] = process.argv.slice(2);
const [w, h] = wh.split('x').map(Number);
fs.mkdirSync(out, { recursive: true });
const browser = await pw.chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700, recordVideo: { dir: out, size: { width: w, height: h } } });
// SEEN=1: a repeat visit in the session (the quick intro)
if (process.env.SEEN) await ctx.addInitScript(() => { try { sessionStorage.setItem('ff-member-intro', '1'); } catch {} });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
const marks = [];
await page.exposeFunction('__mark', (m) => marks.push(`${Date.now() - t0}ms ${m}`));
await page.evaluate(() => {
  const mo = new MutationObserver(() => {
    const i = document.querySelector('.intro');
    if (!i) { window.__mark('intro removed'); mo.disconnect(); return; }
    if (i.classList.contains('is-issued') && !window.__iss) { window.__iss = 1; window.__mark('issued'); }
  });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
});
await new Promise((r) => setTimeout(r, +secs * 1000));
console.log(marks.join('\n'));
const v = page.video();
await ctx.close();
await browser.close();
fs.renameSync(await v.path(), path.join(out, 'intro.webm'));
