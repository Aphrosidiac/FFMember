// hero_shot.mjs — photograph the hero after it settles: node tools/hero_shot.mjs <url> <out.png> [WxH]
import { launch, context, sleep } from './browser.mjs';
const [url, out, wh = '1440x900'] = process.argv.slice(2);
const [w, h] = wh.split('x').map(Number);
const browser = await launch();
const ctx = await context(browser, { w, h, init: "try{sessionStorage.setItem('ff-intro','1')}catch{}" });
const page = await ctx.newPage();
page.on('console', (m) => { if (/error|warn/.test(m.type()) && !/GPU stall/.test(m.text())) console.log('[console]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => document.querySelector('[data-hero-gl]')?.dataset.drawn === '1', null, { timeout: 30000 }).catch(() => console.log('hero never drew'));
await sleep(5000);
await page.screenshot({ path: out });
console.log('quality', await page.evaluate(() => document.querySelector('[data-hero-gl]')?.dataset.quality || 'full'));
await browser.close();
