// ============================================================================
// 共用材質（所有區域都從這裡拿；不准自己另做草地、琉璃、屋瓦、木頭、地磚）
// ----------------------------------------------------------------------------
// 全部紋理都是程式即時生成（canvas＋固定種子雜訊），沒有任何外部圖檔。
//
// UV 慣例：凡是有紋理的材質，UV 單位一律是「公尺」。
//   - 地面類：u = 世界 x、v = 世界 z            → 用 planarUV(geometry)
//   - 牆面類：依面法線做方盒投影                 → 用 boxUV(geometry)
//   - 屋瓦：u = 沿簷口方向（公尺）、v = 沿坡面往下（公尺）→ 自己建 UV，或用 roofUV()
// 沒有紋理的材質（琉璃、金、水…）不需要 UV。
//
// 材質是共用的單一實例：不要對它們 .clone() 後改顏色到處用；
// 需要逐棵/逐塊變化色調時，請用 InstancedMesh.setColorAt()（instanceColor 會乘上材質色）
// 或 geometry 的 vertex colors（材質名稱帶 VC 的版本有開 vertexColors）。
// ============================================================================
import * as THREE from 'three';
import { makeRng, makeNoise2D } from './rng.js';

const TEX_SIZE = 512;

function canvasTexture(name, size, draw, { color = true, tileMeters = 4 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size, makeRng(`tex/${name}`), makeNoise2D(name));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tileMeters, 1 / tileMeters);
  t.anisotropy = 8;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.name = name;
  return t;
}

// 由灰階高度圖算法線圖（給屋瓦、地磚縫、石材用）
function heightToNormal(name, size, heightFn, strength, tileMeters) {
  const h = new Float32Array(size * size);
  const r = makeRng(`tex/${name}/h`), n = makeNoise2D(`${name}/h`);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = heightFn(x / size, y / size, r, n);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
    img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
    img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / tileMeters, 1 / tileMeters);
  t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const hex = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;

// ---------------------------------------------------------------------------
// 紋理
// ---------------------------------------------------------------------------
function grassTex() {
  return canvasTexture('grass', TEX_SIZE, (g, s, r, n) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const big = n.fbm((x / s) * 6, (y / s) * 6, 4);
      const fine = r();
      const i = (y * s + x) * 4;
      img.data[i] = 70 + big * 40 + fine * 22;
      img.data[i + 1] = 105 + big * 45 + fine * 30;
      img.data[i + 2] = 40 + big * 18 + fine * 12;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { tileMeters: 8 });
}

// 花崗岩地磚：模數 1 m，4×4 塊一張
function pavingTex(name, base, spread, tileMeters = 4, grid = 4) {
  return canvasTexture(name, TEX_SIZE, (g, s, r, n) => {
    const cell = s / grid;
    for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) {
      const k = (r() - 0.5) * spread;
      g.fillStyle = hex(base[0] + k, base[1] + k, base[2] + k * 0.9);
      g.fillRect(i * cell, j * cell, cell, cell);
    }
    const img = g.getImageData(0, 0, s, s);
    for (let p = 0; p < s * s; p++) {
      const sp = (r() - 0.5) * 26 + (n.fbm((p % s) / 40, Math.floor(p / s) / 40, 3) - 0.5) * 18;
      img.data[p * 4] += sp; img.data[p * 4 + 1] += sp; img.data[p * 4 + 2] += sp;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(40,38,36,0.55)';
    g.lineWidth = 2;
    for (let i = 0; i <= grid; i++) {
      g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * cell); g.lineTo(s, i * cell); g.stroke();
    }
  }, { tileMeters });
}

// 白色大理石砌塊（主殿、牌樓、臺基牆面）：塊 1.2 m × 0.6 m，交錯砌
function marbleTex(name, base, blocks = true) {
  return canvasTexture(name, TEX_SIZE, (g, s, r, n) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const vein = Math.abs(Math.sin((x / s) * 9 + n.fbm((x / s) * 5, (y / s) * 5, 4) * 7));
      const v = Math.pow(vein, 18) * 26;
      const i = (y * s + x) * 4;
      const t = (r() - 0.5) * 6 + (n.fbm(x / 60, y / 60, 3) - 0.5) * 10;
      img.data[i] = base[0] + t - v; img.data[i + 1] = base[1] + t - v; img.data[i + 2] = base[2] + t - v * 0.8;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    if (!blocks) return;
    // 4.8 m × 4.8 m 一張：4 塊寬 × 8 皮高
    const bw = s / 4, bh = s / 8;
    g.strokeStyle = 'rgba(120,118,112,0.35)';
    g.lineWidth = 1.5;
    for (let row = 0; row < 8; row++) {
      g.beginPath(); g.moveTo(0, row * bh); g.lineTo(s, row * bh); g.stroke();
      const off = row % 2 ? bw / 2 : 0;
      for (let col = 0; col <= 4; col++) {
        const x = col * bw + off;
        g.beginPath(); g.moveTo(x, row * bh); g.lineTo(x, (row + 1) * bh); g.stroke();
      }
    }
  }, { tileMeters: blocks ? 4.8 : 6 });
}

// 筒瓦屋面：瓦壟沿 v（坡向）延伸，壟距 0.4 m；每 0.33 m 一片瓦的接縫
const TILE_PITCH = 0.4, TILE_LEN = 0.33, ROOF_TILE_METERS = 4;
function roofTileTextures(name, base) {
  const map = canvasTexture(name, TEX_SIZE, (g, s, r, n) => {
    const img = g.createImageData(s, s);
    const rows = ROOF_TILE_METERS / TILE_PITCH, segs = ROOF_TILE_METERS / TILE_LEN;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const u = (x / s) * rows, v = (y / s) * segs;
      const ridge = Math.cos((u % 1) * Math.PI * 2) * 0.5 + 0.5;   // 1 = 筒瓦頂、0 = 板瓦溝
      const joint = (v % 1) < 0.06 ? 0.75 : 1;
      const k = (n.fbm(Math.floor(u) * 3.1, Math.floor(v) * 1.7, 2) - 0.5) * 30 + (r() - 0.5) * 8;
      const sh = (0.62 + 0.38 * ridge) * joint;
      const i = (y * s + x) * 4;
      img.data[i] = (base[0] + k) * sh; img.data[i + 1] = (base[1] + k) * sh; img.data[i + 2] = (base[2] + k) * sh;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { tileMeters: ROOF_TILE_METERS });
  const normal = heightToNormal(`${name}N`, 256, (u, v) => {
    const rows = ROOF_TILE_METERS / TILE_PITCH, segs = ROOF_TILE_METERS / TILE_LEN;
    const a = (u * rows) % 1, b = (v * segs) % 1;
    return Math.sqrt(Math.max(0, 1 - Math.pow((a - 0.5) * 2, 2))) * 0.8 - (b < 0.06 ? 0.15 : 0);
  }, 10, ROOF_TILE_METERS);
  return { map, normal };
}

// 斗栱彩畫：青綠為主、金線分隔（UV 公尺，2 m 一循環）
function bracketPaintTex() {
  return canvasTexture('bracketPaint', 256, (g, s, r) => {
    const bands = ['#1f5a6b', '#2c7a5e', '#1b3f78', '#2c7a5e', '#1f5a6b', '#c49a3a', '#8a2a26', '#1b3f78'];
    const h = s / bands.length;
    bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * h, s, h); });
    g.fillStyle = '#d8b25a';
    for (let i = 0; i < bands.length; i++) g.fillRect(0, i * h, s, 2);
    g.strokeStyle = 'rgba(230,220,190,0.6)';
    g.lineWidth = 2;
    for (let k = 0; k < 4; k++) { // 旋子紋示意
      const cx = (k + 0.5) * (s / 4), cy = s * 0.5;
      g.beginPath(); g.arc(cx, cy, s / 12, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cy, s / 24, 0, Math.PI * 2); g.stroke();
    }
    void r;
  }, { tileMeters: 2 });
}

function brickTex() { // 牌樓前紅磚：0.2 × 0.1 m 人字/順砌簡化為順砌
  return canvasTexture('brick', TEX_SIZE, (g, s, r) => {
    const bw = s / 10, bh = s / 20;
    for (let y = 0; y < 20; y++) for (let x = -1; x < 11; x++) {
      const k = (r() - 0.5) * 30;
      g.fillStyle = hex(150 + k, 72 + k * 0.6, 58 + k * 0.5);
      g.fillRect(x * bw + (y % 2) * bw / 2, y * bh, bw - 2, bh - 2);
    }
  }, { tileMeters: 2 });
}

function asphaltTex() {
  return canvasTexture('asphalt', TEX_SIZE, (g, s, r, n) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const k = 44 + (r() - 0.5) * 18 + (n.fbm(x / 50, y / 50, 3) - 0.5) * 14;
      const i = (y * s + x) * 4;
      img.data[i] = k; img.data[i + 1] = k; img.data[i + 2] = k + 3; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { tileMeters: 6 });
}

function stoneTex() {
  return canvasTexture('stone', TEX_SIZE, (g, s, r, n) => {
    const img = g.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const f = n.fbm(x / 30, y / 30, 5);
      const k = 70 + f * 80 + (r() - 0.5) * 20;
      const i = (y * s + x) * 4;
      img.data[i] = k * 1.02; img.data[i + 1] = k; img.data[i + 2] = k * 0.92; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { tileMeters: 3 });
}

// 城市立面：樓高 3.3 m、窗距 2.5 m；部分窗戶點燈（emissive）
const FLOOR_H = 3.3, BAY_W = 2.5, FACADE_FLOORS = 12, FACADE_BAYS = 8;
function facadeTextures() {
  const meters = { u: BAY_W * FACADE_BAYS, v: FLOOR_H * FACADE_FLOORS };
  const make = (name, emissive) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 384;
    const g = c.getContext('2d');
    const r = makeRng('tex/facade');
    const cw = c.width / FACADE_BAYS, ch = c.height / FACADE_FLOORS;
    g.fillStyle = emissive ? '#000' : '#b9b4aa';
    g.fillRect(0, 0, c.width, c.height);
    for (let f = 0; f < FACADE_FLOORS; f++) for (let b = 0; b < FACADE_BAYS; b++) {
      const lit = r() < 0.22;
      const tone = r();
      if (emissive) {
        if (lit) { g.fillStyle = tone < 0.7 ? '#ffcf8a' : '#fff1d6'; g.fillRect(b * cw + 4, f * ch + 6, cw - 8, ch - 12); }
      } else {
        g.fillStyle = lit ? '#6d6458' : hex(52 + tone * 30, 62 + tone * 30, 74 + tone * 30);
        g.fillRect(b * cw + 4, f * ch + 6, cw - 8, ch - 12);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / meters.u, 1 / meters.v);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: make('facade', false), emissive: make('facadeE', true) };
}

// ---------------------------------------------------------------------------
// 材質庫
// ---------------------------------------------------------------------------
let cache = null;

export function getMaterials() {
  if (cache) return cache;
  const std = (o) => new THREE.MeshStandardMaterial(o);

  const roofBlue = roofTileTextures('roofTileBlue', [38, 62, 150]);
  const roofGold = roofTileTextures('roofTileGold', [214, 150, 44]);
  const facade = facadeTextures();

  const M = {
    // --- 草地 ---
    grass: std({ name: 'grass', map: grassTex(), roughness: 0.95 }),
    grassDark: std({ name: 'grassDark', map: grassTex(), color: 0x9fb08f, roughness: 0.95 }),

    // --- 地磚 ---
    paving: std({ name: 'paving', map: pavingTex('paving', [176, 172, 164], 26), roughness: 0.8 }),
    pavingDark: std({ name: 'pavingDark', map: pavingTex('pavingDark', [120, 116, 110], 22), roughness: 0.8 }),
    pavingRed: std({ name: 'pavingRed', map: brickTex(), roughness: 0.85 }),       // 牌樓前紅磚
    sidewalk: std({ name: 'sidewalk', map: pavingTex('sidewalk', [150, 140, 128], 18, 2, 6), roughness: 0.85 }),
    asphalt: std({ name: 'asphalt', map: asphaltTex(), roughness: 0.92 }),
    roadMarking: std({ name: 'roadMarking', color: 0xe8e4da, roughness: 0.7 }),

    // --- 石材／牆 ---
    marble: std({ name: 'marble', map: marbleTex('marble', [236, 234, 228], true), roughness: 0.42 }),
    marbleSmooth: std({ name: 'marbleSmooth', map: marbleTex('marbleSmooth', [240, 238, 232], false), roughness: 0.38 }),
    marbleGrey: std({ name: 'marbleGrey', map: marbleTex('marbleGrey', [178, 176, 172], true), roughness: 0.6 }), // 階梯、臺基踏面
    plasterWhite: std({ name: 'plasterWhite', color: 0xece8df, roughness: 0.85 }),  // 圍牆、側門
    stone: std({ name: 'stone', map: stoneTex(), roughness: 0.95, flatShading: true }), // 假山
    concrete: std({ name: 'concrete', color: 0xa39f97, roughness: 0.9 }),

    // --- 琉璃（無紋理，平滑上釉：屋脊、簷口收邊、圍牆壓頂、寶頂座）---
    glazeBlue: std({ name: 'glazeBlue', color: 0x23408f, roughness: 0.22, metalness: 0.05 }),
    glazeGold: std({ name: 'glazeGold', color: 0xd99a2b, roughness: 0.24, metalness: 0.08 }),
    glazeGreen: std({ name: 'glazeGreen', color: 0x2f6b4a, roughness: 0.25, metalness: 0.05 }),

    // --- 屋瓦（筒瓦紋理＋法線，UV：u 沿簷口、v 沿坡向，公尺）---
    roofTileBlue: std({ name: 'roofTileBlue', map: roofBlue.map, normalMap: roofBlue.normal,
      normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.3, metalness: 0.05 }),
    roofTileGold: std({ name: 'roofTileGold', map: roofGold.map, normalMap: roofGold.normal,
      normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.3, metalness: 0.08 }),

    // --- 木頭 ---
    woodRed: std({ name: 'woodRed', color: 0xa3201c, roughness: 0.45 }),           // 朱紅漆柱、門
    woodDark: std({ name: 'woodDark', color: 0x4a2e1f, roughness: 0.7 }),          // 門扇、橋欄、亭
    woodNatural: std({ name: 'woodNatural', color: 0x8a6440, roughness: 0.75 }),
    bracketPaint: std({ name: 'bracketPaint', map: bracketPaintTex(), roughness: 0.6 }), // 斗栱、額枋彩畫（UV 公尺）
    bracketPaintFlat: std({ name: 'bracketPaintFlat', color: 0x245f6a, roughness: 0.6 }), // 遠景用單色

    // --- 金屬 ---
    gold: std({ name: 'gold', color: 0xd6a043, roughness: 0.28, metalness: 1.0 }), // 寶頂、匾額字
    bronze: std({ name: 'bronze', color: 0x5a4632, roughness: 0.45, metalness: 0.9 }), // 銅門
    lampMetal: std({ name: 'lampMetal', color: 0x2b2d30, roughness: 0.5, metalness: 0.6 }),
    lampGlow: std({ name: 'lampGlow', color: 0xfff1d0, emissive: 0xffcf8a, emissiveIntensity: 1.2, roughness: 0.4 }),

    // --- 水 ---
    water: std({ name: 'water', color: 0x1a3038, roughness: 0.06, metalness: 0.0 }),

    // --- 植物（instanceColor / vertexColors 會乘上這些顏色）---
    foliage: std({ name: 'foliage', color: 0x4f7a34, roughness: 0.9 }),          // 闊葉樹
    foliageDark: std({ name: 'foliageDark', color: 0x34552a, roughness: 0.9 }),
    foliageConifer: std({ name: 'foliageConifer', color: 0x2c4a2a, roughness: 0.9 }), // 松、杉
    foliageCypress: std({ name: 'foliageCypress', color: 0x355e2c, roughness: 0.9 }), // 龍柏
    palmFrond: std({ name: 'palmFrond', color: 0x56783a, roughness: 0.85, side: THREE.DoubleSide }),
    bark: std({ name: 'bark', color: 0x4f4034, roughness: 0.95 }),
    barkPalm: std({ name: 'barkPalm', color: 0x9a9184, roughness: 0.9 }),
    hedge: std({ name: 'hedge', color: 0x3d6a28, roughness: 0.92 }),
    soil: std({ name: 'soil', color: 0x4a3a2c, roughness: 1.0 }),
    flowerRed: std({ name: 'flowerRed', color: 0xb5203a, roughness: 0.8 }),
    flowerPink: std({ name: 'flowerPink', color: 0xd76a9a, roughness: 0.8 }),
    flowerYellow: std({ name: 'flowerYellow', color: 0xe7b52c, roughness: 0.8 }),
    flowerWhite: std({ name: 'flowerWhite', color: 0xece7dc, roughness: 0.8 }),
    flowerMaroon: std({ name: 'flowerMaroon', color: 0x6e1f2a, roughness: 0.85 }), // 照片中的紫紅葉草本

    // --- 城市背景 ---
    cityFacade: std({ name: 'cityFacade', map: facade.map, emissiveMap: facade.emissive,
      emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.75 }),
    cityRoof: std({ name: 'cityRoof', color: 0x77736c, roughness: 0.95 }),
    cityGlass: std({ name: 'cityGlass', color: 0x56677a, roughness: 0.15, metalness: 0.6 }),
    mountain: std({ name: 'mountain', color: 0x4c5a55, roughness: 1.0, flatShading: true }),
  };

  // 帶 vertexColors 的版本（逐頂點上色用，色彩會乘上材質色）
  for (const k of ['foliage', 'foliageDark', 'foliageConifer', 'foliageCypress', 'hedge', 'stone', 'mountain']) {
    const m = M[k].clone();
    m.name = `${k}VC`;
    m.vertexColors = true;
    M[`${k}VC`] = m;
  }
  cache = M;
  return M;
}

// 給 dispose / 測試用
export function resetMaterials() { cache = null; }

// ---------------------------------------------------------------------------
// UV 小工具（UV 單位：公尺）
// ---------------------------------------------------------------------------
// 俯視投影：u = x、v = z（geometry 目前座標系；建議在 bake 到世界座標後呼叫）
export function planarUV(geometry, { axis = 'y', scale = 1 } = {}) {
  const p = geometry.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const [u, v] = axis === 'y' ? [x, z] : axis === 'x' ? [z, y] : [x, y];
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

// 方盒投影：每個三角形依法線主軸選投影面（geometry 需為 non-indexed 或會自動轉）
export function boxUV(geometry, scale = 1) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let t = 0; t < p.count; t += 3) {
    // 用三角形第一個頂點的法線決定投影面，避免同一面接縫
    const ax = Math.abs(n.getX(t)), ay = Math.abs(n.getY(t)), az = Math.abs(n.getZ(t));
    for (let k = 0; k < 3; k++) {
      const i = t + k, x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      let u, v;
      if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
      uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// 屋面 UV：給一個坡面，eaveDir = 簷口方向單位向量、downDir = 沿坡往下單位向量（世界座標）
export function roofUV(geometry, eaveDir, downDir) {
  const p = geometry.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    uv[i * 2] = x * eaveDir.x + y * eaveDir.y + z * eaveDir.z;
    uv[i * 2 + 1] = x * downDir.x + y * downDir.y + z * downDir.z;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

// ---------------------------------------------------------------------------
// 匾額文字紋理（牌樓「自由廣場」、主殿「中正紀念堂」、側門匾）
// vertical: 直書；rightToLeft: 橫書由右至左（傳統匾額）
// ---------------------------------------------------------------------------
export function makePlaqueTexture({ text, vertical = false, rightToLeft = false,
  bg = '#1d2f6e', fg = '#e9c46a', border = '#d6a043', aspect = 4 }) {
  const W = vertical ? 256 : 1024, H = vertical ? Math.round(256 * aspect) : Math.round(1024 / aspect);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = border; g.lineWidth = Math.min(W, H) * 0.06;
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth);
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const chars = [...text];
  const fontStack = '"BiauKai","DFKai-SB","TW-Kai","Noto Serif TC","Noto Serif CJK TC","WenQuanYi Zen Hei",serif';
  if (vertical) {
    const step = (H * 0.86) / chars.length;
    g.font = `bold ${Math.min(W * 0.66, step * 0.86)}px ${fontStack}`;
    chars.forEach((ch, i) => g.fillText(ch, W / 2, H * 0.07 + step * (i + 0.5)));
  } else {
    const seq = rightToLeft ? chars.slice().reverse() : chars;
    const step = (W * 0.84) / seq.length;
    g.font = `bold ${Math.min(H * 0.66, step * 0.86)}px ${fontStack}`;
    seq.forEach((ch, i) => g.fillText(ch, W * 0.08 + step * (i + 0.5), H / 2));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
