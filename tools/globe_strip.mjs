// globe_strip.mjs — photograph the globe section at fixed scroll offsets (in viewport heights from
// the section's top) on the reference and on ours, so the motion is compared frame against frame.
//   node tools/globe_strip.mjs <url> <sectionSelector> <outDir> [WxH]
import fs from 'node:fs';
import { launch, context, sleep } from './browser.mjs';
const [url, sel, out, wh = '1440x900'] = process.argv.slice(2);
const [w, h] = wh.split('x').map(Number);
fs.mkdirSync(out, { recursive: true });
const OFFS = (process.env.OFFS || '-1,-0.75,-0.5,-0.25,0,0.25,0.5,0.75,1,1.25,1.5,2').split(',').map(Number);
const browser = await launch();
const ctx = await context(browser, { w, h, init: "try{sessionStorage.setItem('ff-intro','1')}catch{}" });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await sleep(6000);
for (const k of OFFS) {
  await page.evaluate(([s, k]) => {
    const el = document.querySelector(s);
    // the pin-spacer wraps a pinned section; measure the outermost box so offsets stay stable
    const box = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    const top = box.getBoundingClientRect().top + scrollY;
    const y = Math.max(0, top + k * innerHeight);
    if (window.lenis?.scrollTo) window.lenis.scrollTo(y, { immediate: true, force: true });
    window.scrollTo(0, y);
  }, [sel, k]);
  await sleep(3500);
  await page.screenshot({ path: `${out}/${String(k).replace('-', 'm')}.png` });
  console.log('shot', k, await page.evaluate(() => scrollY));
}
await browser.close();
