// ui_shots.mjs — nav over light and dark sections, the covers section, and a button mid-hover.
//   node tools/ui_shots.mjs <url> <outDir> [WxH]
import fs from 'node:fs';
import { launch, context, sleep } from './browser.mjs';
const [url, out, wh = '1440x900'] = process.argv.slice(2);
const [w, h] = wh.split('x').map(Number);
fs.mkdirSync(out, { recursive: true });
const browser = await launch();
const ctx = await context(browser, { w, h, init: "try{sessionStorage.setItem('ff-intro','1')}catch{}" });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await sleep(3000);
const go = async (sel, k = 0) => {
  await page.evaluate(([s, k]) => {
    const el = document.querySelector(s);
    const y = el.getBoundingClientRect().top + scrollY + k * innerHeight;
    window.lenis?.scrollTo ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y);
    scrollTo(0, y);
  }, [sel, k]);
  await page.mouse.wheel(0, -40); // a small scroll up so the nav shows
  await sleep(2200);
};
const state = () => page.evaluate(() => ({ nav: document.querySelector('[data-nav]').className, current: [...document.querySelectorAll('.nav__link.is-current')].map((l) => l.textContent) }));
await go('.covers', 0.35); await page.screenshot({ path: `${out}/covers.png` }); console.log('covers', await state());
await go('.covers', 1.4); await page.screenshot({ path: `${out}/covers2.png` }); console.log('covers2', await state());
await go('.plans', 0.2); console.log('plans', await state()); await page.screenshot({ path: `${out}/plans.png` });
await go('.support', 0.1); console.log('support', await state()); await page.screenshot({ path: `${out}/support.png` });
await go('.tube', 0.6); console.log('tube', await state());
await go('.hero', 0); console.log('hero', await state());
// hover the hero CTA from the left edge
const b = await page.locator('.hero__foot .btn').boundingBox();
await page.mouse.move(b.x - 20, b.y + b.height / 2);
await page.mouse.move(b.x + 4, b.y + b.height / 2, { steps: 2 });
await sleep(180); await page.screenshot({ path: `${out}/btn-mid.png`, clip: { x: b.x - 30, y: b.y - 30, width: b.width + 60, height: b.height + 60 } });
await sleep(900); await page.screenshot({ path: `${out}/btn-end.png`, clip: { x: b.x - 30, y: b.y - 30, width: b.width + 60, height: b.height + 60 } });
await page.screenshot({ path: `${out}/hero.png` });
await browser.close();
