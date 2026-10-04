// Process: the step nearest the middle of the screen is active; the sticky frame wipes up to the
// screenshot that step belongs to.
import { lenis } from './motion.js';

export function initProcess() {
  const steps = [...document.querySelectorAll('[data-process-steps] li')];
  const frames = [...document.querySelectorAll('[data-process-media] .process__frame')];
  const caption = document.querySelector('[data-process-caption]');
  if (!steps.length || !frames.length) return;
  let current = -1;
  const activate = (i) => {
    if (i === current) return;
    current = i;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    const f = Number(steps[i].dataset.frame);
    frames.forEach((fr, k) => {
      fr.classList.toggle('is-active', k === f);
      fr.classList.toggle('is-past', k < f);
    });
    if (caption) caption.textContent = steps[i].dataset.name;
    const count = document.querySelector('[data-covers-count]');
    if (count) count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(steps.length).padStart(2, '0');
  };
  // The active step is the last one whose top has passed a line: the middle of the screen beside the
  // frame, or on a phone (frame stuck above the list) a line just under the frame, so the step it
  // shows is in view. Read on every scroll rather than with a thin observer band, which a fast flick
  // or an anchor jump can skip straight over.
  const media = document.querySelector('[data-process-media]');
  const list = steps[0].parentElement;
  const stacked = matchMedia('(max-width: 960px) and (orientation: portrait), (max-width: 600px)'); // as in home.css
  let line = innerHeight / 2;
  const measure = () => {
    line = innerHeight / 2;
    if (stacked.matches && media) {
      const below = parseFloat(getComputedStyle(media).top) + media.offsetHeight;
      line = below + (innerHeight - below) * 0.25;
    }
  };
  const pick = () => {
    const box = list.getBoundingClientRect();
    if (box.bottom < -innerHeight || box.top > innerHeight * 2) return;
    let i = 0;
    steps.forEach((s, k) => { if (s.getBoundingClientRect().top <= line) i = k; });
    activate(i);
  };
  measure();
  if (lenis) lenis.on('scroll', pick); else addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', () => { measure(); pick(); });
  activate(0);
  pick();
}
