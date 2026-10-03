// dom_capture.mjs — save the HYDRATED DOM of each route, plus every resource the page
// actually loaded. The server HTML of a Nuxt/Next/SPA site is missing everything rendered
// client-side (sliders, project pages that were never prerendered, lazy media), and
// fetch_assets.py can only see what is in the HTML it is given.
//
//   node <skill>/scripts/dom_capture.mjs --base https://reference.example --out docs/reference/<date>/dom \
//        --paths /,/work,/work/some-project [--sizes 1440x900] [--wait 5000] [--ready "..."] [--scroll]
//
// Writes <slug>.html (outerHTML after hydration + settle), <slug>.resources.txt (every URL from
// performance.getEntriesByType('resource') plus <img>/<video>/<source> currentSrc), and
// resources.txt (the union). Feed the union to fetch_assets.py with --urls.
// --scroll steps through the page first so lazy media is requested and lands in the list.
import fs from 'node:fs';
import { launch, context, settle, sleep, size, slug, args as parse } from './browser.mjs';

const a = parse(process.argv.slice(2), { base: '', out: '', paths: '/', sizes: '1440x900', wait: '5000', ready: '', init: '' });
if (!a.base || !a.out) { console.error('need --base and --out'); process.exit(2); }
const base = a.base.replace(/\/$/, '');
fs.mkdirSync(a.out, { recursive: true });
const browser = await launch();
const all = new Set();
for (const [w, h] of a.sizes.split(',').map(size)) {
  const ctx = await context(browser, { w, h, init: a.init });
  for (const p of a.paths.split(',').filter(Boolean)) {
    const page = await ctx.newPage();
    try {
      await page.goto(base + p, { waitUntil: 'networkidle', timeout: 90000 }).catch((e) => console.log('  goto', p, e.message.split('\n')[0]));
      await settle(page, { ready: a.ready, wait: +a.wait });
      if (a.scroll) {
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < total; y += Math.round(h * 0.7)) { await page.evaluate((yy) => scrollTo({ top: yy, behavior: 'instant' }), y); await sleep(250); }
        await sleep(1500);
      }
      const { html, urls } = await page.evaluate(() => {
        const u = new Set(performance.getEntriesByType('resource').map((e) => e.name));
        document.querySelectorAll('img,video,source,audio').forEach((el) => { if (el.currentSrc) u.add(el.currentSrc); if (el.poster) u.add(el.poster); });
        return { html: '<!doctype html>\n' + document.documentElement.outerHTML, urls: [...u].filter((x) => /^https?:/.test(x)) };
      });
      const name = `${slug(p)}${a.sizes.includes(',') ? '-' + w : ''}`;
      fs.writeFileSync(`${a.out}/${name}.html`, html);
      fs.writeFileSync(`${a.out}/${name}.resources.txt`, urls.join('\n') + '\n');
      urls.forEach((x) => all.add(x));
      console.log(`${p} @${w}: ${html.length.toLocaleString()} chars, ${urls.length} resources`);
    } catch (e) { console.log('FAILED', p, e.message.split('\n')[0]); }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${a.out}/resources.txt`, [...all].sort().join('\n') + '\n');
console.log(`union: ${all.size} resources → ${a.out}/resources.txt`);
