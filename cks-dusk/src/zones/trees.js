// ============================================================================
// 區域：trees（園區內外所有樹木，全部程序生成）
// ----------------------------------------------------------------------------
// 樹種：
//   cypress   龍柏：修剪成圓錐／火焰形，表面一團團雲狀起伏（螺旋扭轉的葉團）
//   pomPine   造型松：S 形彎曲樹幹＋數層扁平雲片狀葉團（日式／台式造型松）
//   conifer   高大針葉樹（肯氏南洋杉／黑松感）：直幹、輪生枝、枝端簇狀葉團
//   broadleaf 闊葉樹（樟樹、榕樹、茄苳感）：主枝分叉＋一團團葉團，團與團之間留縫
//   street    行道樹：中小型闊葉（跟 broadleaf 同一套生成器，枝下高較高）
//   palm      大王椰子：灰白平滑樹幹、綠色冠莖、放射羽狀葉
//
// 做法：
//   - 每個樹種用固定種子做 4～8 種變體幾何，用 THREE.BatchedMesh 放置
//     （BatchedMesh＝多個變體幾何共用一個 draw call，每棵各自有矩陣與色調，
//       並且逐棵做視錐剔除；同材質一個 draw call，所以每樹種只有「葉＋幹」2 個）。
//   - 主角樹（L.TREES.heroes）是高細節的獨立幾何，也放進同樹種的 BatchedMesh。
//   - 造型松、高大針葉樹數量少，每棵獨立造型、直接 bake 成世界座標合併。
//   - 葉團：變形 icosahedron＋「圓頂凸起取最大值」做出雲狀一團團的表面，
//     再加頂點雜訊與 vertex color（凸起處亮、凹縫與樹冠內側暗）。
//   - 會避開鏡頭路徑：用 shots.js 的時間軸取樣相機位置，相機會穿過的樹冠不種
//     （主角樹除外），避免鏡頭穿進樹裡。
// ============================================================================
import { SHOTS, evaluateTimeline, TOTAL_DURATION } from '../shots.js';

const TAU = Math.PI * 2;
const GOLDEN = 2.399963;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 3D value noise（固定種子）
function makeNoise3(r) {
  const p = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint16Array(768);
  for (let i = 0; i < 768; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = r();
  const h = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const s = (t) => t * t * (3 - 2 * t);
  const n = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = s(x - xi), v = s(y - yi), w = s(z - zi);
    const a = lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), b = lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u);
    const c = lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), d = lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u);
    return lerp(lerp(a, b, v), lerp(c, d, v), w);
  };
  n.fbm = (x, y, z, oct = 3) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * n(x * f, y * f, z * f); norm += amp; amp *= 0.5; f *= 2.03; }
    return sum / norm;
  };
  return n;
}

export async function build(ctx) {
  const { THREE, L, geo, M, makeRng, utils } = ctx;
  const { mergeGeometries, mergeVertices } = utils;
  const V3 = THREE.Vector3;
  const group = new THREE.Group();
  group.name = 'trees';
  const noise3 = makeNoise3(makeRng('trees/noise3'));
  const T = L.TREES;
  const H = T.heroes;

  const randUnit = (r) => {
    const z = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - z * z);
    return new V3(s * Math.cos(a), z, s * Math.sin(a));
  };

  // ---------------------------------------------------------------------------
  // 單位球（icosahedron，焊接頂點後的 index 版本），依細分等級快取
  // ---------------------------------------------------------------------------
  const sphereCache = {};
  function unitSphere(d) {
    if (!sphereCache[d]) {
      let g = new THREE.IcosahedronGeometry(1, d);
      g.deleteAttribute('normal');
      g.deleteAttribute('uv');
      g = mergeVertices(g);
      sphereCache[d] = { pos: g.attributes.position.array, idx: g.index.array };
    }
    return sphereCache[d];
  }

  // 圓頂凸起：一組隨機方向的圓頂，取最大值 → 一團一團、團與團之間有凹縫
  function makeBumps(r, k, { wMin = 0.6, wMax = 0.95, aMin = 0.22, aMax = 0.34, upBias = 0 } = {}) {
    const out = [];
    for (let i = 0; i < k; i++) {
      const d = randUnit(r);
      if (upBias) { d.y = d.y * (1 - upBias) + upBias; d.normalize(); }
      const w = r.range(wMin, wMax);
      out.push({ x: d.x, y: d.y, z: d.z, w, cw: Math.cos(w), a: r.range(aMin, aMax) });
    }
    return out;
  }
  function bumpAt(bumps, ux, uy, uz) {
    let m = 0;
    for (let i = 0; i < bumps.length; i++) {
      const b = bumps[i];
      const c = ux * b.x + uy * b.y + uz * b.z;
      if (c <= b.cw) continue;
      const q = Math.acos(Math.min(1, c)) / b.w;
      const v = b.a * Math.sqrt(1 - q * q);
      if (v > m) m = v;
    }
    return m;
  }

  // ---------------------------------------------------------------------------
  // 幾何組裝器：position（＋color＋法線提示）、index
  // ---------------------------------------------------------------------------
  class GB {
    constructor(withColor) { this.pos = []; this.idx = []; this.col = withColor ? [] : null; this.hint = withColor ? [] : null; }
    get count() { return this.pos.length / 3; }
    vert(x, y, z, c, h) {
      this.pos.push(x, y, z);
      if (this.col) {
        this.col.push(c ? c[0] : 1, c ? c[1] : 1, c ? c[2] : 1);
        this.hint.push(h ? h[0] : 0, h ? h[1] : 0, h ? h[2] : 0);
      }
      return this.count - 1;
    }
    tri(a, b, c) { this.idx.push(a, b, c); }

    // 管狀（樹幹、枝）：平行移動標架；capTip = 末端封口
    tube(pts, rads, radial, col = null, capTip = false) {
      const n = pts.length, start = this.count;
      const Tg = new V3(), N = new V3(), B = new V3(), tmp = new V3();
      let prev = null;
      for (let i = 0; i < n; i++) {
        Tg.subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        if (!prev) {
          tmp.set(0, 1, 0);
          if (Math.abs(Tg.y) > 0.9) tmp.set(1, 0, 0);
          N.crossVectors(Tg, tmp).normalize();
        } else {
          N.copy(prev).addScaledVector(Tg, -prev.dot(Tg)).normalize();
        }
        prev = N.clone();
        B.crossVectors(Tg, N);
        const p = pts[i], r = rads[i];
        for (let j = 0; j < radial; j++) {
          const a = (j / radial) * TAU, cs = Math.cos(a), sn = Math.sin(a);
          this.vert(p.x + (N.x * cs + B.x * sn) * r, p.y + (N.y * cs + B.y * sn) * r, p.z + (N.z * cs + B.z * sn) * r, col);
        }
      }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
        const a = start + i * radial + j, b = start + i * radial + ((j + 1) % radial);
        this.tri(a, b, b + radial);
        this.tri(a, b + radial, a + radial);
      }
      if (capTip) {
        const p = pts[n - 1];
        const c = this.vert(p.x + Tg.x * rads[n - 1] * 0.6, p.y + Tg.y * rads[n - 1] * 0.6, p.z + Tg.z * rads[n - 1] * 0.6, col);
        const s0 = start + (n - 1) * radial;
        for (let j = 0; j < radial; j++) this.tri(s0 + j, s0 + ((j + 1) % radial), c);
      }
    }

    // 葉團：變形球。o = { c, rx, ry, rz, basis?[X,Y,Z], detail, bumps, base, flatBottom, noiseAmp, noiseFreq,
    //                     lobes?(ux,uz)→倍率, color(ux,uy,uz,bump,wx,wy,wz)→[r,g,b], hint(ux,uy,uz,wx,wy,wz)→[x,y,z] }
    blob(o) {
      const sp = unitSphere(o.detail), start = this.count;
      const base = o.base ?? 0.8, fb = o.flatBottom ?? 1, na = o.noiseAmp ?? 0, nf = o.noiseFreq ?? 2;
      const off = o.noiseOff ?? 0;
      const bs = o.basis;
      for (let i = 0; i < sp.pos.length; i += 3) {
        const ux = sp.pos[i], uy = sp.pos[i + 1], uz = sp.pos[i + 2];
        const bump = o.bumps ? bumpAt(o.bumps, ux, uy, uz) : 0;
        let s = base + bump;
        if (na) s += na * (noise3.fbm(ux * nf + off, uy * nf + off * 0.7, uz * nf - off, 2) - 0.5) * 2;
        const lob = o.lobes ? o.lobes(ux, uz) : 1;
        const lx = ux * s * lob * o.rx, ly = uy * s * (uy < 0 ? fb : 1) * o.ry, lz = uz * s * lob * o.rz;
        let wx, wy, wz;
        if (bs) {
          wx = o.c.x + bs[0].x * lx + bs[1].x * ly + bs[2].x * lz;
          wy = o.c.y + bs[0].y * lx + bs[1].y * ly + bs[2].y * lz;
          wz = o.c.z + bs[0].z * lx + bs[1].z * ly + bs[2].z * lz;
        } else { wx = o.c.x + lx; wy = o.c.y + ly; wz = o.c.z + lz; }
        this.vert(wx, wy, wz, o.color ? o.color(ux, uy, uz, bump, wx, wy, wz) : null, o.hint ? o.hint(ux, uy, uz, wx, wy, wz) : null);
      }
      for (let i = 0; i < sp.idx.length; i += 3) this.tri(start + sp.idx[i], start + sp.idx[i + 1], start + sp.idx[i + 2]);
    }

    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      if (this.col) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      g.setIndex(this.idx);
      g.computeVertexNormals();
      if (this.hint) { // 葉團法線往「團中心／樹冠中心向外」偏，光影比較柔、成團
        const n = g.attributes.normal.array, h = this.hint;
        for (let i = 0; i < n.length; i += 3) {
          const x = n[i] + h[i], y = n[i + 1] + h[i + 1], z = n[i + 2] + h[i + 2];
          const l = Math.hypot(x, y, z) || 1;
          n[i] = x / l; n[i + 1] = y / l; n[i + 2] = z / l;
        }
      }
      g.computeBoundingBox();
      g.computeBoundingSphere();
      return g;
    }
  }

  const blendHint = (ux, uy, uz, wx, wy, wz, cc, a = 0.5, b = 0.5) => {
    let dx = wx - cc.x, dy = wy - cc.y, dz = wz - cc.z;
    const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    return [ux * a + dx * b, uy * a + dy * b, uz * a + dz * b];
  };

  // ===========================================================================
  // 龍柏：火焰形圓錐，表面兩層螺旋扭轉的雲狀葉團
  // ===========================================================================
  function makeCypress(r, Ht, hero) {
    const fol = new GB(true), bark = new GB(false);
    const NR = hero ? 120 : 28, NS = hero ? 84 : 20;
    const yb = 0.25;
    const Rmax = Ht * r.range(0.165, 0.185);
    const ph = r() * TAU;
    const prof = (t) => Rmax * (0.6 + 0.4 * smooth(0, 0.16, t)) * Math.pow(Math.max(0, 1 - t), 0.78) * (1 + 0.04 * Math.sin(t * 9 + ph));
    const leanA = r() * TAU, leanM = r.range(0.04, 0.16);
    const cen = (t) => [Math.cos(leanA) * leanM * t * t, Math.sin(leanA) * leanM * t * t];
    const twist = r.range(1.6, 2.6) * r.sign(); // 往上扭轉（龍柏的「龍」）
    const alpha = 0.6 * Math.sign(twist);       // 葉團斜向拉長的角度

    // 葉團中心（表面座標：θ、y）
    const puffs = [];
    // 依表面積分配：t 取樣用 R(t) 加權（下粗上細）
    const cdf = [];
    let acc = 0;
    for (let i = 0; i <= 200; i++) { acc += Math.max(prof(i / 200), 0.05); cdf.push(acc); }
    const tAt = (u) => { const v = u * acc; let i = 0; while (i < 200 && cdf[i] < v) i++; return i / 200; };
    const addPuffs = (count, sizeK, ampK, a0) => {
      for (let i = 0; i < count; i++) {
        const t = clamp(tAt((i + r()) / count), 0, 0.985);
        const R = Math.max(prof(t), 0.12);
        const rs = clamp(R * 0.42, 0.14, 0.52) * sizeK * r.range(0.8, 1.2);
        puffs.push({ th: a0 + i * GOLDEN + r.range(-0.4, 0.4) + twist * t, y: yb + t * (Ht - yb), rs, amp: rs * ampK, R });
      }
    };
    addPuffs(hero ? 64 : 34, 1, 0.75, r() * TAU);
    addPuffs(hero ? 240 : 70, 0.5, 0.65, r() * TAU);
    const ca = Math.cos(alpha), sa = Math.sin(alpha);

    for (let i = 0; i < NR; i++) {
      const t = i / NR; // 最後一圈之上是尖頂
      const y = yb + t * (Ht - yb);
      const R = prof(t);
      const [cx, cz] = cen(t);
      for (let j = 0; j < NS; j++) {
        const th = (j / NS) * TAU;
        let m = 0;
        for (let k = 0; k < puffs.length; k++) {
          const p = puffs[k];
          const dv = y - p.y;
          if (dv > p.rs * 1.7 || dv < -p.rs * 1.7) continue;
          let dth = th - p.th;
          dth = dth - Math.round(dth / TAU) * TAU;
          const du = dth * Math.max(R, p.R * 0.5);
          const pu = du * ca + dv * sa, qv = -du * sa + dv * ca;
          const d2 = (pu * pu) / (p.rs * p.rs) + (qv * qv) / (p.rs * p.rs * 2.6);
          if (d2 < 1) { const v = p.amp * Math.sqrt(1 - d2); if (v > m) m = v; }
        }
        const cs = Math.cos(th), sn = Math.sin(th);
        let rr = R * 0.86 + m * Math.min(1, R / 0.25 + 0.2);
        if (hero) rr += (noise3(cs * 6 + 3, y * 6, sn * 6) - 0.5) * 0.08 + (noise3(cs * 17, y * 17, sn * 17 + 5) - 0.5) * 0.05 + (noise3(cs * 40, y * 40, sn * 40 + 9) - 0.5) * 0.025;
        else rr += (noise3(cs * 3, y * 3, sn * 3) - 0.5) * 0.06;
        rr = Math.max(rr, 0.02);
        const bmp = clamp(m / (0.3 * Math.max(R, 0.3)), 0, 1);
        const nv = noise3(cs * 2 + 9, y * 1.3, sn * 2) - 0.5;
        const b = (0.42 + 0.78 * Math.sqrt(bmp) + 0.16 * t + nv * 0.2) * 1.15;
        fol.vert(cx + cs * rr, y, cz + sn * rr, [b * 0.96, b, b * 0.8], [cs * 0.55, 0.2, sn * 0.55]);
      }
    }
    // 尖頂、底部中心
    const [tx, tz] = cen(1);
    const top = fol.vert(tx, Ht, tz, [1.0, 1.04, 0.85], [0, 0.8, 0]);
    const bot = fol.vert(0, yb - 0.08, 0, [0.35, 0.38, 0.32], [0, -0.8, 0]);
    for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NS; j++) {
      const a = i * NS + j, b = i * NS + ((j + 1) % NS), c = a + NS, d = b + NS;
      fol.tri(a, d, b); fol.tri(a, c, d);
    }
    const last = (NR - 1) * NS;
    for (let j = 0; j < NS; j++) {
      fol.tri(last + j, top, last + ((j + 1) % NS));
      fol.tri(j, (j + 1) % NS, bot);
    }
    // 短樹幹（大多被葉子蓋住）
    bark.tube([new V3(0, -0.3, 0), new V3(0, yb + 0.35, 0)], [0.13, 0.11], hero ? 10 : 6);
    return { fol: fol.geometry(), bark: bark.geometry(), H: Ht, R: Rmax };
  }

  // ===========================================================================
  // 闊葉樹（樟樹、榕樹、茄苳感）：主幹分叉→主枝→小枝，枝端一團團葉團，留縫
  // o = { H, W, clumps, clumpR, spacing, detail, limbs, twigs, satellites, trunkClear, radialT, radialL }
  // ===========================================================================
  function makeBroadleaf(r, o) {
    const fol = new GB(true), bark = new GB(false);
    const Ht = o.H, W = o.W;
    const yFork = o.trunkClear ?? Ht * r.range(0.26, 0.36);
    const leanA = r() * TAU, leanM = Ht * r.range(0.0, 0.035);
    const F = new V3(Math.cos(leanA) * leanM, yFork, Math.sin(leanA) * leanM);
    const crownBot = yFork + (Ht - yFork) * 0.1;
    const cc = new V3(F.x * 1.5, (Ht + crownBot) / 2, F.z * 1.5);
    const crx = W / 2, cry = (Ht - crownBot) / 2, crz = (W / 2) * r.range(0.82, 1.0);
    const crot = r() * TAU, cR = Math.cos(crot), sR = Math.sin(crot);
    const rC = o.clumpR ?? W * 0.2;
    const sq = 0.8; // 葉團垂直壓扁
    const clumps = [];
    const mk = (p, rr) => ({ p, r: rr, tone: r.range(0.86, 1.1), yel: r.range(-0.04, 0.08) });
    clumps.push(mk(new V3(cc.x + r.range(-0.4, 0.4), Ht - rC * sq * 1.05, cc.z + r.range(-0.4, 0.4)), rC * 1.05));
    let tries = 0;
    while (clumps.length < o.clumps && tries++ < o.clumps * 120) {
      const d = randUnit(r);
      if (d.y < -0.5 && r() < 0.85) continue;
      const rr = rC * r.range(0.75, 1.2);
      const f = 0.45 + 0.55 * Math.sqrt(r());
      const ex = Math.max(0.3, crx - rr * 0.65), ey = Math.max(0.3, cry - rr * sq * 0.7), ez = Math.max(0.3, crz - rr * 0.65);
      const lx = d.x * ex * f, lz = d.z * ez * f;
      const p = new V3(cc.x + lx * cR - lz * sR, cc.y + d.y * ey * f, cc.z + lx * sR + lz * cR);
      if (p.y - rr * sq < crownBot - 0.3) continue;
      if (p.y + rr * sq > Ht) continue;
      let ok = true;
      for (const c of clumps) if (c.p.distanceTo(p) < (c.r + rr) * o.spacing) { ok = false; break; }
      if (ok) clumps.push(mk(p, rr));
    }

    // --- 樹幹 ---
    const r0 = 0.1 + Ht * 0.022;
    const trunkPts = [], trunkR = [];
    const nT = o.hero ? 8 : 4;
    const wig = r() * TAU;
    for (let i = 0; i < nT; i++) {
      const t = i / (nT - 1);
      const w = Math.sin(t * Math.PI) * r0 * 0.6;
      trunkPts.push(new V3(F.x * Math.pow(t, 1.5) + Math.cos(wig) * w, lerp(-0.3, yFork, t), F.z * Math.pow(t, 1.5) + Math.sin(wig) * w));
      trunkR.push(r0 * (i === 0 ? 1.4 : lerp(1.12, 0.8, t)));
    }
    bark.tube(trunkPts, trunkR, o.radialT ?? 7);

    // --- 主枝：依方位把葉團分組，每組一支主枝 ---
    const K = o.limbs;
    const rot = r() * TAU;
    const groups = Array.from({ length: K }, () => []);
    for (const c of clumps) {
      let a = Math.atan2(c.p.z - F.z, c.p.x - F.x) - rot;
      a = ((a % TAU) + TAU) % TAU;
      groups[Math.floor((a / TAU) * K) % K].push(c);
    }
    const samples = [];
    const qb = (a, m, b, t) => new V3().copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(m, 2 * (1 - t) * t).addScaledVector(b, t * t);
    const nL = o.hero ? 7 : 4;
    for (const g of groups) {
      if (!g.length) continue;
      const G = new V3();
      for (const c of g) G.add(c.p);
      G.multiplyScalar(1 / g.length);
      const S = F.clone().add(new V3(0, -0.4, 0));
      const E = F.clone().lerp(G, 0.78);
      const Mp = F.clone().lerp(E, 0.45);
      Mp.y += (E.y - F.y) * 0.12;
      Mp.x += r.range(-0.6, 0.6); Mp.z += r.range(-0.6, 0.6);
      const pts = [], rads = [];
      for (let i = 0; i < nL; i++) {
        const t = i / (nL - 1);
        const p = qb(S, Mp, E, t);
        pts.push(p);
        rads.push(r0 * lerp(0.62, 0.2, t));
        samples.push({ p, r: rads[i] });
      }
      bark.tube(pts, rads, o.radialL ?? 5, null, true);
      if (o.twigs) {
        for (const c of g) {
          let best = samples[0], bd = Infinity;
          for (const s of samples) { const d = s.p.distanceTo(c.p); if (d < bd) { bd = d; best = s; } }
          const a = best.p, b = c.p.clone().lerp(a, 0.12);
          const m = a.clone().lerp(b, 0.5);
          m.y += bd * 0.12;
          m.x += r.range(-0.3, 0.3); m.z += r.range(-0.3, 0.3);
          const r1 = Math.min(best.r * 0.7, 0.14);
          bark.tube([a, qb(a, m, b, 0.35), qb(a, m, b, 0.7), b], [r1, r1 * 0.7, r1 * 0.5, 0.025], 5, null, true);
          // 細小分枝伸進葉團邊緣（逆光時從縫隙看得到）
          if (o.hero) for (let k = 0; k < 2; k++) {
            const tip = c.p.clone().add(randUnit(r).multiplyScalar(c.r * 0.9));
            tip.y = Math.max(tip.y, c.p.y - c.r * 0.3);
            const st = qb(a, m, b, r.range(0.5, 0.85));
            bark.tube([st, st.clone().lerp(tip, 0.5).add(new V3(0, 0.15, 0)), tip], [0.035, 0.022, 0.01], 4);
          }
        }
      }
    }

    // --- 葉團 ---
    const det = o.detail;
    for (const c of clumps) {
      const out = c.p.clone().sub(cc).normalize();
      const bumps = o.hero
        ? makeBumps(r, 26, { wMin: 0.35, wMax: 0.62, aMin: 0.2, aMax: 0.34, upBias: 0.2 })
        : det >= 2
          ? makeBumps(r, 15, { wMin: 0.42, wMax: 0.7, aMin: 0.22, aMax: 0.34, upBias: 0.25 })
          : makeBumps(r, 11, { wMin: 0.55, wMax: 0.9, aMin: 0.2, aMax: 0.32, upBias: 0.25 });
      const col = (ux, uy, uz, bump, wx, wy, wz) => {
        const od = ux * out.x + uy * out.y + uz * out.z;
        const hgt = clamp((wy - crownBot) / (Ht - crownBot), 0, 1);
        const fine = o.hero ? (noise3(wx * 3.1, wy * 3.1, wz * 3.1) - 0.5) * 0.25 : 0;
        const b = (0.5 + 0.36 * clamp(bump / 0.28, 0, 1) + 0.16 * (od * 0.5 + 0.5) + 0.12 * hgt + 0.06 * uy + fine) * c.tone;
        return [b * (1 + c.yel), b, b * (0.86 - c.yel)];
      };
      const hint = (ux, uy, uz, wx, wy, wz) => blendHint(ux, uy, uz, wx, wy, wz, cc, 0.45, 0.45);
      fol.blob({
        c: c.p, rx: c.r, ry: c.r * sq, rz: c.r * r.range(0.88, 1.1), detail: det, bumps, base: 0.8, flatBottom: 0.72,
        noiseAmp: o.hero ? 0.1 : det >= 2 ? 0.07 : 0.05, noiseFreq: o.hero ? 3 : det >= 2 ? 2.2 : 1.6, noiseOff: r() * 50, color: col, hint,
      });
      if (!o.hero) continue;
      // 主角樹：葉團外側再黏一圈小葉簇（花椰菜狀），剪影邊緣碎而有層次
      const nsub = r.int(5, 8);
      for (let k = 0; k < nsub; k++) {
        const dir = out.clone().multiplyScalar(0.7).add(randUnit(r));
        dir.y = Math.max(dir.y, -0.35);
        dir.normalize();
        const sr = c.r * r.range(0.3, 0.45);
        const sp = c.p.clone().addScaledVector(dir, c.r * r.range(0.72, 0.9));
        sp.y = c.p.y + (sp.y - c.p.y) * sq;
        fol.blob({
          c: sp, rx: sr, ry: sr * 0.82, rz: sr, detail: 1, bumps: makeBumps(r, 9, { wMin: 0.5, wMax: 0.9, aMin: 0.2, aMax: 0.35 }),
          base: 0.78, flatBottom: 0.8, noiseAmp: 0.07, noiseFreq: 2.5, noiseOff: r() * 50, color: col, hint,
        });
      }
      // 再往外散一兩簇離開本體的小葉簇（逆光時邊緣透光）
      const ns = o.satellites ? r.int(o.satellites[0], o.satellites[1]) : 0;
      for (let k = 0; k < ns; k++) {
        const dir = out.clone().multiplyScalar(0.8).add(randUnit(r));
        dir.y = clamp(dir.y, -0.3, 0.35);
        dir.normalize();
        const sr = c.r * r.range(0.2, 0.32);
        const sp = c.p.clone().addScaledVector(dir, c.r * r.range(1.02, 1.2));
        fol.blob({
          c: sp, rx: sr, ry: sr * 0.8, rz: sr, detail: 1, bumps: makeBumps(r, 8, { wMin: 0.6, wMax: 1.0, aMin: 0.2, aMax: 0.35 }),
          base: 0.78, flatBottom: 0.8, noiseAmp: 0.06, noiseFreq: 2, noiseOff: r() * 50, color: col, hint,
        });
        // 連到小葉簇的細枝
        const from = c.p.clone().lerp(sp, 0.35);
        bark.tube([from, from.clone().lerp(sp, 0.5).add(new V3(0, 0.1, 0)), sp], [0.03, 0.02, 0.01], 4);
      }
    }
    return { fol: fol.geometry(), bark: bark.geometry(), H: Ht, R: W / 2 };
  }

  // ===========================================================================
  // 造型松：S 形樹幹、往外伸的枝，枝端扁平雲片葉團（上面圓頂、底面平）
  // ===========================================================================
  function makePomPine(r, Ht, hero) {
    const fol = new GB(true), bark = new GB(false);
    const k = Ht / 6;
    const det = hero ? 10 : 4;
    const a1 = r() * TAU, a2 = a1 + r.range(1.4, 2.6);
    const A1 = r.range(0.35, 0.6) * k, A2 = r.range(0.18, 0.35) * k;
    const trunkTop = Ht - 0.7 * k;
    const tp = (t) => new V3(
      Math.cos(a1) * A1 * Math.sin(t * Math.PI * 0.9) + Math.cos(a2) * A2 * Math.sin(t * Math.PI * 1.9),
      lerp(-0.3, trunkTop, t),
      Math.sin(a1) * A1 * Math.sin(t * Math.PI * 0.9) + Math.sin(a2) * A2 * Math.sin(t * Math.PI * 1.9));
    const NT = hero ? 16 : 8;
    const tpts = [], trad = [];
    for (let i = 0; i < NT; i++) {
      const t = i / (NT - 1);
      tpts.push(tp(t));
      trad.push(lerp(0.24, 0.07, Math.pow(t, 0.8)) * k * (i === 0 ? 1.35 : 1));
    }
    bark.tube(tpts, trad, hero ? 12 : 7, null, true);

    // 雲片：上面是一顆顆小圓頂（修剪後的針葉簇），底面平
    const pad = (c, a, b) => {
      const bumps = makeBumps(r, hero ? 30 : 16, { wMin: hero ? 0.24 : 0.32, wMax: hero ? 0.42 : 0.5, aMin: 0.2, aMax: 0.32, upBias: 0.45 });
      const p1 = r() * TAU, p2 = r() * TAU;
      const lobes = (ux, uz) => { const ang = Math.atan2(uz, ux); return 1 + 0.12 * Math.sin(3 * ang + p1) + 0.07 * Math.sin(5 * ang + p2); };
      const tone = r.range(0.92, 1.08);
      const off = r() * 50;
      fol.blob({
        c, rx: a, ry: b, rz: a * r.range(0.85, 1.0), detail: det, bumps, base: 0.76, flatBottom: 0.38, lobes,
        noiseAmp: hero ? 0.1 : 0.07, noiseFreq: hero ? 7 : 4, noiseOff: off,
        color: (ux, uy, uz, bump, wx, wy, wz) => {
          const fine = hero ? (noise3(wx * 9 + off, wy * 9, wz * 9) - 0.5) * 0.3 : 0;
          const b2 = uy > -0.15
            ? (0.42 + 0.7 * clamp(bump / 0.28, 0, 1) + 0.12 * uy + fine) * tone * 1.6
            : (0.3 + 0.18 * (1 + uy)) * tone * 1.6;
          return [b2 * 0.95, b2, b2 * 0.78];
        },
        hint: (ux, uy, uz) => [ux * 0.5, uy * 0.35 + 0.1, uz * 0.5],
      });
      if (hero) { // 葉團底下的細枝
        for (let j = 0; j < 4; j++) {
          const ang = r() * TAU, len = a * r.range(0.45, 0.8);
          const e = new V3(c.x + Math.cos(ang) * len, c.y - b * 0.3, c.z + Math.sin(ang) * len);
          bark.tube([new V3(c.x, c.y - b * 0.35, c.z), e], [0.035 * k, 0.012], 4);
        }
      }
    };

    const n = hero ? 6 : r.int(4, 6);
    let az = r() * TAU;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const t = lerp(0.34, 0.78, f) + r.range(-0.025, 0.025);
      const y = t * Ht;
      const base = tp((y + 0.3) / (trunkTop + 0.3));
      az += GOLDEN + r.range(-0.3, 0.3);
      const reach = lerp(1.55, 0.7, f) * k * r.range(0.85, 1.1);
      const dir = new V3(Math.cos(az), 0, Math.sin(az));
      const end = base.clone().addScaledVector(dir, reach);
      end.y += r.range(0.12, 0.35) * k;
      const mid = base.clone().addScaledVector(dir, reach * 0.5);
      mid.y -= 0.12 * k;
      bark.tube([base, mid, end], [0.11 * k * lerp(1, 0.7, f), 0.07 * k, 0.045 * k], hero ? 8 : 5, null, true);
      const a = lerp(1.12, 0.72, f) * k * r.range(0.9, 1.08);
      const b = r.range(0.38, 0.48) * k;
      pad(end.clone().add(new V3(0, b * 0.25, 0)), a, b);
    }
    const topP = tp(1);
    const bt = 0.6 * k;
    pad(new V3(topP.x, Ht - bt * 1.08, topP.z), 0.85 * k, bt);
    return { fol: fol.geometry(), bark: bark.geometry() };
  }

  // ===========================================================================
  // 高大針葉樹（肯氏南洋杉／黑松感）：直幹、輪生枝、枝端簇狀葉團
  // ===========================================================================
  function makeConifer(r, Ht) {
    const fol = new GB(true), bark = new GB(false);
    const sway = r() * TAU, swayM = r.range(0.1, 0.5);
    const tc = (y) => new V3(Math.cos(sway) * swayM * (y / Ht) ** 2, y, Math.sin(sway) * swayM * (y / Ht) ** 2);
    const tpts = [], trad = [];
    for (let i = 0; i < 8; i++) {
      const y = lerp(-0.3, Ht - 0.4, i / 7);
      tpts.push(tc(y));
      trad.push(lerp(0.5, 0.06, i / 7) * (Ht / 20) * (i === 0 ? 1.3 : 1));
    }
    bark.tube(tpts, trad, 8, null, true);
    const tone0 = r.range(0.9, 1.05);
    const tuft = (c, basis, rx, ry, rz) => {
      const bumps = makeBumps(r, 10, { wMin: 0.6, wMax: 0.95, aMin: 0.22, aMax: 0.36, upBias: 0.3 });
      const tone = tone0 * r.range(0.9, 1.1);
      fol.blob({
        c, basis, rx, ry, rz, detail: 1, bumps, base: 0.78, flatBottom: 0.6, noiseAmp: 0.06, noiseFreq: 2, noiseOff: r() * 50,
        color: (ux, uy, uz, bump, wx, wy) => {
          const b = (0.48 + 0.4 * clamp(bump / 0.3, 0, 1) + 0.12 * uy + 0.12 * (wy / Ht)) * tone * 1.5;
          return [b * 0.95, b, b * 0.85];
        },
        hint: (ux, uy, uz) => [ux * 0.4, uy * 0.4 + 0.15, uz * 0.4],
      });
    };
    let y = r.range(3.5, 5);
    let rotW = r() * TAU;
    while (y < Ht - 1.6) {
      const nb = r.int(3, 5);
      rotW += r.range(0.5, 1.2);
      const t = y / Ht;
      for (let j = 0; j < nb; j++) {
        if (r() < 0.18) continue; // 缺枝，讓剪影不規則
        const az = rotW + (j / nb) * TAU + r.range(-0.35, 0.35);
        const Lb = ((0.07 + 0.2 * (1 - t)) * Ht * r.range(0.7, 1.15)) + 0.8;
        const dir = new V3(Math.cos(az), 0, Math.sin(az));
        const p0 = tc(y);
        const p1 = p0.clone().addScaledVector(dir, Lb * 0.5); p1.y -= Lb * 0.08;
        const p2 = p0.clone().addScaledVector(dir, Lb); p2.y += Lb * 0.1;
        bark.tube([p0, p1, p2], [0.1 * (Ht / 20) * (1.2 - t), 0.06, 0.03], 4, null, true);
        const side = new V3(-dir.z, 0, dir.x);
        const up = new V3(0, 1, 0);
        const basis = [dir, up, side]; // dir × up = side → 右手系
        const nt = Lb > 4.5 ? 3 : Lb > 2.5 ? 2 : 1;
        for (let q = 0; q < nt; q++) {
          const s = nt === 1 ? 0.8 : lerp(0.5, 1.0, q / (nt - 1));
          const c = p0.clone().lerp(p2, s); c.y += 0.2;
          tuft(c, basis, Math.max(0.9, Lb * 0.24) * r.range(0.85, 1.15), r.range(0.65, 0.95), r.range(1.1, 1.6));
        }
      }
      y += r.range(1.1, 1.7);
    }
    const top = tc(Ht - 1.2);
    tuft(top, null, 1.0, 1.6, 1.0);
    tuft(tc(Ht - 2.6), null, 1.4, 1.0, 1.4);
    return { fol: fol.geometry(), bark: bark.geometry() };
  }

  // ===========================================================================
  // 大王椰子：灰白樹幹（中段微膨大）、綠色冠莖、羽狀葉
  // ===========================================================================
  function makePalm(r, Ht) {
    const trunk = new GB(false), crown = new GB(false);
    const hT = Ht * r.range(0.78, 0.82);
    const la = r() * TAU, lm = r.range(0.05, 0.35);
    const cx = (y) => Math.cos(la) * lm * (y / Ht) ** 2, cz = (y) => Math.sin(la) * lm * (y / Ht) ** 2;
    const tpts = [], trad = [];
    for (let i = 0; i < 8; i++) {
      const t = i / 7, y = lerp(-0.3, hT, t);
      tpts.push(new V3(cx(y), y, cz(y)));
      trad.push(i === 0 ? 0.46 : 0.27 + 0.08 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + (t < 0.15 ? 0.06 : 0));
    }
    trunk.tube(tpts, trad, 9);
    const cs = [], crad = [0.26, 0.3, 0.29, 0.24, 0.17];
    for (let i = 0; i < 5; i++) { const y = lerp(hT - 0.15, Ht, i / 4); cs.push(new V3(cx(y), y, cz(y))); }
    crown.tube(cs, crad, 9, null, true);
    const Tp = new V3(cx(Ht), Ht + 0.05, cz(Ht));
    const nF = 15, S = 16;
    let phi = r() * TAU;
    for (let f = 0; f < nF; f++) {
      phi += GOLDEN + r.range(-0.15, 0.15);
      const age = f / (nF - 1);
      const e0 = lerp(62, -22, age) * Math.PI / 180 + r.range(-0.1, 0.1);
      const droop = r.range(55, 85) * Math.PI / 180 * lerp(0.75, 1.2, age);
      const Lf = r.range(3.8, 4.8);
      const dirH = new V3(Math.cos(phi), 0, Math.sin(phi));
      const side = new V3(-dirH.z, 0, dirH.x);
      const beta = r.range(0.55, 0.85); // 小葉往下垂的角度（大王椰子小葉多方向下垂，羽葉看起來蓬鬆）
      const lD = side.clone().multiplyScalar(Math.cos(beta)).add(new V3(0, -Math.sin(beta), 0));
      const rD = side.clone().multiplyScalar(-Math.cos(beta)).add(new V3(0, -Math.sin(beta), 0));
      let p = Tp.clone().addScaledVector(dirH, 0.15);
      const rach = [], ls = [], rs = [];
      for (let i = 0; i <= S; i++) {
        const s = i / S;
        const e = e0 - droop * Math.pow(s, 1.3);
        if (i > 0) p = p.clone().add(new V3(Math.cos(e) * dirH.x, Math.sin(e), Math.cos(e) * dirH.z).multiplyScalar(Lf / S));
        const w = (0.85 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.1 + 0.02)), 0.7) + 0.04) * (i % 2 ? 0.35 : 1);
        rach.push(crown.vert(p.x, p.y, p.z));
        ls.push(crown.vert(p.x + lD.x * w, p.y + lD.y * w, p.z + lD.z * w));
        rs.push(crown.vert(p.x + rD.x * w, p.y + rD.y * w, p.z + rD.z * w));
      }
      for (let i = 0; i < S; i++) {
        crown.tri(rach[i], ls[i], rach[i + 1]); crown.tri(ls[i], ls[i + 1], rach[i + 1]);
        crown.tri(rach[i], rach[i + 1], rs[i]); crown.tri(rs[i], rach[i + 1], rs[i + 1]);
      }
    }
    return { fol: crown.geometry(), bark: trunk.geometry(), H: Ht };
  }

  // ===========================================================================
  // 放置規則
  // ===========================================================================
  // 鏡頭路徑取樣：相機（以及每顆鏡頭開頭的視線）會經過的地方不種一般樹
  const camPts = [];
  for (let t = 0; t < TOTAL_DURATION; t += 0.05) {
    const s = evaluateTimeline(t);
    if (s.position.y < 34) camPts.push(s.position.clone());
  }
  for (const sh of SHOTS) {
    for (let k = 0; k <= 16; k++) camPts.push(sh.from.pos.clone().lerp(sh.from.target, (k / 16) * 0.85));
  }
  let camRemoved = 0;
  const camClear = (x, z, h, cr) => {
    for (const p of camPts) {
      if (p.y > h + 1.0) continue;
      const dx = p.x - x, dz = p.z - z;
      if (dx * dx + dz * dz < (cr + 1.2) * (cr + 1.2)) { camRemoved++; return false; }
    }
    return true;
  };
  const near = (x, z, list, d) => list.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < d * d);

  const stats = { species: {}, drawCalls: 0 };
  const addStat = (name, tris, n) => {
    const s = stats.species[name] || (stats.species[name] = { trees: 0, triangles: 0 });
    s.trees += n; s.triangles += tris;
  };
  const triCount = (g) => g.index.count / 3;

  // BatchedMesh：變體幾何＋每棵的矩陣與色調，一個材質一個 draw call
  function batched(name, material, geoms, placements, withColor) {
    let maxV = 0, maxI = 0;
    for (const g of geoms) { maxV += g.attributes.position.count; maxI += g.index.count; }
    const bm = new THREE.BatchedMesh(Math.max(1, placements.length), maxV, maxI, material);
    const ids = geoms.map((g) => bm.addGeometry(g));
    let tris = 0;
    for (const p of placements) {
      const id = bm.addInstance(ids[p.v]);
      bm.setMatrixAt(id, p.m);
      if (withColor && p.c) bm.setColorAt(id, p.c);
      tris += triCount(geoms[p.v]);
    }
    bm.name = name;
    bm.castShadow = true;
    bm.receiveShadow = true;
    bm.computeBoundingBox();
    bm.computeBoundingSphere();
    group.add(bm);
    stats.drawCalls++;
    return tris;
  }
  const mat4 = (x, y, z, rotY, sx, sy, sz) => new THREE.Matrix4().compose(
    new V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), rotY), new V3(sx, sy, sz));

  // ---------------------------------------------------------------------------
  // 1) 龍柏
  // ---------------------------------------------------------------------------
  {
    const r = makeRng('trees/cypress');
    const VH = 7.0, NV = 6;
    const vars = [];
    for (let i = 0; i < NV; i++) vars.push(makeCypress(r.fork(`v${i}`), VH, false));
    const hero = makeCypress(makeRng('trees/cypress/hero'), H.cypress.height, true);
    const places = [];
    const R = T.cypressRows;
    for (const z of R.zs) {
      for (let x = R.x0; x <= R.x1 + 1e-6; x += R.spacing) {
        if (Math.hypot(x - H.cypress.x, z - H.cypress.z) < R.spacing * 0.5) continue; // 主角樹位置
        if (!geo.isFree(x, z, 0.4)) continue;                                       // 橫向步道、側門步道開口
        const h = r.range(R.height[0], R.height[1]);
        const sy = h / VH, sxz = Math.pow(sy, 0.6) * r.range(0.94, 1.06);
        if (!camClear(x, z, h, 1.4 * sxz)) continue;
        const tone = r.range(0.88, 1.06);
        places.push({ v: r.int(0, NV - 1), m: mat4(x, L.LEVELS.lawn, z, r() * TAU, sxz, sy, sxz),
          c: new THREE.Color(tone * r.range(0.95, 1.06), tone, tone * r.range(0.82, 0.95)) });
      }
    }
    places.push({ v: NV, m: mat4(H.cypress.x, L.LEVELS.lawn, H.cypress.z, 0.7, 1, 1, 1), c: new THREE.Color(1, 1, 0.92) });
    const geomsF = [...vars.map((v) => v.fol), hero.fol];
    const geomsB = [...vars.map((v) => v.bark), hero.bark];
    const t1 = batched('cypress-foliage', M.foliageCypressVC, geomsF, places, true);
    const t2 = batched('cypress-trunk', M.bark, geomsB, places, false);
    addStat('cypress', t1 + t2, places.length);
  }

  // ---------------------------------------------------------------------------
  // 2) 闊葉樹（林帶、庭園散植、主角逆光樹）＋行道樹（同材質、同一組 BatchedMesh）
  // ---------------------------------------------------------------------------
  {
    const r = makeRng('trees/broadleaf');
    const vars = [];
    const varH = [9, 10.5, 12, 13, 14.5, 15.5, 17, 18];
    for (let i = 0; i < varH.length; i++) {
      const rv = r.fork(`v${i}`);
      const Hh = varH[i];
      vars.push(makeBroadleaf(rv, {
        H: Hh, W: Hh * rv.range(0.72, 0.98), clumps: rv.int(9, 12), clumpR: Hh * rv.range(0.16, 0.2), spacing: 0.62,
        detail: 1, limbs: rv.int(3, 4), twigs: false, radialT: 7, radialL: 4,
      }));
    }
    const street0 = vars.length;
    const streetH = [7, 7.8, 8.5, 9.3, 10];
    for (let i = 0; i < streetH.length; i++) {
      const rv = r.fork(`s${i}`);
      const Hh = streetH[i];
      vars.push(makeBroadleaf(rv, {
        H: Hh, W: Hh * rv.range(0.62, 0.78), clumps: rv.int(7, 8), clumpR: Hh * 0.19, spacing: 0.62,
        detail: 1, limbs: 3, twigs: false, trunkClear: rv.range(2.6, 3.2), radialT: 6, radialL: 4,
      }));
    }
    // 近景變體：中式庭園散植（鏡頭 2、5、6 會近看），葉團細分高一級
    const near0 = vars.length;
    const nearH = [8, 9.5, 11, 12, 13, 14];
    for (let i = 0; i < nearH.length; i++) {
      const rv = r.fork(`n${i}`);
      const Hh = nearH[i];
      vars.push(makeBroadleaf(rv, {
        H: Hh, W: Hh * rv.range(0.8, 1.02), clumps: rv.int(10, 13), clumpR: Hh * rv.range(0.15, 0.18), spacing: 0.66,
        detail: 2, limbs: rv.int(3, 5), twigs: true, radialT: 8, radialL: 5,
      }));
    }
    // 主角逆光樹：高細節、葉團之間留縫、外緣有小葉簇、枝條伸進葉團
    const heroIdx = vars.length;
    const heroDefs = [H.backlit, H.backlit2];
    heroDefs.forEach((hd, i) => {
      const rv = makeRng(`trees/broadleaf/hero${i}`);
      vars.push(makeBroadleaf(rv, {
        H: hd.height, W: hd.height * (i === 0 ? 0.92 : 0.88), clumps: i === 0 ? 46 : 36, clumpR: hd.height * 0.105,
        spacing: 0.92, detail: 4, limbs: 5, twigs: true, satellites: [1, 3], hero: true, radialT: 14, radialL: 9,
      }));
    });

    const places = [];
    const placed = [];
    const heroPts = heroDefs.map((h, i) => ({ x: h.x, z: h.z, r: vars[heroIdx + i].R }));
    const conPts = T.hallTallConifers;
    const tint = (rr) => {
      const k = rr();
      if (k < 0.12) return new THREE.Color(rr.range(1.08, 1.2), rr.range(0.92, 1.0), rr.range(0.55, 0.68)); // 偏黃（茄苳、老葉）
      if (k < 0.3) return new THREE.Color(rr.range(0.72, 0.82), rr.range(0.78, 0.88), rr.range(0.7, 0.8));  // 深綠（榕樹）
      const t = rr.range(0.86, 1.04);
      return new THREE.Color(t * rr.range(0.95, 1.06), t * rr.range(0.9, 0.98), t * rr.range(0.72, 0.85));
    };
    const pickVar = (h, lo, hi, hs) => {
      let best = lo, bd = Infinity;
      for (let i = lo; i < hi; i++) { const d = Math.abs(hs[i - lo] - h) + r() * 0.8; if (d < bd) { bd = d; best = i; } }
      return best;
    };
    const tryPlace = (x, z, h, y0, lo, hi, hs, minGap) => {
      const v = pickVar(h, lo, hi, hs);
      const s = clamp(h / vars[v].H, 0.85, 1.18);
      const cr = vars[v].R * s;
      if (heroPts.some((q) => Math.hypot(q.x - x, q.z - z) < (q.r + cr) * 0.72)) return false;
      if (near(x, z, conPts, 6.5)) return false;
      if (minGap && near(x, z, placed, minGap)) return false;
      if (!camClear(x, z, h, cr)) return false;
      places.push({ v, m: mat4(x, y0, z, r() * TAU, s * r.range(0.92, 1.08), s, s * r.range(0.92, 1.08)), c: tint(r) });
      placed.push({ x, z });
      return true;
    };
    // 林帶：抖動格點
    for (const b of T.belts) {
      const cell = Math.sqrt(1 / b.density);
      for (let z = b.z0 + cell / 2; z < b.z1; z += cell) {
        for (let x = b.x0 + cell / 2; x < b.x1; x += cell) {
          const px = clamp(x + r.range(-0.45, 0.45) * cell, b.x0, b.x1), pz = clamp(z + r.range(-0.45, 0.45) * cell, b.z0, b.z1);
          if (!geo.isFree(px, pz, 1.0)) continue;
          tryPlace(px, pz, r.range(10, 18), L.LEVELS.lawn, 0, street0, varH, 4.5);
        }
      }
    }
    // 中式庭園散植
    for (const g of L.GARDENS.chineseGardens) {
      const cell = Math.sqrt(1 / T.gardenScatter.density);
      for (let z = g.z0 + cell / 2; z < g.z1; z += cell) {
        for (let x = g.x0 + cell / 2; x < g.x1; x += cell) {
          const px = x + r.range(-0.45, 0.45) * cell, pz = z + r.range(-0.45, 0.45) * cell;
          if (!geo.inRect(px, pz, g, -2) || !geo.isFree(px, pz, 3.0)) continue;
          tryPlace(px, pz, r.range(8, 14), L.LEVELS.lawn, near0, heroIdx, nearH, 7);
        }
      }
    }
    const nPark = places.length;
    // 行道樹
    for (const s of T.streetTrees) {
      for (let u = s.from; u <= s.to + 1e-6; u += s.spacing) {
        const x = s.axis === 'x' ? u : s.x, z = s.axis === 'x' ? s.z : u;
        if (!geo.isFree(x, z, 0.5)) continue; // 路口、側門前
        tryPlace(x, z, r.range(7, 10), L.LEVELS.sidewalk, street0, near0, streetH, 0);
      }
    }
    const nStreet = places.length - nPark;
    heroDefs.forEach((hd, i) => {
      places.push({ v: heroIdx + i, m: mat4(hd.x, L.LEVELS.lawn, hd.z, i ? 2.1 : 0.4, 1, 1, 1), c: new THREE.Color(1.0, 0.97, 0.82) });
    });
    const t1 = batched('broadleaf-foliage', M.foliageVC, vars.map((v) => v.fol), places, true);
    const t2 = batched('broadleaf-trunk', M.bark, vars.map((v) => v.bark), places, false);
    addStat('broadleaf+street', t1 + t2, places.length);
    stats.species['broadleaf+street'].park = nPark;
    stats.species['broadleaf+street'].street = nStreet;
  }

  // ---------------------------------------------------------------------------
  // 3) 大王椰子（中山南路分隔島＋園區側人行道）
  // ---------------------------------------------------------------------------
  {
    const r = makeRng('trees/palm');
    const vars = [15.5, 16.5, 17.5, 18.5, 19.5].map((h, i) => makePalm(r.fork(`v${i}`), h));
    const crossRoads = [L.ROADS.xinyi.rect, L.ROADS.aiguoE.rect];
    const places = [];
    for (const row of T.palms) {
      for (let z = row.z0; z <= row.z1 + 1e-6; z += row.spacing) {
        if (row.skipZ && z >= row.skipZ[0] && z <= row.skipZ[1]) continue;
        if (crossRoads.some((rc) => geo.inRect(row.x, z, rc, 1.5))) continue; // 路口不種
        const v = r.int(0, vars.length - 1);
        const s = r.range(0.96, 1.04);
        if (!camClear(row.x, z, vars[v].H * s + 2, 4.5)) continue;
        const t = r.range(0.9, 1.05);
        places.push({ v, m: mat4(row.x, L.LEVELS.sidewalk, z, r() * TAU, s, s, s),
          c: new THREE.Color(t * r.range(0.98, 1.1), t, t * r.range(0.75, 0.9)) });
      }
    }
    const t1 = batched('palm-crown', M.palmFrond, vars.map((v) => v.fol), places, true);
    const t2 = batched('palm-trunk', M.barkPalm, vars.map((v) => v.bark), places, false);
    addStat('palm', t1 + t2, places.length);
  }

  // ---------------------------------------------------------------------------
  // 4) 造型松＋高大針葉樹：數量少，逐棵獨立造型，bake 成世界座標合併
  // ---------------------------------------------------------------------------
  {
    const folG = [], barkG = [];
    const put = (g, x, z, rotY) => {
      const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, L.LEVELS.lawn, z);
      folG.push(g.fol.applyMatrix4(m));
      barkG.push(g.bark.applyMatrix4(m));
    };
    let n = 0;
    // 主角造型松
    put(makePomPine(makeRng('trees/pine/hero'), H.hallPine.height, true), H.hallPine.x, H.hallPine.z, 0.3);
    n++;
    const rp = makeRng('trees/pine');
    T.hallPines.forEach((p, i) => {
      if (Math.hypot(p.x - H.hallPine.x, p.z - H.hallPine.z) < 1) return; // 跟主角同一點
      put(makePomPine(rp.fork(`p${i}`), rp.range(5.0, 6.0), false), p.x, p.z, rp() * TAU);
      n++;
    });
    const rc = makeRng('trees/conifer');
    T.hallTallConifers.forEach((p, i) => {
      put(makeConifer(rc.fork(`c${i}`), rc.range(18, 24)), p.x, p.z, rc() * TAU);
      n++;
    });
    const fol = mergeGeometries(folG);
    const bark = mergeGeometries(barkG);
    fol.computeBoundingSphere(); bark.computeBoundingSphere();
    const mf = new THREE.Mesh(fol, M.foliageConiferVC);
    const mb = new THREE.Mesh(bark, M.bark);
    mf.name = 'pine-conifer-foliage'; mb.name = 'pine-conifer-trunk';
    for (const m of [mf, mb]) { m.castShadow = true; m.receiveShadow = true; group.add(m); stats.drawCalls++; }
    addStat('pomPine+conifer', triCount(fol) + triCount(bark), n);
  }

  let total = 0;
  for (const s of Object.values(stats.species)) total += s.triangles;
  stats.triangles = Math.round(total);
  stats.removedForCamera = camRemoved;
  group.userData.stats = stats;
  return group;
}
