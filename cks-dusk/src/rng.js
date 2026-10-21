// 固定種子亂數。全案禁止使用 Math.random()（scene.js 會把它換成固定種子版本當保險）。
// 用法：const r = makeRng('trees/belts'); r() → [0,1)；r.range(a,b)；r.int(a,b)；r.pick(arr)…
// 每一區用自己的字串名稱衍生子種子，所以某一區改程式不會連帶改變別區的隨機結果。
import { SEED } from './layout.js';

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(name) {
  const next = mulberry32((SEED ^ xmur3(String(name))) >>> 0);
  const r = () => next();
  r.range = (a, b) => a + (b - a) * next();
  r.int = (a, b) => a + Math.floor((b - a + 1) * next()); // 含 a、b
  r.pick = (arr) => arr[Math.floor(next() * arr.length)];
  r.chance = (p) => next() < p;
  r.sign = () => (next() < 0.5 ? -1 : 1);
  r.gauss = () => { // Box–Muller，平均 0、標準差 1
    let u = 0, v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  r.fork = (sub) => makeRng(`${name}/${sub}`);
  return r;
}

// 2D value noise（固定種子），給程序紋理與地形起伏用
export function makeNoise2D(name) {
  const r = makeRng(`noise/${name}`);
  const perm = new Uint16Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const s = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    const u = s(xf), w = s(yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  // fbm：octaves 層疊加，回傳約 [0,1]
  noise.fbm = (x, y, octaves = 4) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += amp * noise(x * f, y * f); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };
  // 週期版（給要無縫拼接的紋理用）：period 為整數格數，第 i 層週期 = period × 2^i
  const vp = (x, y, P) => vals[perm[(perm[((x % P) + P) % P & 255] + (((y % P) + P) % P)) & 511]];
  const noiseP = (x, y, P) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = vp(xi, yi, P), b = vp(xi + 1, yi, P), c = vp(xi, yi + 1, P), d = vp(xi + 1, yi + 1, P);
    const u = s(xf), w = s(yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  // u、v ∈ [0,1) 為紋理座標；period = 第一層的格數
  noise.fbmTile = (u, v, period, octaves = 4) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += amp * noiseP(u * period * f, v * period * f, period * f); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };
  return noise;
}
