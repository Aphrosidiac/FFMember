// capture.mjs — screenshot a site page by page at fixed viewports, after the entrance has
// finished and every scroll-driven reveal has been driven. Run the SAME command against the
// reference and against ours, then compare the folders with diff.py.
//
//   node <skill>/scripts/capture.mjs --base https://reference.example --out docs/reference/2026-09-24/shots \
//        --paths /,/about,/work --sizes 1440x900,390x844 \
//        [--wait 3000] [--ready "!document.querySelector('.preloader')"] \
//        [--init "sessionStorage.setItem('intro','1')"] [--scroll wheel|native] \
//        [--mid 0.35,0.7] [--step 0.6] [--no-full] [--seed 1234567|off]
//
// Per path and width it writes: <slug>-top-<w>.png, <slug>-mid35-<w>.png, <slug>-mid70-<w>.png,
// <slug>-full-<w>.png. Mid-scroll viewports matter: pinned sections, parallax, rails and
// counters only exist there, and a full-page shot of a pinned page is meaningless.
//
// RULES LEARNED THE HARD WAY
// - Run captures ONE AT A TIME. Two headless browsers starving each other stretch GSAP's
//   clock and every timeline lands mid-flight — the diff then blames the build.
// - Bypass or wait out the intro/preloader (--ready / --init). The boot animation is not
//   the page; capture it separately with states.mjs if it matters.
// - Keep the seed on unless randomness IS the thing being checked.
// - Output folders are large (EthanClone reached 1.1 GB and had to be purged from history):
//   git-ignore docs/reference/*/shots and docs/qa/shots before the first commit.
import fs from 'node:fs';
import { launch, context, settle, scrollTo, sleep, size, slug, watchErrors, args as parse } from './browser.mjs';

const a = parse(process.argv.slice(2), {
  base: '', out: '', paths: '/', sizes: '1440x900,390x844', wait: '3000', ready: '', init: '',
  scroll: 'native', mid: '0.35,0.7', step: '0.6', seed: '1234567',
});
if (!a.base || !a.out) { console.error('need --base and --out'); process.exit(2); }
const base = a.base.replace(/\/$/, '');
const paths = a.paths.split(',').filter(Boolean);
const mids = a.mid ? a.mid.split(',').map(Number).filter((n) => n > 0 && n < 1) : [];
fs.mkdirSync(a.out, { recursive: true });

const browser = await launch();
const report = [];
for (const [w, h] of a.sizes.split(',').map(size)) {
  const ctx = await context(browser, { w, h, seed: a.seed === 'off' ? null : +a.seed, init: a.init });
  const mode = w < 700 ? 'native' : a.scroll;
  for (const p of paths) {
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    const s = slug(p);
    try {
      const res = await page.goto(base + p, { waitUntil: 'load', timeout: 90000 });
      const status = res ? res.status() : 0;
      if (status >= 400) console.log(`  HTTP ${status} on ${p} — capturing anyway; a 404 page is not the page`);
      await settle(page, { ready: a.ready, wait: +a.wait });
      await page.screenshot({ path: `${a.out}/${s}-top-${w}.png` });

      // Drive every reveal: step through the whole height with a dwell at each stop.
      const total = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      let y = 0;
      const stride = Math.max(200, Math.round(h * +a.step));
      while (y < total - h) { const next = Math.min(total - h, y + stride); await scrollTo(page, next, { mode, from: y, w, h }); y = next; await sleep(180); }
      await sleep(800);

      for (const f of mids) {
        const target = Math.round((total - h) * f);
        await scrollTo(page, target, { mode, from: y, w, h }); y = target;
        await sleep(1500);
        await page.screenshot({ path: `${a.out}/${s}-mid${Math.round(f * 100)}-${w}.png` });
      }
      await scrollTo(page, 0, { mode, from: y, w, h });
      await sleep(1000);
      if (!a['no-full']) {
        await page.screenshot({ path: `${a.out}/${s}-full-${w}.png`, fullPage: true })
          .catch((e) => console.log('  full-page failed', p, e.message.split('\n')[0]));
      }
      const vis = await page.evaluate(() => document.visibilityState);
      report.push({ path: p, w, status, height: total, visibility: vis, errors: errors.slice(0, 5) });
      console.log(`captured ${p} @${w}  height ${total}${errors.length ? `  (${errors.length} errors)` : ''}`);
    } catch (e) {
      console.log('FAILED', p, w, e.message.split('\n')[0]);
      report.push({ path: p, w, failed: e.message.split('\n')[0] });
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${a.out}/capture.json`, JSON.stringify({ base, at: new Date().toISOString(), args: a, report }, null, 1));
