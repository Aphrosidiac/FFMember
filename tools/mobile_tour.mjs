// mobile_tour.mjs — a phone walk of every page at a real visible height (390 × 700, Safari's
// viewport with its bars showing). Steps down each page half a screen at a time and photographs
// every stop, then the menu, both dialogs and the FAQ; prints overflow and console errors.
//   node tools/mobile_tour.mjs <base> <outDir> [--engine webkit|chromium] [--size 390x700] [--step 0.5]
//   [--only home,studio,...]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { args, sleep } from './browser.mjs';

const req = createRequire(path.join(process.cwd(), 'noop.js'));
const pw = req('playwright');
const a = args(process.argv.slice(2), { engine: 'webkit', size: '390x700', step: '0.5', only: '' });
const [base, out] = a._;
const [w, h] = a.size.split('x').map(Number);
fs.mkdirSync(out, { recursive: true });

const browser = await pw[a.engine].launch({ headless: true });
const ctx = await browser.newContext({
  ...pw.devices['iPhone 13'],
  viewport: { width: w, height: h },
  screen: { width: w, height: h + 144 },
  deviceScaleFactor: 2,
});
await ctx.addInitScript(() => { try { sessionStorage.setItem('ff-member-intro', '1'); } catch (e) {} });

const overflow = () => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || r.right <= vw + 1) continue;
    let p = el.parentElement, scroller = false;
    while (p) { const s = getComputedStyle(p); if (/auto|scroll|hidden|clip/.test(s.overflowX) && p !== document.body && p !== document.documentElement) { scroller = true; break; } p = p.parentElement; }
    if (!scroller) bad.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(r.right)}`);
  }
  return { scrollWidth: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 12) };
};

const setY = (page, y) => page.evaluate((yy) => { window.scrollTo({ top: yy, behavior: 'instant' }); }, y);

async function tour(name, url, { extra } = {}) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(base + url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector('.intro'), null, { timeout: 20000 }).catch(() => errors.push('intro still up after 20 s'));
  await sleep(2600);
  const dir = path.join(out, name);
  fs.mkdirSync(dir, { recursive: true });
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const stride = Math.round(h * Number(a.step));
  let i = 0;
  for (let y = 0; y < total - h + stride; y += stride) {
    await setY(page, Math.min(y, total - h));
    await sleep(y === 0 ? 400 : 1400);
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(3, '0')}_${y}.png`) });
    i++;
  }
  const o = await page.evaluate(overflow);
  console.log(`\n== ${name} (${url}) height ${total}px, ${i} stops, scrollWidth ${o.scrollWidth}/${o.vw}`);
  if (o.bad.length) console.log('  overflow:', o.bad.join(' | '));
  if (extra) await extra(page, dir).catch((e) => console.log('  extra failed:', e.message));
  for (const e of [...new Set(errors)]) console.log('  ' + e);
  await page.close();
}

const tap = async (page, sel) => {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    const r = el.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 20) window.scrollTo({ top: scrollY + r.top - innerHeight / 2, behavior: 'instant' });
  }, sel);
  await sleep(700);
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('no box ' + sel);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
};

const homeExtra = async (page, dir) => {
  await setY(page, 0); await sleep(900);
  await tap(page, '[data-burger]'); await sleep(1100);
  await page.screenshot({ path: path.join(dir, 'x_menu.png') });
  await tap(page, '[data-burger]'); await sleep(900);
  await tap(page, '.hero__foot [data-join]'); await sleep(1100);
  await page.screenshot({ path: path.join(dir, 'x_join.png') });
  await page.evaluate(() => { const p = document.querySelector('#join .modal__panel'); p.scrollTop = p.scrollHeight; });
  await sleep(300);
  await page.screenshot({ path: path.join(dir, 'x_join_end.png') });
  await tap(page, '#join [type=submit]'); await sleep(500);
  await page.screenshot({ path: path.join(dir, 'x_join_errors.png') });
  await tap(page, '#join .modal__close'); await sleep(900);
  const plansY = await page.evaluate(() => document.querySelector('#plans').getBoundingClientRect().top + scrollY);
  await setY(page, plansY + 300); await sleep(1200);
  await tap(page, '[data-plan-detail="maintain"]'); await sleep(1100);
  await page.screenshot({ path: path.join(dir, 'x_plan.png') });
  await tap(page, '#plan-detail .modal__close'); await sleep(900);
  const faqY = await page.evaluate(() => document.querySelector('#faq').getBoundingClientRect().top + scrollY);
  await setY(page, faqY + 200); await sleep(1200);
  await tap(page, '#faq-3-q'); await sleep(900);
  await page.screenshot({ path: path.join(dir, 'x_faq_open.png') });
};

const pages = [
  ['home', '/', { extra: homeExtra }],
  ['studio', '/studio/'],
  ['terms', '/legal/terms/'],
  ['privacy', '/legal/privacy/'],
  ['404', '/404.html'],
];
const only = a.only ? a.only.split(',') : null;
for (const [name, url, opts] of pages) if (!only || only.includes(name)) await tour(name, url, opts);
await browser.close();
