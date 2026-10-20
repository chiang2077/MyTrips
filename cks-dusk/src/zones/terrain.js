// ============================================================================
// 區域：terrain（地形）
// ----------------------------------------------------------------------------
// 負責：
//   1. 園區草地（L.SITE 全範圍，挖空兩座池的橢圓）
//   2. 周邊道路（柏油、車道線、斑馬線、停止線、中山南路中央分隔島）與人行道（含路緣石）
//   3. 園區外城市地坪（L.WORLD.groundRadius 圓盤）＋盆地遠景地坪（接到遠山）
//   4. 程序生成城市（街廓 → 地塊 → 建築量體；近處有退縮、屋頂水塔／機房）
//   5. 台北 101 剪影
//   6. 遠山（低多邊形環帶，北高、東南中、西低）
// 所有位置都從 L（layout.js）推算；這裡只有局部尺寸常數（車道線寬、路緣石寬、樓層高…）。
// ============================================================================

// ---- 局部尺寸常數 ----------------------------------------------------------
const FLOOR = 3.3;           // 樓層高（與 materials.js 的立面紋理一致）
const BAY = 2.5;             // 窗距（同上）
const LINE_W = 0.15;         // 車道線寬
const DASH_ON = 4, DASH_OFF = 6;     // 車道虛線：4 m 線、6 m 空
const MARK_Y = 0.012;        // 標線離路面高度（避免 z-fighting）
const CW_GAP = 1.5, CW_W = 5;        // 斑馬線：距路口 1.5 m、寬 5 m
const STOP_AT = 8, STOP_W = 0.45;    // 停止線：距路口 8 m
const ZEBRA_W = 0.5, ZEBRA_P = 1.0;  // 斑馬紋寬 0.5、間距週期 1.0
const MEDIAN_END = 7;        // 分隔島端點退到路口外 7 m（斑馬線外緣）
const CURB_W = 0.25, CURB_TOP = 0.16; // 路緣石（比人行道高 1 cm）
const MEDIAN_CURB_W = 0.3, MEDIAN_CURB_H = 0.25, MEDIAN_SOIL = 0.2;
const CITY_SHADOW_R = 1000;  // 1 km 內的城市建築才投影
const NEAR_DETAIL = 800;     // 800 m 內的建築做退縮、屋頂設備
const FAR_BLOCK = [130, 210]; // 城市半徑外的遠景粗街廓
// 夕陽側的建築（陰影會落進園區者）不投影，以保留園區的金色夕照；
// 想要「物理上正確」的城市陰影壓進園區，把它改成 true。
const SUNSIDE_SHADOWS = false;

export function build(ctx) {
  const { THREE, L, geo, M, makeRng, makeNoise2D, uv, utils } = ctx;
  const group = new THREE.Group();
  group.name = 'terrain';

  const LV = L.LEVELS;
  const S = L.SITE;
  const SC = { x: (S.xMin + S.xMax) / 2, z: (S.zMin + S.zMax) / 2 }; // 園區中心
  const KO = L.CITY.keepOut;
  const CR = L.WORLD.cityRadius;
  const [MR0, MR1] = L.WORLD.mountainRadius;
  const FAR_R = MR0 * 0.85;  // 遠景粗略建築延伸到遠山前約 85% 處（越遠越稀）
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const inR = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
  const distRect = (x, z, r) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));

  // ==========================================================================
  // 幾何累加器：quad 依「從正面看逆時針」的四角加入；UV 單位公尺
  // ==========================================================================
  function makeAcc() {
    const p = [], n = [], t = [], idx = [];
    let vc = 0;
    return {
      get count() { return vc; },
      quad(a, b, c, d, ua, ub, uc, ud) {
        const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2];
        const fx = d[0] - a[0], fy = d[1] - a[1], fz = d[2] - a[2];
        let nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        p.push(...a, ...b, ...c, ...d);
        for (let k = 0; k < 4; k++) n.push(nx, ny, nz);
        t.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1], ud[0], ud[1]);
        idx.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
        vc += 4;
      },
      geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(t, 2));
        g.setIndex(vc > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
        g.computeBoundingSphere();
        return g;
      },
    };
  }

  // 水平矩形（朝上）
  function flat(acc, x0, x1, z0, z1, y) {
    acc.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0, z1], [x1, z1], [x1, z0], [x0, z0]);
  }
  // 方盒：f.top = acc；f.px/nx/pz/nz = { acc, uo, vo, yb }（u 沿牆、v = y − yb + vo，公尺）
  function box(x0, x1, y0, y1, z0, z1, f) {
    if (f.top) flat(f.top, x0, x1, z0, z1, y1);
    const side = (s, a, b, c, d, len) => {
      if (!s) return;
      const uo = s.uo || 0, yb = s.yb ?? y0, vo = s.vo || 0;
      const v0 = y0 - yb + vo, v1 = y1 - yb + vo;
      s.acc.quad(a, b, c, d, [uo, v0], [uo + len, v0], [uo + len, v1], [uo, v1]);
    };
    side(f.px, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], z1 - z0);
    side(f.nx, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], z1 - z0);
    side(f.pz, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], x1 - x0);
    side(f.nz, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], x1 - x0);
  }
  const allSides = (s) => ({ px: s, nx: s, pz: s, nz: s });

  // 材質桶：同材質＋同投影設定＋同色調 → 合併成一個 mesh
  const buckets = new Map();
  function B(matKey, { cast = false, receive = true, tint = null } = {}) {
    const key = `${matKey}|${cast ? 1 : 0}|${receive ? 1 : 0}|${tint ? tint.join(',') : ''}`;
    let b = buckets.get(key);
    if (!b) { b = { acc: makeAcc(), matKey, cast, receive, tint }; buckets.set(key, b); }
    return b.acc;
  }
  // 只有一個實例的 InstancedMesh：用 instanceColor 對共用材質做色調變化（不改共用材質本身）
  function tinted(geom, mat, color) {
    const m = new THREE.InstancedMesh(geom, mat, 1);
    m.setMatrixAt(0, new THREE.Matrix4());
    m.setColorAt(0, new THREE.Color(color[0], color[1], color[2]));
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    return m;
  }
  function flushBuckets() {
    for (const b of buckets.values()) {
      if (!b.acc.count) continue;
      const geom = b.acc.geometry();
      const mat = M[b.matKey];
      const mesh = b.tint ? tinted(geom, mat, b.tint) : new THREE.Mesh(geom, mat);
      mesh.name = `terrain:${b.matKey}${b.cast ? ':cast' : ''}`;
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      group.add(mesh);
    }
  }

  // ==========================================================================
  // 1. 園區草地：SITE 矩形，挖掉兩座池（與 geo.inPond 同一個旋轉橢圓）
  //    Shape 座標用 (x, −z)，rotateX(−90°) 後即回到世界 (x, z)，法線朝上
  // ==========================================================================
  {
    const shape = new THREE.Shape();
    shape.moveTo(S.xMin, -S.zMin);
    shape.lineTo(S.xMax, -S.zMin);
    shape.lineTo(S.xMax, -S.zMax);
    shape.lineTo(S.xMin, -S.zMax);
    shape.closePath();
    const SEG = 128;
    for (const pond of L.GARDENS.ponds) {
      const hole = new THREE.Path();
      const c = Math.cos(pond.rotation), s = Math.sin(pond.rotation);
      for (let k = 0; k < SEG; k++) {
        const th = (k / SEG) * Math.PI * 2;
        const u = pond.radiusX * Math.cos(th), v = pond.radiusZ * Math.sin(th);
        const x = pond.center.x + u * c - v * s, z = pond.center.z + u * s + v * c;
        // 自我檢查：頂點必須落在 geo.inPond 的橢圓邊上
        if (!geo.inPond(x, z, pond, 0.01) || geo.inPond(x, z, pond, -0.01)) console.warn('terrain: 池緣頂點與 geo.inPond 不一致', pond.name);
        if (k === 0) hole.moveTo(x, -z); else hole.lineTo(x, -z);
      }
      hole.closePath();
      shape.holes.push(hole);
    }
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    g.translate(0, LV.lawn, 0);
    uv.planarUV(g);
    const lawn = new THREE.Mesh(g, M.grass);
    lawn.name = 'terrain:lawn';
    lawn.receiveShadow = true;
    group.add(lawn);
  }

  // ==========================================================================
  // 共用：一維街廓切分（特殊區段＝既有道路帶，之間塞街廓，往外隨機延伸）
  // ==========================================================================
  const SW = L.CITY.streetWidth;
  const [BS0, BS1] = L.CITY.blockSize;
  function partition(rng, specials, center, limit) {
    const sp = specials.slice().sort((a, b) => a[0] - b[0]);
    const blocks = [], streets = [];
    for (let k = 0; k + 1 < sp.length; k++) {
      const a = sp[k][1], b = sp[k + 1][0], G = b - a;
      const avg = (BS0 + BS1) / 2;
      const n = Math.max(1, Math.round((G + SW) / (avg + SW)));
      const ws = Array.from({ length: n }, () => 1 + (rng() - 0.5) * 0.3);
      const sum = ws.reduce((p, q) => p + q, 0), avail = G - (n - 1) * SW;
      let pos = a;
      ws.forEach((w, i) => {
        const s = (avail * w) / sum;
        blocks.push([pos, pos + s]); pos += s;
        if (i < n - 1) { streets.push([pos, pos + SW]); pos += SW; }
      });
    }
    const sizeAt = (pos) => {
      const far = Math.abs(pos - center) > CR * 0.95;
      return far ? [rng.range(FAR_BLOCK[0], FAR_BLOCK[1]), SW * 1.25] : [rng.range(BS0, BS1), SW];
    };
    let pos = sp[sp.length - 1][1];
    while (pos < center + limit) {
      const [s, w] = sizeAt(pos);
      blocks.push([pos, pos + s]); pos += s;
      streets.push([pos, pos + w]); pos += w;
    }
    pos = sp[0][0];
    while (pos > center - limit) {
      const [s, w] = sizeAt(pos);
      blocks.push([pos - s, pos]); pos -= s;
      streets.push([pos - w, pos]); pos -= w;
    }
    return { blocks, streets };
  }

  const roads = Object.values(L.ROADS).map((r) => {
    const rc = r.rect;
    const axis = rc.x1 - rc.x0 > rc.z1 - rc.z0 ? 'x' : 'z';
    return { ...r, axis };
  });
  const roadRects = roads.map((r) => r.rect);
  // 既有道路帶（含兩側的對街人行道）在城市格網中當作特殊區段
  const spanOf = (axis, r) => (axis === 'x' ? [r.x0, r.x1] : [r.z0, r.z1]);
  function specialsFor(crossAxis) {
    // crossAxis='x'：沿 z 延伸的道路，在 x 方向佔用的區段
    const out = [];
    for (const r of roads) {
      if ((crossAxis === 'x' && r.axis !== 'z') || (crossAxis === 'z' && r.axis !== 'x')) continue;
      let [a, b] = spanOf(crossAxis, r.rect);
      // 把貼著道路、且延伸到園區範圍外的人行道併進去
      for (const s of L.SIDEWALKS) {
        const [sa, sb] = spanOf(crossAxis, s.rect);
        const along = crossAxis === 'x' ? [s.rect.z0, s.rect.z1] : [s.rect.x0, s.rect.x1];
        const longEnough = along[0] < (crossAxis === 'x' ? KO.z0 : KO.x0) - 1 || along[1] > (crossAxis === 'x' ? KO.z1 : KO.x1) + 1;
        if (!longEnough) continue;
        if (Math.abs(sb - a) < 0.01) a = sa;
        if (Math.abs(sa - b) < 0.01) b = sb;
      }
      out.push([a, b]);
    }
    return out;
  }
  const rngGrid = makeRng('terrain/grid');
  const gridX = partition(rngGrid, specialsFor('x'), SC.x, FAR_R + 300);
  const gridZ = partition(rngGrid, specialsFor('z'), SC.z, FAR_R + 300);

  // ==========================================================================
  // 2a. 柏油路面（多條道路的聯集，以座標壓縮切成不重疊的矩形）
  // ==========================================================================
  function compress(rects) {
    const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]))].sort((a, b) => a - b);
    const zs = [...new Set(rects.flatMap((r) => [r.z0, r.z1]))].sort((a, b) => a - b);
    return { xs, zs };
  }
  {
    const { xs, zs } = compress(roadRects);
    const acc = B('asphalt');
    for (let j = 0; j + 1 < zs.length; j++) {
      const cz = (zs[j] + zs[j + 1]) / 2;
      let run = null;
      for (let i = 0; i < xs.length; i++) {
        const on = i + 1 < xs.length && roadRects.some((r) => inR((xs[i] + xs[i + 1]) / 2, cz, r));
        if (on && run === null) run = xs[i];
        if (!on && run !== null) { flat(acc, run, xs[i], zs[j], zs[j + 1], LV.road); run = null; }
      }
    }
  }

  // ==========================================================================
  // 2b. 標線：車道虛線、邊線、雙黃線、斑馬線、停止線；中央分隔島
  // ==========================================================================
  {
    const white = makeAcc(), yellow = makeAcc();
    // (a, c) 座標：a = 沿道路方向、c = 橫斷方向
    const AC = (axis, r) => (axis === 'x' ? { a0: r.x0, a1: r.x1, c0: r.z0, c1: r.z1 } : { a0: r.z0, a1: r.z1, c0: r.x0, c1: r.x1 });
    const rectAC = (acc, axis, a0, a1, c0, c1, y = MARK_Y) => {
      if (axis === 'x') flat(acc, a0, a1, c0, c1, y); else flat(acc, c0, c1, a0, a1, y);
    };
    // 路口
    const inters = [];
    for (let i = 0; i < roads.length; i++) for (let j = i + 1; j < roads.length; j++) {
      const A = roads[i].rect, Bq = roads[j].rect;
      if (roads[i].axis === roads[j].axis || !overlap(A, Bq)) continue;
      inters.push({ x0: Math.max(A.x0, Bq.x0), x1: Math.min(A.x1, Bq.x1), z0: Math.max(A.z0, Bq.z0), z1: Math.min(A.z1, Bq.z1) });
    }
    const subtract = (iv, cuts) => {
      let out = [iv];
      for (const [c0, c1] of cuts) {
        const nxt = [];
        for (const [a, b] of out) {
          if (c1 <= a || c0 >= b) { nxt.push([a, b]); continue; }
          if (c0 > a) nxt.push([a, c0]);
          if (c1 < b) nxt.push([c1, b]);
        }
        out = nxt;
      }
      return out.filter(([a, b]) => b - a > 1);
    };
    const dashed = (axis, ivs, c) => {
      for (const [a, b] of ivs) for (let s = a + 1; s + DASH_ON <= b; s += DASH_ON + DASH_OFF)
        rectAC(white, axis, s, s + DASH_ON, c - LINE_W / 2, c + LINE_W / 2);
    };
    const solid = (acc, axis, ivs, c) => { for (const [a, b] of ivs) rectAC(acc, axis, a, b, c - LINE_W / 2, c + LINE_W / 2); };

    for (const road of roads) {
      const { axis } = road;
      const R = AC(axis, road.rect);
      const myI = inters.filter((I) => overlap(I, road.rect)).map((I) => AC(axis, I));
      const free = subtract([R.a0, R.a1], myI.map((I) => [I.a0 - STOP_AT - 1, I.a1 + STOP_AT + 1]));
      const med = road.median ? AC(axis, road.median) : null;
      const half = road.lanes / 2;
      const ways = med ? [[R.c0, med.c0], [med.c1, R.c1]] : [[R.c0, (R.c0 + R.c1) / 2], [(R.c0 + R.c1) / 2, R.c1]];
      // 車道虛線
      for (const [p, q] of ways) {
        const w = (q - p) / half;
        for (let k = 1; k < half; k++) dashed(axis, free, p + k * w);
      }
      // 路緣邊線（實線）
      solid(white, axis, free, R.c0 + 0.45);
      solid(white, axis, free, R.c1 - 0.45);
      if (med) { solid(white, axis, free, med.c0 - 0.45); solid(white, axis, free, med.c1 + 0.45); }
      else { const m = (R.c0 + R.c1) / 2; solid(yellow, axis, free, m - 0.17); solid(yellow, axis, free, m + 0.17); } // 雙黃線
      // 斑馬線＋停止線（每個路口、每個有道路延伸的方向）
      for (const I of myI) {
        for (const leg of ['+', '-']) {
          if (leg === '+' && R.a1 < I.a1 + 12) continue;
          if (leg === '-' && R.a0 > I.a0 - 12) continue;
          const b0 = leg === '+' ? I.a1 + CW_GAP : I.a0 - CW_GAP - CW_W;
          for (let c = R.c0 + 0.7; c + ZEBRA_W <= R.c1 - 0.5; c += ZEBRA_P) rectAC(white, axis, b0, b0 + CW_W, c, c + ZEBRA_W);
          // 進入路口的車道（右側通行）：沿 z 的路往 −z 開 → 東側（c 大）；沿 x 的路往 +x 開 → 南側（c 大）
          const inboundHigh = axis === 'z' ? leg === '+' : leg === '-';
          const way = inboundHigh ? ways[1] : ways[0];
          const s0 = leg === '+' ? I.a1 + STOP_AT : I.a0 - STOP_AT - STOP_W;
          rectAC(white, axis, s0, s0 + STOP_W, way[0] + 0.3, way[1] - 0.3);
        }
      }
      // 中央分隔島（草地＋路緣），在路口前斷開
      if (med) {
        const segs = subtract([med.a0, med.a1], myI.map((I) => [I.a0 - MEDIAN_END, I.a1 + MEDIAN_END]));
        const curb = B('concrete'), grass = B('grass');
        for (const [a0, a1] of segs) {
          const W = (x0, x1, z0, z1, y0, y1, faces) => {
            if (axis === 'x') box(x0, x1, y0, y1, z0, z1, faces); else box(z0, z1, y0, y1, x0, x1, faces);
          };
          const cs = { acc: curb };
          const c0 = med.c0, c1 = med.c1, k = MEDIAN_CURB_W;
          // 兩條長邊路緣＋兩端
          W(a0, a1, c0, c0 + k, 0, MEDIAN_CURB_H, { top: curb, ...allSides(cs) });
          W(a0, a1, c1 - k, c1, 0, MEDIAN_CURB_H, { top: curb, ...allSides(cs) });
          W(a0, a0 + k, c0 + k, c1 - k, 0, MEDIAN_CURB_H, { top: curb, ...allSides(cs) });
          W(a1 - k, a1, c0 + k, c1 - k, 0, MEDIAN_CURB_H, { top: curb, ...allSides(cs) });
          if (axis === 'x') flat(grass, a0 + k, a1 - k, c0 + k, c1 - k, MEDIAN_SOIL);
          else flat(grass, c0 + k, c1 - k, a0 + k, a1 - k, MEDIAN_SOIL);
        }
      }
    }
    const wm = new THREE.Mesh(white.geometry(), M.roadMarking);
    wm.name = 'terrain:roadMarking'; wm.receiveShadow = true;
    const ym = tinted(yellow.geometry(), M.roadMarking, [1.0, 0.62, 0.08]); // 黃線：共用標線材質 × 黃色
    ym.name = 'terrain:roadMarkingYellow'; ym.receiveShadow = true;
    group.add(wm, ym);
  }

  // ==========================================================================
  // 2c. 人行道（聯集，扣掉車道與城市巷道穿越處）＋路緣石＋側面
  // ==========================================================================
  {
    const big = 1e5;
    const cuts = [];
    // 城市巷道接到幹道時切斷對街人行道（只切園區外側那一圈）
    for (const [z0, z1] of gridZ.streets) {
      cuts.push({ x0: -big, x1: KO.x0 + 6, z0, z1 }, { x0: KO.x1 - 6, x1: big, z0, z1 });
    }
    for (const [x0, x1] of gridX.streets) {
      cuts.push({ x0, x1, z0: -big, z1: KO.z0 + 6 }, { x0, x1, z0: KO.z1 - 6, z1: big });
    }
    const fc = L.PLAZA.gateForecourt; // 紅磚前庭：廣場區負責，這裡不鋪，但路緣石照做
    const pos = L.SIDEWALKS.map((s) => s.rect);
    const all = [...pos, fc, ...roadRects, ...cuts.filter((c) => pos.some((p) => overlap(p, c)))];
    const { xs, zs } = compress(all);
    const nx = xs.length - 1, nz = zs.length - 1;
    const state = new Uint8Array(nx * nz), isRoad = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      const k = j * nx + i;
      isRoad[k] = roadRects.some((r) => inR(cx, cz, r)) ? 1 : 0;
      if (inR(cx, cz, fc)) state[k] = 2;
      else if (!isRoad[k] && !cuts.some((r) => inR(cx, cz, r)) && pos.some((r) => inR(cx, cz, r))) state[k] = 1;
    }
    const top = B('sidewalk'), side = B('concrete');
    const Y = LV.sidewalk, Y0 = LV.outsideGround;
    for (let j = 0; j < nz; j++) {
      let run = null;
      for (let i = 0; i <= nx; i++) {
        const on = i < nx && state[j * nx + i] === 1;
        if (on && run === null) run = xs[i];
        if (!on && run !== null) { flat(top, run, xs[i], zs[j], zs[j + 1], Y); run = null; }
      }
    }
    const S_ = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz ? 0 : state[j * nx + i]);
    const R_ = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz ? 0 : isRoad[j * nx + i]);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (!state[j * nx + i]) continue;
      const x0 = xs[i], x1 = xs[i + 1], z0 = zs[j], z1 = zs[j + 1];
      const nb = [['nx', i - 1, j], ['px', i + 1, j], ['nz', i, j - 1], ['pz', i, j + 1]];
      for (const [dir, a, b] of nb) {
        if (S_(a, b)) continue;
        if (R_(a, b)) {
          // 路緣石：寬 CURB_W，頂面略高於人行道
          const r = dir === 'nx' ? [x0, x0 + CURB_W, z0, z1] : dir === 'px' ? [x1 - CURB_W, x1, z0, z1]
            : dir === 'nz' ? [x0, x1, z0, z0 + CURB_W] : [x0, x1, z1 - CURB_W, z1];
          box(r[0], r[1], LV.road, CURB_TOP, r[2], r[3], { top: side, [dir]: { acc: side } });
        } else {
          box(x0, x1, Y0, Y, z0, z1, { [dir]: { acc: side } });
        }
      }
    }
  }

  // ==========================================================================
  // 3. 城市地坪（圓盤，挖掉園區＋道路範圍）＋盆地遠景地坪（接到遠山）
  // ==========================================================================
  {
    const RG = L.WORLD.groundRadius, SEG = 160;
    const shape = new THREE.Shape();
    for (let k = 0; k < SEG; k++) {
      const t = (k / SEG) * Math.PI * 2;
      if (k === 0) shape.moveTo(RG * Math.cos(t), RG * Math.sin(t)); else shape.lineTo(RG * Math.cos(t), RG * Math.sin(t));
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(KO.x0, -KO.z0); hole.lineTo(KO.x0, -KO.z1); hole.lineTo(KO.x1, -KO.z1); hole.lineTo(KO.x1, -KO.z0); hole.closePath();
    shape.holes.push(hole);
    const disc = new THREE.ShapeGeometry(shape);
    disc.rotateX(-Math.PI / 2);
    const ring = new THREE.RingGeometry(RG, MR0 + 500, SEG, 1);
    ring.rotateX(-Math.PI / 2);
    const g = utils.mergeGeometries([disc, ring]);
    g.translate(0, LV.outsideGround, 0);
    uv.planarUV(g);
    const ground = new THREE.Mesh(g, M.asphalt);
    ground.name = 'terrain:cityGround';
    ground.receiveShadow = true;
    group.add(ground);
  }

  // ==========================================================================
  // 4. 程序生成城市
  // ==========================================================================
  const sd = L.SUN.dir;
  const shL = Math.hypot(sd.x, sd.z);
  const SH = { x: -sd.x / shL, z: -sd.z / shL };           // 影子方向（水平）
  const tanEl = Math.tan((L.SUN.elevationDeg * Math.PI) / 180);
  const siteExp = { x0: S.xMin - 25, x1: S.xMax + 25, z0: S.zMin - 25, z1: S.zMax + 25 };
  // 從 (x,z) 沿影子方向射線，碰到（擴大後的）園區的距離；沒碰到 → Infinity
  function shadowHitsSite(x, z) {
    let t0 = 0, t1 = Infinity;
    for (const [p, d, lo, hi] of [[x, SH.x, siteExp.x0, siteExp.x1], [z, SH.z, siteExp.z0, siteExp.z1]]) {
      if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return Infinity; continue; }
      let a = (lo - p) / d, b = (hi - p) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    return t0 <= t1 ? t0 : Infinity;
  }

  const FACADE_TINTS = [[1, 1, 1], [0.78, 0.8, 0.86], [1.12, 1.0, 0.86], [0.66, 0.62, 0.58]];
  const GLASS_TINTS = [[1, 1, 1], [0.7, 1.0, 1.0], [0.85, 0.9, 1.15]];
  const noiseCity = makeNoise2D('terrain/cityEdge');
  const rngB = makeRng('terrain/buildings');
  const rngF = makeRng('terrain/farCity');
  const T101 = L.CITY.taipei101;
  const hN = L.CITY.heightNear, hF = L.CITY.heightFar;

  function sampleHeight(r, dKeep) {
    const t = clamp(dKeep / (CR - 200), 0, 1);
    const lo = lerp(hN[0], hF[0], t), hi = lerp(hN[1], hF[1], t);
    let h;
    if (t < 0.45) h = r.chance(0.72) ? lerp(lo + 0.55 * (hi - lo), hi, r()) : lerp(lo, lo + 0.55 * (hi - lo), r()); // 近處以 10~15 層為主
    else h = lo + (hi - lo) * Math.pow(r(), 2.2);
    return Math.max(3, Math.round(h / FLOOR)) * FLOOR + 1.0; // 女兒牆 1 m
  }

  // 地塊切分（遞迴二分，長邊優先）
  function splitLots(rect, maxLot, r, out, depth = 0) {
    const w = rect.x1 - rect.x0, d = rect.z1 - rect.z0;
    if ((w <= maxLot && d <= maxLot) || depth > 6) { out.push(rect); return out; }
    if (w >= d) {
      const s = rect.x0 + w * r.range(0.35, 0.65);
      splitLots({ ...rect, x1: s }, maxLot, r, out, depth + 1); splitLots({ ...rect, x0: s }, maxLot, r, out, depth + 1);
    } else {
      const s = rect.z0 + d * r.range(0.35, 0.65);
      splitLots({ ...rect, z1: s }, maxLot, r, out, depth + 1); splitLots({ ...rect, z0: s }, maxLot, r, out, depth + 1);
    }
    return out;
  }

  let nBuildings = 0;
  function makeBuilding(lot, block, yb, dKeep, dSite, r) {
    const eq = (a, b) => Math.abs(a - b) < 0.01;
    const street = { nx: eq(lot.x0, block.x0), px: eq(lot.x1, block.x1), nz: eq(lot.z0, block.z0), pz: eq(lot.z1, block.z1) };
    const near = dKeep < NEAR_DETAIL;
    const sb = () => r.range(near ? 2.5 : 2, near ? 5 : 4);
    const gap = () => (r.chance(0.5) ? 0 : r.range(0.4, 1.6));
    const fp = {
      x0: lot.x0 + (street.nx ? sb() : gap()), x1: lot.x1 - (street.px ? sb() : gap()),
      z0: lot.z0 + (street.nz ? sb() : gap()), z1: lot.z1 - (street.pz ? sb() : gap()),
    };
    if (fp.x1 - fp.x0 < 8 || fp.z1 - fp.z0 < 8) return;
    const cx = (fp.x0 + fp.x1) / 2, cz = (fp.z0 + fp.z1) / 2;
    let h = sampleHeight(r, dKeep);
    // 夕陽側（中山南路以西）：鏡頭朝西看夕陽、空拍掠過，近處壓低一些
    const tHit = shadowHitsSite(cx, cz);
    if (cx < S.xMin && tHit < 450) h = Math.min(h, Math.max(4, Math.round((12 + 0.07 * tHit) / FLOOR)) * FLOOR + 1.0);
    const shadowReachesSite = tHit < h / tanEl + 10;
    const cast = dSite <= CITY_SHADOW_R && (SUNSIDE_SHADOWS || !shadowReachesSite);
    const receive = dSite <= CITY_SHADOW_R * 1.3;
    const tint = r.pick(FACADE_TINTS);
    const glass = h > 36 && r.chance(near ? 0.08 : 0.14);
    const gtint = r.pick(GLASS_TINTS);
    const opt = { cast, receive };
    const facadeAcc = B('cityFacade', { ...opt, tint });
    const glassAcc = B('cityGlass', { ...opt, tint: gtint });
    const concAcc = B('concrete', opt);
    const roofAcc = B('cityRoof', opt);
    const uo = BAY * r.int(0, 7), vo = FLOOR * r.int(0, 11);
    const wallFor = (dir, useGlass) => {
      if (street[dir]) return { acc: useGlass ? glassAcc : facadeAcc, uo, vo, yb };
      return r.chance(0.6) ? { acc: concAcc } : { acc: facadeAcc, uo, vo, yb }; // 地塊內側：多為無窗側牆
    };
    const walls = (useGlass) => ({ px: wallFor('px', useGlass), nx: wallFor('nx', useGlass), pz: wallFor('pz', useGlass), nz: wallFor('nz', useGlass) });
    let roof = fp, roofY = yb + h;
    const w = fp.x1 - fp.x0, d = fp.z1 - fp.z0;
    const kind = !near ? 'plain' : (w > 22 && d > 22 && h > 30 && r.chance(0.35)) ? 'podium' : (h > 24 && r.chance(0.18)) ? 'stepped' : 'plain';
    if (kind === 'podium') {
      // 裙樓＋退縮塔樓
      const ph = FLOOR * r.int(2, 4) + 0.6;
      box(fp.x0, fp.x1, yb, yb + ph, fp.z0, fp.z1, { top: roofAcc, ...walls(false) });
      const ins = () => r.range(3, 6);
      const tw = { x0: fp.x0 + ins(), x1: fp.x1 - ins(), z0: fp.z0 + ins(), z1: fp.z1 - ins() };
      box(tw.x0, tw.x1, yb + ph, yb + h, tw.z0, tw.z1, { top: roofAcc, ...walls(glass) });
      roof = tw;
    } else if (kind === 'stepped') {
      // 頂部 2~3 層退縮
      const top = FLOOR * r.int(2, 3);
      box(fp.x0, fp.x1, yb, yb + h - top, fp.z0, fp.z1, { top: roofAcc, ...walls(glass) });
      const ins = r.range(2.5, 4);
      const tw = { x0: fp.x0 + ins, x1: fp.x1 - ins, z0: fp.z0 + ins, z1: fp.z1 - ins };
      if (tw.x1 - tw.x0 > 6 && tw.z1 - tw.z0 > 6) {
        box(tw.x0, tw.x1, yb + h - top, yb + h, tw.z0, tw.z1, { top: roofAcc, ...walls(glass) });
        roof = tw;
      } else roofY = yb + h - top;
    } else {
      box(fp.x0, fp.x1, yb, yb + h, fp.z0, fp.z1, { top: roofAcc, ...walls(glass) });
    }
    nBuildings++;
    // 屋頂設備：水塔、樓梯間／機房（近處才做）
    if (near) {
      const rw = roof.x1 - roof.x0, rd = roof.z1 - roof.z0;
      const place = (sx, sz) => {
        if (rw < sx + 3 || rd < sz + 3) return null;
        const x0 = roof.x0 + 1.5 + r() * (rw - sx - 3), z0 = roof.z0 + 1.5 + r() * (rd - sz - 3);
        return [x0, x0 + sx, z0, z0 + sz];
      };
      if (r.chance(0.65)) {
        const p = place(r.range(4, 7), r.range(3, 5));
        if (p) box(p[0], p[1], roofY, roofY + r.range(2.8, 3.6), p[2], p[3], { top: roofAcc, ...allSides({ acc: concAcc }) });
      }
      if (r.chance(0.7)) {
        const s = r.range(2.4, 3.4);
        const p = place(s, s * r.range(0.8, 1.3));
        if (p) box(p[0], p[1], roofY, roofY + r.range(2.2, 3.2), p[2], p[3], { top: concAcc, ...allSides({ acc: concAcc }) });
      }
    }
  }

  // 走訪格網
  const edgeR = (x, z) => {
    const a = Math.atan2(z - SC.z, x - SC.x);
    return CR * (0.88 + 0.24 * noiseCity(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10));
  };
  const padAcc = B('sidewalk'), padSide = B('concrete'), parkAcc = B('grassDark');
  for (const [x0, x1] of gridX.blocks) for (const [z0, z1] of gridZ.blocks) {
    const block = { x0, x1, z0, z1 };
    if (overlap(block, KO) || roadRects.some((r) => overlap(block, r))) continue;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const dC = Math.hypot(cx - SC.x, cz - SC.z);
    const dKeep = distRect(cx, cz, KO);
    if (dC < edgeR(cx, cz)) {
      // ---- 城市半徑內：街廓（人行道墊高）＋地塊建築 ----
      const r = rngB.fork(`${Math.round(x0)},${Math.round(z0)}`);
      const yb = LV.sidewalk;
      flat(padAcc, x0, x1, z0, z1, yb);
      box(x0, x1, LV.outsideGround, yb, z0, z1, allSides({ acc: padSide }));
      if (dKeep < NEAR_DETAIL && r.chance(0.04)) { // 偶爾一塊街角公園
        flat(parkAcc, x0 + 3, x1 - 3, z0 + 3, z1 - 3, yb + 0.02);
        continue;
      }
      const maxLot = dKeep < NEAR_DETAIL ? r.range(26, 46) : r.range(40, 70);
      for (const lot of splitLots(block, maxLot, r, [])) {
        if (r.chance(0.06)) continue; // 空地／停車場
        const lx = (lot.x0 + lot.x1) / 2, lz = (lot.z0 + lot.z1) / 2;
        makeBuilding(lot, block, yb, distRect(lx, lz, KO), Math.hypot(lx - SC.x, lz - SC.z), r);
      }
    } else if (dC < FAR_R) {
      // ---- 遠景：粗略盒子 ----
      const d101 = Math.hypot(cx - T101.x, cz - T101.z);
      const fall = smooth(CR, FAR_R, dC);
      if (rngF() > 0.9 - 0.5 * fall) continue;
      if (d101 < T101.baseHalf * 4) continue;
      const parts = (x1 - x0) > 150 || (z1 - z0) > 150 ? 2 : 1;
      for (let k = 0; k < parts; k++) {
        let r0 = block;
        if (parts === 2) {
          const alongX = (x1 - x0) >= (z1 - z0), m = alongX ? lerp(x0, x1, 0.5) : lerp(z0, z1, 0.5);
          r0 = alongX ? (k ? { ...block, x0: m } : { ...block, x1: m }) : (k ? { ...block, z0: m } : { ...block, z1: m });
        }
        const ins = () => rngF.range(6, 22);
        const fp = { x0: r0.x0 + ins(), x1: r0.x1 - ins(), z0: r0.z0 + ins(), z1: r0.z1 - ins() };
        if (fp.x1 - fp.x0 < 15 || fp.z1 - fp.z0 < 15) continue;
        let h = hF[0] + (hF[1] - hF[0]) * Math.pow(rngF(), 2.6);
        if (d101 < 1100) h *= lerp(1.9, 1, d101 / 1100); // 信義計畫區：高樓較多
        h = Math.round(h / FLOOR) * FLOOR + 1;
        const glass = h > 60 && rngF.chance(0.3);
        const tint = rngF.pick(FACADE_TINTS);
        const acc = glass ? B('cityGlass', { receive: false, tint: rngF.pick(GLASS_TINTS) }) : B('cityFacade', { receive: false, tint });
        const s = { acc, uo: BAY * rngF.int(0, 7), vo: FLOOR * rngF.int(0, 11), yb: LV.outsideGround };
        box(fp.x0, fp.x1, LV.outsideGround, LV.outsideGround + h, fp.z0, fp.z1, { top: B('cityRoof', { receive: false }), ...allSides(s) });
      }
    }
  }

  // ==========================================================================
  // 5. 台北 101：基座斗形＋8 節倒斗形節段＋頂部塔樓＋尖塔；裙樓（購物中心）
  // ==========================================================================
  {
    const H = T101.height, bh = T101.baseHalf;
    const parts = [];
    // 方形截錐：CylinderGeometry 4 邊、轉 45°，轉成非索引以得到平面法線
    const frustum = (halfBot, halfTop, y0, y1) => {
      const g = new THREE.CylinderGeometry(halfTop * Math.SQRT2, halfBot * Math.SQRT2, y1 - y0, 4, 1, false);
      g.rotateY(Math.PI / 4);
      g.translate(0, (y0 + y1) / 2, 0);
      const n = g.toNonIndexed();
      n.computeVertexNormals();
      n.deleteAttribute('uv');
      return n;
    };
    const baseTop = 0.2 * H, secH = 0.0713 * H, flare = Math.tan((7 * Math.PI) / 180);
    parts.push(frustum(bh, bh * 0.74, -10, baseTop));
    let y = baseTop;
    for (let i = 0; i < 8; i++) { // 8 節：下窄上寬（斗狀）
      const hb = bh * 0.68;
      parts.push(frustum(hb, hb + secH * flare, y, y + secH));
      y += secH;
    }
    const tiers = [[0.6, 0.55, 0.035], [0.48, 0.44, 0.035], [0.38, 0.33, 0.045]];
    for (const [a, b, hh] of tiers) { parts.push(frustum(bh * a, bh * b, y, y + hh * H)); y += hh * H; }
    const glassG = utils.mergeGeometries(parts);
    const glassM = tinted(glassG, M.cityGlass, [2.6, 4.4, 3.8]); // 偏青綠；放大倍率讓金屬感玻璃的漫射也能被夕陽打亮
    glassM.position.set(T101.x, LV.outsideGround, T101.z);
    glassM.name = 'terrain:taipei101';
    // 尖塔
    const spire = new THREE.CylinderGeometry(0.4, 3.2, H - y, 8, 1);
    spire.translate(0, (y + H) / 2, 0);
    const cap = new THREE.CylinderGeometry(bh * 0.22, bh * 0.3, 6, 8, 1);
    cap.translate(0, y + 3, 0);
    const spireM = new THREE.Mesh(utils.mergeGeometries([spire, cap]), M.concrete);
    spireM.position.copy(glassM.position);
    spireM.name = 'terrain:taipei101Spire';
    // 裙樓（購物中心，位於塔樓東側）
    const mall = makeAcc();
    const mx0 = T101.x + bh * 0.6, mz = T101.z, my = LV.outsideGround;
    box(mx0, mx0 + bh * 3.2, my, my + 0.11 * H, mz - bh * 1.5, mz + bh * 1.5, { top: mall, ...allSides({ acc: mall }) });
    const mallM = new THREE.Mesh(mall.geometry(), M.concrete);
    mallM.name = 'terrain:taipei101Mall';
    group.add(glassM, spireM, mallM);
  }

  // ==========================================================================
  // 6. 遠山：極座標網格＋雜訊；前後兩道山稜形成層次剪影
  //    方位角（北 = 0°、順時針）決定山高：北（陽明山）高、東南丘陵中、西（夕陽側）低平
  // ==========================================================================
  {
    const PROFILE = [ // [方位角°, 代表山高 m]
      [0, 900], [25, 800], [50, 560], [75, 380], [100, 340], [130, 430], [160, 480], [190, 430],
      [215, 260], [235, 110], [255, 80], [275, 130], [300, 380], [325, 560], [345, 780], [360, 900],
    ];
    const prof = (deg) => {
      for (let k = 0; k + 1 < PROFILE.length; k++) {
        const [a0, h0] = PROFILE[k], [a1, h1] = PROFILE[k + 1];
        if (deg >= a0 && deg <= a1) { const t = (1 - Math.cos(((deg - a0) / (a1 - a0)) * Math.PI)) / 2; return lerp(h0, h1, t); }
      }
      return PROFILE[0][1];
    };
    const nm = makeNoise2D('terrain/mountain');
    const nm2 = makeNoise2D('terrain/mountain2');
    const gauss = (r, c, w) => Math.exp(-((r - c) * (r - c)) / (2 * w * w));
    const ridged = (v) => 1 - Math.abs(2 * v - 1);
    const NA = 360;
    const radii = [];
    for (let k = 0; k <= 30; k++) radii.push(lerp(MR0, MR1, Math.pow(k / 30, 1.15)));
    const Rf = lerp(MR0, MR1, 0.18), Wf = (MR1 - MR0) * 0.12;
    const Rb = lerp(MR0, MR1, 0.58), Wb = (MR1 - MR0) * 0.22;
    const pos = [], col = [], idx = [];
    for (const r of radii) for (let j = 0; j < NA; j++) {
      const phi = (j / NA) * Math.PI * 2;
      const x = r * Math.sin(phi), z = -r * Math.cos(phi);
      const P = prof((j / NA) * 360);
      const n1 = nm.fbm(x / 2400, z / 2400, 4), n2 = ridged(nm2.fbm(x / 3200 + 7, z / 3200 - 3, 5));
      const front = 0.55 * gauss(r, Rf, Wf) * (0.25 + 1.1 * n1);
      const back = gauss(r, Rb, Wb) * (0.3 + 1.0 * n2);
      const detail = (nm.fbm(x / 600, z / 600, 3) - 0.5) * 0.12;
      let h = P * (front + back + detail * (front + back));
      h *= smooth(MR0, MR0 + 900, r) * (1 - smooth(MR1 - 1800, MR1, r));
      pos.push(x, Math.max(0, h) - 2, z);
      const k = 0.78 + 0.3 * nm.fbm(x / 900 + 40, z / 900, 3);
      const hi = clamp(h / 900, 0, 1);
      col.push(k * lerp(0.85, 0.95, hi), k * lerp(0.98, 0.95, hi), k * lerp(0.86, 1.02, hi));
    }
    for (let i = 0; i + 1 < radii.length; i++) for (let j = 0; j < NA; j++) {
      const a = i * NA + j, b = i * NA + ((j + 1) % NA), c = (i + 1) * NA + ((j + 1) % NA), d = (i + 1) * NA + j;
      idx.push(a, b, c, a, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mtn = new THREE.Mesh(g, M.mountainVC);
    mtn.name = 'terrain:mountains';
    group.add(mtn);
  }

  flushBuckets();
  group.userData.stats = { buildings: nBuildings, meshes: group.children.length };
  return group;
}
