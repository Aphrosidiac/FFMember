// Globe: NASA Blue Marble by day, Black Marble city lights by night, drifting cloud cover, a
// specular glint on open water and a thin limb glow. The planet sits as a night-side horizon at
// the foot of a short pinned stage while the copy scrolls past it, then sinks away and fades so
// the member card can rise edge-on out of the dark into the next section.
import * as THREE from 'three';
import { gsap, ScrollTrigger, reduced } from '../motion.js';
import { makeRenderer, fit, runWhileVisible } from './stage.js';

const KL = { lat: 3.139, lon: 101.687 };

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uData;   // r: luminance, g: land mask, b: clouds
  uniform vec3 uSun;
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uLimbDay;
  uniform vec3 uLimbDusk;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    vec3 L = normalize(uSun);
    float ndl = dot(N, L);

    vec4 data = texture2D(uData, vUv);
    float clouds = texture2D(uData, vUv + vec2(uTime * 0.0016, 0.0)).b;
    clouds = smoothstep(0.18, 0.95, clouds);
    float land = data.g;

    vec3 day = texture2D(uDay, vUv).rgb;
    day = mix(day, vec3(0.92), clouds * 0.82);
    float light = smoothstep(-0.12, 0.35, ndl);
    vec3 lit = day * (0.035 + 1.15 * max(ndl, 0.0));

    vec3 night = texture2D(uNight, vUv).rgb;
    night = pow(night, vec3(1.6)) * vec3(1.25, 1.05, 0.8) * 2.2 * (1.0 - clouds * 0.75);

    vec3 H = normalize(L + V);
    float glint = pow(max(dot(N, H), 0.0), 70.0) * (1.0 - land) * (1.0 - clouds) * step(0.0, ndl) * 0.7;

    vec3 col = lit * light + night * (1.0 - light) + vec3(glint);

    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    vec3 limb = mix(uLimbDusk, uLimbDay, smoothstep(-0.3, 0.6, ndl));
    col += limb * fres * smoothstep(-0.45, 0.35, ndl) * 1.1;
    // dawn: the sun sits just behind the planet, so the crest of the visible cap catches a white glare
    col += vec3(1.0, 0.97, 0.92) * smoothstep(-0.05, 0.4, ndl) * pow(fres, 1.4) * 1.6;

    gl_FragColor = vec4(col, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const haloFrag = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uLimbDay;
  uniform vec3 uLimbDusk;
  uniform float uOpacity;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    float rim = 1.0 - abs(dot(N, V));
    float a = smoothstep(0.55, 1.0, rim);
    a *= smoothstep(1.0, 0.86, rim);
    float sun = smoothstep(-0.5, 0.6, dot(N, normalize(uSun)));
    vec3 c = mix(uLimbDusk, uLimbDay, sun);
    gl_FragColor = vec4(c, a * sun * 0.75 * uOpacity);
    #include <colorspace_fragment>
  }
`;

function latLonToLocal(lat, lon) {
  // three's SphereGeometry: u = phi / 2π with x = -cos(phi) sin(theta), z = sin(phi) sin(theta);
  // an equirectangular map puts longitude -180° at u = 0.
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

export async function initGlobe(canvas, { section, chips }) {
  const renderer = makeRenderer(canvas, { alpha: true, maxDpr: 1.5 });
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const loader = new THREE.TextureLoader();
  const load = (url, srgb) => new Promise((res) => loader.load(url, (t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.wrapS = THREE.RepeatWrapping;
    res(t);
  }, undefined, () => res(null)));
  const [day, night, data] = await Promise.all([load('/globe/day.webp', true), load('/globe/night.webp', true), load('/globe/data.webp', false)]);

  // sun behind and above: the face toward us is night (city lights), dawn rims the top edge
  const sun = new THREE.Vector3(0.0, 0.3, -0.95).normalize();
  const uniforms = {
    uDay: { value: day }, uNight: { value: night }, uData: { value: data },
    uSun: { value: sun }, uTime: { value: 0 }, uOpacity: { value: 1 },
    uLimbDay: { value: new THREE.Color('#9cc2ff') }, uLimbDusk: { value: new THREE.Color('#1b3f8f') },
  };
  const geo = new THREE.SphereGeometry(1, 128, 96);
  const planet = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true }));
  const halo = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: haloFrag, uniforms, transparent: true,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.setScalar(1.022);
  const spin = new THREE.Group();
  spin.add(planet);
  const earth = new THREE.Group();
  earth.add(spin, halo);
  earth.rotation.x = 0.28;
  scene.add(earth);

  // Rotation that brings Kuala Lumpur round to face the camera.
  const kl = latLonToLocal(KL.lat, KL.lon);
  const faceKL = Math.atan2(-kl.x, kl.z);

  // Scroll: q runs across the pinned stretch only. The entry is the stage scrolling in, which
  // lifts the horizon from below; the copy is outside the stage and scrolls past at page speed.
  const S = { q: 0 };
  const portrait = () => camera.aspect < 0.9;
  if (!reduced) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.8 } });
    tl.to(S, { q: 1, ease: 'none', duration: 1 }, 0);
    tl.to(chips.children, { opacity: 0, y: -14, ease: 'none', duration: 0.3, stagger: { amount: 0.2, from: 'random' } }, 0.42);
    gsap.from(chips.children, { opacity: 0, scale: 0.85, duration: 1, ease: 'power3.out', stagger: { amount: 0.5, from: 'random' },
      scrollTrigger: { trigger: section, start: 'top 55%', once: true } });
  }

  const layout = () => fit(renderer, camera, canvas);
  layout();
  addEventListener('resize', layout);

  let idle = 0;
  const ease = (x) => x * x * (3 - 2 * x);
  const frame = (dt, time) => {
    idle += reduced ? 0 : dt * 0.02;
    const sink = ease(THREE.MathUtils.clamp((S.q - 0.42) / 0.5, 0, 1));
    const big = portrait() ? 1.3 : 2.15;
    earth.scale.setScalar(big * (1 - 0.22 * sink));
    earth.position.y = (portrait() ? -2.35 : -2.55) - sink * 1.3;
    earth.rotation.x = 0.28;
    spin.rotation.y = faceKL - 0.35 + idle;
    uniforms.uTime.value = time;
    uniforms.uOpacity.value = 1 - ease(THREE.MathUtils.clamp((sink - 0.6) / 0.4, 0, 1));
    renderer.render(scene, camera);
  };
  runWhileVisible(canvas, frame);
  frame(0, 0);
  ScrollTrigger.refresh();
}
