// 區域：hall — 中正紀念堂主殿（紀念堂主體）
// ----------------------------------------------------------------------------
// 坐東朝西（正面朝 −x）。所有「位置」都由 L.HALL 推算；局部構件尺寸（欄杆、斗栱、
// 石獅、門框線腳…）是本區常數。整個群組放在 L.HALL.center，內部用「主殿中心為原點」的局部座標。
//
// 構件：
//   1. 三層白色臺基（含正面主階梯缺口、南北側梯缺口、腰線、勒腳、頂面地磚、外緣白石欄杆）
//   2. 正面大階梯：兩側踏步＋中央雕刻御路（幾何浮雕：外框、分格、國徽圓、雲紋）、
//      中途平台、梯側牆＋扶手欄杆、抱鼓石、梯底一對石獅；第一層臺基正面兩側拱門
//   3. 主體：40 m 方形核心＋四角 15 m 方塔（外側兩面內傾）、塔頂壓頂、正面拱門
//      （門框線腳、門洞、門內 5 階、半開銅門、門內深色大廳與銅像剪影）、直式匾額
//   4. 屋頂：下簷斗栱層（額枋彩畫＋斗栱）、下簷、鼓座斗栱、上簷、八角攢尖、
//      白色簷口收邊、藍琉璃垂脊（白色起翹翼角）、圍脊、寶頂座、金色葫蘆寶頂
// ----------------------------------------------------------------------------
export function build(ctx) {
  const { THREE, L, M, makeNoise2D, uv, makePlaqueTexture, utils, quality } = ctx;
  const H = L.HALL;
  const q = quality === 'low' ? 0.5 : 1;
  const Q = (n) => Math.max(3, Math.round(n * q));

  const group = new THREE.Group();
  group.name = 'hall';
  group.position.set(H.center.x, 0, H.center.z);

  // ==========================================================================
  // 小工具
  // ==========================================================================
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const avg = (...ps) => {
    const s = [0, 0, 0];
    for (const p of ps) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return [s[0] / ps.length, s[1] / ps.length, s[2] / ps.length];
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  // 三角形湯：累積同材質的面，最後一次轉成 BufferGeometry。quad/hexa 會依 hint 自動修正繞向。
  class Soup {
    constructor(mode) { this.mode = mode; this.p = []; this.t = []; }
    tri(a, b, c, ua, ub, uc) {
      this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      if (ua) this.t.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    }
    quad(a, b, c, d, hint, uvs) {
      const n1 = cross(sub(b, a), sub(c, a)), n2 = cross(sub(c, a), sub(d, a));
      const flip = dot([n1[0] + n2[0], n1[1] + n2[1], n1[2] + n2[2]], hint) < 0;
      const U = uvs || [null, null, null, null];
      if (flip) { this.tri(a, c, b, U[0], U[2], U[1]); this.tri(a, d, c, U[0], U[3], U[2]); }
      else { this.tri(a, b, c, U[0], U[1], U[2]); this.tri(a, c, d, U[0], U[2], U[3]); }
    }
    // v0..v3 底環、v4..v7 頂環（同順序環繞）；凸六面體
    hexa(v) {
      const c = avg(...v);
      for (const f of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) {
        const [a, b, cc, d] = f.map((i) => v[i]);
        this.quad(a, b, cc, d, sub(avg(a, b, cc, d), c));
      }
    }
    box(x0, x1, y0, y1, z0, z1) {
      this.hexa([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
        [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
    }
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      if (this.mode === 'box') return uv.boxUV(g);
      if (this.mode === 'planar') { uv.planarUV(g); g.computeVertexNormals(); return g; }
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.t, 2));
      g.computeVertexNormals();
      return g;
    }
  }
  const SP = {}, EX = {};
  const soup = (k, mode = 'box') => (SP[k] ||= new Soup(mode));
  const addG = (k, g) => (EX[k] ||= []).push(g);
  const boxG = (k, x0, x1, y0, y1, z0, z1) => soup(k).box(Math.min(x0, x1), Math.max(x0, x1), y0, y1, Math.min(z0, z1), Math.max(z0, z1));

  // ==========================================================================
  // 本區獨有材質：匾額（文字紋理）、門內暗部
  // ==========================================================================
  const plaqueTex = makePlaqueTexture({ text: H.plaque.text, vertical: true, aspect: H.plaque.height / H.plaque.width });
  const plaqueMat = new THREE.MeshStandardMaterial({ name: 'hallPlaque', map: plaqueTex, roughness: 0.42, metalness: 0.15 });
  const darkMat = new THREE.MeshStandardMaterial({ name: 'hallInteriorDark', color: 0x2c221c, roughness: 0.92 });

  // ==========================================================================
  // 尺寸（由 layout 推算）
  // ==========================================================================
  const T = H.baseTiers, nT = T.length, topTier = T[nT - 1];
  const S = H.stairs;
  const sx0 = S.x0 - H.center.x, sx1 = S.x1 - H.center.x, sLand = S.landingX - H.center.x;
  const hw = S.halfWidth, rampHalf = S.centerRampHalf;
  const BH = H.balustradeHeight;
  // 本區局部常數 [估]
  const SIDE_HALF = 7;          // 南北側梯（俯視照片中的十字形外凸）半寬
  const CHEEK = 1.0;            // 梯側牆厚
  const NOTCH_IN = 0.5;         // 臺基缺口邊縮進梯側牆內（避免共面）
  const sideTop = topTier.half; // 側梯頂 = 第三層臺基邊緣
  const sideBot = T[0].half;    // 側梯底 = 第一層臺基邊緣
  const tierTopAt = (d) => { let y = 0; for (const t of T) if (d <= t.half + 1e-6) y = Math.max(y, t.top); return y; };

  // ==========================================================================
  // 欄杆（望柱、淨瓶用 InstancedMesh；欄板、扶手 merge）
  // ==========================================================================
  const POST_SP = 2.1;
  const postSet = new Map(), vases = [];
  function prism(k, A, B, halfW, h0, h1) {
    const dx = B[0] - A[0], dz = B[2] - A[2], l = Math.hypot(dx, dz);
    const sx = (-dz / l) * halfW, sz = (dx / l) * halfW;
    soup(k).hexa([
      [A[0] - sx, A[1] + h0, A[2] - sz], [B[0] - sx, B[1] + h0, B[2] - sz], [B[0] + sx, B[1] + h0, B[2] + sz], [A[0] + sx, A[1] + h0, A[2] + sz],
      [A[0] - sx, A[1] + h1, A[2] - sz], [B[0] - sx, B[1] + h1, B[2] - sz], [B[0] + sx, B[1] + h1, B[2] + sz], [A[0] + sx, A[1] + h1, A[2] + sz],
    ]);
  }
  function rail(A, B) {
    const dx = B[0] - A[0], dz = B[2] - A[2], dy = B[1] - A[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.3) return;
    const n = Math.max(1, Math.ceil(len / POST_SP));
    const rot = Math.atan2(-dz, dx);
    for (let i = 0; i <= n; i++) {
      const f = i / n, p = [A[0] + dx * f, A[1] + dy * f, A[2] + dz * f];
      const key = `${p[0].toFixed(1)},${p[2].toFixed(1)}`;
      if (!postSet.has(key)) postSet.set(key, [...p, rot]);
    }
    for (let i = 0; i < n; i++) for (const g of [0.3, 0.7]) {
      const f = (i + g) / n;
      vases.push([A[0] + dx * f, A[1] + dy * f, A[2] + dz * f, rot]);
    }
    prism('white', A, B, 0.075, -0.02, 0.42 * BH);      // 欄板（華板）
    prism('white', A, B, 0.08, BH - 0.17, BH - 0.04);   // 扶手（尋杖）
  }

  // ==========================================================================
  // 1. 三層臺基
  // ==========================================================================
  function tierOutline(i) {
    const h = T[i].half;
    const westNotch = h > -sx1 + 0.01;
    const sideNotch = h > sideTop + 0.01;
    const a = SIDE_HALF - NOTCH_IN, w = hw - NOTCH_IN;
    const pts = [[-h, -h]];
    if (sideNotch) pts.push([-a, -h], [-a, -sideTop], [a, -sideTop], [a, -h]);
    pts.push([h, -h], [h, h]);
    if (sideNotch) pts.push([a, h], [a, sideTop], [-a, sideTop], [-a, h]);
    pts.push([-h, h]);
    if (westNotch) pts.push([-h, w], [sx1, w], [sx1, -w], [-h, -w]);
    return pts;
  }
  const area2 = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], r = pts[(i + 1) % pts.length]; a += p[0] * r[1] - r[0] * p[1]; } return a; };
  const edgeN = (p, r, sg) => { const dx = r[0] - p[0], dz = r[1] - p[1], l = Math.hypot(dx, dz); return [sg * dz / l, -sg * dx / l]; };
  function offsetPoly(pts, d) {
    const sg = Math.sign(area2(pts)), n = pts.length;
    return pts.map((p, i) => {
      const n1 = edgeN(pts[(i - 1 + n) % n], p, sg), n2 = edgeN(p, pts[(i + 1) % n], sg);
      if (n1[0] * n2[0] + n1[1] * n2[1] > 0.99) return [p[0] + d * n1[0], p[1] + d * n1[1]];
      return [p[0] + d * (n1[0] + n2[0]), p[1] + d * (n1[1] + n2[1])];
    });
  }
  function polyWalls(sp, pts, y0, y1) {
    const sg = Math.sign(area2(pts));
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], r = pts[(i + 1) % pts.length], n = edgeN(p, r, sg);
      sp.quad([p[0], y0, p[1]], [r[0], y0, r[1]], [r[0], y1, r[1]], [p[0], y1, p[1]], [n[0], 0, n[1]]);
    }
  }
  function polyBand(sp, pts, d, y0, y1) {
    const o = offsetPoly(pts, d);
    polyWalls(sp, o, y0, y1);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], A = o[i], B = o[(i + 1) % pts.length];
      sp.quad([a[0], y1, a[1]], [b[0], y1, b[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], [0, 1, 0]);
      sp.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [B[0], y0, B[1]], [A[0], y0, A[1]], [0, -1, 0]);
    }
  }
  function polyCap(k, pts, y) {
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], -p[1]))));
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    uv.planarUV(g);
    addG(k, g);
  }

  for (let i = 0; i < nT; i++) {
    const t = T[i], pts = tierOutline(i);
    const y0 = i === 0 ? -0.6 : T[i - 1].top - 0.3;
    polyWalls(soup('marble'), pts, y0, t.top);
    polyBand(soup('white'), pts, 0.2, t.top - 0.66, t.top - 0.36);   // 腰線（壓面石下的線腳）
    polyBand(soup('white'), pts, 0.06, t.top - 0.16, t.top);          // 壓面石外緣
    if (i === 0) polyBand(soup('marble'), pts, 0.18, -0.6, 0.45);      // 勒腳
    polyCap('paving', pts, t.top);

    // 外緣欄杆：四邊，扣掉主梯與側梯開口
    const h = t.half, e = 0.4, L0 = h - e, y = t.top;
    const westGap = hw + 0.15, sideGap = SIDE_HALF + 0.15;
    const runs = [];
    runs.push({ fixed: 'x', at: -L0, from: -L0, to: -westGap }, { fixed: 'x', at: -L0, from: westGap, to: L0 });
    runs.push({ fixed: 'x', at: L0, from: -L0, to: L0 });
    for (const zs of [-1, 1]) runs.push({ fixed: 'z', at: zs * L0, from: -L0, to: -sideGap }, { fixed: 'z', at: zs * L0, from: sideGap, to: L0 });
    for (const r of runs) {
      if (r.to - r.from < 0.5) continue;
      if (r.fixed === 'x') rail([r.at, y, r.from], [r.at, y, r.to]);
      else rail([r.from, y, r.at], [r.to, y, r.at]);
    }
  }

  // 第一層臺基正面、主梯兩側的拱門（照片：梯側牆兩旁各一個深色拱洞）
  function archPts(half, yb, ys, n = 14) {
    const pts = [[-half, yb], [-half, ys]];
    for (let i = 1; i < n; i++) { const th = Math.PI - (Math.PI * i) / n; pts.push([half * Math.cos(th), ys + half * Math.sin(th)]); }
    pts.push([half, ys], [half, yb]);
    return pts;
  }
  // U 形門框（外拱減內拱），畫在 (橫向, y) 平面
  function archFrameShape(inHalf, outHalf, yb, ys) {
    const o = archPts(outHalf, yb, ys, 20), i = archPts(inHalf, yb, ys, 20).reverse();
    return new THREE.Shape([...o, ...i].map((p) => new THREE.Vector2(p[0], p[1])));
  }
  // 平面（橫向 a = 世界 z、b = y）→ 立在 x = xFace、朝 −x 的面；extrude 往 −x 長
  const toWestFace = (g, xFace, zc = 0) => { g.rotateY(-Math.PI / 2); g.translate(xFace, 0, zc); return g; };
  {
    const xF = -T[0].half, inH = 1.8, outH = 2.35, ys = 2.4;
    for (const zs of [-1, 1]) {
      const zc = zs * (hw + 6.5);
      const fr = new THREE.ExtrudeGeometry(archFrameShape(inH, outH, 0, ys), { depth: 0.5, bevelEnabled: false, curveSegments: 8 });
      addG('white', uv.boxUV(toWestFace(fr, xF, zc)));
      const hole = new THREE.ShapeGeometry(new THREE.Shape(archPts(inH, 0, ys).map((p) => new THREE.Vector2(p[0], p[1]))));
      addG('dark', toWestFace(hole, xF - 0.2, zc));
    }
  }

  // ==========================================================================
  // 2. 階梯（正面主梯＋南北側梯）
  // ==========================================================================
  // frame(u, y, w)：u = 沿爬升方向、w = 橫向 → 局部座標
  function slab(k, frame, u0, u1, w0, w1, yb0, yt0, yb1, yt1) {
    soup(k).hexa([
      frame(u0, yb0, w0), frame(u1, yb1, w0), frame(u1, yb1, w1), frame(u0, yb0, w1),
      frame(u0, yt0, w0), frame(u1, yt1, w0), frame(u1, yt1, w1), frame(u0, yt0, w1),
    ]);
  }
  function polyline(f, u0, u1, du = 0.25) {
    const n = Math.max(2, Math.ceil((u1 - u0) / du)), pts = [];
    for (let i = 0; i <= n; i++) { const u = u0 + ((u1 - u0) * i) / n; pts.push([u, f(u)]); }
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
      if (Math.abs((b[1] - a[1]) / (b[0] - a[0]) - (c[1] - b[1]) / (c[0] - b[0])) > 1e-4) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // 梯側牆（含白色壓頂）＋其上的扶手欄杆
  function cheeks(frame, wIn, wOut, topFn, run, railFrom = 0) {
    const pl = polyline(topFn, 0, run);
    for (const sgn of [-1, 1]) {
      const w0 = sgn * wIn, w1 = sgn * wOut, wc = sgn * (wIn + wOut) / 2;
      for (let i = 0; i < pl.length - 1; i++) {
        const [ua, ya] = pl[i], [ub, yb] = pl[i + 1];
        slab('marble', frame, ua, ub, w0, w1, -0.6, ya - 0.22, -0.6, yb - 0.22);
        slab('white', frame, ua, ub, w0 - sgn * 0.08, w1 + sgn * 0.08, ya - 0.22, ya, yb - 0.22, yb);
        if (ub > railFrom) {
          const u0 = Math.max(ua, railFrom), y0 = lerp(ya, yb, (u0 - ua) / (ub - ua));
          rail(frame(u0, y0, wc), frame(ub, yb, wc));
        }
      }
    }
  }

  // ---- 正面主梯 ------------------------------------------------------------
  const run = sx1 - sx0;
  const rise = topTier.top;
  const r = rise / S.steps;
  const landD = 3.0;
  const uL0 = sLand - sx0 - landD / 2, uL1 = uL0 + landD;
  const tAvg = (run - landD) / S.steps;
  const N1 = Math.round(uL0 / tAvg), N2 = S.steps - N1;
  const t1 = uL0 / N1, t2 = (run - uL1) / N2;
  const yL = N1 * r;
  // 踏步內角連線（平滑剖面）
  const prof = (u) => (u <= uL0 ? (u / uL0) * yL : u <= uL1 ? yL : yL + ((u - uL1) / (run - uL1)) * (rise - yL));
  const rampTop = (u) => prof(u) + r + 0.12;
  const fMain = (u, y, w) => [sx0 + u, y, w];

  // 兩側踏步
  {
    const wA = rampHalf + 0.6, wB = hw - CHEEK;
    for (const sgn of [-1, 1]) {
      const w0 = sgn * wA, w1 = sgn * wB;
      for (let k = 1; k <= N1; k++) {
        const top = k * r, u0 = (k - 1) * t1, u1 = k === N1 ? uL1 : k * t1;
        slab('grey', fMain, u0, u1, w0, w1, top - 2 * r - 0.1, top, top - 2 * r - 0.1, top);
      }
      for (let j = 1; j <= N2; j++) {
        const top = yL + j * r, u0 = uL1 + (j - 1) * t2, u1 = uL1 + j * t2;
        slab('grey', fMain, u0, u1, w0, w1, top - 2 * r - 0.1, top, top - 2 * r - 0.1, top);
      }
    }
  }
  // 梯側牆：至少高出踏步 0.55 m，碰到較高的臺基頂就與臺基齊平
  cheeks(fMain, hw - CHEEK, hw, (u) => Math.max(prof(u) + r + 0.55, tierTopAt(-(sx0 + u))), run, 1.3);
  // 抱鼓石（梯底扶手端）
  for (const sgn of [-1, 1]) {
    const w = sgn * (hw - CHEEK / 2), yb = prof(0.6) + r + 0.55;
    const drum = new THREE.CylinderGeometry(0.55, 0.55, 0.34, 18);
    drum.rotateX(Math.PI / 2);
    drum.translate(sx0 + 0.7, yb + 0.55, w);
    addG('white', uv.boxUV(drum));
    boxG('white', sx0 + 0.15, sx0 + 1.3, yb - 0.05, yb + 0.12, w - 0.2, w + 0.2);
  }

  // 中央御路：幾何浮雕（外框、分格、國徽圓、雲紋）
  {
    const noise = makeNoise2D('hall/ramp');
    const uE = 0.75 * uL0;                       // 國徽圓位置（第一段梯上半格）
    const edges = [0, uL0 / 2, uL1 + (run - uL1) / 2, run];
    const relief = (w, u) => {
      const aw = Math.abs(w);
      if (aw > rampHalf - 0.55) return 0.1;                               // 外框
      for (const e of edges) if (Math.abs(u - e) < 0.35) return 0.1;     // 分格帶
      if (u > uL0 - 0.35 && u < uL1 + 0.35) return 0.1;                  // 平台段
      const du = u - uE, d = Math.hypot(w, du);
      if (Math.abs(u - uE) < 4.2) {                                       // 國徽：外圈、十二道光芒、中心圓
        if (d > 3.15 && d < 3.6) return 0.1;
        if (d < 1.25) return 0.07;
        if (d > 1.45 && d < 2.95) {
          const th = Math.atan2(w, du), f = (((th / (2 * Math.PI)) * 12) % 1 + 1) % 1 - 0.5;
          const width = 0.5 * (1 - (d - 1.45) / 1.5);
          return Math.abs(f) < width ? 0.07 : 0;
        }
        return 0;
      }
      // 其他格：雲紋（低浮雕）
      const a = Math.sin(w * 1.25 + Math.sin(u * 0.62) * 1.9) * Math.cos(u * 0.95 - w * 0.45) + (noise.fbm(w * 0.6, u * 0.6, 2) - 0.5) * 0.5;
      return 0.055 * smooth(0.3, 0.62, a);
    };
    const NW = Q(60), NU = Q(240);
    const pos = [], uvs = [], idx = [];
    for (let j = 0; j <= NU; j++) {
      const u = (run * j) / NU;
      for (let i = 0; i <= NW; i++) {
        const w = -rampHalf + (2 * rampHalf * i) / NW;
        const p = fMain(u, rampTop(u) + relief(w, u), w);
        pos.push(p[0], p[1], p[2]); uvs.push(w, u);
      }
    }
    for (let j = 0; j < NU; j++) for (let i = 0; i < NW; i++) {
      const a = j * (NW + 1) + i, b = a + 1, c = a + NW + 1, d = c + 1;
      idx.push(a, d, b, a, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { idx.reverse(); g.setIndex(idx); g.computeVertexNormals(); }
    addG('white', g);
    // 御路正面
    soup('white').quad(fMain(0, 0, -rampHalf), fMain(0, 0, rampHalf), fMain(0, rampTop(0), rampHalf), fMain(0, rampTop(0), -rampHalf), [-1, 0, 0]);
    // 御路兩側壓邊石＋矮欄
    const br = [0, uL0, uL1, run];
    for (const sgn of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const ua = br[i], ub = br[i + 1];
        slab('white', fMain, ua, ub, sgn * rampHalf, sgn * (rampHalf + 0.6), prof(ua) - 0.3, rampTop(ua) + 0.12, prof(ub) - 0.3, rampTop(ub) + 0.12);
        rail(fMain(Math.max(ua, 0.8), rampTop(Math.max(ua, 0.8)) + 0.12, sgn * (rampHalf + 0.3)), fMain(ub, rampTop(ub) + 0.12, sgn * (rampHalf + 0.3)));
      }
    }
    // 御路頂端：橫向門檻石＋欄杆（大門前那道）
    const yTop = rampTop(run) + 0.12;
    slab('white', fMain, run - 0.05, run + 0.7, -(rampHalf + 0.6), rampHalf + 0.6, rise - 0.3, yTop, rise - 0.3, yTop);
    rail(fMain(run + 0.35, yTop, -rampHalf - 0.3), fMain(run + 0.35, yTop, rampHalf + 0.3));
  }

  // ---- 南北側梯（十字形外凸）-------------------------------------------------
  {
    const runS = sideBot - sideTop, nS = S.steps, rS = rise / nS, tS = runS / nS;
    const frames = [
      (u, y, w) => [-w, y, -sideBot + u],   // 北側：往 +z 爬
      (u, y, w) => [w, y, sideBot - u],     // 南側：往 −z 爬
    ];
    for (const f of frames) {
      for (let k = 1; k <= nS; k++) {
        const top = k * rS;
        slab('grey', f, (k - 1) * tS, k * tS, -(SIDE_HALF - CHEEK), SIDE_HALF - CHEEK, top - 2 * rS - 0.1, top, top - 2 * rS - 0.1, top);
      }
      cheeks(f, SIDE_HALF - CHEEK, SIDE_HALF, (u) => Math.max((u / runS) * rise + rS + 0.55, tierTopAt(sideBot - u)), runS, 0);
    }
  }

  // ---- 梯底石獅（程序造型：坐姿，面向 −x）--------------------------------------
  {
    const noise = makeNoise2D('hall/lion');
    for (const sgn of [-1, 1]) {
      const px = sx0 + 1.6, pz = sgn * (hw + 2.0);
      // 須彌座
      boxG('marble', px - 1.15, px + 1.15, -0.1, 0.25, pz - 0.85, pz + 0.85);
      boxG('marble', px - 0.95, px + 0.95, 0.25, 1.2, pz - 0.7, pz + 0.7);
      boxG('white', px - 1.1, px + 1.1, 1.2, 1.38, pz - 0.82, pz + 0.82);
      const parts = [];
      const ell = (rx, ry, rz, x, y, z, ws = 14, hs = 10) => {
        const s = new THREE.SphereGeometry(1, ws, hs); s.scale(rx, ry, rz); s.translate(x, y, z); parts.push(s);
      };
      ell(0.62, 0.55, 0.55, 0.32, 0.55, 0);           // 後軀
      ell(0.42, 0.4, 0.22, 0.3, 0.45, 0.42);          // 後腿
      ell(0.42, 0.4, 0.22, 0.3, 0.45, -0.42);
      ell(0.5, 0.78, 0.5, -0.12, 1.05, 0);            // 前胸
      for (const zz of [-0.25, 0.25]) {
        const leg = new THREE.CylinderGeometry(0.14, 0.18, 1.0, 10);
        leg.rotateZ(-0.12); leg.translate(-0.42, 0.5, zz); parts.push(leg);
        ell(0.22, 0.12, 0.17, -0.55, 0.08, zz);       // 前爪
        ell(0.26, 0.12, 0.18, -0.02, 0.08, zz * 1.7); // 後爪
      }
      ell(0.42, 0.42, 0.4, -0.42, 1.72, 0);           // 頭
      ell(0.24, 0.17, 0.26, -0.8, 1.6, 0);            // 吻
      ell(0.1, 0.08, 0.1, -1.02, 1.66, 0, 8, 6);      // 鼻
      ell(0.2, 0.32, 0.18, 0.82, 0.95, 0, 10, 8);     // 尾捲
      ell(0.26, 0.26, 0.26, -0.72, 0.26, -sgn * 0.42); // 繡球／幼獅
      // 鬃毛：二十面體加雜訊起伏（捲毛）
      const mane = new THREE.IcosahedronGeometry(0.62, 2);
      const mp = mane.attributes.position;
      for (let i = 0; i < mp.count; i++) {
        const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i);
        const k = 1 + (noise.fbm(x * 4 + 7, z * 4 + y * 3, 2) - 0.5) * 0.45;
        mp.setXYZ(i, x * k * 0.85, y * k * 1.05, z * k);
      }
      mane.translate(-0.24, 1.66, 0);
      parts.push(mane);
      const lion = utils.mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
        for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
        return g;
      }));
      lion.scale(1.15, 1.15, 1.15);
      lion.translate(px + 0.1, 1.38, pz);
      lion.computeVertexNormals();
      addG('white', uv.boxUV(lion));
    }
  }

  // ==========================================================================
  // 3. 主體（核心＋四角方塔＋大門＋匾額）
  // ==========================================================================
  const Bd = H.body, y0b = Bd.bottom, y1b = Bd.top;
  const core = Bd.coreHalf, prot = Bd.cornerProtrusion;
  const outer = core + prot, inner = core - prot;
  const faceAt = (y) => outer - Bd.wallBatter * (y - y0b);  // 方塔外側兩面內傾
  const slabHalf = core + 1.0, slabY0 = y1b - 0.6, slabY1 = y1b + 0.12;
  const capY0 = y1b - 2.15;

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const yTop = y1b - 0.2, oT = faceAt(yTop);
    const ring = (o, y) => [[sx * inner, y, sz * inner], [sx * o, y, sz * inner], [sx * o, y, sz * o], [sx * inner, y, sz * o]];
    soup('marble').hexa([...ring(outer, y0b - 0.3), ...ring(oT, yTop)]);
    // 塔頂壓頂（兩段線腳）
    const lip = faceAt(capY0) + 0.4, cap = faceAt(capY0 + 0.35) + 0.22;
    boxG('white', sx * (inner - 0.3), sx * lip, capY0, capY0 + 0.35, sz * (inner - 0.3), sz * lip);
    boxG('marble', sx * (inner - 0.22), sx * cap, capY0 + 0.35, y1b, sz * (inner - 0.22), sz * cap);
    // 角上的回字凸塊（照片：塔頂外角有一個方形小階）
    boxG('white', sx * (cap - 1.6), sx * (cap - 0.25), y1b, y1b + 0.35, sz * (cap - 1.6), sz * (cap - 0.25));
  }
  // 頂板（簷下斗栱層的座）
  boxG('marble', -slabHalf, slabHalf, slabY0, slabY1, -slabHalf, slabHalf);
  // 核心凹入牆面：東、北、南
  {
    const sp = soup('marble'), yW = slabY0;
    sp.quad([core, y0b, -inner], [core, y0b, inner], [core, yW, inner], [core, yW, -inner], [1, 0, 0]);
    sp.quad([-inner, y0b, -core], [inner, y0b, -core], [inner, yW, -core], [-inner, yW, -core], [0, 0, -1]);
    sp.quad([-inner, y0b, core], [inner, y0b, core], [inner, yW, core], [-inner, yW, core], [0, 0, 1]);
  }
  // 西（正面）牆：拱門洞
  const D = H.door, dHalf = D.width / 2, dSpring = D.bottom + D.height - dHalf, xF = -core;
  {
    const door = archPts(dHalf, D.bottom, dSpring, 24);
    const wall = [[-inner, y0b], ...door, [inner, y0b], [inner, slabY0], [-inner, slabY0]];
    const g = new THREE.ShapeGeometry(new THREE.Shape(wall.map((p) => new THREE.Vector2(p[0], p[1]))));
    addG('marble', uv.boxUV(toWestFace(g, xF)));
    // 門框線腳：主框＋外側細線＋拱心石＋柱礎
    const fr1 = new THREE.ExtrudeGeometry(archFrameShape(dHalf, dHalf + 1.5, D.bottom, dSpring), { depth: 0.45, bevelEnabled: false, curveSegments: 12 });
    addG('white', uv.boxUV(toWestFace(fr1, xF)));
    const fr2 = new THREE.ExtrudeGeometry(archFrameShape(dHalf + 1.5, dHalf + 1.85, D.bottom, dSpring), { depth: 0.25, bevelEnabled: false, curveSegments: 12 });
    addG('white', uv.boxUV(toWestFace(fr2, xF)));
    const fr3 = new THREE.ExtrudeGeometry(archFrameShape(dHalf + 0.15, dHalf + 0.4, D.bottom, dSpring), { depth: 0.6, bevelEnabled: false, curveSegments: 12 });
    addG('white', uv.boxUV(toWestFace(fr3, xF)));
    boxG('white', xF - 0.7, xF, dSpring + dHalf - 0.2, dSpring + dHalf + 1.7, -0.7, 0.7);
    for (const zs of [-1, 1]) boxG('white', xF - 0.6, xF, D.bottom, D.bottom + 1.3, zs * (dHalf - 0.05), zs * (dHalf + 2.0));
    // 門洞（隧道）
    const depth = 3.0, sp = soup('marble');
    for (let i = 0; i < door.length - 1; i++) {
      const [a0, b0] = door[i], [a1, b1] = door[i + 1];
      const bm = (b0 + b1) / 2, am = (a0 + a1) / 2;
      sp.quad([xF, b0, a0], [xF, b1, a1], [xF + depth, b1, a1], [xF + depth, b0, a0], [0, bm < dSpring ? 0 : dSpring - bm, -am]);
    }
    // 門內 5 階（大廳前 5 階）
    const nU = S.upperSteps, rU = r, tU = (depth - 0.4) / nU;
    for (let j = 1; j <= nU; j++) boxG('grey', xF + 0.2 + (j - 1) * tU, xF + depth + (j === nU ? 13 : 0), D.bottom - 0.1, D.bottom + j * rU, -dHalf, dHalf);
    const yFloor = D.bottom + nU * rU;
    // 門內大廳（暗部）
    const xIn = xF + depth, xBack = xIn + 15, zR = 10, yC = slabY0 - 3;
    const dk = soup('dark');
    dk.quad([xBack, yFloor, -zR], [xBack, yFloor, zR], [xBack, yC, zR], [xBack, yC, -zR], [-1, 0, 0]);
    for (const zs of [-1, 1]) dk.quad([xIn, yFloor, zs * zR], [xBack, yFloor, zs * zR], [xBack, yC, zs * zR], [xIn, yC, zs * zR], [0, 0, -zs]);
    dk.quad([xIn, yC, -zR], [xBack, yC, -zR], [xBack, yC, zR], [xIn, yC, zR], [0, -1, 0]);
    soup('grey').quad([xIn, yFloor, -zR], [xBack, yFloor, -zR], [xBack, yFloor, zR], [xIn, yFloor, zR], [0, 1, 0]);
    // 半開銅門（往內開約 70°）＋拱內銅格柵
    const leafH = dSpring - yFloor, open = 70 * Math.PI / 180;
    for (const zs of [-1, 1]) {
      const hx = xIn - 0.05, hz = zs * (dHalf - 0.05);
      const dx = Math.sin(open), dz = -zs * Math.cos(open), wl = dHalf - 0.1, th = 0.22;
      const nx = -dz * zs, nz = dx * zs;
      const c = [[hx, hz], [hx + dx * wl, hz + dz * wl], [hx + dx * wl + nx * th, hz + dz * wl + nz * th], [hx + nx * th, hz + nz * th]];
      soup('bronze').hexa([...c.map((p) => [p[0], yFloor, p[1]]), ...c.map((p) => [p[0], yFloor + leafH, p[1]])]);
    }
    const tym = new THREE.ShapeGeometry(new THREE.Shape(archPts(dHalf, dSpring, dSpring, 20).slice(1, -1).concat([[dHalf, dSpring - 0.4], [-dHalf, dSpring - 0.4]]).map((p) => new THREE.Vector2(p[0], p[1]))));
    addG('bronze', uv.boxUV(toWestFace(tym, xIn - 0.05)));
    for (let i = 1; i < 8; i++) {
      const th = Math.PI * i / 8, ca = Math.cos(th), sa = Math.sin(th);
      const p0 = [xIn - 0.12, dSpring + 0.6 * sa, 0.6 * ca], p1 = [xIn - 0.12, dSpring + (dHalf - 0.2) * sa, (dHalf - 0.2) * ca];
      const dd = [0, p1[1] - p0[1], p1[2] - p0[2]], l = Math.hypot(dd[1], dd[2]);
      const nn = [0, -dd[2] / l * 0.07, dd[1] / l * 0.07];
      soup('glaze').hexa([
        [p0[0] - 0.08, p0[1] - nn[1], p0[2] - nn[2]], [p1[0] - 0.08, p1[1] - nn[1], p1[2] - nn[2]], [p1[0] - 0.08, p1[1] + nn[1], p1[2] + nn[2]], [p0[0] - 0.08, p0[1] + nn[1], p0[2] + nn[2]],
        [p0[0] + 0.05, p0[1] - nn[1], p0[2] - nn[2]], [p1[0] + 0.05, p1[1] - nn[1], p1[2] - nn[2]], [p1[0] + 0.05, p1[1] + nn[1], p1[2] + nn[2]], [p0[0] + 0.05, p0[1] + nn[1], p0[2] + nn[2]],
      ]);
    }
    // 銅像剪影（坐姿）
    const sxp = xIn + 9;
    boxG('white', sxp - 2.2, sxp + 2.2, yFloor, yFloor + 3.0, -2.6, 2.6);
    boxG('bronze', sxp - 1.0, sxp + 1.3, yFloor + 3.0, yFloor + 6.2, -1.3, 1.3);   // 身
    boxG('bronze', sxp - 2.4, sxp - 0.6, yFloor + 3.0, yFloor + 4.3, -1.2, 1.2);   // 膝
    boxG('bronze', sxp - 2.5, sxp - 1.7, yFloor + 3.0, yFloor + 3.6, -1.0, 1.0);
    const head = new THREE.SphereGeometry(0.62, 12, 9); head.scale(1, 1.15, 0.92); head.translate(sxp + 0.1, yFloor + 7.0, 0);
    addG('bronze', uv.boxUV(head));
  }
  // 直式匾額（藍底金字）＋白石框
  // layout 的 plaque.y＝33.5、高 7.5 → 下緣 29.75，會壓到 16 m 大門的拱頂（30.5）與門框。
  // 照片中匾額在拱頂之上、上半段疊在斗栱層前方，所以這裡把中心往上推到「剛好避開門框」，
  // 匾額掛在頂板／額枋外側（斗栱層正前方），該處的斗栱單元讓開（見 bracketRing 的 skip）。
  const PL = H.plaque, plHW = PL.width / 2, plHH = PL.height / 2, plFB = 0.5;
  const plY = Math.max(PL.y, dSpring + dHalf + 1.85 + 0.45 + plFB + plHH);
  const plX = -slabHalf - 0.5;                       // 匾額底板正面
  const plSkip = plHW + plFB + 1.6;                  // 正面中央這個寬度內不放斗栱
  {
    const xb = plX, xf = plX - 0.35;
    boxG('white', xb, xF, plY - plHH - plFB, plY + plHH + plFB, -plHW - plFB, plHW + plFB);   // 底板（貼牆）
    boxG('white', xf, xb, plY + plHH, plY + plHH + plFB, -plHW - plFB, plHW + plFB);         // 上框
    boxG('white', xf, xb, plY - plHH - plFB, plY - plHH, -plHW - plFB, plHW + plFB);         // 下框
    for (const zs of [-1, 1]) boxG('white', xf, xb, plY - plHH, plY + plHH, zs * plHW, zs * (plHW + plFB));
    boxG('gold', xf - 0.03, xf + 0.02, plY - plHH - 0.08, plY + plHH + 0.08, -plHW - 0.08, -plHW);  // 金色內緣線
    boxG('gold', xf - 0.03, xf + 0.02, plY - plHH - 0.08, plY + plHH + 0.08, plHW, plHW + 0.08);
    const pg = new THREE.PlaneGeometry(PL.width, PL.height);
    pg.rotateY(-Math.PI / 2);
    pg.translate(xb - 0.02, plY, 0);
    addG('plaque', pg);
  }

  // ==========================================================================
  // 4. 屋頂：八角攢尖重簷
  // ==========================================================================
  const R = H.roof, NSIDE = R.sides || 8;
  const C8 = Math.cos(Math.PI / NSIDE), S8 = Math.sin(Math.PI / NSIDE), TN = Math.tan(Math.PI / NSIDE);
  // 第 k 面（面中心朝向 φ = k·45°；k = 4 → 正西）上，參數 s∈[−1,1]、外接圓半徑 ρ 的平面點
  const dirOf = (k) => { const f = (k * 2 * Math.PI) / NSIDE; return [Math.cos(f), Math.sin(f)]; };
  const plan = (k, s, rho) => {
    const [nx, nz] = dirOf(k);
    return [rho * (C8 * nx - s * S8 * nz), rho * (C8 * nz + s * S8 * nx)];
  };
  // 八角面帶（單面，朝外）；uvMode 'paint' 時 u 沿面、v 沿高（公尺）
  function octBand(k0, a, y0, y1) {
    const Rr = a / C8, half = a * TN, sp = soup(k0, k0 === 'paint' ? 'custom' : 'box');
    for (let k = 0; k < NSIDE; k++) {
      const [x0, z0] = plan(k, -1, Rr), [x1, z1] = plan(k, 1, Rr), [nx, nz] = dirOf(k);
      // bracketPaint 每 2 m 一循環，v∈[0.78,1.98] 是青／綠／藍帶（避開紅、金帶，照片的額枋以青綠為主）
      sp.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0], [nx, 0, nz],
        [[-half, 0.78], [half, 0.78], [half, 1.98], [-half, 1.98]]);
    }
  }
  // 八角環（封閉）
  function octRing(k0, aIn, aOut, y0, y1) {
    const Ri = aIn / C8, Ro = aOut / C8;
    for (let k = 0; k < NSIDE; k++) {
      const a = plan(k, -1, Ri), b = plan(k, 1, Ri), c = plan(k, 1, Ro), d = plan(k, -1, Ro);
      const ring = (y) => [[a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]]];
      soup(k0).hexa([...ring(y0), ...ring(y1)]);
    }
  }

  // ---- 斗栱單元（局部：X 朝外、Y 向上、Z 沿面；基準高 2.7、出跳 2.6、間距 2.0）----------
  const unitTeal = [], unitWhite = [];
  {
    const bx = (list, x0, x1, y0, y1, z0, z1) => {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      list.push(g);
    };
    // 栱（沿面）與翹（出跳），三跳
    bx(unitTeal, -0.05, 0.35, 0.45, 0.78, -1.0, 1.0);
    bx(unitTeal, -0.1, 1.1, 0.45, 0.78, -0.17, 0.17);
    bx(unitTeal, 0.6, 1.0, 1.0, 1.33, -1.3, 1.3);
    bx(unitTeal, -0.1, 1.85, 1.0, 1.33, -0.17, 0.17);
    bx(unitTeal, 1.35, 1.75, 1.55, 1.88, -1.6, 1.6);
    bx(unitTeal, -0.1, 2.6, 1.55, 1.88, -0.17, 0.17);
    bx(unitTeal, 2.15, 2.6, 2.1, 2.7, -1.01, 1.01);   // 挑檐枋（連續）
    bx(unitTeal, -0.1, 0.45, 2.1, 2.7, -1.01, 1.01);  // 正心枋（連續）
    // 斗（白）
    bx(unitWhite, -0.15, 0.5, 0, 0.45, -0.33, 0.33);
    for (const z of [-0.85, 0.85]) bx(unitWhite, 0.0, 0.32, 0.78, 1.0, z - 0.15, z + 0.15);
    bx(unitWhite, 0.8, 1.1, 0.78, 1.0, -0.17, 0.17);
    for (const z of [-1.15, 1.15]) bx(unitWhite, 0.65, 0.95, 1.33, 1.55, z - 0.15, z + 0.15);
    bx(unitWhite, 1.55, 1.85, 1.33, 1.55, -0.17, 0.17);
    for (const z of [-1.45, 1.45]) bx(unitWhite, 1.4, 1.7, 1.88, 2.1, z - 0.15, z + 0.15);
    bx(unitWhite, 2.3, 2.6, 1.88, 2.1, -0.17, 0.17);
    bx(unitWhite, 2.12, 2.66, 2.05, 2.12, -1.01, 1.01);  // 枋下白線
    // 人字斜撐（照片中斗栱層的白色鋸齒紋）
    for (const sgn of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.08, 1.45, 0.11);
      g.rotateX(sgn * 0.72);
      g.translate(1.22, 1.42, sgn * 0.5);
      unitWhite.push(g);
    }
  }
  const unitTealG = uv.boxUV(utils.mergeGeometries(unitTeal.map((g) => g.toNonIndexed())));
  {
    // 斗栱 UV 壓到彩畫的青綠藍帶：立面 v = 0.85 + 0.4·y、水平面 v = 1.4 + 0.3·z
    const ua = unitTealG.attributes.uv, na = unitTealG.attributes.normal, pa = unitTealG.attributes.position;
    for (let i = 0; i < ua.count; i++) {
      const horiz = Math.abs(na.getY(i)) > 0.5;
      ua.setY(i, horiz ? 1.4 + 0.3 * pa.getZ(i) : 0.85 + 0.4 * pa.getY(i));
    }
  }
  const unitWhiteG = uv.boxUV(utils.mergeGeometries(unitWhite.map((g) => g.toNonIndexed())));
  const unitMats = [];
  const _m = new THREE.Matrix4(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function bracketRing(a, yb, sy, sx, skip = null) {
    const side = 2 * a * TN, m = Math.max(2, Math.round(side / 2.0)), spc = side / m;
    for (let k = 0; k < NSIDE; k++) {
      const [nx, nz] = dirOf(k);
      _n.set(nx, 0, nz); _t.set(-nz, 0, nx);
      for (let i = 0; i < m; i++) {
        const off = -side / 2 + (i + 0.5) * spc;
        if (skip && k === skip.k && Math.abs(off) < skip.half) continue;
        const mm = new THREE.Matrix4().makeBasis(_n, _up, _t).scale(new THREE.Vector3(sx, sy, spc / 2.0));
        mm.setPosition(nx * a - nz * off, yb, nz * a + nx * off);
        unitMats.push(mm);
      }
    }
  }

  // ---- 屋面 ---------------------------------------------------------------
  const FAS_H = 0.55, LIP_H = 0.12;
  function roofLayer(spec) {
    const { yE, RE, yT, RT, lift, sag, prof: pf } = spec;
    const NS = Q(32), NT = Q(20);
    const rhoE = (s) => RE * (1 - sag * (1 - Math.pow(Math.abs(s), 2.2)));
    const liftAt = (s) => lift * Math.pow(Math.abs(s), 2.6);
    const P3 = (k, s, t) => {
      const rho = rhoE(s) * (1 - t) + RT * t;
      const y = yE + (yT - yE) * pf(t) + liftAt(s) * Math.pow(1 - t, 1.5);
      const [x, z] = plan(k, s, rho);
      return [x, y, z, rho];
    };
    // v：中線由上往下量的坡長（公尺）
    const vT = new Float32Array(NT + 1);
    for (let j = NT - 1, acc = 0; j >= 0; j--) {
      const a = P3(0, 0, j / NT), b = P3(0, 0, (j + 1) / NT);
      acc += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      vT[j] = acc;
    }
    for (let k = 0; k < NSIDE; k++) {
      const pos = [], uvs = [], idx = [];
      for (let j = 0; j <= NT; j++) for (let i = 0; i <= NS; i++) {
        const s = -1 + (2 * i) / NS, p = P3(k, s, j / NT);
        pos.push(p[0], p[1], p[2]); uvs.push(s * p[3] * S8, vT[j]);
      }
      // 繞向：讓法線朝上
      const pa = P3(k, 0, 0), pb = P3(k, 2 / NS, 0), pc = P3(k, 0, 1 / NT);
      const up = cross(sub(pb, pa), sub(pc, pa))[1] > 0;
      for (let j = 0; j < NT; j++) for (let i = 0; i < NS; i++) {
        const a = j * (NS + 1) + i, b = a + 1, c = a + NS + 1, d = c + 1;
        if (up) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      addG('tile', g);
    }
    // 簷口白色收邊（立面帶＋上緣唇＋底面）
    const fs = soup('white');
    for (let k = 0; k < NSIDE; k++) {
      const [nx, nz] = dirOf(k);
      const o = (s, dr, dy) => { const [x, z] = plan(k, s, rhoE(s) + dr); return [x, yE + liftAt(s) + dy, z]; };
      for (let i = 0; i < NS; i++) {
        const s0 = -1 + (2 * i) / NS, s1 = -1 + (2 * (i + 1)) / NS;
        fs.quad(o(s0, 0.06, -FAS_H), o(s1, 0.06, -FAS_H), o(s1, 0.06, LIP_H), o(s0, 0.06, LIP_H), [nx, 0, nz]);
        fs.quad(o(s0, -0.42, LIP_H), o(s1, -0.42, LIP_H), o(s1, 0.06, LIP_H), o(s0, 0.06, LIP_H), [0, 1, 0]);
        fs.quad(o(s0, -0.2, -FAS_H), o(s1, -0.2, -FAS_H), o(s1, 0.06, -FAS_H), o(s0, 0.06, -FAS_H), [0, -1, 0]);
      }
    }
    // 垂脊（藍琉璃）＋白色起翹翼角
    for (let k = 0; k < NSIDE; k++) {
      const pts = [];
      for (const e of [1.5, 1.0, 0.5]) {
        const [x, z] = plan(k, 1, rhoE(1) + e);
        pts.push([x, yE + liftAt(1) + 0.3 * e + 0.16 * e * e + 0.25, z]);
      }
      const nH = Q(14);
      for (let j = 0; j <= nH; j++) { const p = P3(k, 1, j / nH); pts.push([p[0], p[1] + 0.25, p[2]]); }
      sweep(pts, 0.26, 0.5, 3);
    }
    return { rhoE, liftAt, P3 };
  }
  // 沿折線掃出方形斷面的脊；前 nTip 段用白色
  function sweep(pts, hwid, h, nTip) {
    const rings = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let T3 = sub(b, a); const tl = Math.hypot(...T3) || 1; T3 = T3.map((v) => v / tl);
      let sd = [-T3[2], 0, T3[0]]; const sl = Math.hypot(...sd) || 1; sd = sd.map((v) => v / sl);
      let nr = cross(sd, T3); if (nr[1] < 0) nr = nr.map((v) => -v);
      const at = (u, v) => [p[0] + sd[0] * u + nr[0] * v, p[1] + sd[1] * u + nr[1] * v, p[2] + sd[2] * u + nr[2] * v];
      return [at(-hwid, -0.25), at(hwid, -0.25), at(hwid, h), at(-hwid, h)];
    });
    for (let i = 0; i < rings.length - 1; i++) {
      const sp = soup(i < nTip ? 'white' : 'glaze');
      const A = rings[i], B = rings[i + 1], ca = avg(pts[i], pts[i + 1]);
      for (let e = 0; e < 4; e++) {
        const a = A[e], b = A[(e + 1) % 4], c = B[(e + 1) % 4], d = B[e];
        sp.quad(a, b, c, d, sub(avg(a, b, c, d), ca));
      }
    }
    const A = rings[0];
    soup('white').quad(A[0], A[1], A[2], A[3], sub(pts[0], pts[1]));
  }
  // 簷下天花（藍綠底）
  function soffit(rf, yE, ringR, ringY) {
    const NS = Q(16), sp = soup('soffit');
    for (let k = 0; k < NSIDE; k++) {
      const pt = (s, t) => {
        const rho = lerp(rf.rhoE(s) - 0.2, ringR, t), [x, z] = plan(k, s, rho);
        return [x, lerp(yE + rf.liftAt(s) - FAS_H, ringY, t), z];
      };
      for (let i = 0; i < NS; i++) {
        const s0 = -1 + (2 * i) / NS, s1 = -1 + (2 * (i + 1)) / NS;
        for (const [ta, tb] of [[0, 0.5], [0.5, 1]]) sp.quad(pt(s0, ta), pt(s1, ta), pt(s1, tb), pt(s0, tb), [0, -1, 0]);
      }
    }
  }

  // ---- 下簷斗栱層（坐在主體頂板上）------------------------------------------------
  const aL = slabHalf;                                  // 斗栱層面距 = 頂板半寬
  const lowRingTop = R.lowerEave.y - FAS_H - 0.07;
  const lowArch1 = R.bracketBottom + 1.35;
  octBand('soffit', aL - 0.05, slabY1 - 0.1, lowRingTop);          // 栱眼壁
  octBand('paint', aL + 0.12, slabY1, lowArch1);                   // 額枋彩畫
  octRing('white', aL, aL + 0.22, slabY1, slabY1 + 0.14);
  octRing('white', aL, aL + 0.22, lowArch1 - 0.14, lowArch1);
  const lowerSpec = {
    yE: R.lowerEave.y, RE: R.lowerEave.radius, yT: R.drum.y0, RT: R.drum.radius,
    lift: 1.4, sag: 0.07, prof: (t) => 0.62 * t + 0.38 * t * t,
  };
  const lowEaveFace = R.lowerEave.radius * (1 - lowerSpec.sag) * C8;
  const lowSy = (lowRingTop - lowArch1) / 2.7, lowSx = Math.min(1.2, (lowEaveFace - aL - 0.5) / 2.6);
  const westK = Math.round(NSIDE / 2);              // 面向 −x 的那一面
  bracketRing(aL + 0.12, lowArch1, lowSy, lowSx, { k: westK, half: plSkip });
  {
    // 匾額後方讓開的斗栱段：補上連續的挑檐枋與正心枋，簷下不留缺口
    const a0 = aL + 0.12;
    boxG('soffit', -(a0 + 2.6 * lowSx), -(a0 + 2.15 * lowSx), lowArch1 + 2.1 * lowSy, lowArch1 + 2.7 * lowSy, -plSkip, plSkip);
    boxG('soffit', -(a0 + 0.45 * lowSx), -(a0 - 0.1 * lowSx), lowArch1 + 2.1 * lowSy, lowArch1 + 2.7 * lowSy, -plSkip, plSkip);
    boxG('white', -(a0 + 2.66 * lowSx), -(a0 + 2.12 * lowSx), lowArch1 + 2.05 * lowSy, lowArch1 + 2.12 * lowSy, -plSkip, plSkip);
  }
  const lowRoof = roofLayer(lowerSpec);
  soffit(lowRoof, lowerSpec.yE, aL / C8, lowRingTop);

  // ---- 鼓座（兩簷之間）＋上簷斗栱 ----------------------------------------------------
  const aD = R.drum.radius * C8;
  const upArch1 = R.drum.y0 + 1.0;
  octBand('soffit', aD, R.drum.y0 - 1.5, R.drum.y1);              // 鼓座牆
  octBand('paint', aD + 0.12, R.drum.y0, upArch1);
  octRing('white', aD, aD + 0.22, upArch1 - 0.14, upArch1);
  octRing('glaze', aD - 0.1, aD + 0.5, R.drum.y0 - 0.15, R.drum.y0 + 0.45);   // 圍脊（下簷屋面與鼓座交接）
  const upperSpec = {
    yE: R.upperEave.y, RE: R.upperEave.radius, yT: R.apex, RT: 0,
    lift: 1.15, sag: 0.07, prof: (t) => 0.55 * t + 0.45 * Math.pow(t, 3.2),
  };
  const upEaveFace = R.upperEave.radius * (1 - upperSpec.sag) * C8;
  bracketRing(aD + 0.12, upArch1, (R.drum.y1 - upArch1) / 2.7, Math.max(0.35, (upEaveFace - aD - 0.35) / 2.6));
  const upRoof = roofLayer(upperSpec);
  soffit(upRoof, upperSpec.yE, R.drum.radius, R.drum.y1);

  // ---- 寶頂座＋金色葫蘆寶頂 ------------------------------------------------------
  {
    const F = R.finial, hF = F.y1 - F.y0, mr = F.maxRadius;
    const collar = new THREE.CylinderGeometry(mr * 0.62, mr * 0.8, 0.9, NSIDE);
    collar.rotateY(Math.PI / NSIDE);
    collar.translate(0, F.y0 - 0.3, 0);
    addG('glaze', collar);
    const PROF = [[0, 0], [0.62, 0], [0.66, 0.04], [0.55, 0.08], [0.72, 0.14], [0.9, 0.22], [1.0, 0.32], [0.98, 0.42],
      [0.86, 0.5], [0.6, 0.56], [0.34, 0.6], [0.28, 0.64], [0.38, 0.68], [0.42, 0.73], [0.36, 0.78], [0.2, 0.83],
      [0.13, 0.88], [0.08, 0.95], [0, 1]];
    const lathe = new THREE.LatheGeometry(PROF.map(([rr, hh]) => new THREE.Vector2(rr * mr, F.y0 + hh * hF)), Q(32));
    addG('gold', lathe);
    // 寶頂上的橫向凸紋
    for (const hh of [0.2, 0.3, 0.42]) {
      const rr = PROF.reduce((best, p) => (Math.abs(p[1] - hh) < Math.abs(best[1] - hh) ? p : best))[0] * mr;
      const tor = new THREE.TorusGeometry(rr * 0.99, 0.06, 5, Q(32));
      tor.rotateX(Math.PI / 2);
      tor.translate(0, F.y0 + hh * hF, 0);
      addG('gold', tor);
    }
  }

  // ==========================================================================
  // 組裝：同材質 merge、欄杆與斗栱 InstancedMesh
  // ==========================================================================
  const MATS = {
    marble: M.marble, white: M.marbleSmooth, grey: M.marbleGrey, paving: M.paving,
    glaze: M.glazeBlue, tile: M.roofTileBlue, soffit: M.bracketPaintFlat, paint: M.bracketPaint,
    gold: M.gold, bronze: M.bronze, dark: darkMat, plaque: plaqueMat,
  };
  const clean = (g) => {
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    return g;
  };
  for (const k of Object.keys(MATS)) {
    const list = [];
    if (SP[k] && SP[k].p.length) list.push(SP[k].geometry());
    if (EX[k]) list.push(...EX[k]);
    if (!list.length) continue;
    const g = utils.mergeGeometries(list.map(clean));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, MATS[k]);
    mesh.name = `hall:${k}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 望柱（柱身＋柱頭）
  {
    const pb = new THREE.BoxGeometry(0.22, BH + 0.02, 0.22); pb.translate(0, (BH + 0.02) / 2, 0);
    const pc = new THREE.CylinderGeometry(0.1, 0.14, 0.12, 6); pc.translate(0, BH + 0.08, 0);
    const pk = new THREE.CylinderGeometry(0.03, 0.1, 0.24, 6); pk.translate(0, BH + 0.26, 0);
    const postG = uv.boxUV(utils.mergeGeometries([pb, pc, pk].map((g) => g.toNonIndexed())));
    const vh = 0.58 * BH - 0.17;
    const vg = new THREE.BoxGeometry(0.1, vh, 0.08); vg.translate(0, 0.42 * BH + vh / 2, 0);
    const vaseG = uv.boxUV(vg);
    const quat = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3();
    const inst = (geo, list, name) => {
      const im = new THREE.InstancedMesh(geo, M.marbleSmooth, list.length);
      list.forEach((p, i) => {
        quat.setFromAxisAngle(_up, p[3]);
        im.setMatrixAt(i, new THREE.Matrix4().compose(p3.set(p[0], p[1], p[2]), quat, one));
      });
      im.name = name; im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    };
    inst(postG, [...postSet.values()], 'hall:posts');
    inst(vaseG, vases, 'hall:vases');
  }
  // 斗栱
  for (const [geo, mat, name] of [[unitTealG, M.bracketPaint, 'hall:bracketTeal'], [unitWhiteG, M.marbleSmooth, 'hall:bracketWhite']]) {
    const im = new THREE.InstancedMesh(geo, mat, unitMats.length);
    unitMats.forEach((m, i) => im.setMatrixAt(i, m));
    im.name = name; im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }
  void _m;
  return group;
}
