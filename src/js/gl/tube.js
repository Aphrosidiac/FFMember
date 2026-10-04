// Tube: the camera stands inside a cylinder lined with screenshots of FF's own work. Rows turn in
// alternate directions; scroll lifts the cylinder, speeds the rows and turns the member card one
// full revolution so its back — "a membership card, not a payment card" — passes the reader.
import * as THREE from 'three';
import { gsap, ScrollTrigger, reduced, lenis } from '../motion.js';
import { makeRenderer, fit, runWhileVisible } from './stage.js';
import { makeCard, studioEnvironment } from './card.js';

const WORK = ['hai-awan', 'sunlight-supplies', 'lewix-ai', 'smoothsail', 'big-brain-furniture', 'ascend-peptides', 'lewix-my', 'big-brain-furniture-alt'];

const ROWS = 5;
const COLS = 15;
const RADIUS = 10.4;
const TILE_W = 2.9;
const TILE_H = TILE_W / 1.6;
const ROW_GAP = 2.35;

function plate(c, img) {
  const ctx = c.getContext('2d');
  const r = 26;
  ctx.fillStyle = '#242421';
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, c.height, r);
  ctx.fill();
  if (!img) return;
  const pad = 56;
  const w = c.width - pad * 2;
  const h = c.height - pad * 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, w, h, 12);
  ctx.clip();
  const s = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, pad + (w - img.width * s) / 2, pad, img.width * s, img.height * s);
  ctx.restore();
}

export async function initTube(canvas, { section, copy }) {
  const vignette = section.querySelector('.tube__fade');
  const renderer = makeRenderer(canvas, { alpha: true, maxDpr: 1.5 });
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0b0a, 7, 22);
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.7;

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
  camera.position.set(0, 0, 6.6);

  // Each screenshot sits inset on a graphite plate, as FF shows its work — never full-bleed.
  const textures = WORK.map((slug) => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 800;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const img = new Image();
    img.onload = () => { plate(c, img); t.needsUpdate = true; };
    img.src = `/work/${slug}/tile.jpg`;
    plate(c, null);
    return t;
  });

  // Curved tiles: each is a short arc of the cylinder so it hugs the wall instead of cutting it.
  const arc = TILE_W / RADIUS;
  const tileGeo = new THREE.CylinderGeometry(RADIUS, RADIUS, TILE_H, 12, 1, true, -arc / 2, arc);
  // CylinderGeometry faces outward; flip so the image reads from the inside.
  tileGeo.scale(-1, 1, 1);
  const fade = { value: reduced ? 1 : 0 };
  const tube = new THREE.Group();
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const row = new THREE.Group();
    row.position.y = (r - (ROWS - 1) / 2) * ROW_GAP;
    const offset = r % 2 ? 0.5 : 0;
    for (let c = 0; c < COLS; c++) {
      const mat = new THREE.MeshBasicMaterial({ map: textures[(r * 3 + c) % textures.length], side: THREE.FrontSide, transparent: true, opacity: 0, fog: true, alphaTest: 0.01 });
      mat.color.setScalar(0.82);
      const tile = new THREE.Mesh(tileGeo, mat);
      tile.rotation.y = ((c + offset) / COLS) * Math.PI * 2;
      row.add(tile);
    }
    rows.push({ group: row, dir: r % 2 ? -1 : 1, speed: 0.55 + (r / (ROWS - 1)) * 0.6 });
    tube.add(row);
  }
  scene.add(tube);

  const card = await makeCard();
  const holder = new THREE.Group();
  holder.add(card);
  scene.add(holder);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 4, 5);
  scene.add(key);

  // The card starts edge-on at the centre, so it reads as a thin line rising out of the dark while
  // the stage scrolls in behind the sinking globe, then turns to face the reader.
  const S = { p: 0, cardY: -0.3, cardTurn: -Math.PI * 2.5 };
  if (!reduced) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom bottom', scrub: 1 } });
    tl.to(S, { p: 1, ease: 'none', duration: 1 }, 0)
      .to(fade, { value: 1, duration: 0.14, ease: 'none' }, 0.24)
      .to(S, { cardY: 0.25, duration: 0.3, ease: 'power2.out' }, 0)
      .to(S, { cardTurn: 0, duration: 0.5, ease: 'power1.inOut' }, 0.26)
      .fromTo(copy, { opacity: 0, y: 50, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.12, ease: 'power2.out' }, 0.62);
  } else {
    Object.assign(S, { p: 0.6, cardY: 0.25, cardTurn: 0 });
  }

  // wheel and touch nudge the rows like a flywheel
  let spin = 0;
  if (lenis) lenis.on('scroll', (l) => { if (visible()) spin += l.velocity * 0.0009; });

  const layout = () => {
    fit(renderer, camera, canvas);
    const narrow = camera.aspect < 0.9;
    camera.position.z = narrow ? 7.6 : 6.6;
    camera.fov = narrow ? 58 : 48;
    camera.updateProjectionMatrix();
  };
  layout();
  addEventListener('resize', layout);

  let angle = 0;
  const frame = (dt) => {
    spin *= Math.pow(0.9, dt * 60);
    angle += reduced ? 0 : (0.06 + spin) * dt;
    const p = S.p;
    tube.position.y = -2.4 + p * 4.8;
    for (const [i, r] of rows.entries()) {
      r.group.rotation.y = r.dir * (angle * r.speed + p * (i % 2 ? 1.6 : 0.6));
      for (const t of r.group.children) t.material.opacity = fade.value;
    }
    if (vignette) vignette.style.opacity = String(fade.value);
    holder.position.y = S.cardY + Math.sin(performance.now() / 1100) * 0.04;
    holder.rotation.set(-0.08, S.cardTurn, Math.PI / 2 * 0 + 0.0);
    card.rotation.z = 0;
    renderer.render(scene, camera);
  };
  const loop = runWhileVisible(canvas, frame);
  const visible = () => loop.isVisible();
  frame(0);
  ScrollTrigger.refresh();
}
