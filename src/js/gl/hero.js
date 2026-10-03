// Hero: the member card hovers over a chrome plinth in a dark stone room. The stone wall is drawn
// in a shader (layered noise, lit from above), a band of mist sits on the horizon, and the floor is
// a dark mirror. The card turns slowly, leans towards the pointer and tips away on scroll.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { gsap, ScrollTrigger, reduced, coarse } from '../motion.js';
import { makeRenderer, fit, runWhileVisible } from './stage.js';
import { makeCard, softboxEnvironment } from './card.js';

const FLOOR_Y = -1.36;

// Shared GLSL noise: value noise with a smooth fade, summed into fractal octaves.
const NOISE = /* glsl */ `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = r * p * 2.03 + 3.1; a *= 0.5; }
    return v;
  }
`;

const passVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// Stone wall: a rock height field (fractal noise), shaded by its own slope against a light from
// above — relief rather than veins. A pool of light behind the card, darker towards the base.
const wallFrag = /* glsl */ `
  uniform float uTime;
  uniform vec2 uAspect;
  varying vec2 vUv;
  ${NOISE}
  float height(vec2 p) { return fbm(p) + 0.45 * fbm(p * 3.1 + 11.0) + 0.12 * noise(p * 22.0); }
  void main() {
    vec2 p = vUv * uAspect * 2.2 + vec2(0.0, uTime * 0.002);
    float e = 0.004;
    float h = height(p);
    vec2 g = vec2(height(p + vec2(e, 0.0)) - h, height(p + vec2(0.0, e)) - h) / e;
    vec3 n = normalize(vec3(-g * 0.06, 1.0));
    vec3 L = normalize(vec3(-0.25, 0.85, 0.55));
    float lit = max(dot(n, L), 0.0);
    float cavity = smoothstep(0.25, 0.9, h);
    vec2 c = vUv - vec2(0.5, 0.6);
    float pool = exp(-dot(c * vec2(1.0, 1.5), c * vec2(1.0, 1.5)) * 3.0);
    float lift = smoothstep(0.02, 0.6, vUv.y);
    float v = pow(lit, 2.2) * (0.25 + 0.75 * cavity);
    vec3 col = vec3(0.86, 0.86, 0.84) * v * (0.01 + 0.16 * pool) * (0.2 + 0.8 * lift);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// Mist: a soft band hugging the horizon line, drifting slowly sideways, brightest at its base.
const mistFrag = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vec2(vUv.x * 6.0 + uTime * 0.03, vUv.y * 2.0);
    float n = fbm(p) * 0.7 + fbm(p * 2.3 - uTime * 0.02) * 0.5;
    float band = smoothstep(0.08, 0.2, vUv.y) * (1.0 - smoothstep(0.2, 0.9, vUv.y));
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float a = band * edge * smoothstep(0.3, 0.9, n) * uOpacity;
    gl_FragColor = vec4(vec3(1.0, 0.99, 0.96) * 2.2, a);
    #include <colorspace_fragment>
  }
`;

export async function initHero(canvas) {
  RectAreaLightUniformsLib.init();
  const renderer = makeRenderer(canvas, { alpha: false, clear: 0x0b0b0a, maxDpr: 2 });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b0a);
  scene.environment = softboxEnvironment(renderer);
  scene.environmentIntensity = 1;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const camBase = new THREE.Vector3(0, 0.55, 8.4);
  camera.position.copy(camBase);

  // stone wall behind everything, sized in layout() to overfill the frustum
  const wallUniforms = { uTime: { value: 0 }, uAspect: { value: new THREE.Vector2(1.6, 1) } };
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    vertexShader: passVert, fragmentShader: wallFrag, uniforms: wallUniforms, depthWrite: false,
  }));
  wall.position.z = -7;
  wall.renderOrder = -1;
  scene.add(wall);

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

  // horizon mist, in front of the wall and behind the plinth
  const mistUniforms = { uTime: { value: 0 }, uOpacity: { value: 0.9 } };
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(34, 2.2), new THREE.ShaderMaterial({
    vertexShader: passVert, fragmentShader: mistFrag, uniforms: mistUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  mist.position.set(0, FLOOR_Y + 0.9, -6.6);
  scene.add(mist);

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

  let cardY = 0.42;
  const layout = () => {
    fit(renderer, camera, canvas);
    const portrait = camera.aspect < 0.9;
    const wide = camera.aspect > 1.85 ? (camera.aspect - 1.85) * 2.2 : 0;
    camBase.set(0, portrait ? 1.2 : 0.95, (portrait ? 12.5 : 8.4) + wide);
    lookAt.y = portrait ? 1.25 : 0.78;
    cardY = portrait ? 0.95 : 0.36;
    // wall overfills the view at its depth, whatever the aspect
    const d = camBase.z - wall.position.z;
    const h = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25;
    wall.scale.set(h * camera.aspect, h, 1);
    wall.position.y = lookAt.y;
    wallUniforms.uAspect.value.set(camera.aspect, 1);
    renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
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
    holder.position.y = cardY + Math.sin(t * 0.9) * 0.04 - (1 - e) * 0.6;
    holder.rotation.y = Math.sin(t * 0.35) * 0.28 + pointer.x * 0.2 - (1 - e) * 1.4 + p * 1.1;
    holder.rotation.x = -0.04 + pointer.y * 0.06 + p * 0.25;
    holder.rotation.z = Math.sin(t * 0.5) * 0.012;
    camera.position.set(camBase.x + pointer.x * 0.25, camBase.y - pointer.y * 0.12 + p * 0.6, camBase.z + (1 - e) * 1.5 + p * 1.2);
    camera.lookAt(lookAt);
    wallUniforms.uTime.value = t;
    mistUniforms.uTime.value = t;
    mistUniforms.uOpacity.value = 0.35 + 0.55 * e;
    renderer.render(scene, camera);
  };
  runWhileVisible(canvas, frame);
  frame(0);
  return { playEnter };
}
