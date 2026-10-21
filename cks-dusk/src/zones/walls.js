// ============================================================================
// 區域：walls — 園區環外圍牆迴廊、四角小亭、大忠門（北）與大孝門（南）
// ----------------------------------------------------------------------------
// 介面：export function build(ctx) → THREE.Object3D
//   ctx = { THREE, L(layout), geo, M(materials), makeRng, makeNoise2D, uv:{planarUV,boxUV,roofUV},
//           makePlaqueTexture, utils:{mergeGeometries,mergeVertices}, quality }
//
// 位置全部由 L.WALL（外緣線、進深、簷高、脊高、漏窗、開口）與 L.SIDE_GATES 推算；
// 本檔只寫「局部尺寸」常數（柱寬、斗栱、拱門比例…）。
//
// 迴廊斷面（每一邊用自己的局部座標：s = 沿牆、t = 由外緣往園區內、y = 上）：
//   t = 0 ～ 0.4   外側白色實牆（開漏窗），下方灰色牆基
//   t = 0.4 ～ depth  開放迴廊：地坪平臺、內側白色方柱（約 4 m 一間）、簷枋
//   屋頂：兩坡藍琉璃瓦，脊在 t = depth/2，前後出簷各 0.7 m
//
// 側門（三間四柱三樓）局部座標：a = 沿門寬、b = 朝街道外側為正（facing 方向）、y = 上。
// 比例以官方 19.7 m × 13.8 m 調好；layout 改尺寸時整座等比例縮放。
//
// 效能：所有靜態幾何依材質 merge 成一個 mesh；漏窗格柵與瓦當用 InstancedMesh。
// ============================================================================
export function build(ctx) {
  const { THREE, L, M, makePlaqueTexture, utils, uv } = ctx;
  const group = new THREE.Group();
  group.name = 'walls';

  const W = L.WALL;
  const UP = new THREE.Vector3(0, 1, 0);
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ==========================================================================
  // 幾何累積器：依材質收集（已轉成世界座標的）幾何，最後一次 merge
  // ==========================================================================
  const acc = {};
  const prep = (g) => {
    const h = g.index ? g.toNonIndexed() : g;
    if (!h.attributes.normal) h.computeVertexNormals();
    if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
    for (const k of Object.keys(h.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') h.deleteAttribute(k);
    h.morphAttributes = {};
    h.clearGroups();
    return h;
  };
  // mode：'keep' 保留原 UV（屋瓦自己算好公尺 UV）；'box' 用世界座標方盒投影（石材、彩畫）
  const put = (key, g, m, mode = 'keep') => {
    if (m) g.applyMatrix4(m);
    if (mode === 'box') g = uv.boxUV(g);
    (acc[key] ||= []).push(prep(g));
  };
  const inst = { winA: [], winB: [], disc: [] }; // InstancedMesh 的世界矩陣

  // 軸向方盒（局部座標）
  const bx = (x0, x1, y0, y1, z0, z1) => {
    const g = new THREE.BoxGeometry(Math.max(1e-3, x1 - x0), Math.max(1e-3, y1 - y0), Math.max(1e-3, z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return g;
  };
  // 兩點之間的方料（w = 水平側寬、h = 截面高）
  const beam = (p, q, w, h) => {
    const d = q.clone().sub(p);
    const len = d.length();
    const x = d.normalize();
    const up = Math.abs(x.y) > 0.95 ? v3(1, 0, 0) : UP;
    const z = x.clone().cross(up).normalize();
    const y = z.clone().cross(x).normalize();
    const g = new THREE.BoxGeometry(len, h, w);
    g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(p.clone().add(q).multiplyScalar(0.5)));
    return g;
  };
  // 參數曲面格網：fn(u,v)→[x,y,z]，uvFn(u,v)→[U,V]（公尺），hint = 期望的大致法線方向（自動校正正反面）
  const grid = (nu, nv, fn, uvFn, hint) => {
    const pos = [], uvs = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const u = i / nu, v = j / nv;
      const p = fn(u, v);
      pos.push(p[0], p[1], p[2]);
      const t = uvFn ? uvFn(u, v) : [0, 0];
      uvs.push(t[0], t[1]);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, b, d, a, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const n = g.attributes.normal;
    let s = 0;
    for (let k = 0; k < n.count; k++) s += n.getX(k) * hint[0] + n.getY(k) * hint[1] + n.getZ(k) * hint[2];
    if (s < 0) {
      for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
      g.setIndex(idx);
      g.computeVertexNormals();
    }
    return g;
  };
  const mul = (a, b) => a.clone().multiply(b);
  const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

  // 屋面曲線：v = 0 簷口 → 1 屋脊；簷口平緩、近脊陡（中式屋面「舉折」）
  const prof = (v) => 0.4 * v + 0.6 * v * v;

  // ==========================================================================
  // 廡殿／攢尖屋頂（局部座標，中心在原點；a = x、b = z）
  //   hl, hd = 簷口半長、半深；R = 正脊半長（0 → 攢尖）；U = 翼角起翹量
  // ==========================================================================
  function hipRoof({ hl, hd, R, eaveY, ridgeY, th, U, nu = 12, nv = 8 }) {
    const rise = ridgeY - eaveY;
    const yv = (v) => eaveY + rise * prof(v);
    const ax = (v) => hl - (hl - R) * v;
    const bxt = (v) => hd * (1 - v);
    const lift = (u, v) => U * Math.pow(Math.abs(u), 4) * (1 - v) * (1 - v);
    // side：0 = +b 前坡、1 = −b 後坡、2 = +a 端坡、3 = −a 端坡；u ∈ [−1, 1]
    const pt = (side, u, v, dy = 0) => {
      const y = yv(v) + lift(u, v) + dy;
      if (side === 0) return [u * ax(v), y, bxt(v)];
      if (side === 1) return [-u * ax(v), y, -bxt(v)];
      if (side === 2) return [ax(v), y, -u * bxt(v)];
      return [-ax(v), y, u * bxt(v)];
    };
    const arcTab = (run) => {
      const N = 64, t = [0];
      for (let i = 1; i <= N; i++) t.push(t[i - 1] + Math.hypot(run / N, yv(i / N) - yv((i - 1) / N)));
      return (v) => t[Math.round(v * N)];
    };
    const arcF = arcTab(hd), arcE = arcTab(Math.max(0.01, hl - R));
    const hints = [[0, 1, 1], [0, 1, -1], [1, 1, 0], [-1, 1, 0]];
    const outs = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0]];
    const top = [], under = [], edge = [];
    for (let side = 0; side < 4; side++) {
      const fb = side < 2;
      const ext = fb ? ax : bxt, arc = fb ? arcF : arcE;
      const n = fb ? nu : Math.max(6, Math.round(nu * hd / hl));
      top.push(grid(n, nv, (a, b) => pt(side, a * 2 - 1, b), (a, b) => [(a * 2 - 1) * ext(b), arc(b)], hints[side]));
      under.push(grid(n, nv, (a, b) => pt(side, a * 2 - 1, b, -th), null, [0, -1, 0]));
      edge.push(grid(n, 1, (a, b) => pt(side, a * 2 - 1, 0, -th * b), null, outs[side]));
    }
    const hips = [];
    for (const side of [0, 1]) for (const u of [-1, 1]) {
      const pl = [];
      for (let j = 0; j <= nv; j++) pl.push(v3(...pt(side, u, j / nv, 0.05)));
      hips.push(pl);
    }
    // 簷下底面高度：front = true 用前後坡、false 用端坡
    const underAt = (a, b, front) => {
      if (front) { const v = 1 - Math.abs(b) / hd; return yv(v) + lift(a / ax(v), v) - th; }
      const v = (hl - Math.abs(a)) / Math.max(0.01, hl - R);
      return yv(v) + lift(b / Math.max(0.01, bxt(v)), v) - th;
    };
    return { top, under, edge, hips, pt, underAt, hl, hd, R, ridgeY, th, ax, bxt };
  }

  // 鴟吻（側影擠出）：局部 x 指向屋脊中心
  function chiwenGeom(h) {
    const s = new THREE.Shape();
    s.moveTo(-0.16 * h, 0);
    s.lineTo(0.46 * h, 0);
    s.lineTo(0.46 * h, 0.2 * h);
    s.lineTo(0.24 * h, 0.3 * h);
    s.quadraticCurveTo(0.36 * h, 0.78 * h, 0.1 * h, 1.0 * h);
    s.quadraticCurveTo(-0.22 * h, 0.96 * h, -0.34 * h, 0.7 * h);
    s.quadraticCurveTo(-0.17 * h, 0.74 * h, -0.12 * h, 0.52 * h);
    s.lineTo(-0.16 * h, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.22 * h, bevelEnabled: false, curveSegments: 5 });
    g.translate(0, 0, -0.11 * h);
    return g;
  }

  // 寶頂（攢尖頂用）
  function finialGeom(h) {
    const pts = [[0, 0], [0.34, 0], [0.38, 0.1], [0.22, 0.26], [0.3, 0.46], [0.2, 0.7], [0.09, 0.88], [0.04, 1.0], [0, 1.0]]
      .map(([r, y]) => new THREE.Vector2(r * h * 0.7, y * h));
    return new THREE.LatheGeometry(pts, 12);
  }

  // 把屋頂丟進累積器（m = 屋頂局部 → 世界）
  function emitRoof(r, m, { underMat = 'bracketPaintFlat', k = 1, chiwen = 0, beasts = false, finial = 0, discs = false } = {}) {
    r.top.forEach((g) => put('roofTileBlue', g, m));
    r.under.forEach((g) => put(underMat, g, m));
    r.edge.forEach((g) => put('glazeBlue', g, m));
    for (const pl of r.hips) {
      for (let i = 0; i < pl.length - 1; i++) put('glazeBlue', beam(pl[i], pl[i + 1], 0.2 * k, 0.24 * k), m);
      // 翼角起翹的脊端
      const c = pl[0];
      const out = v3(Math.sign(c.x), 0, Math.sign(c.z)).normalize();
      put('glazeBlue', beam(c.clone().addScaledVector(out, -0.1), c.clone().addScaledVector(out, 0.38 * k).add(v3(0, 0.3 * k, 0)), 0.17 * k, 0.2 * k), m);
      if (beasts) { // 垂脊上的小走獸（簡化成三個小塊）
        for (let q = 1; q <= 3; q++) {
          const p = pl[0].clone().lerp(pl[1], 0.25 + q * 0.28);
          if (q === 3) p.copy(pl[1]).lerp(pl[2], 0.2);
          put('glazeBlue', bx(-0.07 * k, 0.07 * k, 0, 0.2 * k, -0.07 * k, 0.07 * k), mul(m, T(p.x, p.y + 0.12 * k, p.z)));
        }
      }
    }
    if (r.R > 0.05) {
      const y = r.ridgeY + 0.1 * k;
      put('glazeBlue', beam(v3(-r.R - 0.05, y, 0), v3(r.R + 0.05, y, 0), 0.34 * k, 0.42 * k), m);
      put('glazeBlue', beam(v3(-r.R, y + 0.25 * k, 0), v3(r.R, y + 0.25 * k, 0), 0.24 * k, 0.1 * k), m);   // 脊頂蓋
      put('glazeGold', beam(v3(-r.R, y + 0.02 * k, 0), v3(r.R, y + 0.02 * k, 0), 0.36 * k, 0.05 * k), m);  // 脊身金線
      if (chiwen > 0) {
        for (const sgn of [-1, 1]) {
          const g = chiwenGeom(chiwen);
          if (sgn > 0) g.rotateY(Math.PI);
          put('glazeBlue', g, mul(m, T(sgn * (r.R + 0.02), r.ridgeY - 0.05, 0)));
        }
      }
    }
    if (finial > 0) put('glazeBlue', finialGeom(finial), mul(m, T(0, r.ridgeY - 0.12, 0)));
    if (discs) { // 瓦當：沿簷口每 0.4 m 一枚
      const outs = [v3(0, 0, 1), v3(0, 0, -1), v3(1, 0, 0), v3(-1, 0, 0)];
      for (let side = 0; side < 4; side++) {
        const half = side < 2 ? r.hl : r.hd;
        const n = Math.max(2, Math.round((2 * half) / 0.4));
        const out = outs[side], along = UP.clone().cross(out);
        for (let i = 0; i <= n; i++) {
          const u = -1 + (2 * i) / n;
          const p = v3(...r.pt(side, u, 0, -0.1)).addScaledVector(out, 0.03);
          inst.disc.push(mul(m, new THREE.Matrix4().makeBasis(along, UP, out).setPosition(p)));
        }
      }
    }
  }

  // 斗栱一朵（局部：x 沿簷、y 上、z 往外挑出；k = 縮放）：總高 0.96k、出跳 1.08k
  function bracketSetGeom(k) {
    const parts = [
      bx(-0.17, 0.17, 0, 0.22, 0, 0.34),          // 櫨斗
      bx(-0.5, 0.5, 0.22, 0.38, 0.09, 0.25),      // 泥道栱
      bx(-0.08, 0.08, 0.22, 0.4, 0, 0.78),        // 一跳華栱
      bx(-0.1, 0.1, 0.4, 0.53, 0.58, 0.78),       // 跳頭交互斗
      bx(-0.4, 0.4, 0.53, 0.67, 0.61, 0.75),      // 瓜栱
      bx(-0.08, 0.08, 0.53, 0.71, 0, 1.08),       // 二跳（昂）
      bx(-0.1, 0.1, 0.71, 0.84, 0.9, 1.08),       // 跳頭斗
      bx(-0.52, -0.32, 0.38, 0.52, 0.07, 0.27), bx(0.32, 0.52, 0.38, 0.52, 0.07, 0.27), // 散斗
      bx(-0.4, -0.24, 0.67, 0.79, 0.6, 0.76), bx(0.24, 0.4, 0.67, 0.79, 0.6, 0.76),
    ];
    const g = utils.mergeGeometries(parts);
    g.scale(k, k, k);
    return g;
  }
  // 一排斗栱：origin = 排中心（局部座標，y = 斗栱底），out = 挑出方向；含三道通長枋
  function bracketRow(m, origin, out, length, count, k) {
    const along = UP.clone().cross(out);
    const basis = new THREE.Matrix4().makeBasis(along, UP, out);
    const base = mul(m, basis.clone().setPosition(origin));
    for (let i = 0; i < count; i++) {
      const x = -length / 2 + ((i + 0.5) * length) / count;
      put('bracketPaint', bracketSetGeom(k), mul(base, T(x, 0, 0)), 'box');
    }
    const hl = length / 2;
    put('bracketPaint', bx(-hl, hl, 0.52 * k, 0.9 * k, 0.09 * k, 0.25 * k), base.clone(), 'box');   // 正心枋
    put('bracketPaint', bx(-hl, hl, 0.79 * k, 0.9 * k, 0.61 * k, 0.75 * k), base.clone(), 'box');   // 拽枋
    put('bracketPaint', bx(-hl - 0.2 * k, hl + 0.2 * k, 0.84 * k, 0.97 * k, 0.9 * k, 1.08 * k), base.clone(), 'box'); // 挑檐枋
  }

  // ==========================================================================
  // 1. 圍牆迴廊
  // ==========================================================================
  const dep = W.depth, eaveH = W.eaveHeight, ridgeH = W.ridgeHeight;
  const WW = W.windowSize.w, WH = W.windowSize.h, SILL = W.windowSize.sill;
  const wallT = 0.4;            // 外牆厚
  const FLOOR = 0.45;           // 迴廊地坪（平臺頂）
  const OV = 0.7;               // 出簷
  const TH_C = 0.2;             // 屋面厚
  const COL_TOP = 3.55;         // 內側方柱頂（簷枋底）
  const tc = dep / 2, run = tc + OV;
  const ridgeTile = ridgeH - 0.3;  // 瓦面在脊處的高度（再蓋 0.3 m 正脊 → 脊頂 = ridgeHeight）
  const riseC = ridgeTile - eaveH;
  const yTopC = (t) => eaveH + riseC * prof(Math.max(0, 1 - Math.abs(t - tc) / run));
  const yUnderC = (t) => yTopC(t) - TH_C;
  const wallTop = (yTopC(0) + yUnderC(wallT)) / 2;
  const arcC = (() => {
    const N = 60, t = [0];
    for (let i = 1; i <= N; i++) t.push(t[i - 1] + Math.hypot(run / N, riseC * (prof(i / N) - prof((i - 1) / N))));
    return (v) => t[Math.round(v * N)];
  })();

  // 外緣線 → 四邊局部座標系（s 沿牆、t 往內）。確保 d × up 指向園區內。
  let outline = W.outline.map((p) => ({ x: p.x, z: p.z }));
  const cen = outline.reduce((a, p) => ({ x: a.x + p.x / outline.length, z: a.z + p.z / outline.length }), { x: 0, z: 0 });
  {
    const p0 = outline[0], p1 = outline[1];
    const dx = p1.x - p0.x, dz = p1.z - p0.z;
    const mx = (p0.x + p1.x) / 2, mz = (p0.z + p1.z) / 2;
    if (-dz * (cen.x - mx) + dx * (cen.z - mz) < 0) outline = outline.reverse();
  }
  const sides = outline.map((p0, i) => {
    const p1 = outline[(i + 1) % outline.length];
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    const d = v3((p1.x - p0.x) / len, 0, (p1.z - p0.z) / len);
    const n = d.clone().cross(UP);
    const m = new THREE.Matrix4().makeBasis(d, UP, n).setPosition(p0.x, 0, p0.z);
    // 邊名（給 openings 對照）：內法線 +z → 北牆、−z → 南牆、+x → 西牆、−x → 東牆
    const name = Math.abs(n.z) > Math.abs(n.x) ? (n.z > 0 ? 'north' : 'south') : (n.x > 0 ? 'west' : 'east');
    return { p0, p1, d, n, len, m, name };
  });

  // 外牆一段（含牆基、漏窗洞口與窗格），在邊的局部座標系
  let winIndex = 0;
  function wallRun(m, s0, s1, centers, top) {
    put('concrete', bx(s0, s1, -0.3, 0.75, -0.08, wallT + 0.08), m);   // 牆基
    // 牆身：一整片帶窗洞的擠出體（避免方塊拼接的接縫線）
    const sh = new THREE.Shape();
    sh.moveTo(s0, 0.75); sh.lineTo(s1, 0.75); sh.lineTo(s1, top); sh.lineTo(s0, top); sh.lineTo(s0, 0.75);
    for (const c of centers) {
      const h = new THREE.Path();
      h.moveTo(c - WW / 2, SILL); h.lineTo(c + WW / 2, SILL); h.lineTo(c + WW / 2, SILL + WH); h.lineTo(c - WW / 2, SILL + WH); h.lineTo(c - WW / 2, SILL);
      sh.holes.push(h);
      (winIndex++ % 2 ? inst.winB : inst.winA).push(mul(m, T(c, SILL + WH / 2, wallT / 2)));
    }
    put('plasterWhite', new THREE.ExtrudeGeometry(sh, { depth: wallT, bevelEnabled: false }), m);
    // 牆頂下緣一道藍色琉璃細帶（外側）
    put('glazeBlue', bx(s0, s1, top - 0.32, top - 0.2, -0.05, 0), m);
  }

  // 迴廊屋頂（兩坡）＋正脊；端點 e0/e1；gable 端加垂脊與脊端翹
  function corridorRoof(m, e0, e1, gable0, gable1) {
    const nv = 6;
    const tOf = (inner, v) => (inner ? dep + OV - v * run : -OV + v * run);
    for (const inner of [false, true]) {
      put('roofTileBlue', grid(1, nv, (u, v) => [e0 + u * (e1 - e0), yTopC(tOf(inner, v)), tOf(inner, v)],
        (u, v) => [e0 + u * (e1 - e0), arcC(v)], [0, 1, inner ? 1 : -1]), m);
      put('plasterWhite', grid(1, nv, (u, v) => [e0 + u * (e1 - e0), yUnderC(tOf(inner, v)), tOf(inner, v)], null, [0, -1, 0]), m);
      put('glazeBlue', grid(1, 1, (u, w) => [e0 + u * (e1 - e0), yTopC(tOf(inner, 0)) - TH_C * w, tOf(inner, 0)], null, [0, 0, inner ? 1 : -1]), m);
    }
    // 屋面兩端封口
    for (const [e, sg] of [[e0, -1], [e1, 1]]) {
      put('glazeBlue', grid(2 * nv, 1, (u, w) => { const t = -OV + u * (dep + 2 * OV); return [e, yTopC(t) - TH_C * w, t]; }, null, [sg, 0, 0]), m);
    }
    // 正脊
    put('glazeBlue', bx(e0, e1, ridgeTile - 0.1, ridgeH, tc - 0.17, tc + 0.17), m);
    for (const [e, sg, on] of [[e0, -1, gable0], [e1, 1, gable1]]) {
      if (!on) continue;
      // 垂脊（沿山牆的屋面邊）
      const pl = [];
      for (let i = 0; i <= 12; i++) { const t = -OV + (i / 12) * (dep + 2 * OV); pl.push(v3(e - sg * 0.11, yTopC(t) + 0.07, t)); }
      for (let i = 0; i < pl.length - 1; i++) put('glazeBlue', beam(pl[i], pl[i + 1], 0.2, 0.2), m);
      // 正脊端微翹
      put('glazeBlue', beam(v3(e - sg * 0.3, ridgeH - 0.15, tc), v3(e + sg * 0.15, ridgeH + 0.22, tc), 0.26, 0.24), m);
    }
  }

  // 山牆收頭（牆端），at = 牆面所在 s；dir = +1 往 s 增加方向延伸（起點端）、−1（終點端）
  function gableEnd(m, at, dir) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.3);
    s.lineTo(dep, -0.3);
    for (let i = 0; i <= 12; i++) { const t = dep - (i / 12) * dep; s.lineTo(t, yUnderC(t) + 0.05); }
    s.lineTo(0, -0.3);
    const g = new THREE.ExtrudeGeometry(s, { depth: wallT, bevelEnabled: false });
    // 形狀 x → t（局部 z）、y → y、擠出 → −s
    const basis = new THREE.Matrix4().makeBasis(v3(0, 0, 1), UP, v3(-1, 0, 0));
    const sPos = dir > 0 ? at + wallT : at;
    put('plasterWhite', g, mul(m, basis.setPosition(sPos, 0, 0)));
    const a0 = dir > 0 ? at : at - wallT - 0.08, a1 = dir > 0 ? at + wallT + 0.08 : at;
    put('marbleGrey', bx(a0, a1, -0.3, 0.75, -0.08, dep + 0.08), m, 'box');
    // 端柱（內側轉角）
    const c = dir > 0 ? at + 0.3 : at - 0.3;
    put('plasterWhite', bx(c - 0.3, c + 0.3, FLOOR, COL_TOP + 0.05, dep - 0.6, dep), m);
  }

  // 一段迴廊
  function corridor(sd, s0, s1, end0, end1) {
    const m = sd.m;
    const len = s1 - s0;
    if (len < 1) return;
    const n = Math.max(1, Math.round(len / W.windowSpacing));
    const bay = len / n;
    const centers = [];
    for (let i = 0; i < n; i++) centers.push(s0 + (i + 0.5) * bay);
    wallRun(m, s0, s1, centers, wallTop);
    put('marbleGrey', bx(s0, s1, -0.1, FLOOR, wallT, dep + 0.25), m, 'box');      // 地坪平臺
    const ct = dep - 0.3; // 柱列中心線
    for (let i = 0; i <= n; i++) {
      let s = s0 + i * bay;
      if (i === 0) { if (end0 === 'gate') continue; s += 0.2; }
      if (i === n) { if (end1 === 'gate') continue; s -= 0.2; }
      const hw = 0.17;
      put('plasterWhite', bx(s - hw, s + hw, FLOOR, COL_TOP, ct - hw, ct + hw), m);                    // 方柱
      put('marbleGrey', bx(s - 0.24, s + 0.24, FLOOR, FLOOR + 0.18, ct - 0.24, ct + 0.24), m, 'box');  // 柱礎
      put('plasterWhite', bx(s - 0.1, s + 0.1, COL_TOP - 0.32, COL_TOP - 0.06, wallT, ct), m);         // 穿插枋
    }
    // 簷枋（柱頭通長）＋ 底下一道藍色琉璃細帶
    put('plasterWhite', bx(s0, s1, COL_TOP, yUnderC(dep - 0.12) + 0.04, dep - 0.48, dep - 0.12), m);
    put('glazeBlue', bx(s0, s1, COL_TOP - 0.02, COL_TOP + 0.1, dep - 0.13, dep - 0.09), m);
    const e0 = s0 - (end0 === 'gate' ? 0.15 : 0), e1 = s1 + (end1 === 'gate' ? 0.15 : 0);
    corridorRoof(m, e0, e1, end0 === 'gate', end1 === 'gate');
    if (end0 === 'gate') gableEnd(m, s0, 1);
    if (end1 === 'gate') gableEnd(m, s1, -1);
  }

  // 各邊：扣掉轉角亭與開口後的區段
  const PAV = W.cornerPavilions ? dep + 1.5 : 0;   // 角亭平面邊長（比迴廊進深多 1.5 m）
  for (const sd of sides) {
    const toS = (c) => (sd.name === 'north' || sd.name === 'south'
      ? (c - sd.p0.x) * sd.d.x + 0 : (c - sd.p0.z) * sd.d.z);
    const cuts = W.openings.filter((o) => o.side === sd.name)
      .map((o) => { const a = toS(o.from), b = toS(o.to); return [Math.min(a, b), Math.max(a, b)]; })
      .sort((a, b) => a[0] - b[0]);
    let cur = PAV, curType = W.cornerPavilions ? 'pav' : 'corner';
    for (const [a, b] of cuts) {
      if (a > cur) corridor(sd, cur, a, curType, 'gate');
      cur = Math.max(cur, b); curType = 'gate';
    }
    if (sd.len - PAV > cur) corridor(sd, cur, sd.len - PAV, curType, W.cornerPavilions ? 'pav' : 'corner');
  }

  // ==========================================================================
  // 2. 四角小亭（攢尖頂）
  //    角亭位在邊 k 的起點：s ∈ [0, PAV]、t ∈ [0, PAV]；也等於前一邊的終點段
  // ==========================================================================
  if (W.cornerPavilions) {
    const P = PAV;
    const pavEave = ridgeH + 0.4, pavApex = pavEave + 2.4, pavWall = pavEave - 0.3;
    const lintel0 = eaveH - 0.2;
    for (let k = 0; k < sides.length; k++) {
      const sk = sides[k], sp = sides[(k + sides.length - 1) % sides.length];
      // 兩道外牆（各在自己的邊座標）＋內側門楣牆
      wallRun(sk.m, 0, P, [P / 2], pavWall);
      wallRun(sp.m, sp.len - P, sp.len, [sp.len - P / 2], pavWall);
      put('plasterWhite', bx(P - 0.3, P, lintel0, pavWall, wallT, P), sk.m);
      put('plasterWhite', bx(sp.len - P, sp.len - P + 0.3, lintel0, pavWall, wallT, P), sp.m);
      const m = sk.m;
      put('marbleGrey', bx(wallT, P, -0.1, FLOOR, wallT, P), m, 'box');
      // 內角柱
      put('plasterWhite', bx(P - 0.46, P, FLOOR, pavWall, P - 0.46, P), m);
      put('marbleGrey', bx(P - 0.54, P + 0.08, FLOOR, FLOOR + 0.2, P - 0.54, P + 0.08), m, 'box');
      // 簷下彩畫額枋（四周一圈）
      const r0 = -0.06, r1 = P + 0.06, bw = 0.5, y0 = pavWall - 0.45, y1 = pavWall;
      put('bracketPaint', bx(r0, r1, y0, y1, r0, r0 + bw), m, 'box');
      put('bracketPaint', bx(r0, r1, y0, y1, r1 - bw, r1), m, 'box');
      put('bracketPaint', bx(r0, r0 + bw, y0, y1, r0 + bw, r1 - bw), m, 'box');
      put('bracketPaint', bx(r1 - bw, r1, y0, y1, r0 + bw, r1 - bw), m, 'box');
      // 天花／屋頂下填塊
      const rf = hipRoof({ hl: P / 2 + 1.0, hd: P / 2 + 1.0, R: 0, eaveY: pavEave, ridgeY: pavApex, th: 0.24, U: 0.45, nu: 10, nv: 8 });
      put('bracketPaintFlat', bx(-0.02, P + 0.02, pavWall, rf.underAt(0, P / 2 + 0.02, true) + 0.04, -0.02, P + 0.02), mul(m, T(0, 0, 0)));
      emitRoof(rf, mul(m, T(P / 2, 0, P / 2)), { k: 0.85, finial: 1.1 });
    }
  }

  // ==========================================================================
  // 3. 側門：大忠門、大孝門（三間四柱三樓，白石拱門＋藍琉璃三頂）
  // ==========================================================================
  const plaqueMeshes = [];
  // 局部常數（以 19.7 × 13.8 × 6 為基準）
  const G = {
    hw: 9.85, tb: 1.5,                          // 半寬、牆身半厚
    pillars: [[-9.85, -8.15], [-4.4, -2.8], [2.8, 4.4], [8.15, 9.85]],
    yL: 7.45, yC: 9.75,                          // 下段牆身頂、中央高起段頂
    arches: [{ c: 0, w: 5.2, spring: 4.0 }, { c: -6.275, w: 3.3, spring: 2.9 }, { c: 6.275, w: 3.3, spring: 2.9 }],
    center: { hl: 5.55, hd: 3.0, R: 3.2, eaveY: 11.2, ridgeY: 12.95, th: 0.24, U: 0.42 },
    side: { cx: 7.425, hl: 3.425, hd: 2.6, R: 1.475, eaveY: 8.75, ridgeY: 10.3, th: 0.22, U: 0.34 },
  };

  function archRingGeom(cx, w, spring, rw, y0) {
    const r = w / 2;
    const s = new THREE.Shape();
    s.moveTo(cx - r - rw, y0);
    s.lineTo(cx - r, y0);
    s.lineTo(cx - r, spring);
    s.absarc(cx, spring, r, Math.PI, 0, true);
    s.lineTo(cx + r, y0);
    s.lineTo(cx + r + rw, y0);
    s.lineTo(cx + r + rw, spring);
    s.absarc(cx, spring, r + rw, 0, Math.PI, false);
    s.lineTo(cx - r - rw, y0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false, curveSegments: 20 });
  }
  // 矩形線腳框（浮雕框）
  function frameBoxes(a0, a1, y0, y1, z0, z1, f) {
    return [bx(a0, a1, y1 - f, y1, z0, z1), bx(a0, a1, y0, y0 + f, z0, z1), bx(a0, a0 + f, y0 + f, y1 - f, z0, z1), bx(a1 - f, a1, y0 + f, y1 - f, z0, z1)];
  }

  function buildSideGate(sg) {
    const rot = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[sg.facing] ?? 0;
    const GM = new THREE.Matrix4().compose(v3(sg.center.x, 0, sg.center.z),
      new THREE.Quaternion().setFromAxisAngle(UP, rot), v3(sg.width / 19.7, sg.height / 13.8, sg.depth / 6));
    const FLIP = new THREE.Matrix4().makeRotationY(Math.PI);
    const GB = mul(GM, FLIP); // 背面（園區內側）
    // 正背兩面都放
    const both = (key, g, mode = 'keep') => { put(key, g.clone(), GM, mode); put(key, g, GB, mode); };
    const { hw, tb, yL, yC } = G;

    // --- 牆身：外輪廓含三個拱門缺口，沿 b 擠出 ---
    const s = new THREE.Shape();
    s.moveTo(-hw, 0);
    const arches = G.arches.slice().sort((a, b) => a.c - b.c);
    for (const a of arches) {
      const r = a.w / 2;
      s.lineTo(a.c - r, 0);
      s.lineTo(a.c - r, a.spring);
      s.absarc(a.c, a.spring, r, Math.PI, 0, true);
      s.lineTo(a.c + r, 0);
    }
    s.lineTo(hw, 0);
    s.lineTo(hw, yL);
    s.lineTo(4.4, yL);
    s.lineTo(4.4, yC);
    s.lineTo(-4.4, yC);
    s.lineTo(-4.4, yL);
    s.lineTo(-hw, yL);
    s.lineTo(-hw, 0);
    const body = new THREE.ExtrudeGeometry(s, { depth: 2 * tb, bevelEnabled: false, curveSegments: 24 });
    body.translate(0, 0, -tb);
    put('marble', body, GM, 'box');

    // --- 門下石板地坪（接人行道與園內步道）---
    put('marbleGrey', bx(-hw - 0.3, hw + 0.3, -0.1, 0.17, -tb - 1.7, tb + 1.2), GM.clone(), 'box');

    // --- 柱：壁柱、柱礎、柱頭、夾桿石（抱鼓） ---
    const bShape = new THREE.Shape();
    bShape.moveTo(0, 0);
    bShape.lineTo(1.05, 0);
    bShape.lineTo(1.05, 0.5);
    bShape.quadraticCurveTo(1.02, 1.1, 0.55, 1.2);
    bShape.absarc(0.42, 1.55, 0.36, -Math.PI / 2 + 0.35, Math.PI * 0.95, false);
    bShape.lineTo(0.12, 2.15);
    bShape.lineTo(0, 2.15);
    bShape.lineTo(0, 0);
    for (const [p0, p1] of G.pillars) {
      const pc = (p0 + p1) / 2;
      both('marbleSmooth', bx(p0, p1, 0.55, yL - 0.25, tb, tb + 0.16), 'box');                 // 壁柱
      both('marbleSmooth', bx(p0 - 0.08, p1 + 0.08, yL - 0.65, yL - 0.25, tb, tb + 0.24), 'box'); // 柱頭
      put('marbleGrey', bx(p0 - 0.12, p1 + 0.12, -0.05, 0.55, -tb - 0.3, tb + 0.3), GM.clone(), 'box'); // 柱礎
      const bt = new THREE.ExtrudeGeometry(bShape, { depth: 0.8, bevelEnabled: false, curveSegments: 8 });
      bt.translate(0, 0, -0.4);
      bt.applyMatrix4(new THREE.Matrix4().makeBasis(v3(0, 0, 1), UP, v3(-1, 0, 0)).setPosition(pc, 0.55, tb + 0.16));
      both('marbleSmooth', bt, 'box');
    }
    // 拱圈線腳、拱心石、拱上浮雕框
    for (const a of G.arches) {
      const ring = archRingGeom(a.c, a.w, a.spring, 0.28, 0.55);
      ring.translate(0, 0, tb);
      both('marbleSmooth', ring, 'box');
      both('marbleSmooth', bx(a.c - 0.22, a.c + 0.22, a.spring + a.w / 2 - 0.05, a.spring + a.w / 2 + 0.5, tb, tb + 0.16), 'box');
      if (a.c !== 0) for (const g of frameBoxes(a.c - 1.5, a.c + 1.5, a.spring + a.w / 2 + 0.75, yL - 0.55, tb, tb + 0.07, 0.12)) both('marbleSmooth', g, 'box');
    }
    // 中央拱上方的橫帶浮雕
    for (const g of frameBoxes(-2.55, 2.55, 6.85, 7.25, tb, tb + 0.06, 0.08)) both('marbleSmooth', g, 'box');
    // 腰簷線腳（全寬）、中央段頂線腳
    put('marbleSmooth', bx(-hw - 0.08, hw + 0.08, yL - 0.22, yL, -tb - 0.2, tb + 0.2), GM.clone(), 'box');
    put('marbleSmooth', bx(-4.48, 4.48, yC - 0.18, yC, -tb - 0.14, tb + 0.14), GM.clone(), 'box');
    // 匾額外框（白石浮雕框）
    for (const g of frameBoxes(-2.6, 2.6, 7.7, 9.5, tb, tb + 0.09, 0.14)) both('marbleSmooth', g, 'box');

    // --- 匾額：藍底金字、由右至左，正背兩面 ---
    const tex = makePlaqueTexture({ text: sg.name, rightToLeft: true, aspect: 4.1 / 1.25 });
    const pmat = new THREE.MeshStandardMaterial({ name: `plaque:${sg.name}`, map: tex, roughness: 0.42, metalness: 0.15 });
    both('glazeGold', bx(-2.22, 2.22, 7.93, 9.37, tb, tb + 0.12));
    for (const mm of [GM, GB]) {
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 1.25), pmat);
      pm.applyMatrix4(mul(mm, T(0, 8.65, tb + 0.125)));
      pm.receiveShadow = true;
      pm.name = `plaque:${sg.name}`;
      plaqueMeshes.push(pm);
    }

    // --- 屋頂幾何先算好（填塊頂要藏在屋面裡）---
    const rc = hipRoof({ ...G.center, nu: 16, nv: 9 });
    const rsP = G.side;
    const mkSide = () => hipRoof({ hl: rsP.hl, hd: rsP.hd, R: rsP.R, eaveY: rsP.eaveY, ridgeY: rsP.ridgeY, th: rsP.th, U: rsP.U, nu: 12, nv: 8 });

    // --- 額枋（彩畫）＋ 斗栱層 ---
    const kC = 0.95, kS = 0.72, bf = tb + 0.1;
    const cTop = Math.min(rc.underAt(0, bf, true), rc.underAt(4.45, 0, false)) + 0.02;
    const sTop = mkSide().underAt(0, bf, true) - 0.01;
    put('bracketPaint', bx(-4.48, 4.48, yC, yC + 0.4, -bf, bf), GM.clone(), 'box');
    put('bracketPaintFlat', bx(-4.45, 4.45, yC + 0.4, cTop, -bf + 0.02, bf - 0.02), GM.clone());
    const ySideB = yL + 0.4;
    for (const sgn of [-1, 1]) {
      put('bracketPaint', bx(Math.min(sgn * 4.4, sgn * (hw + 0.05)), Math.max(sgn * 4.4, sgn * (hw + 0.05)), yL, ySideB, -bf, bf), GM.clone(), 'box');
      put('bracketPaintFlat', bx(Math.min(sgn * 4.42, sgn * (hw - 0.02)), Math.max(sgn * 4.42, sgn * (hw - 0.02)), ySideB, sTop, -bf + 0.02, bf - 0.02), GM.clone());
    }
    const yCB = yC + 0.4;
    for (const mm of [GM, GB]) {
      bracketRow(mm, v3(0, yCB, bf), v3(0, 0, 1), 8.9, 7, kC);
      for (const sgn of [-1, 1]) bracketRow(mm, v3(sgn * 7.15, ySideB, bf), v3(0, 0, 1), 5.4, 4, kS);
    }
    for (const sgn of [-1, 1]) {
      bracketRow(GM, v3(sgn * 4.45, yCB, 0), v3(sgn, 0, 0), 2 * bf, 2, kC);
      bracketRow(GM, v3(sgn * hw, ySideB, 0), v3(sgn, 0, 0), 2 * bf, 2, kS);
    }

    // --- 屋頂：中央高、兩側低 ---
    emitRoof(rc, GM, { k: 1, chiwen: 0.9, beasts: true, discs: true });
    for (const sgn of [-1, 1]) {
      const rs = mkSide();
      emitRoof(rs, mul(GM, T(sgn * rsP.cx, 0, 0)), { k: 0.8, chiwen: 0.62, beasts: true, discs: true });
      // 側樓椽子
      const mS = mul(GM, T(sgn * rsP.cx, 0, 0));
      const ra = [4.45 - rsP.cx, hw - rsP.cx];
      rafters(rs, mS, bf, sgn > 0 ? ra[0] : -ra[1], sgn > 0 ? ra[1] : -ra[0]);
    }
    // 中央椽子（前後＋兩端）
    rafters(rc, GM, bf, -4.4, 4.4);
  }

  // 椽子：沿簷下底面，從額枋外皮挑到簷口
  function rafters(r, m, faceB, a0, a1) {
    const step = 0.3;
    for (const sb of [1, -1]) {
      const bIn = faceB, bOut = r.hd - 0.03;
      for (let a = Math.ceil(a0 / step) * step; a <= a1 + 1e-6; a += step) {
        const vIn = 1 - bIn / r.hd;
        if (Math.abs(a) > r.ax(vIn) - 0.08) continue;
        const pts = [bIn, (bIn + bOut) / 2, bOut].map((b) => v3(a, r.underAt(a, b, true) - 0.06, sb * b));
        for (let i = 0; i < 2; i++) put('bracketPaint', beam(pts[i], pts[i + 1], 0.09, 0.09), m, 'box');
      }
    }
  }

  for (const sg of Object.values(L.SIDE_GATES)) buildSideGate(sg);

  // ==========================================================================
  // 4. 合併輸出
  // ==========================================================================
  for (const [key, list] of Object.entries(acc)) {
    const g = utils.mergeGeometries(list, false);
    const mesh = new THREE.Mesh(g, M[key]);
    mesh.name = `walls:${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const pm of plaqueMeshes) group.add(pm);

  // 漏窗格柵（兩種花樣交替）
  function latticeGeom(variant) {
    const w = WW, h = WH, f = 0.09, d = 0.16, b = 0.055;
    const parts = [
      bx(-w / 2, w / 2, h / 2 - f, h / 2, -d / 2, d / 2), bx(-w / 2, w / 2, -h / 2, -h / 2 + f, -d / 2, d / 2),
      bx(-w / 2, -w / 2 + f, -h / 2 + f, h / 2 - f, -d / 2, d / 2), bx(w / 2 - f, w / 2, -h / 2 + f, h / 2 - f, -d / 2, d / 2),
    ];
    const iw = w / 2 - f, ih = h / 2 - f;
    if (variant === 0) { // 十字＋菱形
      parts.push(bx(-b / 2, b / 2, -ih, ih, -d * 0.35, d * 0.35), bx(-iw, iw, -b / 2, b / 2, -d * 0.35, d * 0.35));
      const q = [v3(-iw, 0, 0), v3(0, ih, 0), v3(iw, 0, 0), v3(0, -ih, 0)];
      for (let i = 0; i < 4; i++) parts.push(beam(q[i], q[(i + 1) % 4], d * 0.7, b));
    } else { // 九宮格＋中心方塊
      for (const x of [-iw / 3, iw / 3]) parts.push(bx(x - b / 2, x + b / 2, -ih, ih, -d * 0.35, d * 0.35));
      for (const y of [-ih / 3, ih / 3]) parts.push(bx(-iw, iw, y - b / 2, y + b / 2, -d * 0.35, d * 0.35));
      parts.push(bx(-iw / 3 + b / 2, iw / 3 - b / 2, -ih / 3 + b / 2, ih / 3 - b / 2, -d * 0.12, d * 0.12));
    }
    return utils.mergeGeometries(parts);
  }
  const addInst = (geomF, mat, list, name) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geomF, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = name;
    group.add(im);
  };
  addInst(latticeGeom(0), M.glazeBlue, inst.winA, 'walls:latticeA');
  addInst(latticeGeom(1), M.glazeBlue, inst.winB, 'walls:latticeB');
  const disc = new THREE.CylinderGeometry(0.085, 0.085, 0.07, 10);
  disc.rotateX(Math.PI / 2);
  addInst(disc, M.glazeBlue, inst.disc, 'walls:tileEnds');

  return group;
}
