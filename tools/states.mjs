// states.mjs — screenshot interaction states (menu open, hovers, modals, transitions mid-way,
// preloader frames) on the reference and on ours with one scenario file.
//
//   node <skill>/scripts/states.mjs --base https://reference.example --out docs/reference/<date>/states \
//        --file tools/states.scenarios.mjs [--only menu,hover-card] [--init "..."] [--ready "..."]
//
// The scenario file lives in the PROJECT (it is site-specific) and exports an object:
//
//   export default {
//     'menu': { size: '1440x900', async run(t) {
//       await t.go('/about');                       // goto + settle
//       await t.click('.menu-button'); await t.sleep(400); await t.shot('menu-opening-0.4s');
//       await t.sleep(1400); await t.shot('menu-open');
//       await t.hover('.menu a:nth-child(3)'); await t.sleep(1200); await t.shot('menu-hover');
//     } },
//     'm-menu': { size: '390x844', async run(t) { await t.go('/'); await t.page.tap('#menuOpen'); await t.sleep(1600); await t.shot('m-menu'); } },
//   };
//
// `t` gives: page, go(path), shot(name), hover(sel), click(sel), wheel(dy), sleep(ms), base.
// Use the same selectors on both sites — in an exact recreation the class names are 1:1.
// Name shots by time offset ("-0.4s") for mid-transition frames; the diff then compares
// the same instant of the animation, which is the only way to check an easing numerically.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, context, settle, sleep, size, watchErrors, hover, click, args as parse } from './browser.mjs';

const a = parse(process.argv.slice(2), { base: '', out: '', file: '', only: '', init: '', ready: '', wait: '2500', seed: '1234567' });
if (!a.base || !a.out || !a.file) { console.error('need --base, --out and --file'); process.exit(2); }
const base = a.base.replace(/\/$/, '');
const scenarios = (await import(pathToFileURL(path.resolve(a.file)).href)).default;
fs.mkdirSync(a.out, { recursive: true });

const browser = await launch();
const results = {};
const list = a.only ? a.only.split(',') : Object.keys(scenarios);
for (const name of list) {
  const sc = scenarios[name];
  if (!sc) { console.log('no scenario', name); continue; }
  const [w, h] = size(sc.size || '1440x900');
  const ctx = await context(browser, { w, h, seed: a.seed === 'off' ? null : +a.seed, init: sc.init ?? a.init });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  const t = {
    page, base, sleep,
    go: async (p, opts = {}) => { await page.goto(base + p, { waitUntil: 'load', timeout: 90000 }); await settle(page, { ready: opts.ready ?? sc.ready ?? a.ready, wait: opts.wait ?? +a.wait }); },
    shot: (n, opts = {}) => page.screenshot({ path: `${a.out}/${n}.png`, ...opts }),
    hover: (sel) => hover(page, sel),
    click: (sel) => click(page, sel),
    wheel: async (dy) => { await page.mouse.move(w / 2, h / 2); await page.mouse.wheel(0, dy); },
  };
  try { await sc.run(t); results[name] = { ok: true, errors }; console.log('ok  ', name); }
  catch (e) { results[name] = { ok: false, error: e.message.split('\n')[0], errors }; console.log('FAIL', name, e.message.split('\n')[0]); }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${a.out}/states.json`, JSON.stringify(results, null, 1));
