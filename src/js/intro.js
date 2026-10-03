// First visit in a session: the FF mark sharpens in, a progress hairline fills, and the curtain
// lifts into the hero. Later visits (and reduced motion) skip straight to the page.
import { gsap, reduced } from './motion.js';

const KEY = 'ff-member-intro';

export function playIntro() {
  const intro = document.querySelector('.intro');
  const seen = document.documentElement.classList.contains('intro-seen');
  if (!intro || seen || reduced) {
    intro?.remove();
    return Promise.resolve(false);
  }
  try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  const mark = intro.querySelector('.intro__mark');
  const meta = intro.querySelector('.intro__meta');
  const bar = intro.querySelector('.intro__bar i');
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: () => { intro.remove(); } });
    tl.from(mark, { opacity: 0, filter: 'blur(14px)', scale: 0.92, duration: 1.1, ease: 'power3.out' })
      .from(meta, { opacity: 0, y: 12, duration: 0.8, ease: 'power3.out' }, 0.2)
      .to(bar, { scaleX: 1, duration: 1.5, ease: 'power2.inOut' }, 0.2)
      .add(() => resolve(true), '+=0.05')
      .to(mark, { opacity: 0, y: -20, filter: 'blur(8px)', duration: 0.6, ease: 'power2.in' })
      .to(meta, { opacity: 0, duration: 0.4 }, '<')
      .to(intro, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.25');
  });
}
