// 讀 layout.js 的幾何小工具（不新增任何座標，只做判斷與換算）
import * as L from './layout.js';

export const rectW = (r) => r.x1 - r.x0;
export const rectD = (r) => r.z1 - r.z0;
export const rectCenter = (r) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
export const inRect = (x, z, r, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
export const halfRect = (cx, cz, hx, hz) => ({ x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz });

// 點是否在（旋轉後的）池塘橢圓內；m = 往外擴的距離
export function inPond(x, z, pond, m = 0) {
  const c = Math.cos(-pond.rotation), s = Math.sin(-pond.rotation);
  const dx = x - pond.center.x, dz = z - pond.center.z;
  const u = dx * c - dz * s, v = dx * s + dz * c;
  const a = pond.radiusX + m, b = pond.radiusZ + m;
  return (u * u) / (a * a) + (v * v) / (b * b) <= 1;
}

// 所有「不能種樹」的矩形：建物、鋪面、道路
export function keepOutRects() {
  const out = [];
  const H = L.HALL;
  out.push(halfRect(H.center.x, H.center.z, L.PLAZA.hallRing.outerHalf, L.PLAZA.hallRing.outerHalf));
  out.push({ x0: H.stairs.x0, x1: H.stairs.x1, z0: -H.stairs.halfWidth, z1: H.stairs.halfWidth });
  const G = L.GATE;
  out.push(halfRect(G.center.x, G.center.z, G.depth / 2, G.width / 2));
  for (const sg of Object.values(L.SIDE_GATES)) out.push(halfRect(sg.center.x, sg.center.z, sg.width / 2, sg.depth));
  for (const b of [L.HALLS2.concertHall, L.HALLS2.theater]) {
    out.push(halfRect(b.center.x, b.center.z, L.HALLS2.podium.halfX, L.HALLS2.podium.halfZ + L.HALLS2.frontStairs.run));
  }
  const P = L.PLAZA;
  out.push({ x0: P.boulevard.x0, x1: P.boulevard.x1, z0: -P.boulevard.halfWidth, z1: P.boulevard.halfWidth });
  out.push(P.libertySquare, P.hallForecourt, P.gateForecourt, ...P.sideAvenues, ...P.sidePaths, ...P.crossPaths);
  out.push(...L.GARDENS.parterres);
  for (const r of Object.values(L.ROADS)) out.push(r.rect);
  out.push(...L.TREE_KEEPOUT_EXTRA);
  return out;
}

// 圍牆迴廊帶（園區外緣往內 WALL.depth）
export function inWallBand(x, z, m = 0) {
  const S = L.SITE, d = L.WALL.depth + m;
  if (!inRect(x, z, S, m)) return false;
  return x < S.xMin + d || x > S.xMax - d || z < S.zMin + d || z > S.zMax - d;
}

// 樹木可種植檢查：margin = 樹冠半徑之類的緩衝
export function isFree(x, z, margin = 0) {
  for (const r of keepOutRects()) if (inRect(x, z, r, margin)) return false;
  for (const p of L.GARDENS.ponds) if (inPond(x, z, p, margin)) return false;
  if (inWallBand(x, z, margin)) return false;
  return true;
}

// 指向太陽的單位向量
export function sunDir() { return L.SUN.dir; }
