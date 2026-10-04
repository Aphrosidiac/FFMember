// browser.mjs — shared headless launcher for capture.mjs, states.mjs, dom_capture.mjs, tokens.mjs.
//
// Headless Chromium is the default instrument for this skill: rAF runs, timers are not
// clamped, and nothing depends on a window being in front. The Browser pane and an occluded
// Chrome tab both report visibilityState "hidden" and photograph scroll-animated pages as
// blank — headless sidesteps that entirely.
//
// Playwright is resolved from the PROJECT (process.cwd()), not from this skill folder, so run
// these scripts from the repo root after `npm i -D playwright`. If the project has no
// playwright, the cached browsers under ~/Library/Caches/ms-playwright still need a client
// library — install it; do not vendor one into the skill.
import { createRequire } from 'node:module';
import path from 'node:path';

const req = createRequire(path.join(process.cwd(), 'noop.js'));
let pw;
try { pw = req('playwright'); } catch {
  try { pw = req('@playwright/test'); } catch {
    console.error('playwright not found in this project. Run: npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export async function launch() {
  return pw.chromium.launch({
    headless: true,
    // WebGL via SwiftShader so three.js / R3F / shader sites render; autoplay so hero films play.
    args: [...(process.env.GPU ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
      '--autoplay-policy=no-user-gesture-required'],
  });
}

// Parse "1440x900" -> [1440, 900].
export const size = (s) => s.split('x').map(Number);

// A context that emulates a phone below 700px (viewport emulation, not a narrow window —
// headless clamps --window-size below ~400px and crops the capture), seeds Math.random so
// shuffled/random content matches between the reference and ours, and runs an optional
// init snippet (e.g. set the sessionStorage flag that skips an intro).
export async function context(browser, { w, h, seed = 1234567, init = '', reducedMotion = 'no-preference' }) {
  const mobile = w < 700;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion,
    isMobile: mobile, hasTouch: mobile, ...(mobile ? { userAgent: IPHONE_UA } : {}),
  });
  if (seed !== null && seed !== undefined) {
    await ctx.addInitScript((s0) => {
      let s = s0;
      Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    }, seed);
  }
  if (init) await ctx.addInitScript({ content: init });
  return ctx;
}

// Collect console errors and page errors — a capture of a page that threw is not evidence.
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

// Wait for the page to be "arrived": an optional JS predicate (preloader gone, ready class
// set), then a fixed settle for the entrance animation.
export async function settle(page, { ready = '', wait = 3000 } = {}) {
  if (ready) await page.waitForFunction(ready, null, { timeout: 20000 }).catch(() => console.log('  ready predicate timed out'));
  await sleep(wait);
}

// Hover/click by bounding box. Playwright's actionability checks stall on pages whose sections
// are re-transformed every frame by a custom smooth scroll (Lenis, Locomotive, bespoke).
export async function center(page, sel) {
  const b = await page.locator(sel).first().boundingBox({ timeout: 8000 });
  if (!b) throw new Error('no box for ' + sel);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
export async function hover(page, sel) { const p = await center(page, sel); await page.mouse.move(p.x, p.y, { steps: 4 }); }
export async function click(page, sel) { const p = await center(page, sel); await page.mouse.move(p.x, p.y, { steps: 4 }); await page.mouse.click(p.x, p.y); }

// Scroll in a way both native and smooth-scrolled pages accept. 'wheel' goes through the
// site's own scroll handler (required for Lenis/Locomotive/virtual-scroll sites); 'native'
// jumps with behavior:'instant' (html{scroll-behavior:smooth} turns a plain scrollTo into an
// animation). Phones get native — there is no wheel on a touch device.
export async function scrollTo(page, y, { mode = 'native', from = 0, w = 1440, h = 900 } = {}) {
  if (mode === 'wheel') {
    await page.mouse.move(w / 2, h / 2);
    let d = y - from;
    while (Math.abs(d) > 0) { const s = Math.sign(d) * Math.min(600, Math.abs(d)); await page.mouse.wheel(0, s); d -= s; await sleep(60); }
  } else {
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'instant' }), y);
  }
}

export const slug = (p) => (p === '/' || p === '' ? 'index' : p.replace(/^\//, '').replace(/[/?#=&]+/g, '_'));

// Minimal --flag value parser.
export function args(argv, defaults) {
  const out = { ...defaults, _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2); const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) out[k] = true; else { out[k] = v; i++; }
    } else out._.push(a);
  }
  return out;
}
