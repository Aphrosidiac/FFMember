// check.mjs — functional pass over FF Member in headless Chromium. Prints PASS/FAIL per check and
// exits non-zero on any failure.
//
//   node tools/check.mjs --base http://localhost:3180
import { launch, context, sleep } from './browser.mjs';

const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3180';
const PAGES = ['/', '/studio/', '/legal/terms/', '/legal/privacy/', '/404.html'];
const WIDTHS = [320, 375, 390, 768, 1024, 1440, 1920];
const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const skipIntro = "sessionStorage.setItem('ff-member-intro','1')";

const browser = await launch();

// 1. every page, every width: no errors, no horizontal overflow
for (const path of PAGES) {
  for (const w of WIDTHS) {
    const ctx = await context(browser, { w, h: w < 700 ? 844 : 900, init: skipIntro });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const res = await page.goto(base + path, { waitUntil: 'load' });
    await sleep(1800);
    const over = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')].filter((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || getComputedStyle(el).position === 'fixed') return false;
        let p = el.parentElement;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'clip' || o === 'hidden' || o === 'auto') return false; p = p.parentElement; }
        return r.right > W + 1 || r.left < -1;
      }).slice(0, 3).map((el) => el.className || el.tagName);
      return { sw: document.documentElement.scrollWidth, W, wide };
    });
    ok(`${path} @${w} status`, res.status() === 200, String(res.status()));
    ok(`${path} @${w} no errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    ok(`${path} @${w} no horizontal overflow`, over.sw <= over.W && over.wide.length === 0, `${over.sw}/${over.W} ${over.wide.join(',')}`);
    await ctx.close();
  }
}

// 2. internal links resolve
{
  const ctx = await context(browser, { w: 1440, h: 900, init: skipIntro });
  const page = await ctx.newPage();
  const hrefs = new Set();
  const local = new Set();
  for (const p of PAGES) {
    await page.goto(base + p, { waitUntil: 'load' });
    for (const h of await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))) {
      hrefs.add(h);
      if (h.startsWith('#')) local.add(p + h); // in-page anchors resolve against their own page
    }
  }
  for (const h of [...[...hrefs].filter((h) => h.startsWith('/')), ...local]) {
    const [path, hash] = h.split('#');
    const r = await page.goto(base + path, { waitUntil: 'load' });
    let anchor = true;
    if (hash && hash !== 'top') anchor = (await page.$(`#${hash}`)) !== null;
    if (hash === 'top') anchor = (await page.$('#top')) !== null || path === '/' ;
    ok(`link ${h}`, r.status() === 200 && anchor, `${r.status()}${anchor ? '' : ' missing #' + hash}`);
  }
  const ext = [...hrefs].filter((h) => /^(https?:|mailto:|tel:)/.test(h));
  ok('external links are FF-owned or contact', ext.every((h) => /ffdev\.studio|lewix\.ai|smoothsail\.my|ff-sunlight\.pages\.dev|^mailto:hello@ffdev\.studio|^tel:\+60139078719/.test(h)), ext.join(' '));
  await ctx.close();
}

// 3. home interactions
{
  const ctx = await context(browser, { w: 1440, h: 900, init: skipIntro });
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (r) => { if (!r.url().startsWith(base)) requests.push(r.url()); });
  await page.goto(base + '/', { waitUntil: 'load' });
  await sleep(2500);

  // billing toggle
  await page.click('label:has([data-billing][value="year"])');
  await page.waitForFunction(() => document.querySelector('[data-price]').textContent === '590', null, { timeout: 8000 }).catch(() => {});
  await sleep(1500);
  const yearly = await page.$$eval('[data-price]', (els) => els.map((e) => e.textContent));
  ok('yearly prices', yearly.join(',') === '590,1,490,2,990', yearly.join(' / '));
  const per = await page.$eval('[data-per]', (e) => e.textContent);
  ok('yearly period label', per === '/ year', per);
  await page.click('label:has([data-billing][value="month"])');
  await sleep(2500);
  const monthly = await page.$$eval('[data-price]', (els) => els.map((e) => e.textContent));
  ok('monthly prices', monthly.join(',') === '59,149,299', monthly.join(' / '));

  // plan detail modal
  await page.click('[data-plan-detail="maintain"]');
  await sleep(700);
  const fee = await page.evaluate(() => ({
    open: document.querySelector('[data-modal="plan"]').classList.contains('is-open'),
    name: document.querySelector('[data-plan-name]').textContent,
    m: document.querySelector('[data-fee-month]').textContent,
    y: document.querySelector('[data-fee-year]').textContent,
    s: document.querySelector('[data-fee-save]').textContent,
    items: document.querySelectorAll('[data-plan-list] li').length,
  }));
  ok('plan modal: Maintain fees', fee.open && fee.name === 'Maintain' && fee.m === 'RM149 / month' && fee.y === 'RM1,490 / year' && fee.s === 'RM298' && fee.items === 4, JSON.stringify(fee));
  await page.keyboard.press('Escape');
  await sleep(700);
  const afterEsc = await page.evaluate(() => ({ open: !!document.querySelector('.modal.is-open'), focus: document.activeElement?.getAttribute('data-plan-detail') }));
  ok('plan modal: Escape closes and returns focus', !afterEsc.open && afterEsc.focus === 'maintain', JSON.stringify(afterEsc));

  // plan → join hand-off
  await page.click('[data-plan-detail="evolve"]');
  await sleep(600);
  await page.click('[data-plan-join]');
  await sleep(700);
  const handoff = await page.evaluate(() => ({ join: document.querySelector('[data-modal="join"]').classList.contains('is-open'), plan: document.querySelector('#j-plan').value }));
  ok('plan modal → join form carries the plan', handoff.join && handoff.plan === 'evolve', JSON.stringify(handoff));
  await page.keyboard.press('Escape');
  await sleep(700);

  // join form: empty submit
  await page.click('.nav__cta');
  await sleep(700);
  await page.selectOption('#j-plan', '');
  await page.click('[data-join-form] button[type="submit"]');
  await sleep(200);
  const empty = await page.evaluate(() => ({
    errs: [...document.querySelectorAll('[data-join-form] .field__error')].map((e) => e.textContent).filter(Boolean).length,
    consent: document.querySelector('[data-consent-error]').textContent,
    focus: document.activeElement?.id,
    step: document.querySelector('[data-step="done"]').hidden,
  }));
  ok('join: empty submit shows errors and focuses first', empty.errs >= 3 && empty.consent && empty.focus === 'j-name' && empty.step, JSON.stringify(empty));

  // hostile / invalid input
  await page.fill('#j-name', '<img src=x onerror=alert(1)>');
  await page.fill('#j-email', 'not-an-email');
  await page.fill('#j-site', 'javascript:alert(1)');
  await page.click('[data-join-form] button[type="submit"]');
  await sleep(200);
  const bad = await page.evaluate(() => ({
    email: document.querySelector('#j-email').closest('.field').querySelector('.field__error').textContent,
    site: document.querySelector('#j-site').closest('.field').querySelector('.field__error').textContent,
  }));
  ok('join: invalid email and site refused', !!bad.email && !!bad.site, JSON.stringify(bad));

  // valid
  await page.fill('#j-email', 'person@example.com');
  await page.fill('#j-site', 'example.com');
  await page.selectOption('#j-plan', 'maintain');
  await page.check('[name="period"][value="yearly"]', { force: true });
  await page.fill('#j-note', 'Line one\nLine two & more');
  await page.check('[name="consent"]', { force: true });
  await page.click('[data-join-form] button[type="submit"]');
  await sleep(400);
  const done = await page.evaluate(() => ({
    shown: !document.querySelector('[data-step="done"]').hidden,
    rows: [...document.querySelectorAll('[data-summary] div')].map((d) => d.textContent),
    href: document.querySelector('[data-mailto]').getAttribute('href'),
    injected: !!document.querySelector('[data-summary] img'),
    focus: document.activeElement?.hasAttribute('data-done-title'),
  }));
  const decoded = decodeURIComponent(done.href);
  ok('join: success step with summary', done.shown && done.rows.length === 6 && done.focus, done.rows.join(' | '));
  ok('join: hostile name rendered as text', !done.injected);
  ok('join: email draft to hello@ffdev.studio with plan and yearly price', done.href.startsWith('mailto:hello@ffdev.studio?subject=') && decoded.includes('Maintain · RM1,490 / year') && decoded.includes('Billing: Yearly'), decoded.slice(0, 160));
  await page.click('[data-back]');
  await sleep(200);
  ok('join: edit details returns to the form', await page.evaluate(() => !document.querySelector('[data-step="form"]').hidden && document.activeElement?.id === 'j-name'));
  await page.click('.modal.is-open [data-close].modal__close');
  await sleep(700);
  ok('join: close button closes', await page.evaluate(() => !document.querySelector('.modal.is-open')));

  // focus trap
  await page.click('.nav__cta');
  await sleep(700);
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  ok('join: focus stays inside the dialog', await page.evaluate(() => !!document.activeElement?.closest('[data-modal="join"]')));
  await page.keyboard.press('Escape');
  await sleep(700);

  // FAQ: one open at a time
  await page.evaluate(() => document.querySelector('#faq').scrollIntoView());
  await sleep(800);
  await page.click('#faq-1-q');
  await sleep(900);
  await page.click('#faq-3-q');
  await sleep(900);
  const faq = await page.evaluate(() => ({
    one: document.querySelector('#faq-1-q').getAttribute('aria-expanded'),
    three: document.querySelector('#faq-3-q').getAttribute('aria-expanded'),
    oneHidden: document.querySelector('#faq-1').hidden,
    threeHidden: document.querySelector('#faq-3').hidden,
    h: document.querySelector('#faq-3').getBoundingClientRect().height,
  }));
  ok('faq: opening one closes the other', faq.one === 'false' && faq.three === 'true' && faq.oneHidden && !faq.threeHidden && faq.h > 20, JSON.stringify(faq));

  ok('home: no third-party requests', requests.length === 0, requests.slice(0, 3).join(' '));
  await ctx.close();
}

// 4. phone menu
{
  const ctx = await context(browser, { w: 390, h: 844, init: skipIntro });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await sleep(2000);
  await page.click('[data-burger]');
  await sleep(900);
  const m = await page.evaluate(() => ({ open: document.documentElement.classList.contains('menu-open'), exp: document.querySelector('[data-burger]').getAttribute('aria-expanded'), inert: document.querySelector('[data-menu]').inert, focus: document.activeElement?.textContent?.trim() }));
  ok('menu: opens, not inert, focus on first link', m.open && m.exp === 'true' && !m.inert && /^Plans/.test(m.focus || ''), JSON.stringify(m));
  await page.click('[data-menu] a[href="/#plans"]');
  await sleep(2500);
  const after = await page.evaluate(() => ({ open: document.documentElement.classList.contains('menu-open'), top: Math.round(document.querySelector('#plans').getBoundingClientRect().top) }));
  ok('menu: link closes menu and scrolls to plans', !after.open && Math.abs(after.top) < 120, JSON.stringify(after));
  await ctx.close();
}

// 5. reduced motion: nothing left invisible
{
  const ctx = await context(browser, { w: 1440, h: 900, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await sleep(1500);
  const r = await page.evaluate(() => ({
    intro: !!document.querySelector('.intro') && getComputedStyle(document.querySelector('.intro')).display !== 'none',
    hidden: [...document.querySelectorAll('h1, h2, h3, p, .btn')].filter((el) => {
      let e = el; while (e) { if (parseFloat(getComputedStyle(e).opacity) < 0.05) return true; e = e.parentElement; } return false;
    }).filter((el) => !el.closest('.modal, .menu, .tube__words, [data-globe-b]')).map((el) => el.textContent.trim().slice(0, 30)),
    lenis: document.documentElement.classList.contains('lenis'),
  }));
  ok('reduced motion: no intro, no smooth scroll', !r.intro && !r.lenis, JSON.stringify({ intro: r.intro, lenis: r.lenis }));
  ok('reduced motion: no text left invisible', r.hidden.length === 0, r.hidden.slice(0, 5).join(' | '));
  await ctx.close();
}

// 6. first visit plays the intro, then removes it
{
  const ctx = await context(browser, { w: 1440, h: 900 });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  await sleep(500);
  const during = await page.evaluate(() => !!document.querySelector('.intro'));
  await page.waitForFunction(() => !document.querySelector('.intro'), null, { timeout: 30000 }).catch(() => {});
  // headless software GL is several times slower than a real GPU; let the entrance finish
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.nav')).opacity === '1', null, { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  const after = await page.evaluate(() => ({ gone: !document.querySelector('.intro'), seen: sessionStorage.getItem('ff-member-intro'), navOpacity: getComputedStyle(document.querySelector('.nav')).opacity, title: getComputedStyle(document.querySelector('.hero__line')).opacity }));
  ok('intro: plays on first visit and is removed', during && after.gone && after.seen === '1' && Number(after.navOpacity) >= 0.99 && Number(after.title) >= 0.99, JSON.stringify(after));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
