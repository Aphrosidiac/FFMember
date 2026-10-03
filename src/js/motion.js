// Shared motion setup: GSAP plugins, Lenis smooth scroll wired into ScrollTrigger, and one flag
// every module reads to decide whether to animate at all.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarse = window.matchMedia('(pointer: coarse)').matches;
export let lenis = null;

export function startScroll() {
  if (reduced) {
    document.documentElement.classList.add('no-motion');
    return null;
  }
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, touchMultiplier: 1.4, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  // GSAP's default lag smoothing stays on: when a frame stalls (a WebGL scene compiling on a slow
  // phone), timelines pause through the stall instead of jumping to their end.
  return lenis;
}

// Anchor links go through Lenis so the eased scroll and the pinned sections stay in step.
export function scrollTo(target, opts = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el && target !== 0) return;
  if (lenis) lenis.scrollTo(el ?? 0, { offset: 0, duration: 1.6, ...opts });
  else (el ?? document.body).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

export function lockScroll(on) {
  if (lenis) on ? lenis.stop() : lenis.start();
  document.documentElement.style.overflow = on ? 'hidden' : '';
}

export { gsap, ScrollTrigger, SplitText };
