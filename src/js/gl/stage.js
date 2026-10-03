// Shared WebGL plumbing: a renderer sized to its canvas, a capped pixel ratio, and a frame loop
// on the GSAP ticker that only runs while the canvas is near the viewport.
import * as THREE from 'three';
import { gsap } from '../motion.js';

export function makeRenderer(canvas, { alpha = true, clear = 0x0b0b0a, maxDpr = 1.75 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  if (!alpha) renderer.setClearColor(clear, 1);
  return renderer;
}

export function fit(renderer, camera, canvas) {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  const size = renderer.getSize(new THREE.Vector2());
  if (size.x === w && size.y === h) return false;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  return true;
}

export function runWhileVisible(el, frame, margin = '200px 0px') {
  let visible = false;
  let last = performance.now();
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }, { rootMargin: margin });
  io.observe(el);
  const tick = () => {
    if (!visible || document.hidden) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    frame(dt, now / 1000);
  };
  gsap.ticker.add(tick);
  return { stop: () => { gsap.ticker.remove(tick); io.disconnect(); }, isVisible: () => visible };
}
