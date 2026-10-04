// Globe: a physically lit planet (day map, city lights on the night side, cloud cover, bumped relief,
// glossier oceans) with a sun high behind it, so the face toward us is night and a dawn crest and a
// thin atmosphere rim run along the top. The section pins for 2.5 viewport heights without spacing:
// the planet turns westward, shrinks and fades while the next section scrolls up underneath.
// Shading follows the three.js TSL earth example (MIT), on WebGPURenderer's WebGL2 backend.
import * as THREE from 'three/webgpu';
import {
  step, normalWorldGeometry, output, texture, vec3, vec4, normalize, positionWorld, bumpMap,
  cameraPosition, color, uniform, mix, uv, max,
} from 'three/tsl';
import { gsap, ScrollTrigger, reduced } from '../motion.js';
import { runWhileVisible } from './stage.js';

const ATMOSPHERE = { day: '#a3afbd', twilight: '#47649e', night: 0.95, reach: 0.635 };
const SUN = new THREE.Vector3(0.26, 1.39, -3);
const GLOBE = { y: -1.32, scale: 1.3, spin: 0.025 };
const ROUGHNESS = [0.25, 0.35];
const PIN = 2.5; // viewport heights

export async function initGlobe(canvas, { section, header, chips }) {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true, forceWebGL: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  await renderer.init();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 100);
  camera.position.set(0, 0.2, 5);

  const sun = new THREE.DirectionalLight('#ffffff', 6);
  sun.position.copy(SUN);
  scene.add(sun);

  const loader = new THREE.TextureLoader();
  const load = (url, srgb) => loader.loadAsync(url).then((t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
  const [dayTex, nightTex, dataTex] = await Promise.all([
    load('/globe/day.webp', true), load('/globe/night.webp', true), load('/globe/data.webp', false),
  ]);

  const u = {
    day: uniform(color(ATMOSPHERE.day)),
    twilight: uniform(color(ATMOSPHERE.twilight)),
    night: uniform(ATMOSPHERE.night),
    reach: uniform(ATMOSPHERE.reach),
    opacity: uniform(1),
  };

  // shared terms: how edge-on the surface is, how much sun it faces, and a mask that keeps the
  // atmosphere to the upper half so the rim reads as a crest, not a ring
  const view = positionWorld.sub(cameraPosition).normalize();
  const fresnel = view.dot(normalWorldGeometry).abs().oneMinus().toVar();
  const facing = normalWorldGeometry.dot(normalize(sun.position)).toVar();
  const air = mix(u.twilight, u.day, facing.smoothstep(-0.25, 0.75));
  const edge = u.reach.mul(2.35).sub(1.5);
  const crest = normalWorldGeometry.y.smoothstep(edge, edge.add(0.3));

  const data = texture(dataTex, uv()); // r relief, g land, b clouds
  const clouds = data.b.smoothstep(0.2, 1);
  const surface = new THREE.MeshStandardNodeMaterial({ transparent: true });
  surface.colorNode = mix(texture(dayTex), vec3(1), clouds.mul(2));
  surface.roughnessNode = max(data.g, step(0.01, clouds)).remap(0, 1, ROUGHNESS[0], ROUGHNESS[1]);
  surface.normalNode = bumpMap(max(data.r, clouds));
  const lit = facing.smoothstep(-0.25, 0.5);
  const haze = facing.smoothstep(-0.5, 1).mul(fresnel.pow(2)).mul(crest).clamp(0, 1);
  const shaded = mix(mix(texture(nightTex).rgb.mul(u.night), output.rgb, lit), air, haze);
  surface.outputNode = vec4(shaded, output.a.mul(u.opacity));

  const sphere = new THREE.SphereGeometry(1, 64, 64);
  const planet = new THREE.Mesh(sphere, surface);

  const glow = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: true });
  glow.outputNode = vec4(air, fresnel.remap(0.73, 1, 1, 0).pow(3).mul(facing.smoothstep(-0.5, 1)).mul(crest).mul(u.opacity));
  const atmosphere = new THREE.Mesh(sphere, glow);
  atmosphere.scale.setScalar(1.04);
  atmosphere.renderOrder = 1;

  const earth = new THREE.Group();
  earth.add(planet, atmosphere);
  earth.position.set(0, GLOBE.y, 0);
  earth.scale.setScalar(GLOBE.scale);
  earth.rotation.y = -Math.PI / 1.4;
  scene.add(earth);

  const size = () => {
    const r = canvas.getBoundingClientRect();
    return [r.width || innerWidth, r.height > 4 ? r.height : innerHeight];
  };
  let last = '';
  const layout = () => {
    const [w, h] = size();
    if (`${w}x${h}` === last) return;
    last = `${w}x${h}`;
    camera.aspect = w / h;
    // a phone on its side: the planet sits lower so it clears the copy above it
    camera.position.y = h < 500 && w / h > 1.3 ? 0.55 : 0.2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  layout();
  new ResizeObserver(layout).observe(canvas);

  // Scroll: one scrubbed timeline across the pin, timeline length 1.
  //   0 → 0.5   the planet turns from -π/1.4 to -π/5, the header lifts out
  //   0 → 0.45  the status chips drop away in random order
  //   0.1 → 1   the planet shrinks to 40% (power2.out)
  //   0.2 → 0.35 the planet fades out
  if (!reduced) {
    const s = GLOBE.scale;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section, start: 'top top', end: () => `+=${PIN * innerHeight}`,
        pin: true, pinSpacing: false, scrub: 1, invalidateOnRefresh: true,
      },
    });
    tl.fromTo(earth.rotation, { y: -Math.PI / 1.4 }, { y: -Math.PI / 5, ease: 'none', duration: 0.5 }, 0);
    tl.fromTo(earth.scale, { x: s, y: s, z: s }, { x: s * 0.4, y: s * 0.4, z: s * 0.4, duration: 0.9, ease: 'power2.out' }, 0.1);
    tl.fromTo(u.opacity, { value: 1 }, { value: 0, duration: 0.15, ease: 'power2.out' }, 0.2);
    tl.to(header, { yPercent: -120, duration: 0.5 }, 0);
    tl.to(chips, { autoAlpha: 0, y: 24, duration: 0.25, stagger: { amount: 0.2, from: 'random' }, ease: 'none' }, 0);
    tl.set(chips, { display: 'none', immediateRender: false }, 0.45);
  }

  // the idle spin runs on the clock from load, not only while visible, so the planet arrives
  // already turned by however long the reader spent above it
  const born = performance.now();
  const frame = () => {
    if (!reduced) planet.rotation.y = ((performance.now() - born) / 1000) * GLOBE.spin;
    renderer.render(scene, camera);
  };
  runWhileVisible(canvas, frame, '400px 0px');
  frame();
  canvas.dataset.drawn = '1';
  ScrollTrigger.refresh();
}
