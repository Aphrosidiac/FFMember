// strip.mjs — walk a page top to bottom with real wheel input and screenshot the viewport at
// fixed scroll offsets. Pinned sections (globe, card tube, numbers) only exist mid-scroll, so a
// full-page shot says nothing about them; a strip of viewports does.
//
//   node tools/strip.mjs --base https://www.moto-card.com --path / --size 1440x900 \
//        --out docs/reference/2026-10-03/strip --step 450 [--init "..."] [--wait 4000]
//
// Writes <slug>-<w>-<offset>.png and strip.json (offset -> actual scrollY, doc height).
import fs from 'node:fs';
import path from 'node:path';
import { launch, context, settle, sleep, size } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, all) => {
  if (v.startsWith('--')) acc.push([v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

const [w, h] = size(args.size || '1440x900');
const step = Number(args.step || 450);
const out = args.out;
fs.mkdirSync(out, { recursive: true });
const slug = (args.path === '/' ? 'index' : args.path.replace(/^\//, '').replace(/\//g, '_')) + '-' + w;

const browser = await launch();
const ctx = await context(browser, { w, h, init: args.init || '' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(args.base + args.path, { waitUntil: 'load', timeout: 60000 });
await settle(page, { wait: Number(args.wait || 4000) });

const log = [];
let target = 0;
const docH = await page.evaluate(() => document.documentElement.scrollHeight);
const max = Number(args.max || docH);
await page.mouse.move(w / 2, h / 2);
while (target <= max) {
  // Wheel in small notches so Lenis and the scrubbed timelines follow as they would for a person.
  let y = await page.evaluate(() => window.scrollY);
  let guard = 0;
  while (y < target - 2 && guard++ < 200) {
    await page.mouse.wheel(0, Math.min(120, target - y));
    await sleep(40);
    y = await page.evaluate(() => window.scrollY);
  }
  await sleep(Number(args.hold || 1400));
  const actual = await page.evaluate(() => window.scrollY);
  const file = `${slug}-${String(target).padStart(5, '0')}.png`;
  await page.screenshot({ path: path.join(out, file) });
  log.push({ target, actual, file });
  const h2 = await page.evaluate(() => document.documentElement.scrollHeight);
  if (actual + h >= h2 - 2 && target > 0) break;
  target += step;
}
fs.writeFileSync(path.join(out, `${slug}.json`), JSON.stringify({ docH, log, errors }, null, 1));
console.log(`${slug}: ${log.length} frames, docH ${docH}, errors ${errors.length}`);
await browser.close();
