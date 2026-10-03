// Globe: NASA Blue Marble by day, Black Marble city lights by night, drifting cloud cover, a
// specular glint on open water and a thin limb glow. The planet rises from the bottom of a pinned
// section, turns until Kuala Lumpur faces the reader, and settles to a smaller sphere as the copy
// hands over.
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

export async function initGlobe(canvas, { pin, section, chips, copyA, copyB }) {
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

  const sun = new THREE.Vector3(-0.9, 0.55, 0.55).normalize();
  const uniforms = {
    uDay: { value: day }, uNight: { value: night }, uData: { value: data },
    uSun: { value: sun }, uTime: { value: 0 }, uOpacity: { value: 1 },
    uLimbDay: { value: new THREE.Color('#a9bccf') }, uLimbDusk: { value: new THREE.Color('#33507f') },
  };
  const geo = new THREE.SphereGeometry(1, 128, 96);
  const planet = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true }));
  const halo = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: haloFrag, uniforms, transparent: true,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.scale.setScalar(1.075);
  const spin = new THREE.Group();
  spin.add(planet);
  const earth = new THREE.Group();
  earth.add(spin, halo);
  earth.rotation.x = 0.28;
  scene.add(earth);

  // Rotation that brings Kuala Lumpur round to face the camera.
  const kl = latLonToLocal(KL.lat, KL.lon);
  const faceKL = Math.atan2(-kl.x, kl.z);

  // Scroll: rises from the bottom, turns, settles; copy A leaves, copy B arrives.
  const S = { p: 0 };
  const big = () => (camera.aspect < 0.9 ? 1.25 : 1.65);
  const small = () => (camera.aspect < 0.9 ? 0.62 : 0.58);
  if (!reduced) {
    const tl = gsap.timeline({ scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 1 } });
    tl.to(S, { p: 1, ease: 'none', duration: 1 }, 0);
    tl.to(copyA, { yPercent: -40, opacity: 0, ease: 'power2.in', duration: 0.2 }, 0.1);
    tl.to(chips.children, { opacity: 0, y: -16, ease: 'none', duration: 0.12, stagger: { amount: 0.12, from: 'random' } }, 0.24);
    tl.fromTo(copyB, { opacity: 0, y: 40 }, { opacity: 1, y: 0, ease: 'power3.out', duration: 0.2 }, 0.62);
    // chips drift in as the section is entered
    gsap.from(chips.children, { opacity: 0, scale: 0.85, duration: 1, ease: 'power3.out', stagger: { amount: 0.5, from: 'random' },
      scrollTrigger: { trigger: section, start: 'top 60%', once: true } });
  } else {
    S.p = 1;
  }

  const layout = () => fit(renderer, camera, canvas);
  layout();
  addEventListener('resize', layout);

  const v = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  let idle = 0;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const frame = (dt, time) => {
    idle += reduced ? 0 : dt * 0.05;
    const p = S.p;
    const k = ease(THREE.MathUtils.clamp((p - 0.12) / 0.63, 0, 1));
    // position and scale: a rising horizon → a settled sphere
    const s = THREE.MathUtils.lerp(big(), small(), k);
    earth.scale.setScalar(s);
    earth.position.y = THREE.MathUtils.lerp(camera.aspect < 0.9 ? -2.1 : -1.75, camera.aspect < 0.9 ? 0.5 : -0.12, k);
    earth.rotation.x = THREE.MathUtils.lerp(0.28, 0.06, k);
    spin.rotation.y = faceKL - (1 - k) * 2.4 + idle * (1 - k);
    uniforms.uTime.value = time;
    uniforms.uOpacity.value = 1 - Math.max(0, (p - 0.92) / 0.08) * 0.6;
    renderer.render(scene, camera);

    // project the KL pin; hide it when it turns to the far side
    if (pin) {
      v.copy(kl).multiplyScalar(1.005);
      planet.localToWorld(v);
      nrm.copy(kl).applyQuaternion(planet.getWorldQuaternion(new THREE.Quaternion()));
      toCam.copy(camera.position).sub(v).normalize();
      const facing = nrm.dot(toCam);
      const sp = v.clone().project(camera);
      const x = (sp.x * 0.5 + 0.5) * canvas.clientWidth;
      const y = (-sp.y * 0.5 + 0.5) * canvas.clientHeight;
      pin.style.transform = `translate3d(${x - 5}px, ${y - 5}px, 0)`;
      pin.style.opacity = String(THREE.MathUtils.clamp((facing - 0.15) * 4, 0, 1) * THREE.MathUtils.clamp((k - 0.5) * 4, 0, 1));
    }
  };
  runWhileVisible(canvas, frame);
  frame(0, 0);
  ScrollTrigger.refresh();
}
