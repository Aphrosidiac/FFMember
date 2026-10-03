// The FF member card: a rounded, bevelled metal card built from a Shape, with its two faces painted
// on canvases. It is a membership mark — no network logos, no card numbers — and its back says so.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ISO ID-1 proportions (85.60 × 53.98 mm, corner radius 3.18 mm), scaled to 2.6 units wide.
export const CARD_W = 2.6;
export const CARD_H = (CARD_W * 53.98) / 85.6;
const CORNER = (CARD_W * 3.18) / 85.6;
const DEPTH = 0.024;

const loadImage = (src) =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Brushed-metal ground: a cool vertical gradient with horizontal streaks of seeded noise.
function brushed(ctx, w, h, base, seed = 7) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, base[0]);
  g.addColorStop(0.55, base[1]);
  g.addColorStop(1, base[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    const y = rnd() * h;
    ctx.fillStyle = rnd() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(0, y, w, rnd() * 1.6 + 0.4);
  }
  ctx.globalAlpha = 1;
}

function chip(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#cfccc3');
  g.addColorStop(0.5, '#8f8c84');
  g.addColorStop(1, '#bdbab1');
  roundRect(ctx, x, y, w, h, h * 0.16);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(11,11,10,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.36, y);
  ctx.lineTo(x + w * 0.36, y + h);
  ctx.moveTo(x + w * 0.64, y);
  ctx.lineTo(x + w * 0.64, y + h);
  for (const f of [0.33, 0.67]) {
    ctx.moveTo(x, y + h * f);
    ctx.lineTo(x + w * 0.36, y + h * f);
    ctx.moveTo(x + w * 0.64, y + h * f);
    ctx.lineTo(x + w, y + h * f);
  }
  ctx.stroke();
}

async function paintFaces() {
  const W = 2048;
  const H = Math.round((W * 53.98) / 85.6);
  const mark = await loadImage('/brand/ff-mark-white.svg');
  await document.fonts.load('500 64px "Instrument Sans"').catch(() => {});
  await document.fonts.load('italic 64px "Instrument Serif"').catch(() => {});

  // colour — front
  const front = document.createElement('canvas');
  front.width = W;
  front.height = H;
  let c = front.getContext('2d');
  brushed(c, W, H, ['#2c2c29', '#1b1b19', '#0f0f0e']);
  // a soft engraved field behind the mark
  const halo = c.createRadialGradient(W * 0.5, H * 0.48, 10, W * 0.5, H * 0.48, W * 0.42);
  halo.addColorStop(0, 'rgba(243,239,228,0.07)');
  halo.addColorStop(1, 'rgba(243,239,228,0)');
  c.fillStyle = halo;
  c.fillRect(0, 0, W, H);
  // mark, centred, etched (lighter)
  const mw = W * 0.34;
  const mh = (mw * 72) / 194;
  c.globalAlpha = 0.9;
  c.drawImage(mark, (W - mw) / 2, H * 0.48 - mh / 2, mw, mh);
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(243,239,228,0.86)';
  c.font = '500 58px "Instrument Sans"';
  c.letterSpacing = '14px';
  c.fillText('MEMBER', 110, 160);
  c.fillStyle = '#d9ff43';
  c.beginPath();
  c.arc(W - 128, 140, 15, 0, Math.PI * 2);
  c.fill();
  chip(c, 110, H * 0.62, 230, 176);
  c.letterSpacing = '6px';
  c.fillStyle = 'rgba(243,239,228,0.8)';
  c.font = '500 50px "Instrument Sans"';
  c.fillText('FF DEV STUDIO', 110, H - 120);
  c.fillStyle = 'rgba(243,239,228,0.5)';
  c.font = 'italic 54px "Instrument Serif"';
  c.letterSpacing = '0px';
  c.textAlign = 'right';
  c.fillText('Kuala Lumpur', W - 110, H - 120);

  // colour — back
  const back = document.createElement('canvas');
  back.width = W;
  back.height = H;
  c = back.getContext('2d');
  brushed(c, W, H, ['#121211', '#1d1d1b', '#2a2a27'], 11);
  c.strokeStyle = 'rgba(243,239,228,0.07)';
  c.lineWidth = 2;
  for (let x = 0; x <= W; x += 128) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 0; y <= H; y += 128) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.globalAlpha = 0.85;
  const bw = W * 0.14;
  c.drawImage(mark, 110, 110, bw, (bw * 72) / 194);
  c.globalAlpha = 1;
  c.fillStyle = 'rgba(243,239,228,0.9)';
  c.font = 'italic 112px "Instrument Serif"';
  c.fillText('Kept in care,', 110, H * 0.56);
  c.fillText('every month.', 110, H * 0.56 + 118);
  c.fillStyle = 'rgba(243,239,228,0.55)';
  c.font = '500 40px "Instrument Sans"';
  c.letterSpacing = '3px';
  c.fillText('A MEMBERSHIP CARD, NOT A PAYMENT CARD', 110, H - 170);
  c.fillText('HELLO@FFDEV.STUDIO', 110, H - 110);

  // roughness — front: the mark and chip polish brighter than the brushed ground
  const rough = document.createElement('canvas');
  rough.width = W;
  rough.height = H;
  c = rough.getContext('2d');
  c.fillStyle = '#8a8a8a';
  c.fillRect(0, 0, W, H);
  c.filter = 'brightness(0)';
  c.globalAlpha = 0.75;
  c.drawImage(mark, (W - mw) / 2, H * 0.48 - mh / 2, mw, mh);
  c.filter = 'none';
  c.globalAlpha = 1;
  c.fillStyle = '#383838';
  roundRect(c, 110, H * 0.62, 230, 176, 28);
  c.fill();

  const tex = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { front: tex(front, true), back: tex(back, true), rough: tex(rough, false) };
}

// Split an extruded, non-indexed geometry into three draw groups by face normal: front cap,
// back cap and the bevelled edge — so each face can carry its own material.
function groupByFacing(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const buckets = [[], [], []];
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    n.fromBufferAttribute(nor, i).add(new THREE.Vector3().fromBufferAttribute(nor, i + 1)).add(new THREE.Vector3().fromBufferAttribute(nor, i + 2));
    const k = n.z > 2.7 ? 0 : n.z < -2.7 ? 1 : 2;
    buckets[k].push(i, i + 1, i + 2);
  }
  const out = new THREE.BufferGeometry();
  const order = buckets.flat();
  const take = (attr) => {
    const arr = new Float32Array(order.length * attr.itemSize);
    order.forEach((src, j) => { for (let c = 0; c < attr.itemSize; c++) arr[j * attr.itemSize + c] = attr.array[src * attr.itemSize + c]; });
    return new THREE.BufferAttribute(arr, attr.itemSize);
  };
  out.setAttribute('position', take(pos));
  out.setAttribute('normal', take(nor));
  out.setAttribute('uv', take(uv));
  let start = 0;
  buckets.forEach((b, k) => { out.addGroup(start, b.length, k); start += b.length; });
  // Cap UVs: 0…1 across the card, back face mirrored so its texture reads the right way round.
  const p = out.attributes.position;
  const u = out.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = (p.getX(i) + CARD_W / 2) / CARD_W;
    const y = (p.getY(i) + CARD_H / 2) / CARD_H;
    const isBack = i >= buckets[0].length && i < buckets[0].length + buckets[1].length;
    u.setXY(i, isBack ? 1 - x : x, y);
  }
  return out;
}

export function cardGeometry() {
  const s = new THREE.Shape();
  const w = CARD_W / 2;
  const h = CARD_H / 2;
  const r = CORNER;
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 4,
    curveSegments: 18,
  });
  geo.translate(0, 0, -DEPTH / 2);
  return groupByFacing(geo);
}

export async function makeCard() {
  const faces = await paintFaces();
  const shared = { metalness: 0.82, clearcoat: 0.7, clearcoatRoughness: 0.22, envMapIntensity: 1 };
  const materials = [
    new THREE.MeshPhysicalMaterial({ ...shared, map: faces.front, roughnessMap: faces.rough, roughness: 1 }),
    new THREE.MeshPhysicalMaterial({ ...shared, map: faces.back, roughness: 0.5 }),
    new THREE.MeshPhysicalMaterial({ ...shared, color: '#5a5a55', roughness: 0.28 }),
  ];
  const mesh = new THREE.Mesh(cardGeometry(), materials);
  mesh.name = 'ff-member-card';
  return mesh;
}

export function studioEnvironment(renderer, intensity = 1) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  env.userData.intensity = intensity;
  return env;
}
