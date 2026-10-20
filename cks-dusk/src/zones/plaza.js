// 區域：plaza（廣場）
// 範圍：園區內所有鋪面（民主大道、自由廣場、林蔭大道、側門步道、橫向步道、主殿前廣場、環堂道路）、
//       牌樓前紅磚前庭、民主大道燈柱、旗桿（含國旗）、林蔭大道長椅。
// 介面：export function build(ctx) → THREE.Object3D
//
// 施工原則：
//   - 位置一律由 L.PLAZA / L.LEVELS / L.HALL / L.GATE / L.FOCUS 推算；本檔只寫「局部尺寸」常數。
//   - 鋪面＝薄板（含側邊），頂面 = L.LEVELS.paving；不投影、只接受陰影。
//   - 同材質靜態網格全部 merge；非特寫燈柱、長椅用 InstancedMesh。
//   - 鏡頭 4 特寫的那支燈柱（最靠近 L.FOCUS.squareLamp）與鏡頭 8 特寫的旗桿基座做高細節。

export function build(ctx) {
  const { THREE, L, M, utils } = ctx;
  const { mergeGeometries } = utils;
  const P = L.PLAZA, LV = L.LEVELS;
  const group = new THREE.Group();
  group.name = 'plaza';

  // -------------------------------------------------------------------------
  // 局部尺寸常數（不是世界座標）
  // -------------------------------------------------------------------------
  const SLAB_BOTTOM = -0.1;     // 鋪面薄板底（埋進草地以下，側邊只露出 6 cm）
  const INLAY_T = 0.015;        // 嵌入帶浮出鋪面的高度（1.5 cm）
  const CURB_W = 0.3;           // 路緣石寬
  const CURB_UP = 0.03;         // 路緣石高出鋪面
  const EPS = 0.05;

  // -------------------------------------------------------------------------
  // 幾何小工具
  // -------------------------------------------------------------------------
  // 統一成 non-indexed、只留 position + normal（flat=true 時重算為面法線）
  function part(g, flat = false) {
    if (g.index) g = g.toNonIndexed();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    if (flat || !g.attributes.normal) g.computeVertexNormals();
    return g;
  }
  // 軸對齊方盒（世界座標）
  function box(x0, x1, y0, y1, z0, z1) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return part(g);
  }
  // 方盒投影 UV（公尺），沿用既有法線，不重算（避免把迴轉體變成面法線）
  function uvBox(g) {
    const p = g.attributes.position, n = g.attributes.normal;
    const uv = new Float32Array(p.count * 2);
    for (let t = 0; t < p.count; t += 3) {
      const ax = Math.abs(n.getX(t) + n.getX(t + 1) + n.getX(t + 2));
      const ay = Math.abs(n.getY(t) + n.getY(t + 1) + n.getY(t + 2));
      const az = Math.abs(n.getZ(t) + n.getZ(t + 1) + n.getZ(t + 2));
      for (let k = 0; k < 3; k++) {
        const i = t + k, x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let u, v;
        if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
        uv[i * 2] = u; uv[i * 2 + 1] = v;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }
  function addMesh(geos, mat, { textured = false, cast = false, name = '' } = {}) {
    if (!geos.length) return null;
    const g = mergeGeometries(geos);
    if (textured) uvBox(g);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  // 迴轉體（profile = [[r, y], ...]，由下往上）
  function lathe(profile, seg, flat = false) {
    const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
    return part(new THREE.LatheGeometry(pts, seg), flat);
  }
  const UP = new THREE.Vector3(0, 1, 0);
  // 圓錐／圓柱沿任意方向擺放：base = 底面中心，dir = 軸向
  function orientTo(g, base, dir) {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    g.applyQuaternion(q);
    g.translate(base.x, base.y, base.z);
    return g;
  }

  // 矩形工具
  const R = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });
  const near = (a, b) => Math.abs(a - b) < EPS;
  const overlap1 = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > EPS;
  // 從 [a,b] 扣掉若干區間
  function subtract(a, b, cuts) {
    let segs = [[a, b]];
    for (const [c0, c1] of cuts) {
      const next = [];
      for (const [s0, s1] of segs) {
        if (c1 <= s0 || c0 >= s1) { next.push([s0, s1]); continue; }
        if (c0 > s0) next.push([s0, c0]);
        if (c1 < s1) next.push([c1, s1]);
      }
      segs = next;
    }
    return segs.filter(([s0, s1]) => s1 - s0 > 0.4);
  }

  // =========================================================================
  // 1. 鋪面配置（全部由 layout 推算；彼此只相接、不重疊，避免 z-fighting）
  // =========================================================================
  const B = P.boulevard, SQ = P.libertySquare, FC = P.hallForecourt;
  const hw = B.halfWidth;
  // 民主大道：自由廣場東緣 → 主殿前廣場西緣（兩端被廣場取代）
  const boulevardRect = R(SQ.x1, FC.x0, -hw, hw);
  // 牌樓腳下：牌樓前庭東緣 → 自由廣場西緣，寬度 = 牌樓寬
  const gateStrip = R(P.gateForecourt.x1, SQ.x0, L.GATE.center.z - L.GATE.width / 2, L.GATE.center.z + L.GATE.width / 2);
  // 環堂道路：只做 sides 列出的面
  const H = L.HALL.center, ri = P.hallRing.innerHalf, ro = P.hallRing.outerHalf;
  const ringRects = [];
  for (const s of P.hallRing.sides) {
    if (s === 'north') ringRects.push(R(H.x - ro, H.x + ro, H.z - ro, H.z - ri));
    if (s === 'south') ringRects.push(R(H.x - ro, H.x + ro, H.z + ri, H.z + ro));
    if (s === 'east') ringRects.push(R(H.x + ri, H.x + ro, H.z - ri, H.z + ri));
    if (s === 'west') ringRects.push(R(H.x - ro, H.x - ri, H.z - ri, H.z + ri));
  }

  const paved = [
    { r: R(SQ.x0, SQ.x1, SQ.z0, SQ.z1), mat: 'paving', curb: true, name: 'libertySquare' },
    { r: gateStrip, mat: 'paving', curb: false, name: 'gateStrip' },
    { r: boulevardRect, mat: 'paving', curb: true, name: 'boulevard' },
    { r: R(FC.x0, FC.x1, FC.z0, FC.z1), mat: 'paving', curb: true, name: 'hallForecourt' },
    ...P.sideAvenues.map((r) => ({ r, mat: 'paving', curb: true, name: 'sideAvenue' })),
    ...P.crossPaths.map((r) => ({ r, mat: 'paving', curb: true, name: 'crossPath' })),
    ...P.sidePaths.map((r) => ({ r, mat: 'pavingDark', curb: true, name: 'sidePath' })),
    ...ringRects.map((r) => ({ r, mat: 'paving', curb: true, name: 'hallRing' })),
  ];
  // 相鄰但不是本區鋪面的東西：路緣石要讓開
  const S = L.HALL.stairs;
  const tier1 = L.HALL.baseTiers[0].half;
  const neighbors = [
    R(S.x0, S.x1, -S.halfWidth, S.halfWidth),                    // 主殿大階梯
    R(H.x - tier1, H.x + tier1, H.z - tier1, H.z + tier1),        // 第一層臺基
  ];

  const geoPave = [], geoDark = [];
  const top = LV.paving;
  for (const p of paved) {
    const { r } = p;
    (p.mat === 'paving' ? geoPave : geoDark).push(box(r.x0, r.x1, SLAB_BOTTOM, top, r.z0, r.z1));
  }

  // 路緣石：每個鋪面四邊，扣掉與其他鋪面／階梯／臺基相接的區段
  const others = (self) => [...paved.filter((q) => q !== self).map((q) => q.r), ...neighbors];
  for (const p of paved) {
    if (!p.curb) continue;
    const { r } = p, os = others(p);
    // 東西向的兩邊（z = z0 / z1）
    for (const [zLine, inward] of [[r.z0, 1], [r.z1, -1]]) {
      const cuts = os.filter((o) => (near(o.z1, zLine) || near(o.z0, zLine) || (o.z0 < zLine && o.z1 > zLine)) && overlap1(o.x0, o.x1, r.x0, r.x1))
        .map((o) => [o.x0, o.x1]);
      for (const [a, b] of subtract(r.x0, r.x1, cuts)) {
        const z0 = inward > 0 ? zLine : zLine - CURB_W, z1 = inward > 0 ? zLine + CURB_W : zLine;
        geoDark.push(box(a, b, top - 0.04, top + CURB_UP, z0, z1));
      }
    }
    // 南北向的兩邊（x = x0 / x1）
    for (const [xLine, inward] of [[r.x0, 1], [r.x1, -1]]) {
      const cuts = os.filter((o) => (near(o.x1, xLine) || near(o.x0, xLine) || (o.x0 < xLine && o.x1 > xLine)) && overlap1(o.z0, o.z1, r.z0, r.z1))
        .map((o) => [o.z0, o.z1]);
      for (const [a, b] of subtract(r.z0, r.z1, cuts)) {
        const x0 = inward > 0 ? xLine : xLine - CURB_W, x1 = inward > 0 ? xLine + CURB_W : xLine;
        geoDark.push(box(x0, x1, top - 0.04, top + CURB_UP, a, b));
      }
    }
  }

  // -------------------------------------------------------------------------
  // 嵌入帶（M.pavingDark，浮於鋪面 1.5 cm）
  // -------------------------------------------------------------------------
  const iy0 = top - 0.004, iy1 = top + INLAY_T;
  const inlay = (x0, x1, z0, z1) => geoDark.push(box(x0, x1, iy0, iy1, z0, z1));
  // 方框帶：外緣半寬 half、帶寬 w
  function frame(cx, cz, half, w) {
    inlay(cx - half, cx + half, cz - half, cz - half + w);
    inlay(cx - half, cx + half, cz + half - w, cz + half);
    inlay(cx - half, cx - half + w, cz - half + w, cz + half - w);
    inlay(cx + half - w, cx + half, cz - half + w, cz + half - w);
  }
  function rectFrame(r, inset, w) {
    inlay(r.x0 + inset, r.x1 - inset, r.z0 + inset, r.z0 + inset + w);
    inlay(r.x0 + inset, r.x1 - inset, r.z1 - inset - w, r.z1 - inset);
    inlay(r.x0 + inset, r.x0 + inset + w, r.z0 + inset + w, r.z1 - inset - w);
    inlay(r.x1 - inset - w, r.x1 - inset, r.z0 + inset + w, r.z1 - inset - w);
  }
  // 四瓣花（四個圓的聯集外緣）環帶：radial(θ) = 外緣半徑，往內 w
  function quatrefoilRing(cx, cz, d, rad, w, rot = 0, n = 192) {
    const rho = (th) => {
      let m = 0;
      for (let k = 0; k < 4; k++) {
        const a = rot + (k * Math.PI) / 2;
        const uc = d * Math.cos(th - a);
        m = Math.max(m, uc + Math.sqrt(rad * rad - d * d + uc * uc));
      }
      return m;
    };
    const pos = [];
    const pt = (th, r, y) => [cx + Math.cos(th) * r, y, cz + Math.sin(th) * r];
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI * 2, t1 = ((i + 1) / n) * Math.PI * 2;
      const o0 = rho(t0), o1 = rho(t1), i0 = Math.max(0, o0 - w), i1 = Math.max(0, o1 - w);
      const A = pt(t0, i0, iy1), Bq = pt(t0, o0, iy1), C = pt(t1, o1, iy1), D = pt(t1, i1, iy1);
      // 頂面（逆時針朝上：從上往下看 x→z 是順時針，故用 A,D,C / A,C,B 之外的順序）
      pos.push(...A, ...C, ...Bq, ...A, ...D, ...C);
      // 外側壁
      const Bb = pt(t0, o0, iy0), Cb = pt(t1, o1, iy0);
      pos.push(...Bb, ...Bq, ...C, ...Bb, ...C, ...Cb);
      // 內側壁
      if (i0 > 0) {
        const Ab = pt(t0, i0, iy0), Db = pt(t1, i1, iy0);
        pos.push(...Ab, ...D, ...A, ...Ab, ...Db, ...D);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    geoDark.push(g);
  }
  // 實心圓盤
  function disc(cx, cz, r, n = 48) {
    const g = new THREE.CylinderGeometry(r, r, iy1 - iy0, n);
    g.translate(cx, (iy0 + iy1) / 2, cz);
    geoDark.push(part(g, true));
  }

  // (a) 自由廣場：大型回字紋同心方框 ＋ 中心四瓣花紋
  {
    const o = SQ.ornament, h = o.half;
    frame(o.x, o.z, h, 1.6);                // 最外框
    frame(o.x, o.z, h - 2.6, 0.6);          // 外框內側細線（雙線）
    frame(o.x, o.z, h * 0.72, 1.2);         // 中框
    frame(o.x, o.z, h * 0.46, 1.2);         // 內框（花紋外圍）
    frame(o.x, o.z, h * 0.46 - 1.9, 0.5);   // 內框細線
    // 中框與最外框四角以斜向短帶相連（回字紋的轉角）
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const a = h * 0.72 - 0.6, b = h - 0.8;
      const n = 10;
      for (let k = 0; k < n; k++) {
        const t = a + ((b - a) * (k + 0.5)) / n, s = 0.55;
        inlay(o.x + sx * t - s, o.x + sx * t + s, o.z + sz * t - s, o.z + sz * t + s);
      }
    }
    // 四瓣花：外緣約 h*0.33
    const big = h * 0.33;
    quatrefoilRing(o.x, o.z, big * 0.46, big * 0.54, 1.2);
    quatrefoilRing(o.x, o.z, big * 0.46 * 0.42, big * 0.54 * 0.42, 0.6, Math.PI / 4);
    disc(o.x, o.z, big * 0.07);
    // 廣場周邊收邊帶（距路緣 2 m）
    rectFrame(R(SQ.x0, SQ.x1, SQ.z0, SQ.z1), CURB_W + 2.0, 1.0);
  }

  // (b) 民主大道：每隔一段一條橫向深色分隔帶（落在燈柱之間），兩側縱向收邊帶
  {
    const r = boulevardRect, zIn = hw - CURB_W;
    const fp = P.flagpole;
    for (let x = P.lamps.x0 + P.lamps.spacing / 2; x < r.x1 - 2; x += P.lamps.spacing) {
      if (x < r.x0 + 2) continue;
      if (Math.abs(x - fp.x) < 4) continue; // 讓開旗桿基座
      inlay(x - 0.6, x + 0.6, -zIn + 1.6, zIn - 1.6);
    }
    for (const s of [-1, 1]) inlay(r.x0, r.x1, s > 0 ? zIn - 1.6 : -zIn + 0.8, s > 0 ? zIn - 0.8 : -zIn + 1.6);
  }

  // (c) 主殿前廣場：收邊帶 ＋ 8 m 分格線
  {
    const r = R(FC.x0, FC.x1, FC.z0, FC.z1);
    rectFrame(r, CURB_W + 1.0, 1.0);
    const xi0 = r.x0 + CURB_W + 2.0, xi1 = r.x1 - CURB_W - 2.0;
    const zi0 = r.z0 + CURB_W + 2.0, zi1 = r.z1 - CURB_W - 2.0;
    for (let x = xi0 + 8; x < xi1 - 2; x += 8) inlay(x - 0.15, x + 0.15, zi0, zi1);
    for (let z = Math.ceil(zi0 / 8) * 8; z < zi1; z += 8) inlay(xi0, xi1, z - 0.15, z + 0.15);
  }

  // (d) 林蔭大道：中線細帶 ＋ 每 12 m 一道橫帶
  for (const r of P.sideAvenues) {
    const zc = (r.z0 + r.z1) / 2;
    for (let x = r.x0 + 6; x < r.x1 - 1; x += 12) inlay(x - 0.25, x + 0.25, r.z0 + CURB_W + 0.5, r.z1 - CURB_W - 0.5);
    inlay(r.x0, r.x1, zc - 0.2, zc + 0.2);
  }


  // =========================================================================
  // 2. 牌樓前紅磚前庭（園區外），頂面略高於人行道，四周收邊
  // =========================================================================
  {
    const r = P.gateForecourt;
    const ftop = LV.sidewalk + 0.03, eW = 0.25;
    const red = [box(r.x0, r.x1, LV.sidewalk - 0.12, ftop, r.z0, r.z1)];
    const edge = [
      box(r.x0, r.x1, LV.sidewalk - 0.12, ftop + 0.03, r.z0, r.z0 + eW),
      box(r.x0, r.x1, LV.sidewalk - 0.12, ftop + 0.03, r.z1 - eW, r.z1),
      box(r.x0, r.x0 + eW, LV.sidewalk - 0.12, ftop + 0.03, r.z0 + eW, r.z1 - eW),
      box(r.x1 - eW, r.x1, LV.sidewalk - 0.12, ftop + 0.03, r.z0 + eW, r.z1 - eW),
    ];
    // 每 10 m 一道灰色分隔帶（與中軸對稱）
    for (let z = Math.ceil((r.z0 + 1) / 10) * 10; z < r.z1 - 1; z += 10) {
      edge.push(box(r.x0 + eW, r.x1 - eW, ftop - 0.004, ftop + 0.012, z - 0.12, z + 0.12));
    }
    addMesh(red, M.pavingRed, { textured: true, name: 'plaza:gateForecourt' });
    geoDark.push(...edge);   // 收邊與園區內深色地磚合併成同一個 mesh
  }

  addMesh(geoPave, M.paving, { textured: true, name: 'plaza:paving' });
  addMesh(geoDark, M.pavingDark, { textured: true, name: 'plaza:pavingDark' });

  // =========================================================================
  // 3. 燈柱（中式宮燈）
  // =========================================================================
  const LH = P.lamps.height;            // 燈柱總高（含頂飾）
  const k = LH / 6.5;                   // 以 6.5 m 設計，依 layout 高度等比縮放
  const LANT = { y0: 5.34 * k, y1: 6.0 * k, r: 0.27 };   // 燈籠本體
  const lampPositions = [];
  for (let x = P.lamps.x0; x <= P.lamps.x1 + 1e-6; x += P.lamps.spacing) {
    for (const z of P.lamps.zOffsets) lampPositions.push({ x, z });
  }
  // 特寫主角：離 FOCUS.squareLamp 最近的那支
  const F4 = L.FOCUS.squareLamp;
  let heroIdx = 0;
  lampPositions.forEach((p, i) => {
    const d = Math.hypot(p.x - F4.x, p.z - F4.z), b = lampPositions[heroIdx];
    if (d < Math.hypot(b.x - F4.x, b.z - F4.z)) heroIdx = i;
  });

  // 燈柱柱身輪廓（[半徑, 高度]），由下往上；高度乘 k
  const postProfile = (fine) => {
    const pr = [
      [0, 0.14], [0.2, 0.14], [0.2, 0.2], [0.17, 0.24], [0.15, 0.3], [0.17, 0.42], [0.165, 0.52],
      [0.12, 0.62], [0.1, 0.72], [0.12, 0.76], [0.12, 0.8], [0.085, 0.84], [0.08, 0.9],
      [0.072, 2.0], [0.09, 2.04], [0.09, 2.1], [0.07, 2.14],
      [0.065, 3.6], [0.082, 3.64], [0.082, 3.7], [0.064, 3.74],
      [0.058, 4.95], [0.075, 5.0], [0.09, 5.04], [0.12, 5.14], [0.16, 5.22], [0.2, 5.26], [0.22, 5.28],
      [0.22, 5.3], [0, 5.3],
    ];
    const simple = [[0, 0.14], [0.18, 0.14], [0.15, 0.5], [0.09, 0.85], [0.07, 2.0], [0.058, 4.95],
      [0.12, 5.14], [0.22, 5.28], [0.22, 5.3], [0, 5.3]];
    return (fine ? pr : simple).map(([r, y]) => [r, y * k]);
  };
  // 燈籠屋頂（六角、凹曲面），由簷口下方往上到寶頂頸
  const roofProfile = (fine) => {
    const pr = fine
      ? [[0, 5.99], [0.36, 5.99], [0.42, 6.02], [0.44, 6.045], [0.36, 6.07], [0.28, 6.1], [0.2, 6.15], [0.14, 6.21], [0.1, 6.27], [0.075, 6.31], [0, 6.31]]
      : [[0, 5.99], [0.42, 6.0], [0.44, 6.04], [0.25, 6.12], [0.1, 6.27], [0, 6.31]];
    return pr.map(([r, y]) => [r, y * k]);
  };

  function lampMetalParts(fine) {
    const g = [];
    // 方形底座（兩層）
    g.push(box(-0.3, 0.3, 0, 0.08 * k, -0.3, 0.3));
    g.push(box(-0.26, 0.26, 0.08 * k, 0.14 * k, -0.26, 0.26));
    // 柱身
    g.push(lathe(postProfile(fine), fine ? 16 : 8));
    // 燈籠底盤（六角倒台）
    const tray = new THREE.CylinderGeometry(0.32, 0.22, 0.06 * k, 6);
    tray.translate(0, 5.33 * k, 0);
    g.push(part(tray, true));
    // 燈籠上下框
    for (const [y0, y1] of [[5.36, 5.41], [5.94, 6.0]]) {
      const ring = new THREE.CylinderGeometry(0.3, 0.3, (y1 - y0) * k, 6);
      ring.translate(0, ((y0 + y1) / 2) * k, 0);
      g.push(part(ring, true));
    }
    // 六角屋頂
    g.push(lathe(roofProfile(fine), 6, true));
    // 頂飾：頸、寶珠、尖
    g.push(lathe([[0, 6.3 * k], [0.05, 6.3 * k], [0.04, 6.34 * k], [0, 6.34 * k]], fine ? 12 : 6));
    const ball = new THREE.SphereGeometry(0.06, fine ? 16 : 6, fine ? 10 : 4);
    ball.translate(0, 6.39 * k, 0);
    g.push(part(ball));
    const spike = new THREE.ConeGeometry(0.02, LH - 6.44 * k, fine ? 8 : 4);
    spike.translate(0, 6.44 * k + (LH - 6.44 * k) / 2, 0);
    g.push(part(spike));
    if (!fine) {
      // 遠景版：角柱用 6 根細方柱表示
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const p = box(-0.018, 0.018, LANT.y0, LANT.y1, -0.018, 0.018);
        p.translate(Math.sin(a) * 0.29, 0, Math.cos(a) * 0.29);
        g.push(p);
      }
      return g;
    }
    // ---- 以下只有特寫版 ----
    // 六根角柱（沿六角頂點）
    const rr = LANT.r + 0.012, ap = LANT.r * Math.cos(Math.PI / 6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = box(-0.017, 0.017, 5.41 * k, 5.94 * k, -0.017, 0.017);
      p.rotateY(a);
      p.translate(Math.sin(a) * rr, 0, Math.cos(a) * rr);
      g.push(p);
    }
    // 每面窗格：兩道橫檔＋一道中豎，外加上緣角花
    for (let i = 0; i < 6; i++) {
      const a = ((i + 0.5) / 6) * Math.PI * 2;
      const dx = Math.sin(a), dz = Math.cos(a);
      const place = (geom, y, out = ap + 0.006) => {
        geom.rotateY(a);
        geom.translate(dx * out, y, dz * out);
        g.push(geom);
      };
      for (const y of [5.55, 5.8]) place(box(-LANT.r / 2, LANT.r / 2, -0.008, 0.008, -0.007, 0.007), y * k);
      place(box(-0.008, 0.008, 5.41 * k, 5.94 * k, -0.007, 0.007), 0);
      // 上緣角花（菱形小鐵片，半露於上框下方）
      for (const sgn of [-1, 1]) {
        const d = box(-0.028, 0.028, -0.028, 0.028, -0.006, 0.006);
        d.rotateZ(Math.PI / 4);
        d.translate(sgn * (LANT.r / 2 - 0.03), 0, 0);
        place(d, 5.935 * k, ap + 0.008);
      }
    }
    // 簷角起翹（六個小角錐，往外上翹）
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const c = new THREE.ConeGeometry(0.022, 0.13, 6);
      c.translate(0, 0.065, 0);
      g.push(part(orientTo(c, new THREE.Vector3(out.x * 0.42, 6.035 * k, out.z * 0.42),
        new THREE.Vector3(out.x * 0.75, 0.66, out.z * 0.75)), true));
    }
    // 屋脊（六條，沿頂點順著凹曲屋面往上收）
    const ridgePts = [[0.44, 6.05], [0.36, 6.078], [0.28, 6.108], [0.2, 6.158], [0.14, 6.218], [0.1, 6.278], [0.08, 6.31]];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3(ridgePts.map(([r, y]) => new THREE.Vector3(Math.sin(a) * r, y * k, Math.cos(a) * r)));
      g.push(part(new THREE.TubeGeometry(curve, 10, 0.013, 5, false)));
    }
    // 托架：四支 S 形鐵捲草，從柱身伸到底盤
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const sx = Math.sin(a), sz = Math.cos(a);
      const pts = [[0.055, 4.8], [0.1, 4.86], [0.17, 4.94], [0.22, 5.05], [0.21, 5.15], [0.16, 5.17], [0.15, 5.11],
        [0.19, 5.1]].map(([r, y]) => new THREE.Vector3(sx * r, y * k, sz * r));
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011, 5, false);
      g.push(part(tube));
      // 托架上端連到盤底
      const up = new THREE.CatmullRomCurve3([[0.22, 5.05], [0.26, 5.18], [0.27, 5.3]]
        .map(([r, y]) => new THREE.Vector3(sx * r, y * k, sz * r)));
      g.push(part(new THREE.TubeGeometry(up, 8, 0.009, 5, false)));
    }
    // 底盤下的垂珠
    const drop = lathe([[0, 5.22], [0.03, 5.24], [0.045, 5.27], [0.03, 5.3], [0, 5.3]].map(([r, y]) => [r, y * k]), 10);
    drop.translate(0.0, 0, 0);
    g.push(drop);
    return g;
  }

  // 燈籠發光體（六角柱）
  function lampGlowParts() {
    const c = new THREE.CylinderGeometry(LANT.r, LANT.r, (5.94 - 5.41) * k, 6);
    c.translate(0, ((5.41 + 5.94) / 2) * k, 0);
    return [part(c, true)];
  }

  // 流蘇（特寫版；紅色）
  function lampTasselParts() {
    const g = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.sin(a) * 0.4, z = Math.cos(a) * 0.4, y = 6.0 * k;
      const cord = new THREE.CylinderGeometry(0.005, 0.005, 0.07, 4);
      cord.translate(x, y - 0.035, z);
      g.push(part(cord));
      const knot = new THREE.SphereGeometry(0.026, 8, 6);
      knot.translate(x, y - 0.09, z);
      g.push(part(knot));
      const tas = new THREE.CylinderGeometry(0.012, 0.038, 0.17, 8, 1);
      tas.translate(x, y - 0.11 - 0.085, z);
      g.push(part(tas));
    }
    return g;
  }

  // 主角燈（高細節，非 instance）
  {
    const hp = lampPositions[heroIdx];
    const tr = (gs) => gs.map((g) => { g.translate(hp.x, 0, hp.z); return g; });
    addMesh(tr(lampMetalParts(true)), M.lampMetal, { cast: true, name: 'plaza:heroLampMetal' });
    addMesh(tr(lampGlowParts()), M.lampGlow, { name: 'plaza:heroLampGlow' });
    addMesh(tr(lampTasselParts()), M.woodRed, { cast: true, name: 'plaza:heroLampTassel' });
  }
  // 其餘燈柱（InstancedMesh）
  {
    const list = lampPositions.filter((_, i) => i !== heroIdx);
    const gMetal = mergeGeometries(lampMetalParts(false));
    const gGlow = mergeGeometries(lampGlowParts());
    const mat4 = new THREE.Matrix4();
    for (const [geom, mat, cast, nm] of [[gMetal, M.lampMetal, true, 'plaza:lampsMetal'], [gGlow, M.lampGlow, false, 'plaza:lampsGlow']]) {
      const im = new THREE.InstancedMesh(geom, mat, list.length);
      list.forEach((p, i) => im.setMatrixAt(i, mat4.makeTranslation(p.x, 0, p.z)));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = cast; im.receiveShadow = true; im.name = nm;
      group.add(im);
    }
  }

  // =========================================================================
  // 4. 旗桿：多層白石臺座（須彌座）＋ 漸細桿身 ＋ 金色頂球 ＋ 國旗
  // =========================================================================
  {
    const fp = P.flagpole, fx = fp.x, fz = fp.z;
    const sq = (h, y0, y1) => box(fx - h, fx + h, y0, y1, fz - h, fz + h);
    const lower = [], upper = [];
    // 兩層臺階（白石）
    lower.push(sq(2.2, 0, 0.28), sq(1.75, 0.28, 0.5));
    // 須彌座：下枋、下梟、束腰、上梟、上枋
    upper.push(sq(1.27, 0.5, 0.58), sq(1.2, 0.58, 0.64), sq(1.12, 0.64, 0.7));
    upper.push(sq(1.0, 0.7, 1.3));
    upper.push(sq(1.12, 1.3, 1.36), sq(1.2, 1.36, 1.42), sq(1.28, 1.42, 1.54));
    // 束腰四角的角柱（瑪瑙柱）
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      upper.push(box(fx + sx * 0.9, fx + sx * 1.03, 0.7, 1.3, fz + sz * 0.9, fz + sz * 1.03));
    }
    // 束腰四面：凸起的框線＋中央圓形浮雕＋兩側卷雲小圓
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2;         // 面的法線方向角（繞 y）
      const nx = Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
      const onFace = (geom, along, y, out = 1.0) => {
        geom.rotateY(a);
        geom.translate(fx + nx * out + tx * along, y, fz + nz * out + tz * along);
        upper.push(geom);
      };
      const bw = 0.045, pd = 0.025, zl = 0.72, y0 = 0.79, y1 = 1.21;
      onFace(box(-zl, zl, -bw / 2, bw / 2, 0, pd), 0, y0);
      onFace(box(-zl, zl, -bw / 2, bw / 2, 0, pd), 0, y1);
      onFace(box(-bw / 2, bw / 2, y0 - bw / 2, y1 + bw / 2, 0, pd), -zl, 0);
      onFace(box(-bw / 2, bw / 2, y0 - bw / 2, y1 + bw / 2, 0, pd), zl, 0);
      // 中央圓形浮雕：外環＋內盤＋中心乳丁
      const med = lathe([[0, 0], [0.2, 0], [0.2, 0.02], [0.17, 0.035], [0.15, 0.03], [0.12, 0.045], [0.06, 0.05], [0.04, 0.07], [0, 0.075]], 28);
      med.rotateX(Math.PI / 2);   // 迴轉軸 y → z（朝外）
      onFace(med, 0, 1.0);
      // 兩側卷雲（小圓盤＋渦形小球）
      for (const s of [-1, 1]) {
        const c = lathe([[0, 0], [0.09, 0], [0.085, 0.015], [0.05, 0.03], [0, 0.035]], 16);
        c.rotateX(Math.PI / 2);
        onFace(c, s * 0.45, 1.0);
        const c2 = lathe([[0, 0], [0.05, 0], [0.045, 0.012], [0, 0.02]], 12);
        c2.rotateX(Math.PI / 2);
        onFace(c2, s * 0.58, 0.93);
        const c3 = c2.clone();
        onFace(c3, s * 0.32, 1.07);
      }
    }
    // 上下梟的蓮瓣（覆蓮在下、仰蓮在上）：扁半球排成一圈
    const petal = (cx, cy, cz, a, flipY) => {
      const sph = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      sph.rotateX(Math.PI / 2);                // 半球朝 +z
      sph.scale(0.075, 0.05, 0.03);
      sph.translate(0, flipY ? -0.008 : 0.008, 0);
      sph.rotateY(a);
      sph.translate(cx, cy, cz);
      upper.push(part(sph));
    };
    for (const [half, y, flip] of [[1.12, 0.67, false], [1.12, 1.33, true]]) {
      const n = 14;                             // 每邊瓣數
      for (let f = 0; f < 4; f++) {
        const a = (f * Math.PI) / 2;
        const nx = Math.sin(a), nz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
        for (let i = 0; i < n; i++) {
          const t = -half + ((i + 0.5) / n) * 2 * half;
          petal(fx + nx * half + tx * t, y, fz + nz * half + tz * t, a, flip);
        }
      }
    }
    // 頂部圓形承座
    upper.push(lathe([[0, 1.54], [0.6, 1.54], [0.6, 1.6], [0.5, 1.64], [0.4, 1.71], [0.34, 1.79], [0.34, 1.84], [0.26, 1.87], [0, 1.87]]
      .map(([r, y]) => [r, y]), 32).translate(fx, 0, fz));
    addMesh(lower, M.marble, { textured: true, cast: true, name: 'plaza:flagBaseLower' });
    addMesh(upper, M.marbleSmooth, { textured: true, cast: true, name: 'plaza:flagBaseUpper' });

    // 桿身：不鏽鋼（本區獨有材質）
    const poleMat = new THREE.MeshStandardMaterial({ name: 'plaza:poleSteel', color: 0xd4d6d8, roughness: 0.32, metalness: 0.85 });
    const topY = fp.height;
    const ballR = 0.22, poleTop = topY - 2 * ballR - 0.06;
    const pole = [lathe([[0, 1.87], [0.24, 1.87], [0.24, 1.97], [0.2, 2.02], [0.17, 2.06], [0.17, 2.6],
      [0.07, poleTop], [0.09, poleTop], [0.09, poleTop + 0.06], [0, poleTop + 0.06]], 20).translate(fx, 0, fz)];
    // 升旗索固定座（桿身側邊的小夾具）
    pole.push(box(fx - 0.04, fx + 0.04, 1.4 + 1.2, 1.4 + 1.45, fz + 0.16, fz + 0.24));
    addMesh(pole, poleMat, { cast: true, name: 'plaza:pole' });
    const ball = new THREE.SphereGeometry(ballR, 20, 14);
    ball.translate(fx, topY - ballR, fz);
    addMesh([part(ball)], M.gold, { cast: true, name: 'plaza:poleBall' });

    // 國旗：canvas 程序繪製（紅底、左上藍色區塊、12 道光芒白日）
    const tex = flagTexture(THREE);
    const flagMat = new THREE.MeshStandardMaterial({ name: 'plaza:flag', map: tex, roughness: 0.78, side: THREE.DoubleSide });
    flagMat.shadowSide = THREE.DoubleSide;
    const FW = 3.6, FH = 2.4, nu = 28, nv = 12;
    const fg = new THREE.PlaneGeometry(FW, FH, nu, nv);
    fg.translate(FW / 2, 0, 0);   // 旗邊（掛繩側）在 x = 0
    const pa = fg.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), u = x / FW, v = y / FH + 0.5;
      // 靜態波浪：離旗桿越遠振幅越大，沿 y 有些許相位差；尾端略垂
      const amp = 0.06 + 0.22 * Math.pow(u, 1.1);
      const zw = amp * Math.sin(u * Math.PI * 2 * 1.35 - 0.6 + v * 0.7) + 0.05 * Math.sin(v * Math.PI * 2 + u * 3);
      pa.setXYZ(i, x * (1 - 0.04 * u), y - 0.12 * u * u * (1 - v * 0.6), zw);
    }
    fg.computeVertexNormals();
    // 旗面朝向：旗幟往南（+z）略偏東飄，讓中軸方向的鏡頭看到正面
    const dir = new THREE.Vector3(0.28, 0, 1).normalize();
    fg.rotateY(Math.atan2(-dir.z, dir.x));
    const flagTopY = poleTop - 0.5;
    fg.translate(fx + dir.x * 0.1, flagTopY - FH / 2, fz + dir.z * 0.1);
    const flag = new THREE.Mesh(fg, flagMat);
    flag.name = 'plaza:flag';
    flag.castShadow = true; flag.receiveShadow = true;
    group.add(flag);
    // 升旗索（兩條細線）
    const rope = [];
    for (const s of [-1, 1]) {
      const len = flagTopY - 2.8;
      const c = new THREE.CylinderGeometry(0.006, 0.006, len, 3);
      c.translate(fx + dir.x * 0.1 + s * 0.012, 2.8 + len / 2, fz + dir.z * 0.1);
      rope.push(part(c));
    }
    addMesh(rope, M.lampMetal, { name: 'plaza:rope' });
  }

  // =========================================================================
  // 5. 長椅（沿林蔭大道，少量）
  // =========================================================================
  {
    const wood = [], metal = [];
    const LEN = 1.8;
    // 座板 4 片
    for (let i = 0; i < 4; i++) {
      const z0 = -0.22 + i * 0.11;
      wood.push(box(-LEN / 2, LEN / 2, 0.42, 0.45, z0, z0 + 0.09));
    }
    // 靠背 3 片（後傾）
    for (let i = 0; i < 3; i++) {
      const b = box(-LEN / 2, LEN / 2, -0.04, 0.04, -0.015, 0.015);
      b.rotateX(-0.22);
      b.translate(0, 0.58 + i * 0.12, -0.27 - i * 0.025);
      wood.push(b);
    }
    // 兩端鑄鐵側架：前腳、後腳（延伸成靠背支柱）、座下橫檔、扶手
    for (const sx of [-1, 1]) {
      const x = sx * (LEN / 2 - 0.12);
      metal.push(box(x - 0.025, x + 0.025, 0, 0.42, 0.16, 0.21));
      const back = box(x - 0.025, x + 0.025, 0, 0.92, -0.025, 0.025);
      back.rotateX(-0.12);
      back.translate(0, 0, -0.24);
      metal.push(back);
      metal.push(box(x - 0.025, x + 0.025, 0.37, 0.42, -0.28, 0.24));
      metal.push(box(x - 0.03, x + 0.03, 0.62, 0.66, -0.28, 0.26));
      metal.push(box(x - 0.025, x + 0.025, 0.42, 0.64, 0.2, 0.24));
    }
    const gW = mergeGeometries(wood), gM = mergeGeometries(metal);
    const spots = [];
    const sp = P.sidePaths;
    for (const r of P.sideAvenues) {
      let side = 0;
      for (let x = r.x0 + 12; x < r.x1 - 10; x += 24) {
        // 讓開側門步道路口
        if (sp.some((s) => x > s.x0 - 4 && x < s.x1 + 4 && overlap1(s.z0 - 1, s.z1 + 1, r.z0, r.z1))) continue;
        const atLow = side++ % 2 === 0;
        // 長椅背靠路緣，面向林蔭大道中線
        spots.push({ x, z: atLow ? r.z0 + CURB_W + 0.45 : r.z1 - CURB_W - 0.45, rot: atLow ? 0 : Math.PI });
      }
    }
    const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    for (const [geom, mat, nm] of [[gW, M.woodNatural, 'plaza:benchWood'], [gM, M.lampMetal, 'plaza:benchMetal']]) {
      const im = new THREE.InstancedMesh(geom, mat, spots.length);
      spots.forEach((s, i) => {
        q.setFromAxisAngle(UP, s.rot);
        im.setMatrixAt(i, mat4.compose(new THREE.Vector3(s.x, top, s.z), q, sc));
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = true; im.receiveShadow = true; im.name = nm;
      group.add(im);
    }
  }

  return group;
}

// ---------------------------------------------------------------------------
// 中華民國國旗紋理：比例 3:2；藍色區塊佔左上 1/4；白日 12 道光芒
// 光芒外接圓半徑 = 區塊高 × 0.375；藍環半徑 = 外接圓 × 17/30；白日半徑 = 外接圓 × 15/30
// ---------------------------------------------------------------------------
function flagTexture(THREE) {
  const W = 1200, Hh = 800;
  const c = document.createElement('canvas');
  c.width = W; c.height = Hh;
  const g = c.getContext('2d');
  g.fillStyle = '#fe0000';
  g.fillRect(0, 0, W, Hh);
  const cw = W / 2, ch = Hh / 2;
  g.fillStyle = '#000095';
  g.fillRect(0, 0, cw, ch);
  const cx = cw / 2, cy = ch / 2, Ro = ch * 0.375, Rin = Ro * 0.5176;
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 12;
    const r = i % 2 === 0 ? Ro : Rin;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.fillStyle = '#000095';
  g.beginPath(); g.arc(cx, cy, Ro * 17 / 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(cx, cy, Ro * 15 / 30, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
