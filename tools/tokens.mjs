// tokens.mjs — run extract_tokens.js headlessly across pages and widths, saving the JSON.
// Same numbers as pasting the extractor into a browser tool, without a hidden tab lying about
// the viewport.
//
//   node <skill>/scripts/tokens.mjs --base https://reference.example --out docs/reference/<date>/tokens \
//        --paths /,/pricing,/blog/some-post --sizes 1440x900,390x844 [--wait 3000] [--ready "..."] [--init "..."]
//
// Run it on ours with the same args and diff the JSON (verification.md, Pass 2).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, context, settle, size, slug, args as parse } from './browser.mjs';

const a = parse(process.argv.slice(2), { base: '', out: '', paths: '/', sizes: '1440x900,390x844', wait: '3000', ready: '', init: '' });
if (!a.base || !a.out) { console.error('need --base and --out'); process.exit(2); }
const here = path.dirname(fileURLToPath(import.meta.url));
const script = fs.readFileSync(path.join(here, 'extract_tokens.js'), 'utf8');
const base = a.base.replace(/\/$/, '');
fs.mkdirSync(a.out, { recursive: true });
const browser = await launch();
for (const [w, h] of a.sizes.split(',').map(size)) {
  const ctx = await context(browser, { w, h, init: a.init });
  const page = await ctx.newPage();
  for (const p of a.paths.split(',').filter(Boolean)) {
    try {
      await page.goto(base + p, { waitUntil: 'load', timeout: 90000 });
      await settle(page, { ready: a.ready, wait: +a.wait });
      const res = await page.evaluate(script);
      fs.writeFileSync(`${a.out}/${slug(p)}-${w}.json`, JSON.stringify(res, null, 1));
      const t = res.typography;
      console.log(`${p} @${w}: ${t.sizes.length} sizes, ${res.color.text.length} text colours, top family ${t.families[0]?.value}` +
        (res.meta.viewportSuspect ? `  SUSPECT: ${res.meta.viewportSuspect}` : ''));
    } catch (e) { console.log('FAILED', p, w, e.message.split('\n')[0]); }
  }
  await ctx.close();
}
await browser.close();
