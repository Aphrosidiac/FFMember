// First visit in a session: "issuing your member card". A card like the 3D one rises; its //FF mark
// polishes from etched to chrome as the page really loads (the hero scene is what it waits for),
// while a status line ticks through what membership covers. At 100 a light sweeps the card, then it
// flies onto the plinth, lands where the 3D card sits, and the 3D card takes over as the veil lifts.
// Transforms and opacity only: the WebGL scene is compiling underneath and must not make this stutter.
// Later visits in the session get a quick version that only lasts as long as loading does, so the
// hero is never seen empty while the scene builds. Reduced motion skips straight to the page.
import { gsap, reduced } from './motion.js';

const KEY = 'ff-member-intro';
const COVERS = ['Hosting', 'SSL certificate', 'CDN', 'Backups', 'Uptime monitoring', 'Security updates'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ready: resolves with the hero scene ({ placeCard }) once it has drawn, or with nothing if it failed.
export function playIntro(ready = Promise.resolve(null)) {
  const intro = document.querySelector('.intro');
  const quick = document.documentElement.classList.contains('intro-seen');
  if (!intro || reduced) {
    intro?.remove();
    return Promise.resolve(false);
  }
  try { sessionStorage.setItem(KEY, '1'); } catch (e) {}

  const $ = (s) => intro.querySelector(s);
  const card = $('[data-intro-card]');
  const polish = $('[data-intro-polish]');
  const polishIn = $('[data-intro-polish-in]');
  const bar = $('[data-intro-bar]');
  const count = $('[data-intro-count]');
  const status = $('[data-intro-status]');
  const label = status.querySelector('span');
  const veil = $('.intro__veil');
  const meta = [$('.intro__meta'), $('.intro__bar')];

  const P = { v: 0 };
  let step = -1;
  const say = (text, done) => {
    gsap.to(label, { opacity: 0, y: -6, duration: 0.18, ease: 'power2.in', onComplete: () => {
      label.textContent = text;
      status.classList.toggle('is-done', !!done);
      gsap.fromTo(label, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
    } });
  };
  const render = () => {
    const v = P.v;
    count.textContent = String(Math.round(v * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${v})`;
    polish.style.transform = `translateX(${(v - 1) * 100}%)`;
    polishIn.style.transform = `translateX(${(1 - v) * 100}%)`;
    const s = Math.min(COVERS.length - 1, Math.floor(v * COVERS.length * 0.999));
    if (v > 0.08 && s !== step) { step = s; say(`${COVERS[s]} · ready`, true); }
  };
  render();

  return new Promise((resolve) => {
    let resolved = false;
    const release = () => { if (!resolved) { resolved = true; resolve(true); } };
    const finish = () => { release(); intro.remove(); };
    // Never hold the page: whatever happens, the intro is gone after 9 s.
    const cap = setTimeout(finish, 9000);

    (async () => {
      gsap.fromTo(card, { opacity: 0, y: quick ? 24 : 60, rotateX: quick ? 12 : 28, scale: quick ? 0.97 : 0.94 }, { opacity: 1, y: 0, rotateX: 0, scale: 1, duration: quick ? 0.7 : 1.3, ease: 'expo.out' });
      gsap.from(meta, { opacity: 0, duration: quick ? 0.4 : 0.8, delay: quick ? 0 : 0.2 });
      // fill to 86% on a clock, then the rest only once the hero scene is ready (or 5 s pass)
      const scene = Promise.race([ready, wait(5000).then(() => null)]);
      await gsap.to(P, { v: 0.86, duration: quick ? 0.6 : 1.7, ease: 'power2.out', onUpdate: render });
      // still loading: keep creeping towards 99 so the counter never looks frozen
      let waiting = true;
      const creep = () => { if (!waiting) return; P.v += (0.99 - P.v) * 0.012; render(); requestAnimationFrame(creep); };
      requestAnimationFrame(creep);
      await scene;
      waiting = false;
      await gsap.to(P, { v: 1, duration: quick ? 0.25 : 0.4, ease: 'power2.inOut', onUpdate: render });
      intro.classList.add('is-issued');
      say(quick ? 'Welcome back' : 'Card issued', true);
      await wait(quick ? 300 : 550);

      const hero = await scene;
      const target = hero?.placeCard ? await hero.placeCard().catch(() => null) : null;
      release(); // the hero text starts its entrance under the flight
      gsap.to(meta, { opacity: 0, duration: 0.4 });
      const box = card.getBoundingClientRect();
      const fly = target
        ? { x: target.x - (box.left + box.width / 2), y: target.y - (box.top + box.height / 2), scale: target.w / box.width, rotation: (target.tilt * 180) / Math.PI }
        : { y: 40, scale: 0.85 };
      const tl = gsap.timeline({ onComplete: () => { clearTimeout(cap); finish(); } });
      tl.to(card, { ...fly, duration: 1, ease: 'expo.inOut' }, 0)
        .to(veil, { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, 0.4)
        .to(card, { opacity: 0, duration: target ? 0.3 : 0.5, ease: 'power1.in' }, target ? 0.95 : 0.6);
    })().catch(finish);
  });
}
