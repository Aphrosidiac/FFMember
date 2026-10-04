// The FF member card: a rounded, bevelled metal card built from a Shape, with its two faces painted
// on canvases (colour, finish and height maps). It is a membership mark — no network logos, no card numbers — and its back says so.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ISO ID-1 proportions (85.60 × 53.98 mm, corner radius 3.18 mm), scaled to 2.6 units wide.
export const CARD_W = 2.6;
export const CARD_H = (CARD_W * 53.98) / 85.6;
const CORNER = (CARD_W * 3.18) / 85.6;
const DEPTH = 0.024;
const BEVEL = 0.006;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function chip(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#9c8f72');
  g.addColorStop(0.5, '#62594a');
  g.addColorStop(1, '#8c8068');
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

// The FF mark as paths (from brand/ff-mark-white.svg, 194 × 72), so it can be drawn into the colour,
// finish and height maps identically.
const MARK = ['M0 72 16 0h14L14 72Z', 'M24 72 40 0h14L38 72Z', 'M72 0h54v15H88v13h32v14H88v30H72Z', 'M140 0h54v15h-38v13h32v14h-32v30h-16Z'];
function markPath(x, y, w) {
  const s = w / 194;
  const path = new Path2D();
  const m = new DOMMatrix().translateSelf(x, y).scaleSelf(s, s);
  for (const d of MARK) path.addPath(new Path2D(d), m);
  return path;
}

// Raised shapes are filled once into the height canvas at their top level; heightToNormal turns each
// edge into a smooth chamfer.
function emboss(c, path, top = 255) {
  c.fillStyle = `rgb(${top},${top},${top})`;
  c.fill(path);
}

// Height → tangent-space normal map, once, on the CPU. A bump map takes its slope from screen-space
// derivatives, which flicker pixel to pixel along a diagonal edge (the slashes) and draw a dotted line
// — the same last-pixel shading spike antialiasing can't fix. Smoothing the height first and baking
// real normals keeps the bevel's shading stable at every size (mipmaps average it properly).
function heightToNormal(src, strength) {
  const W = src.width;
  const H = src.height;
  const px = src.getContext('2d').getImageData(0, 0, W, H).data;
  let h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) h[i] = px[i * 4] / 255;
  const blur = (a, r) => { // separable box blur, run twice (≈ gaussian)
    const t = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += a[y * W + Math.min(Math.max(x, 0), W - 1)];
      for (let x = 0; x < W; x++) {
        t[y * W + x] = acc / (2 * r + 1);
        acc += a[y * W + Math.min(x + r + 1, W - 1)] - a[y * W + Math.max(x - r, 0)];
      }
    }
    const o = new Float32Array(W * H);
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += t[Math.min(Math.max(y, 0), H - 1) * W + x];
      for (let y = 0; y < H; y++) {
        o[y * W + x] = acc / (2 * r + 1);
        acc += t[Math.min(y + r + 1, H - 1) * W + x] - t[Math.max(y - r, 0) * W + x];
      }
    }
    return o;
  };
  // chamfer: blur the filled shapes, then keep 2·blur − fill inside each shape. Deep inside the two
  // agree (full height); at the edge the blur is half the fill (zero). Smoothstep rounds the shoulder.
  const b = blur(blur(blur(h, 3), 3), 3);
  for (let i = 0; i < W * H; i++) {
    const top = h[i];
    if (top <= 0) { h[i] = 0; continue; }
    const t = Math.min(Math.max((2 * b[i] - top) / top, 0), 1);
    h[i] = top * t * t * (3 - 2 * t);
  }
  const [out, oc] = canvas(W, H);
  const img = oc.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = (h[y * W + Math.min(x + 1, W - 1)] - h[y * W + Math.max(x - 1, 0)]) * 0.5;
      const dy = (h[Math.min(y + 1, H - 1) * W + x] - h[Math.max(y - 1, 0) * W + x]) * 0.5;
      // canvas rows run down, texture v runs up (flipY), so the row slope enters with its sign kept
      let nx = -dx * strength;
      let ny = dy * strength;
      const l = Math.hypot(nx, ny, 1);
      d[i * 4] = ((nx / l) * 0.5 + 0.5) * 255;
      d[i * 4 + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      d[i * 4 + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      d[i * 4 + 3] = 255;
    }
  }
  oc.putImageData(img, 0, 0);
  return out;
}

// Finish map channels as three reads them: green = roughness, blue = metalness.
const finish = (rough, metal) => `rgb(0,${Math.round(rough * 255)},${Math.round(metal * 255)})`;

const BODY = { color: '#0b0b0a', rough: 0.58, metal: 0 };        // bead-blasted black
const POLISH = { color: '#dedbd3', rough: 0.2, metal: 1 };         // polished, raised
const ETCH = { color: '#6d6b65', rough: 0.78, metal: 0 };          // laser-etched, flush

function canvas(W, H) {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  return [cv, cv.getContext('2d')];
}

// Paints both faces onto canvases. Run by tools/bake_card.mjs, which saves them to public/card/;
// the site loads those files, so none of this (and none of the normal baking) runs for visitors.
export async function paintCardFaces() {
  const W = 2048;
  const H = Math.round((W * 53.98) / 85.6);
  await document.fonts.load('500 64px "Instrument Sans"').catch(() => {});
  const label = (c, text, x, y, size, track, align = 'left') => {
    c.font = `500 ${size}px "Instrument Sans"`;
    c.letterSpacing = `${track}px`;
    c.textAlign = align;
    c.fillText(text, x, y);
  };

  // ---------- front ----------
  const [colour, cc] = canvas(W, H);
  const [orm, oc] = canvas(W, H);
  const [height, hc] = canvas(W, H);
  cc.fillStyle = BODY.color;
  cc.fillRect(0, 0, W, H);
  oc.fillStyle = finish(BODY.rough, BODY.metal);
  oc.fillRect(0, 0, W, H);
  hc.fillStyle = '#000';
  hc.fillRect(0, 0, W, H);

  // machined arcs from the lower right corner: a little glossier than the body, so they only show
  // when light rakes across the card
  oc.strokeStyle = finish(0.5, 0.22);
  oc.lineWidth = 2;
  for (let r = 160; r < W * 0.62; r += 24) {
    oc.beginPath();
    oc.arc(W * 1.02, H * 1.08, r, Math.PI, Math.PI * 1.5);
    oc.stroke();
  }

  // the mark: large, raised and polished
  const mw = W * 0.4;
  const mark = markPath((W - mw) / 2, H * 0.45 - (mw * 72) / 194 / 2, mw);
  cc.fillStyle = POLISH.color;
  cc.fill(mark);
  oc.fillStyle = finish(POLISH.rough, POLISH.metal);
  oc.fill(mark);
  emboss(hc, mark);

  // chip: champagne satin, slightly raised
  const chipPath = new Path2D();
  const cx = 150, cy = H * 0.58, cw = 220, ch = 168;
  chipPath.roundRect(cx, cy, cw, ch, 26);
  chip(cc, cx, cy, cw, ch);
  oc.fillStyle = finish(0.32, 1);
  oc.fill(chipPath);
  emboss(hc, chipPath, 150);

  // etched words
  for (const [c, fill] of [[cc, ETCH.color], [oc, finish(ETCH.rough, ETCH.metal)]]) {
    c.fillStyle = fill;
    label(c, 'MEMBER', 150, 190, 52, 16);
    label(c, 'FF DEV STUDIO', 150, H - 130, 44, 8);
    label(c, 'KUALA LUMPUR', W - 150, H - 130, 44, 8, 'right');
  }

  // ---------- back ----------
  const [bColour, bc] = canvas(W, H);
  const [bOrm, bo] = canvas(W, H);
  const [bHeight, bh] = canvas(W, H);
  bc.fillStyle = BODY.color;
  bc.fillRect(0, 0, W, H);
  bo.fillStyle = finish(BODY.rough, BODY.metal);
  bo.fillRect(0, 0, W, H);
  bh.fillStyle = '#000';
  bh.fillRect(0, 0, W, H);
  const small = markPath(150, 130, W * 0.13);
  bc.fillStyle = POLISH.color;
  bc.fill(small);
  bo.fillStyle = finish(POLISH.rough, POLISH.metal);
  bo.fill(small);
  emboss(bh, small);
  for (const [c, fill] of [[bc, ETCH.color], [bo, finish(ETCH.rough, ETCH.metal)]]) {
    c.fillStyle = fill;
    label(c, 'Built by us.', 150, H * 0.56, 104, -3);
    label(c, 'Looked after by us.', 150, H * 0.56 + 116, 104, -3);
    label(c, 'A MEMBERSHIP CARD, NOT A PAYMENT CARD', 150, H - 170, 38, 3);
    label(c, 'HELLO@FFDEV.STUDIO', 150, H - 110, 38, 3);
  }

  return {
    front: { colour, orm, normal: heightToNormal(height, 6) },
    back: { colour: bColour, orm: bOrm, normal: heightToNormal(bHeight, 6) },
  };
}

const MAPS = ['front-colour', 'front-orm', 'front-normal', 'back-colour', 'back-orm', 'back-normal'];
function loadFaces() {
  const loader = new THREE.TextureLoader();
  return Promise.all(MAPS.map((name) => loader.loadAsync(`/card/${name}.webp`).then((t) => {
    t.colorSpace = name.endsWith('colour') ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  }))).then(([fc, fo, fn, bc, bo, bn]) => ({ front: { map: fc, orm: fo, normal: fn }, back: { map: bc, orm: bo, normal: bn } }));
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
  // Rim normals from the rounded box's own shape, not the extrusion's flat facets. Flat facets on a
  // rim one or two pixels wide take turns reflecting a bright strip and the black room, and that
  // reads as dashes and stair-steps along the outline — a shading spike that antialiasing can't
  // smooth, because it sits in the outline's last pixel.
  const nr = out.attributes.normal;
  const core = { x: CARD_W / 2 - CORNER, y: CARD_H / 2 - CORNER, z: DEPTH / 2 };
  for (let i = buckets[0].length + buckets[1].length; i < nr.count; i++) {
    const x = out.attributes.position.getX(i);
    const y = out.attributes.position.getY(i);
    const z = out.attributes.position.getZ(i);
    const qx = Math.abs(x) - core.x;
    const qy = Math.abs(y) - core.y;
    let dx = 0;
    let dy = 0;
    if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); dx = qx / l; dy = qy / l; }
    else if (qx > qy) dx = 1;
    else dy = 1;
    const tilt = Math.sign(z) * Math.min(Math.max((Math.abs(z) - core.z) / BEVEL, 0), 1); // 0 on the side wall, ±1 at the cap
    const side = Math.sqrt(1 - tilt * tilt);
    n.set(Math.sign(x) * dx * side, Math.sign(y) * dy * side, tilt).normalize();
    nr.setXYZ(i, n.x, n.y, n.z);
  }
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
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 4,
    curveSegments: 24,
  });
  geo.translate(0, 0, -DEPTH / 2);
  return groupByFacing(geo);
}

// One design for both scenes: a bead-blasted black body with a raised, mirror-polished mark and
// etched type, on a gunmetal rim. `finish: 'polished'` lifts the reflections for the lit hero stage.
export async function makeCard({ finish: look = 'brushed' } = {}) {
  const faces = await loadFaces();
  const env = look === 'polished' ? 1.25 : 1;
  const face = (f) => new THREE.MeshPhysicalMaterial({
    map: f.map, roughnessMap: f.orm, metalnessMap: f.orm, roughness: 1, metalness: 1,
    normalMap: f.normal, envMapIntensity: env,
    specularIntensity: 0.3, // the black body's sheen only; metal parts take their reflectance from colour
  });
  const materials = [
    face(faces.front),
    face(faces.back),
    // the rim is satin gunmetal, not mirror: a one-pixel band can't hold a crisp reflection without sparkling
    new THREE.MeshPhysicalMaterial({ color: '#7d7c77', metalness: 1, roughness: 0.34, envMapIntensity: env }),
  ];
  const mesh = new THREE.Mesh(cardGeometry(), materials);
  mesh.name = 'ff-member-card';
  return mesh;
}

// A product-photography environment: a black room with three bright softbox strips (overhead,
// left, right) and a faint floor bounce. Chrome reflects crisp black and white instead of grey.
export function softboxEnvironment(renderer) {
  const room = new THREE.Scene();
  room.background = new THREE.Color(0x000000);
  const strip = (w, h, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    room.add(m);
  };
  strip(8, 0.7, 9, [0, 5, 1.2], [0, 0, 0]);       // overhead key bar
  strip(8, 0.35, 5, [0, 5, -1.4], [0, 0, 0]);     // second, thinner overhead bar
  strip(0.7, 6, 6, [-5, 1.6, 1.5], [0, 0, 0]);    // left vertical bar
  strip(0.45, 6, 3, [5, 1.6, -0.5], [0, 0, 0]);   // right vertical bar
  strip(5, 0.8, 1.2, [0, 0.4, 6], [0, 0, 0]);     // small low front fill
  strip(14, 0.5, 4, [0, 0.7, -6], [0, 0.7, 0]);   // horizon bar behind: a line across horizontal chrome
  strip(12, 1.8, 2.2, [0, -1.0, 5.5], [0, 0, 0]);  // low front bar: a soft band across vertical chrome faces
  strip(14, 14, 0.04, [0, -4, 0], [0, 0, 0]);     // faint floor bounce
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.02).texture;
  pmrem.dispose();
  return env;
}

export function studioEnvironment(renderer, intensity = 1) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  env.userData.intensity = intensity;
  return env;
}
