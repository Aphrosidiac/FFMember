// Hero: the member card hovers over a dark lacquered plinth, turning slowly, leaning towards the
// pointer, and tipping away as the hero scrolls out.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gsap, ScrollTrigger, reduced, coarse } from '../motion.js';
import { makeRenderer, fit, runWhileVisible } from './stage.js';
import { makeCard, studioEnvironment } from './card.js';

export async function initHero(canvas) {
  const renderer = makeRenderer(canvas, { alpha: true, maxDpr: 1.75 });
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.55;
  scene.fog = new THREE.Fog(0x0b0b0a, 9, 18);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const camBase = new THREE.Vector3(0, 0.55, 8.4);
  camera.position.copy(camBase);

  // light: a cool key from above-left, a warm-neutral rim from behind
  const key = new THREE.SpotLight(0xffffff, 60, 20, Math.PI / 10, 0.7, 1.4);
  key.position.set(-1.6, 6.5, 1.2);
  key.target.position.set(0, 0.2, 0);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xf3efe4, 1.6);
  rim.position.set(1.5, 2, -4);
  scene.add(rim);

  // plinth
  const plinthMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0a09, metalness: 0.5, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(4.2, 0.62, 1.9, 6, 0.05), plinthMat);
  plinth.position.set(0, -0.92, 0);
  scene.add(plinth);
  const step = new THREE.Mesh(new RoundedBoxGeometry(4.6, 0.12, 2.2, 4, 0.03), plinthMat);
  step.position.set(0, -1.3, 0);
  scene.add(step);
  // a thin lit edge along the plinth top
  const edge = new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: 0xf3efe4, transparent: true, opacity: 0.55 }));
  edge.position.set(0, -0.61, 0.95);
  scene.add(edge);
  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x080807, roughness: 0.85, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.36;
  scene.add(floor);

  const card = await makeCard();
  const holder = new THREE.Group();
  holder.add(card);
  holder.position.set(0, 0.42, 0);
  scene.add(holder);
  // a soft glow on the plinth under the card
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({
    map: radialTexture(), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, -0.6, 0.1);
  scene.add(glow);

  const lookAt = new THREE.Vector3(0, -0.55, 0);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarse) {
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  // scroll-out: progress 0 → 1 as the hero leaves
  const out = { p: 0 };
  ScrollTrigger.create({ trigger: canvas.closest('section'), start: 'top top', end: 'bottom top', scrub: true, onUpdate: (s) => (out.p = s.progress) });

  // entrance
  const enter = { v: reduced ? 1 : 0 };
  const playEnter = () => gsap.to(enter, { v: 1, duration: 2.6, ease: 'power3.out' });

  const layout = () => {
    fit(renderer, camera, canvas);
    // keep the card a sensible share of the frame on tall phones
    const portrait = camera.aspect < 0.9;
    camBase.set(0, portrait ? 0.9 : 0.55, portrait ? 12.5 : 8.4);
    lookAt.y = portrait ? -0.9 : -0.55;
    holder.position.y = portrait ? 1.0 : 0.42;
  };
  layout();
  addEventListener('resize', layout);

  let t = 0;
  const frame = (dt) => {
    t += reduced ? 0 : dt;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const e = enter.v;
    const p = out.p;
    holder.position.y = (camera.aspect < 0.9 ? 1.0 : 0.42) + Math.sin(t * 0.9) * 0.05 - (1 - e) * 0.6;
    holder.rotation.y = Math.sin(t * 0.35) * 0.32 + pointer.x * 0.22 - (1 - e) * 1.4 + p * 1.1;
    holder.rotation.x = -0.06 + pointer.y * 0.08 + p * 0.25;
    holder.rotation.z = Math.sin(t * 0.5) * 0.015;
    card.material.forEach((m) => (m.opacity = 1));
    camera.position.set(camBase.x + pointer.x * 0.25, camBase.y - pointer.y * 0.12 + p * 0.6, camBase.z + (1 - e) * 1.5 + p * 1.2);
    camera.lookAt(lookAt);
    glow.material.opacity = 0.18 + 0.2 * e;
    renderer.render(scene, camera);
  };
  runWhileVisible(canvas, frame);
  frame(0);
  return { playEnter };
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(243,239,228,0.9)');
  g.addColorStop(1, 'rgba(243,239,228,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
