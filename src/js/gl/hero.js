// Hero: the member card hovers over a chrome plinth in a dark stone room. The wall is a photoscanned
// rock face (Poly Haven rock_face_03, CC0) displaced into real relief and lit like a set: a raking key
// from above that throws the rock's own shadows, and a cove uplight along its base. The floor is a dark
// mirror. The card turns slowly, leans towards the pointer and tips away on scroll.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { gsap, ScrollTrigger, reduced, coarse } from '../motion.js';
import { makeRenderer, fit, runWhileVisible } from './stage.js';
import { makeCard, softboxEnvironment, CARD_W } from './card.js';

const FLOOR_Y = -1.36;

const ROCK_TILE = 8; // world units per repeat of the scan: big formations, few visible repeats
const WALL = { w: 32, h: 15, z: -7 };

export async function initHero(canvas) {
  RectAreaLightUniformsLib.init();
  const renderer = makeRenderer(canvas, { alpha: false, clear: 0x0b0b0a, maxDpr: 2 });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // two passes: the backdrop (rock wall and its own two lights) is drawn first, then the plinth and
  // card scene on top. Rect-area lights have no falloff, so the plinth's softboxes would otherwise
  // wash the whole wall flat.
  const backdrop = new THREE.Scene();
  backdrop.background = new THREE.Color(0x0b0b0a);
  const scene = new THREE.Scene();
  scene.environment = softboxEnvironment(renderer);
  scene.environmentIntensity = 1;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const camBase = new THREE.Vector3(0, 0.55, 8.4);
  camera.position.copy(camBase);

  // rock wall: one wide displaced sheet standing on the floor, self-shadowed by a raking key light
  const loader = new THREE.TextureLoader();
  const rockTex = (url, srgb) => loader.loadAsync(url).then((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(WALL.w / ROCK_TILE, WALL.h / ROCK_TILE);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const [rockAlbedo, rockNormal, rockData] = await Promise.all([
    rockTex('/hero/rock-albedo.webp', true), rockTex('/hero/rock-normal.webp'), rockTex('/hero/rock-data.webp'),
  ]);
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL.w, WALL.h, coarse ? 192 : 320, coarse ? 90 : 150),
    new THREE.MeshStandardMaterial({
      map: rockAlbedo, normalMap: rockNormal, normalScale: new THREE.Vector2(1.3, 1.3),
      displacementMap: rockData, displacementScale: 0.9, displacementBias: -0.45, // r: height
      roughnessMap: rockData, roughness: 1, metalness: 0, // g: roughness
    }),
  );
  wall.position.set(0, FLOOR_Y - 0.35 + WALL.h / 2, WALL.z);
  wall.castShadow = wall.receiveShadow = true;
  backdrop.add(wall);

  // key: high and close to the wall, so light grazes the relief and every ledge drops a shadow
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // wall and light never move: render the shadow once
  const key = new THREE.SpotLight(0xe9edf1, 72, 0, 0.44, 1, 2);
  key.position.set(0.4, 10.5, WALL.z + 3.4);
  key.target.position.set(0, -0.2, WALL.z);
  key.castShadow = true;
  key.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 3;
  backdrop.add(key, key.target);
  // cove: a long strip at the foot of the wall washing up the rock, so the base glows instead of
  // ending in a hard line against the floor
  const cove = new THREE.RectAreaLight(0xeef0f2, 8, WALL.w, 0.18);
  cove.position.set(0, FLOOR_Y + 0.02, WALL.z + 0.55);
  cove.lookAt(0, FLOOR_Y + 1.6, WALL.z);
  backdrop.add(cove);

  // lights: two soft panels above the plinth for long chrome highlights, a cool rim behind
  const panelA = new THREE.RectAreaLight(0xffffff, 16, 4.5, 0.6);
  panelA.position.set(0, 3.2, 1.6);
  panelA.lookAt(0, -0.6, 0);
  const panelB = new THREE.RectAreaLight(0xf3efe4, 14, 7, 0.8);
  panelB.position.set(0, -0.4, 4.6);
  panelB.lookAt(0, -0.9, 0);
  scene.add(panelA, panelB);
  const rim = new THREE.DirectionalLight(0xdfe6ee, 1.4);
  rim.position.set(-2, 2.5, -4);
  scene.add(rim);

  // plinth: polished chrome block on a darker base, with lit seams between the tiers
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xcfcfcc, metalness: 1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 });
  const smoked = new THREE.MeshPhysicalMaterial({ color: 0x141413, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const top = new THREE.Mesh(new RoundedBoxGeometry(4.6, 0.36, 2.1, 6, 0.03), chrome);
  top.position.set(0, -0.62, 0);
  const base = new THREE.Mesh(new RoundedBoxGeometry(4.5, 0.5, 2.0, 6, 0.02), smoked);
  base.position.set(0, -1.11, 0);
  scene.add(top, base);
  const topMirror = new Reflector(new THREE.PlaneGeometry(4.5, 2.0), {
    textureWidth: coarse ? 512 : 1024, textureHeight: coarse ? 512 : 1024, color: 0x8a8a88, clipBias: 0.002,
  });
  topMirror.rotation.x = -Math.PI / 2;
  topMirror.position.set(0, -0.4385, 0);
  scene.add(topMirror);
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  for (const [y, w] of [[-0.442, 4.56], [-0.803, 4.56], [-1.35, 4.5]]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.007, 0.007), seamMat);
    seam.position.set(0, y, 1.06);
    scene.add(seam);
  }
  // a low riser under the card
  const riser = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.05, 0.6, 3, 0.015), chrome);
  riser.position.set(0, -0.415, 0.1);
  scene.add(riser);

  // floor: a dark mirror, dimmed by a smoked sheet just above it
  const mirror = new Reflector(new THREE.PlaneGeometry(40, 40), {
    textureWidth: coarse ? 512 : 1024, textureHeight: coarse ? 512 : 1024, color: 0x4a4a48, clipBias: 0.003,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = FLOOR_Y;
  scene.add(mirror);
  const smoke = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x0b0b0a, transparent: true, opacity: 0.72, depthWrite: false }));
  smoke.rotation.x = -Math.PI / 2;
  smoke.position.y = FLOOR_Y + 0.004;
  scene.add(smoke);
  // the cove's spill on the floor: a soft band fading from the foot of the wall towards the plinth
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(WALL.w, 3.2), new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float a = pow(vUv.y, 5.0) * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        gl_FragColor = vec4(vec3(0.93, 0.94, 0.95) * 0.28, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, FLOOR_Y + 0.006, WALL.z + 1.6);
  spill.renderOrder = 2; // over the smoked sheet
  scene.add(spill);

  const card = await makeCard({ finish: 'polished' });
  const holder = new THREE.Group();
  holder.add(card);
  holder.scale.setScalar(0.86);
  scene.add(holder);

  const lookAt = new THREE.Vector3(0, -0.55, 0);
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarse) {
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  const out = { p: 0 };
  ScrollTrigger.create({ trigger: canvas.closest('section'), start: 'top top', end: 'bottom top', scrub: true, onUpdate: (s) => (out.p = s.progress) });

  const enter = { v: reduced ? 1 : 0 };
  const playEnter = () => gsap.to(enter, { v: 1, duration: 2.6, ease: 'power3.out' });

  // Adaptive quality: if the first frames come in under ~28 fps, the two mirror passes and the high
  // pixel ratio go, so the entrance and scrolling stay smooth on weak GPUs.
  const samples = [];
  let degraded = false;
  const degrade = () => {
    degraded = true;
    renderer.setPixelRatio(1);
    mirror.visible = false;
    topMirror.visible = false;
    smoke.material.opacity = 0.96;
    canvas.dataset.quality = 'low';
  };

  let cardY = 0.42;
  const layout = () => {
    fit(renderer, camera, canvas);
    const portrait = camera.aspect < 0.9;
    const wide = camera.aspect > 1.85 ? (camera.aspect - 1.85) * 2.2 : 0;
    camBase.set(0, portrait ? 1.2 : 0.95, (portrait ? 12.5 : 8.4) + wide);
    lookAt.y = portrait ? 1.25 : 0.78;
    cardY = portrait ? 0.95 : 0.36;
    if (!degraded) renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  };
  layout();
  addEventListener('resize', layout);
  renderer.shadowMap.needsUpdate = true;

  let t = 0;
  let last = performance.now();
  const frame = (dt) => {
    const now = performance.now();
    if (!degraded && samples.length < 40) {
      samples.push(now - last);
      if (samples.length === 40) {
        const median = [...samples].sort((a, b) => a - b)[20];
        if (median > 36 && !/[?&]hq\b/.test(location.search)) degrade(); // ?hq: keep full quality (captures)
      }
    }
    last = now;
    t += reduced ? 0 : dt;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const e = enter.v;
    const p = out.p;
    holder.position.y = cardY + Math.sin(t * 0.9) * 0.04 - (1 - e) * 0.6;
    holder.rotation.y = Math.sin(t * 0.35) * 0.28 + pointer.x * 0.2 - (1 - e) * 1.4 + p * 1.1;
    holder.rotation.x = -0.04 + pointer.y * 0.06 + p * 0.25;
    holder.rotation.z = Math.sin(t * 0.5) * 0.012;
    camera.position.set(camBase.x + pointer.x * 0.25, camBase.y - pointer.y * 0.12 + p * 0.6, camBase.z + (1 - e) * 1.5 + p * 1.2);
    camera.lookAt(lookAt);
    renderer.autoClear = true;
    renderer.render(backdrop, camera);
    renderer.autoClear = false;
    renderer.render(scene, camera);
    if (!canvas.dataset.drawn) canvas.dataset.drawn = '1';
  };
  runWhileVisible(canvas, frame);
  frame(0);

  // The intro hands its card to this one: skip the entrance, let two frames draw the card at rest,
  // then report where it sits on screen (centre and projected width, in CSS px).
  const placeCard = () => new Promise((resolve) => {
    gsap.killTweensOf(enter);
    enter.v = 1;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      holder.updateMatrixWorld(true);
      const r = canvas.getBoundingClientRect();
      const at = (x) => {
        const v = new THREE.Vector3(x, 0, 0).applyMatrix4(card.matrixWorld).project(camera);
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      };
      const l = at(-CARD_W / 2);
      const c = at(0);
      const rr = at(CARD_W / 2);
      resolve({ x: c.x, y: c.y, w: Math.hypot(rr.x - l.x, rr.y - l.y), tilt: Math.atan2(rr.y - l.y, rr.x - l.x) });
    }));
  });
  return { playEnter, placeCard };
}
