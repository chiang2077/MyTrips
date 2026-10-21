// 區域：gate — 正面牌樓「自由廣場」（五間六柱十一樓，白色大理石、藍色琉璃瓦）
// 介面：export function build(ctx) → THREE.Object3D
//   ctx = { THREE, L(layout), geo, M(materials), makeRng, makeNoise2D, uv:{planarUV,boxUV,roofUV},
//           makePlaqueTexture, utils:{mergeGeometries,mergeVertices}, quality }
//
// 本區局部座標（group 原點 = L.GATE.center，地坪 y = 0）：
//   x = 進深方向（正面朝 −x，背面朝 +x）、z = 面寬方向（北 −z、南 +z）、y = 上。
//   group 依 L.GATE.facing 旋轉；layout 預設 '-x' 不需旋轉。
//
// 構成（由下往上）：
//   ・六組柱基座（須彌座＋前後捲雲抱鼓石＋小石墩）
//   ・牆身（五個半圓拱，依 L.GATE.arches）、六根方柱、拱圈線腳、拱肩花盤、橫帶浮雕框
//   ・五座「樓座」（中央樓座嵌匾額）
//   ・十一樓屋頂：五座主樓（廡殿頂，中央最高）＋六座夾樓（每根柱上一座）
//     屋面筒瓦、琉璃正脊／垂脊、走獸、鴟吻（程序造型）、斗栱、飛椽、白色連檐
//
// 高度：以 L.GATE.height（30 m）為基準等比例（下方 LV 表是 30 m 時的數值，對照照片量測後換算）。
// 中央正脊的鴟吻最高點 = L.GATE.height；鴟吻中心在 z = ±L.GATE.topRidge.halfLength。

const D2R = Math.PI / 180;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const smooth = (t) => t * t * (3 - 2 * t);

// 匾額書寫方向：照片（現況）「自由廣場」是由左至右書寫（舊「大中至正」才是由右至左）。
// 若統包要傳統由右至左，改成 true 即可。
const PLAQUE_RTL = false;

// --- 局部尺寸（公尺）---
const T = 3.0;          // 牆身／樓座厚度（x）
const HT = T / 2;
const PW = 2.2;         // 方柱面寬（z）
const PD = T + 0.5;     // 方柱進深（x），前後各凸出 0.25
const PED_D = 4.2;      // 柱基座進深（x）
const PED_TOP = 4.2;    // 柱基座頂高
const OUT_MARGIN = 1.6; // 最外側拱與外柱之間的牆寬
const AV_W = 0.75;      // 拱圈線腳寬

export function build(ctx) {
  const { THREE, L, M, makePlaqueTexture, utils } = ctx;
  const G = L.GATE;
  const V3 = THREE.Vector3;
  const kH = G.height / 30;           // 高度比例（layout 改高度時整體跟著縮放）
  const lv = (y) => y * kH;

  const group = new THREE.Group();
  group.name = 'gate';
  group.position.set(G.center.x, 0, G.center.z);
  group.rotation.y = { '-x': 0, '+x': Math.PI, '-z': -Math.PI / 2, '+z': Math.PI / 2 }[G.facing] ?? 0;

  // ------------------------------------------------------------------------
  // 幾何收集桶（同材質最後 merge 成一個 mesh）
  // ------------------------------------------------------------------------
  const B = { marble: [], smooth: [], tile: [], glaze: [], bracket: [], soffit: [] };
  const DEC = [];  // 正面（−x）的浮雕元件，最後鏡射一份到背面：[bucket, geom]

  const add = (k, g) => { B[k].push(g); return g; };
  const boxG = (x0, x1, y0, y1, z0, z1) => {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return g;
  };
  const box = (k, x0, x1, y0, y1, z0, z1) => add(k, boxG(x0, x1, y0, y1, z0, z1));
  // 正面（朝 −x）面上的凸出方塊：f = 面的 |x|、d = 凸出量
  const fbox = (k, f, d, y0, y1, z0, z1) => { const g = boxG(-f - d, -f + 0.02, y0, y1, z0, z1); DEC.push([k, g]); return g; };
  // 正面上的圓盤（花盤、圓釘）
  // 圓盤只做側面＋外蓋（貼牆那一面看不到，不做）
  const discG = (r, d, seg) => {
    const side = new THREE.CylinderGeometry(r, r, d, seg, 1, true);
    const cap = new THREE.CircleGeometry(r, seg);
    cap.rotateX(-Math.PI / 2);
    cap.translate(0, d / 2, 0);
    return utils.mergeGeometries([side.toNonIndexed(), cap.toNonIndexed()].map((g) => { g.deleteAttribute('uv'); return g; }), false);
  };
  const fdisc = (k, f, d, y, z, r, seg = 12) => {
    const g = discG(r, d + 0.02, Math.max(8, Math.min(seg, Math.round(8 + r * 16))));
    g.rotateZ(Math.PI / 2);           // 外蓋朝 −x
    g.translate(-f - d / 2 + 0.01, y, z);
    DEC.push([k, g]);
    return g;
  };
  // 正面上的擠出造型（shape 以 (z, y) 座標描述）
  const fshape = (k, f, d, shape, y = 0, z = 0) => {
    const g = new THREE.ExtrudeGeometry(shape, { depth: d + 0.02, bevelEnabled: false, curveSegments: 8 });
    g.rotateY(-Math.PI / 2);          // shape x → z、擠出方向 → −x
    g.translate(-f + 0.02, y, z);
    DEC.push([k, g]);
    return g;
  };
  const shapeOf = (pts) => new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const hexShape = (w, h) => shapeOf([[-w / 2, 0], [-w / 2 + h / 2, h / 2], [w / 2 - h / 2, h / 2], [w / 2, 0], [w / 2 - h / 2, -h / 2], [-w / 2 + h / 2, -h / 2]]);
  const rrectShape = (w, h, r) => {
    const s = new THREE.Shape();
    const x0 = -w / 2, y0 = -h / 2;
    s.moveTo(x0 + r, y0);
    s.lineTo(x0 + w - r, y0); s.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x0 + w, y0 + h - r); s.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x0 + r, y0 + h); s.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  };
  // 方框線腳（四條細條）
  const fframe = (k, f, d, y0, y1, z0, z1, w) => {
    fbox(k, f, d, y0, y0 + w, z0, z1);
    fbox(k, f, d, y1 - w, y1, z0, z1);
    fbox(k, f, d, y0 + w, y1 - w, z0, z0 + w);
    fbox(k, f, d, y0 + w, y1 - w, z1 - w, z1);
  };
  // 一條兩端點之間的方材（垂脊、椽子、拱腹線腳用）
  const UP = new V3(0, 1, 0);
  const beamG = (p0, p1, w, h, upHint = UP) => {
    const d = new V3().subVectors(p1, p0);
    const len = d.length();
    const zA = d.clone().normalize();
    let xA = new V3().crossVectors(upHint, zA);
    if (xA.lengthSq() < 1e-6) xA = new V3(1, 0, 0);
    xA.normalize();
    const yA = new V3().crossVectors(zA, xA);
    const g = new THREE.BoxGeometry(w, h, len);
    const m = new THREE.Matrix4().makeBasis(xA, yA, zA);
    m.setPosition(new V3().addVectors(p0, p1).multiplyScalar(0.5));
    g.applyMatrix4(m);
    return g;
  };

  // ------------------------------------------------------------------------
  // 平面：拱、柱位
  // ------------------------------------------------------------------------
  const arches = [...G.arches].sort((a, b) => a.z - b.z);
  const widths = [...new Set(arches.map((a) => a.w))].sort((a, b) => b - a);
  const rankOf = (a) => widths.indexOf(a.w);     // 0 = 中央、1 = 次間、2 = 梢間
  const pillars = [];
  {
    const first = arches[0], last = arches[arches.length - 1];
    pillars.push(first.z - first.w / 2 - OUT_MARGIN - PW / 2);
    for (let i = 0; i < arches.length - 1; i++) {
      const a = arches[i], b = arches[i + 1];
      pillars.push(((a.z + a.w / 2) + (b.z - b.w / 2)) / 2);
    }
    pillars.push(last.z + last.w / 2 + OUT_MARGIN + PW / 2);
  }
  const zEndN = pillars[0] - PW / 2, zEndS = pillars[pillars.length - 1] + PW / 2;

  // 各級樓座／屋頂高度（30 m 時的數值，依照片量測換算）
  const plq = G.plaque;
  const TW = [Math.max(plq.width / 2 + 1.0, 6), 4.3, 4.2];   // 樓座半寬（依 rank）
  const LV = {
    wallTop: [lv(19.0), lv(19.0), lv(17.4)],    // 牆頂（依所在間的 rank）
    towerTop: [lv(23.95), lv(21.8), lv(20.0)],
  };
  const towers = arches.map((a) => {
    const r = rankOf(a);
    return { z0: a.z - TW[r], z1: a.z + TW[r], r, z: a.z, bottom: LV.wallTop[r], top: LV.towerTop[r] };
  });
  // 牆頂：梢間樓座內緣以內 = 高牆頂，以外 = 低牆頂
  const outerT = towers.filter((t) => t.r === 2);
  const innerLimitN = outerT.length ? Math.max(...outerT.filter((t) => t.z < 0).map((t) => t.z1)) : zEndN;
  const innerLimitS = outerT.length ? Math.min(...outerT.filter((t) => t.z > 0).map((t) => t.z0)) : zEndS;
  const wallTopAt = (z) => (z > innerLimitN && z < innerLimitS ? LV.wallTop[0] : LV.wallTop[2]);

  // 地坪：牌樓腳下的地磚由廣場區（plaza）鋪設，本區不另鋪地板。

  // ------------------------------------------------------------------------
  // 2. 牆身：立面輪廓（含五個拱）擠出成厚 T 的牆
  // ------------------------------------------------------------------------
  {
    const pts = [[zEndN, 0]];
    for (const a of arches) {
      const r = a.w / 2, spring = a.h - r;
      pts.push([a.z - r, 0], [a.z - r, spring]);
      const n = 40;
      for (let i = 1; i < n; i++) { const t = Math.PI * (1 - i / n); pts.push([a.z + r * Math.cos(t), spring + r * Math.sin(t)]); }
      pts.push([a.z + r, spring], [a.z + r, 0]);
    }
    const wtHi = LV.wallTop[0], wtLo = LV.wallTop[2];
    pts.push([zEndS, 0], [zEndS, wtLo], [innerLimitS, wtLo], [innerLimitS, wtHi], [innerLimitN, wtHi], [innerLimitN, wtLo], [zEndN, wtLo]);
    const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: T, bevelEnabled: false });
    g.rotateY(-Math.PI / 2);
    g.translate(HT, 0, 0);
    add('marble', g);
  }

  // 牆頂簷線（一整塊跨過前後兩面的疊澀線腳）
  const cornice = (k, y, z0, z1, x, outs = [0.12, 0.3, 0.45], hs = [0.15, 0.2, 0.25], endN = true, endS = true) => {
    let yy = y - hs.reduce((s, h) => s + h, 0);
    for (let i = 0; i < outs.length; i++) {
      const o = outs[i];
      box(k, -x - o, x + o, yy, yy + hs[i], z0 - (endN ? o : 0), z1 + (endS ? o : 0));
      yy += hs[i];
    }
  };
  {
    const wtHi = LV.wallTop[0], wtLo = LV.wallTop[2];
    cornice('smooth', wtHi, innerLimitN, innerLimitS, HT, undefined, undefined, false, false);
    cornice('smooth', wtLo, zEndN, innerLimitN, HT, undefined, undefined, true, false);
    cornice('smooth', wtLo, innerLimitS, zEndS, HT, undefined, undefined, false, true);
  }

  // ------------------------------------------------------------------------
  // 3. 方柱＋柱基座＋抱鼓石
  // ------------------------------------------------------------------------
  const baoguShape = (sc) => {
    const pts = [];
    const P = (s, y) => pts.push([s * sc, y]);
    P(0, 0.3); P(3.0, 0.3);
    for (let i = 0; i <= 14; i++) { const a = (-35 + 155 * i / 14) * D2R; P(2.6 + 0.62 * Math.cos(a), 0.95 + 0.62 * Math.sin(a)); }
    P(2.05, 1.52); P(1.8, 1.66);
    for (let i = 0; i <= 18; i++) { const a = (-25 + 205 * i / 18) * D2R; P(0.95 + 0.8 * Math.cos(a), 2.2 + 0.8 * Math.sin(a)); }
    P(0, 2.2);
    return shapeOf(pts);
  };
  const zdisc = (k, x, y, zFace, dir, r, d, seg = 14) => {  // 朝 ±z 的圓盤
    const g = discG(r, d + 0.02, Math.max(8, Math.min(seg, Math.round(8 + r * 12))));
    g.rotateX(dir * Math.PI / 2);     // 外蓋朝 dir·z
    g.translate(x, y, zFace + dir * (d / 2 - 0.01));
    return add(k, g);
  };

  pillars.forEach((pz, i) => {
    const outer = i === 0 || i === pillars.length - 1;
    // 基座寬：內柱 = 柱間牆寬 − 0.4（上限 5.6）；外柱 4.6
    let pedW;
    if (outer) pedW = 4.6;
    else {
      const a = arches[i - 1], b = arches[i];
      pedW = Math.min(5.6, (b.z - b.w / 2) - (a.z + a.w / 2) - 0.4);
    }
    const z0 = pz - pedW / 2, z1 = pz + pedW / 2;
    const ph = G.plinthHeight;
    // 須彌座下段（plinth）
    box('marble', -PED_D / 2 - 0.16, PED_D / 2 + 0.16, 0, ph - 0.18, z0 - 0.16, z1 + 0.16);
    box('smooth', -PED_D / 2 - 0.1, PED_D / 2 + 0.1, ph - 0.18, ph, z0 - 0.1, z1 + 0.1);
    // 座身
    box('marble', -PED_D / 2, PED_D / 2, ph, PED_TOP - 0.34, z0, z1);
    // 座頂疊澀
    box('smooth', -PED_D / 2 - 0.08, PED_D / 2 + 0.08, PED_TOP - 0.34, PED_TOP - 0.16, z0 - 0.08, z1 + 0.08);
    box('smooth', -PED_D / 2 - 0.18, PED_D / 2 + 0.18, PED_TOP - 0.16, PED_TOP, z0 - 0.18, z1 + 0.18);
    // 座身側面（朝拱洞）框飾
    for (const side of [-1, 1]) {
      const zf = side < 0 ? z0 : z1;
      const fr = (y0, y1, x0, x1) => box('smooth', x0, x1, y0, y1, side < 0 ? zf - 0.05 : zf - 0.01, side < 0 ? zf + 0.01 : zf + 0.05);
      const yb = ph + 0.25, yt = PED_TOP - 0.55, xa = PED_D / 2 - 0.25;
      fr(yb, yb + 0.1, -xa, xa); fr(yt - 0.1, yt, -xa, xa);
      fr(yb, yt, -xa, -xa + 0.1); fr(yb, yt, xa - 0.1, xa);
      // 框內花盤
      zdisc('smooth', 0, (yb + yt) / 2, zf, side, 0.42, 0.05);
      zdisc('smooth', 0, (yb + yt) / 2, zf, side, 0.22, 0.1);
    }
    // 正面（−x）座身框飾（抱鼓兩側露出的部分）→ 鏡射到背面
    {
      const yb = ph + 0.25, yt = PED_TOP - 0.55;
      fframe('smooth', PED_D / 2, 0.05, yb, yt, z0 + 0.22, z1 - 0.22, 0.1);
    }
    // 方柱
    const top = Math.max(wallTopAt(pz - PW / 2 + 0.01), wallTopAt(pz + PW / 2 - 0.01));
    const capY = top - 0.6;
    box('marble', -PD / 2, PD / 2, PED_TOP, capY - 0.3, pz - PW / 2, pz + PW / 2);
    box('smooth', -PD / 2 - 0.1, PD / 2 + 0.1, capY - 0.3, capY, pz - PW / 2 - 0.1, pz + PW / 2 + 0.1);
    // 柱腳線
    box('smooth', -PD / 2 - 0.08, PD / 2 + 0.08, PED_TOP, PED_TOP + 0.25, pz - PW / 2 - 0.08, pz + PW / 2 + 0.08);
    // 柱面框飾＋花盤（正面，鏡射到背面）
    {
      const f = PD / 2, yb = PED_TOP + 0.55, yt = capY - 0.55;
      fframe('smooth', f, 0.06, yb, yt, pz - PW / 2 + 0.2, pz + PW / 2 - 0.2, 0.1);
      fframe('smooth', f, 0.04, yb + 0.22, yt - 1.6, pz - PW / 2 + 0.42, pz + PW / 2 - 0.42, 0.07);
      fdisc('smooth', f, 0.06, yt - 0.8, pz, 0.5, 20);
      fdisc('smooth', f, 0.12, yt - 0.8, pz, 0.32, 16);
      fdisc('smooth', f, 0.18, yt - 0.8, pz, 0.14, 12);
      // 柱身中段長六角
      const hs = hexShape(0.5, 0.5);
      for (let k = 0; k < 3; k++) fshape('smooth', f, 0.06, hs, yb + 1.0 + k * ((yt - 2.6 - yb) / 2), pz);
    }
    // 外柱的外側端面框飾
    if (outer) {
      const dir = i === 0 ? -1 : 1, zf = i === 0 ? zEndN : zEndS;
      const yb = PED_TOP + 0.6, yt = capY - 0.6;
      const fr = (y0, y1, x0, x1) => box('smooth', x0, x1, y0, y1, dir < 0 ? zf - 0.06 : zf - 0.01, dir < 0 ? zf + 0.01 : zf + 0.06);
      fr(yb, yb + 0.1, -HT + 0.3, HT - 0.3); fr(yt - 0.1, yt, -HT + 0.3, HT - 0.3);
      fr(yb, yt, -HT + 0.3, -HT + 0.4); fr(yb, yt, HT - 0.4, HT - 0.3);
      zdisc('smooth', 0, yt - 0.9, zf, dir, 0.45, 0.06);
      zdisc('smooth', 0, yt - 0.9, zf, dir, 0.25, 0.12);
    }

    // 抱鼓石（前後各一）＋墊石＋小石墩
    const bgT = Math.min(1.5, pedW * 0.32);
    const reach = G.depth / 2 - 0.12 - PED_D / 2;
    const sc = reach / 3.2;
    const bshape = baoguShape(sc);
    for (const sx of [-1, 1]) {
      const xFace = sx * PED_D / 2;
      // 墊石
      box('smooth', Math.min(xFace, sx * G.depth / 2), Math.max(xFace, sx * G.depth / 2), 0, 0.3, pz - bgT / 2 - 0.45, pz + bgT / 2 + 0.45);
      const g = new THREE.ExtrudeGeometry(bshape, { depth: bgT - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 4 });
      g.translate(0, 0, -(bgT - 0.12) / 2);
      if (sx < 0) g.rotateY(Math.PI);
      g.translate(xFace - sx * 0.05, 0, pz);
      add('smooth', g);
      // 捲雲渦紋（兩側面同心圓盤）
      const dx = xFace + sx * 0.95 * sc, rx = xFace + sx * 2.6 * sc;
      for (const dz of [-1, 1]) {
        const zf = pz + dz * bgT / 2;
        zdisc('smooth', dx, 2.2, zf, dz, 0.62, 0.05);
        zdisc('smooth', dx, 2.2, zf, dz, 0.42, 0.11);
        zdisc('smooth', dx, 2.2, zf, dz, 0.2, 0.17, 12);
        zdisc('smooth', rx, 0.95, zf, dz, 0.45, 0.05);
        zdisc('smooth', rx, 0.95, zf, dz, 0.22, 0.11, 12);
      }
      // 小石墩
      for (const dz of [-1, 1]) {
        const c = new THREE.CylinderGeometry(0.17, 0.2, 0.55, 12, 1);
        c.translate(sx * (G.depth / 2 - 0.25), 0.27, pz + dz * (bgT / 2 + 0.75));
        add('smooth', c);
      }
    }
  });

  // ------------------------------------------------------------------------
  // 4. 拱圈線腳、拱腹、拱肩花盤、橫帶浮雕
  // ------------------------------------------------------------------------
  arches.forEach((a, ai) => {
    const R = a.w / 2, spring = a.h - R, Ri = R, Ro = R + AV_W;
    const zl = pillars[ai] + PW / 2, zr = pillars[ai + 1] - PW / 2;   // 左右柱內緣
    const wt = wallTopAt(a.z);
    const yb = PED_TOP;
    const n = 36;
    // 拱圈（U 形帶，從基座頂高度沿拱腳上升、繞過拱頂）
    const bandShape = (r0, r1) => {
      const pts = [[a.z - r1, yb], [a.z - r1, spring]];
      for (let i = 1; i < n; i++) { const t = Math.PI * (1 - i / n); pts.push([a.z + r1 * Math.cos(t), spring + r1 * Math.sin(t)]); }
      pts.push([a.z + r1, spring], [a.z + r1, yb], [a.z + r0, yb], [a.z + r0, spring]);
      for (let i = 1; i < n; i++) { const t = Math.PI * (i / n); pts.push([a.z + r0 * Math.cos(t), spring + r0 * Math.sin(t)]); }
      pts.push([a.z - r0, spring], [a.z - r0, yb]);
      return shapeOf(pts);
    };
    fshape('smooth', HT, 0.08, bandShape(Ri, Ro));
    fshape('smooth', HT, 0.17, bandShape(Ri, Ri + 0.16));
    fshape('smooth', HT, 0.15, bandShape(Ro - 0.14, Ro));
    // 拱圈上的卷草浮雕（一串小凸塊）
    {
      const rm = (Ri + 0.16 + Ro - 0.14) / 2;
      const arcLen = Math.PI * rm, step = 0.55;
      const nb = Math.round(arcLen / step);
      for (let i = 0; i < nb; i++) {
        const t = Math.PI * (i + 0.5) / nb;
        const y = spring + rm * Math.sin(t), z = a.z + rm * Math.cos(t);
        const g = new THREE.BoxGeometry(0.16, 0.22, 0.28);
        g.rotateX(-(Math.PI / 2 - t));
        g.translate(-HT - 0.1, y, z);
        DEC.push(['smooth', g]);
      }
      const nl = Math.max(1, Math.floor((spring - yb - 0.3) / step));
      for (const s of [-1, 1]) for (let i = 0; i < nl; i++) {
        fbox('smooth', HT, 0.16, yb + 0.35 + i * step, yb + 0.35 + i * step + 0.28, a.z + s * rm - 0.11, a.z + s * rm + 0.11);
      }
      // 拱心石
      fbox('smooth', HT, 0.22, a.h - 0.05, a.h + AV_W + 0.1, a.z - 0.42, a.z + 0.42);
      fdisc('smooth', HT + 0.22, 0.06, a.h + AV_W / 2 + 0.02, a.z, 0.24, 14);
    }
    // 拱腹：靠前後面的兩條線腳＋中央一串方格（兩面對稱，直接整體做）
    {
      const segs = 28;
      const ringAt = (x, w, dep) => {
        for (let i = 0; i < segs; i++) {
          const t0 = Math.PI * i / segs, t1 = Math.PI * (i + 1) / segs;
          const r = R - dep / 2;
          const p0 = new V3(x, spring + r * Math.sin(t0), a.z + r * Math.cos(t0));
          const p1 = new V3(x, spring + r * Math.sin(t1), a.z + r * Math.cos(t1));
          add('smooth', beamG(p0, p1, w, dep + 0.02, new V3(-1, 0, 0)));
        }
        for (const s of [-1, 1]) {
          const zz = a.z + s * (R - dep / 2);
          box('smooth', x - w / 2, x + w / 2, yb, spring, zz - dep / 2 - 0.01, zz + dep / 2 + 0.01);
        }
      };
      ringAt(-HT + 0.32, 0.22, 0.1);
      ringAt(HT - 0.32, 0.22, 0.1);
      ringAt(-HT + 0.62, 0.08, 0.06);
      ringAt(HT - 0.62, 0.08, 0.06);
      // 拱腹中央方格
      const nc = Math.round((Math.PI * R) / 0.9);
      for (let i = 0; i < nc; i++) {
        const t = Math.PI * (i + 0.5) / nc;
        const g = new THREE.BoxGeometry(0.9, 0.08, 0.36);
        g.translate(0, -0.03, 0);
        g.rotateX(-(Math.PI / 2 - t));
        // 盒子 y 軸 → 半徑方向
        const m = new THREE.Matrix4().makeRotationX(0);
        void m;
        const yy = spring + R * Math.sin(t), zz = a.z + R * Math.cos(t);
        const radial = new V3(0, Math.sin(t), Math.cos(t));
        const gg = beamG(new V3(-0.45, yy - radial.y * 0.03, zz - radial.z * 0.03), new V3(0.45, yy - radial.y * 0.03, zz - radial.z * 0.03), 0.36, 0.08, radial);
        add('smooth', gg);
        g.dispose();
      }
    }
    // 拱肩花盤
    for (const s of [-1, 1]) {
      const y = spring + Ro * 0.72;
      const arcZ = Math.sqrt(Math.max(0, Ro * Ro - (Ro * 0.72) ** 2));
      const edge = s < 0 ? zl : zr;
      const room = Math.abs(edge - (a.z + s * arcZ));
      const yTopRoom = a.h + AV_W + 0.2 - y;
      if (room > 0.8) {
        const r = Math.min(0.62, room / 2 - 0.1, yTopRoom - 0.05);
        const z = a.z + s * (arcZ + room / 2);
        fdisc('smooth', HT, 0.05, y, z, r, 20);
        fdisc('smooth', HT, 0.1, y, z, r * 0.68, 16);
        fdisc('smooth', HT, 0.16, y, z, r * 0.3, 12);
        // 四片花瓣
        for (let p = 0; p < 4; p++) {
          const t = p * Math.PI / 2 + Math.PI / 4;
          fdisc('smooth', HT, 0.08, y + Math.sin(t) * r * 0.62, z + Math.cos(t) * r * 0.62, r * 0.22, 10);
        }
      }
    }
    // 橫帶浮雕框（拱頂以上到牆頂簷線以下）
    {
      const y0 = a.h + AV_W + 0.28, y1 = wt - 0.62;
      const nbands = Math.max(1, Math.round((y1 - y0) / 1.45));
      const bh = (y1 - y0) / nbands;
      const za = zl + 0.1, zb = zr - 0.1, bw = zb - za, zc = (za + zb) / 2;
      for (let b = 0; b < nbands; b++) {
        const ya = y0 + b * bh + 0.06, yb2 = y0 + (b + 1) * bh - 0.06;
        const ym = (ya + yb2) / 2, hh = yb2 - ya;
        fframe('smooth', HT, 0.07, ya, yb2, za, zb, 0.11);
        if ((b + nbands) % 2 === 0) {
          // 長六角開光＋兩側花盤
          fshape('smooth', HT, 0.05, hexShape(bw * 0.5, hh * 0.66), ym, zc);
          fshape('smooth', HT, 0.1, hexShape(bw * 0.5 - 0.3, hh * 0.66 - 0.26), ym, zc);
          for (const s of [-1, 1]) {
            const r = Math.min(0.3, hh * 0.27);
            fdisc('smooth', HT, 0.06, ym, zc + s * bw * 0.37, r, 16);
            fdisc('smooth', HT, 0.12, ym, zc + s * bw * 0.37, r * 0.5, 12);
            fframe('smooth', HT, 0.04, ym - hh * 0.36, ym + hh * 0.36, zc + s * bw * 0.37 - hh * 0.36, zc + s * bw * 0.37 + hh * 0.36, 0.06);
          }
        } else {
          // 一列方塊（回紋示意）
          const sq = Math.min(0.42, hh * 0.38), stepZ = sq * 1.75;
          const nq = Math.floor((bw - 0.6) / stepZ);
          for (let q = 0; q < nq; q++) {
            const z = zc + (q - (nq - 1) / 2) * stepZ;
            fbox('smooth', HT, 0.06, ym - sq / 2, ym + sq / 2, z - sq / 2, z + sq / 2);
            fbox('smooth', HT, 0.1, ym - sq * 0.22, ym + sq * 0.22, z - sq * 0.22, z + sq * 0.22);
          }
        }
      }
    }
  });

  // ------------------------------------------------------------------------
  // 5. 樓座（五座）＋匾額
  // ------------------------------------------------------------------------
  towers.forEach((t) => {
    const yc = t.top - 0.5;
    box('marble', -HT, HT, t.bottom - 0.05, yc, t.z0, t.z1);
    // 頂部疊澀（承斗栱）
    box('smooth', -HT - 0.12, HT + 0.12, yc, yc + 0.22, t.z0 - 0.12, t.z1 + 0.12);
    box('smooth', -HT - 0.25, HT + 0.25, yc + 0.22, t.top, t.z0 - 0.25, t.z1 + 0.25);
    // 兩側壁柱
    fbox('smooth', HT, 0.1, t.bottom, yc, t.z0, t.z0 + 0.42);
    fbox('smooth', HT, 0.1, t.bottom, yc, t.z1 - 0.42, t.z1);
    // 端面框飾
    for (const [zf, dir] of [[t.z0, -1], [t.z1, 1]]) {
      const yb = t.bottom + 0.4, yt = yc - 0.3;
      if (yt - yb < 0.8) continue;
      const fr = (y0, y1, x0, x1) => box('smooth', x0, x1, y0, y1, dir < 0 ? zf - 0.06 : zf - 0.01, dir < 0 ? zf + 0.01 : zf + 0.06);
      fr(yb, yb + 0.1, -HT + 0.3, HT - 0.3); fr(yt - 0.1, yt, -HT + 0.3, HT - 0.3);
      fr(yb, yt, -HT + 0.3, -HT + 0.4); fr(yb, yt, HT - 0.4, HT - 0.3);
    }
    if (t.r === 0) return; // 中央樓座另做匾額
    // 次／梢樓座：雙層框＋圓角開光＋中心花盤
    const za = t.z0 + 0.6, zb = t.z1 - 0.6, ya = t.bottom + 0.35, yb = yc - 0.3;
    fframe('smooth', HT, 0.06, ya, yb, za, zb, 0.12);
    fframe('smooth', HT, 0.1, ya + 0.22, yb - 0.22, za + 0.22, zb - 0.22, 0.08);
    const w = (zb - za) - 1.2, h = (yb - ya) - 0.9, ym = (ya + yb) / 2, zm = (za + zb) / 2;
    fshape('smooth', HT, 0.05, rrectShape(w, h, Math.min(0.5, h * 0.35)), ym, zm);
    fshape('smooth', HT, 0.09, rrectShape(w * 0.62, h * 0.7, Math.min(0.35, h * 0.3)), ym, zm);
    fdisc('smooth', HT, 0.15, ym, zm, Math.min(0.42, h * 0.3), 20);
    fdisc('smooth', HT, 0.21, ym, zm, Math.min(0.2, h * 0.14), 14);
    for (const s of [-1, 1]) {
      fshape('smooth', HT, 0.1, hexShape(w * 0.16, h * 0.42), ym, zm + s * w * 0.4);
      fdisc('smooth', HT, 0.09, ya + 0.42, zm + s * (w / 2 + 0.05), 0.12, 10);
      fdisc('smooth', HT, 0.09, yb - 0.42, zm + s * (w / 2 + 0.05), 0.12, 10);
    }
  });

  // 匾額（兩面）：程序文字紋理，框飾為立體線腳
  {
    const ct = towers.find((t) => t.r === 0);
    const zc = ct ? ct.z : 0;
    const w = plq.width, h = plq.height, y = plq.y;
    // 匾框：外框帶＋內圈珠線＋外圈細線＋框上浮雕凸塊（前面做好，最後鏡射到背面）
    const fw = 0.42;
    fframe('smooth', HT, 0.14, y - h / 2 - fw, y + h / 2 + fw, zc - w / 2 - fw, zc + w / 2 + fw, fw);
    fframe('smooth', HT, 0.24, y - h / 2 - 0.1, y + h / 2 + 0.1, zc - w / 2 - 0.1, zc + w / 2 + 0.1, 0.1);
    fframe('smooth', HT, 0.2, y - h / 2 - fw, y + h / 2 + fw, zc - w / 2 - fw, zc + w / 2 + fw, 0.07);
    const bump = (yy, zz, r) => { fdisc('smooth', HT + 0.14, 0.07, yy, zz, r, 10); };
    const stepB = 0.46;
    const nH = Math.round((w + fw) / stepB), nV = Math.round((h + fw) / stepB);
    for (let i = 0; i <= nH; i++) {
      const zz = zc - (w + fw) / 2 + i * (w + fw) / nH;
      bump(y + h / 2 + fw / 2, zz, 0.12); bump(y - h / 2 - fw / 2, zz, 0.12);
    }
    for (let i = 1; i < nV; i++) {
      const yy = y - (h + fw) / 2 + i * (h + fw) / nV;
      bump(yy, zc - w / 2 - fw / 2, 0.12); bump(yy, zc + w / 2 + fw / 2, 0.12);
    }
    // 匾心（文字）
    const tex = makePlaqueTexture({ text: plq.text, rightToLeft: PLAQUE_RTL, bg: '#e9e5da', fg: '#1a2130', border: '#cfc8b8', aspect: w / h });
    const plaqueMat = new THREE.MeshStandardMaterial({ name: 'gatePlaque', map: tex, roughness: 0.42 });
    const faces = G.plaque.bothFaces === false ? [-1] : [-1, 1];
    for (const sx of faces) {
      const pg = new THREE.PlaneGeometry(w, h);
      pg.rotateY(sx < 0 ? -Math.PI / 2 : Math.PI / 2);
      pg.translate(sx * (HT + 0.08), y, zc);
      const pm = new THREE.Mesh(pg, plaqueMat);
      pm.name = 'gate:plaque';
      pm.castShadow = false; pm.receiveShadow = true;
      group.add(pm);
    }
    // 匾後襯板（略凸出樓座面，匾額嵌在框內）
    fbox('smooth', HT, 0.06, y - h / 2 - 0.02, y + h / 2 + 0.02, zc - w / 2 - 0.02, zc + w / 2 + 0.02);
  }

  // ------------------------------------------------------------------------
  // 6. 屋頂（十一樓）
  // ------------------------------------------------------------------------
  const roofs = [];
  {
    // 主樓：每座樓座上一座；夾樓：每根柱上一座（嵌在相鄰樓座之間）
    const S = {  // 依 rank 的主樓參數（30 m 時）
      0: { hl: 11.7, hd: 4.7, ye: 25.05, chi: 1.0, lift: 1.0, kick: 0.6, th: 0.36, reach: 2.25, tiers: 4, sc: 1.0, sp: 1.45 },
      1: { hl: 7.8, hd: 4.2, ye: 22.85, rt: 25.6, rl: 3.0, chi: 0.6, lift: 0.85, kick: 0.5, th: 0.32, reach: 2.0, tiers: 4, sc: 0.9, sp: 1.4 },
      2: { hl: 6.6, hd: 3.9, ye: 21.0, rt: 23.45, rl: 2.4, chi: 0.55, lift: 0.8, kick: 0.45, th: 0.3, reach: 1.8, tiers: 3, sc: 0.85, sp: 1.4 },
    };
    for (const t of towers) {
      const s = S[t.r];
      const r = {
        cz: t.z, hl: s.hl, hd: s.hd, ye: lv(s.ye), lift: s.lift, kick: s.kick, th: s.th,
        base: t.top, sup: [t.z0, t.z1], endsFree: [true, true], chi: s.chi,
        br: { reach: s.reach, tiers: s.tiers, sc: s.sc, sp: s.sp }, big: true, rafters: true,
      };
      if (t.r === 0) {
        // 中央最高樓：鴟吻頂 = G.height，鴟吻中心在 ±topRidge.halfLength
        r.rl = G.topRidge.halfLength;
        r.ridgeTop = G.height - (CHI_TOP - CHI_MOUTH) * s.chi;
        r.chiTopExact = G.height;
      } else {
        r.rl = s.rl;
        r.ridgeTop = lv(s.rt);
      }
      roofs.push(r);
    }
    // 夾樓
    const sortedT = [...towers].sort((a, b) => a.z - b.z);
    for (let i = 0; i < pillars.length; i++) {
      const pz = pillars[i];
      const left = sortedT.filter((t) => t.z1 <= pz + 0.01).pop();
      const right = sortedT.find((t) => t.z0 >= pz - 0.01);
      const outer = !left || !right;
      const tuck = 0.35;
      let za, zb, endsFree;
      if (!left) { za = -G.width / 2; zb = right.z0 - tuck; endsFree = [true, false]; }
      else if (!right) { za = left.z1 + tuck; zb = G.width / 2; endsFree = [false, true]; }
      else { za = left.z1 - tuck; zb = right.z0 + tuck; endsFree = [false, false]; }
      // 若樓座重疊柱位（例如中央樓座蓋過第一根柱），夾樓仍放在兩樓座之間的空檔
      if (left && right && zb - za < 1.2) continue;
      const base = outer ? LV.wallTop[2] : LV.wallTop[0];
      const hl = (zb - za) / 2, hd = 2.7;
      const sup = [left ? left.z1 : zEndN, right ? right.z0 : zEndS];
      roofs.push({
        cz: (za + zb) / 2, hl, hd, rl: Math.max(0.5, hl - (outer ? 1.9 : 2.0)),
        ye: base + lv(0.95), ridgeTop: base + lv(outer ? 2.6 : 2.55), lift: 0.45, kick: 0.28, th: 0.24,
        base, sup, endsFree, chi: 0.4,
        br: { reach: 0.95, tiers: 3, sc: 0.62, sp: 1.15 }, big: false, rafters: true,
      });
    }
  }

  for (const R of roofs) buildRoof(R);

  // ------------------------------------------------------------------------
  // 屋頂建構
  // ------------------------------------------------------------------------
  function buildRoof(R) {
    R.yr = R.ridgeTop - 0.42 * (R.big ? 1 : 0.6);   // 屋面在正脊處的高度
    const lcF = Math.min(R.hl * 0.6, 5.5), lcE = R.hd * 0.9;
    const prof = (v) => v * (0.42 + 0.58 * v);       // 舉折：近簷平緩、近脊陡
    const pt = (side, a, v, under = false) => {
      let ex, ez, rz, c, ox, oz;
      const sa = a < 0 ? -1 : 1;
      if (side < 2) {
        const sx = side ? 1 : -1;
        ex = sx * R.hd; ez = R.cz + a * R.hl; rz = R.cz + a * R.rl;
        c = (Math.abs(a) * R.hl - (R.hl - lcF)) / lcF; ox = sx; oz = sa;
      } else {
        const sz = side === 2 ? -1 : 1;
        ex = a * R.hd; ez = R.cz + sz * R.hl; rz = R.cz + sz * R.rl;
        c = (Math.abs(a) * R.hd - (R.hd - lcE)) / lcE; ox = sa; oz = sz;
      }
      c = smooth(clamp01(c));
      const w = c * c * (1 - v) * (1 - v);
      const x = ex * (1 - v) + ox * R.kick * w;
      const z = ez + (rz - ez) * v + oz * R.kick * w;
      let y = R.ye + (R.yr - R.ye) * prof(v) + R.lift * w;
      if (under) y -= R.th * (1 + 0.8 * v);
      return new V3(x, y, z);
    };
    R.pt = pt;
    const naF = R.big ? 30 : 12, naE = R.big ? 12 : 8, nvT = R.big ? 11 : 6, nvU = R.big ? 6 : 4;
    const outward = [new V3(-1, 0, 0), new V3(1, 0, 0), new V3(0, 0, -1), new V3(0, 0, 1)];

    for (let side = 0; side < 4; side++) {
      const na = side < 2 ? naF : naE;
      for (const under of [false, true]) {
        const nv = under ? nvU : nvT;   // 簷底只需較粗的分段
        const pos = [], uvA = [];
        const grid = [];
        for (let j = 0; j <= nv; j++) {
          const row = [];
          for (let i = 0; i <= na; i++) row.push(pt(side, -1 + 2 * i / na, j / nv, under));
          grid.push(row);
        }
        // UV：u = 沿簷口（公尺）、v = 自正脊沿坡往下（公尺）
        const vAcc = grid.map((r) => r.map(() => 0));
        for (let i = 0; i <= na; i++) {
          let acc = 0;
          for (let j = nv; j >= 0; j--) {
            if (j < nv) acc += grid[j][i].distanceTo(grid[j + 1][i]);
            vAcc[j][i] = acc;
          }
        }
        for (let j = 0; j <= nv; j++) for (let i = 0; i <= na; i++) {
          const p = grid[j][i];
          pos.push(p.x, p.y, p.z);
          uvA.push(side < 2 ? p.z : p.x, vAcc[j][i]);
        }
        const idx = [];
        for (let j = 0; j < nv; j++) for (let i = 0; i < na; i++) {
          const a0 = j * (na + 1) + i, b0 = a0 + 1, c0 = a0 + na + 1, d0 = c0 + 1;
          idx.push(a0, b0, d0, a0, d0, c0);
        }
        // 檢查朝向：屋面朝上、簷底朝下
        const p0 = grid[0][Math.floor(na / 2)], p1 = grid[0][Math.floor(na / 2) + 1], p2 = grid[1][Math.floor(na / 2) + 1];
        const nrm = new V3().crossVectors(new V3().subVectors(p1, p0), new V3().subVectors(p2, p0));
        const want = under ? -1 : 1;
        if (Math.sign(nrm.y) !== want) for (let k = 0; k < idx.length; k += 3) { const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvA, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        add(under ? 'soffit' : 'tile', g);
      }
      // 連檐（白色簷口立面）
      {
        const pos = [];
        const out = outward[side];
        for (let i = 0; i < na; i++) {
          const a0 = -1 + 2 * i / na, a1 = -1 + 2 * (i + 1) / na;
          const t0 = pt(side, a0, 0), t1 = pt(side, a1, 0), u0 = pt(side, a0, 0, true), u1 = pt(side, a1, 0, true);
          const tri = [[t0, t1, u1], [t0, u1, u0]];
          for (const [p, q, r] of tri) {
            const n = new V3().crossVectors(new V3().subVectors(q, p), new V3().subVectors(r, p));
            if (n.dot(out) < 0) pos.push(p.x, p.y, p.z, r.x, r.y, r.z, q.x, q.y, q.z);
            else pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
        add('smooth', g);
        // 勾頭滴水：連檐上緣一條琉璃細邊
        for (let i = 0; i < na; i++) {
          const a0 = -1 + 2 * i / na, a1 = -1 + 2 * (i + 1) / na;
          const p0 = pt(side, a0, 0.0).add(new V3(0, 0.03, 0)), p1 = pt(side, a1, 0.0).add(new V3(0, 0.03, 0));
          add('glaze', beamG(p0, p1, 0.16, 0.1));
        }
      }
    }

    const s = R.big ? 1 : 0.62;
    // 正脊（沿 z）
    {
      const z0 = R.cz - R.rl, z1 = R.cz + R.rl;
      const rt = R.ridgeTop;
      box('glaze', -0.24 * s, 0.24 * s, R.yr - 0.3 * s, rt - 0.12 * s, z0, z1);
      box('glaze', -0.31 * s, 0.31 * s, rt - 0.12 * s, rt, z0, z1);
      box('glaze', -0.28 * s, 0.28 * s, R.yr - 0.3 * s, R.yr - 0.12 * s, z0, z1);
      box('smooth', -0.26 * s, 0.26 * s, rt - 0.36 * s, rt - 0.28 * s, z0, z1);  // 脊身白色線（照片可見）
    }
    // 垂脊（四角）＋起翹套獸＋走獸
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const side = sx < 0 ? 0 : 1;
      const n = R.big ? 12 : 7;
      const pts = [];
      for (let k = 0; k <= n; k++) pts.push(pt(side, sz, k / n).add(new V3(0, 0.13 * s, 0)));
      for (let k = 0; k < n; k++) add('glaze', beamG(pts[k], pts[k + 1].clone().add(new V3().subVectors(pts[k + 1], pts[k]).multiplyScalar(0.04)), 0.3 * s, 0.3 * s));
      // 翹角：從簷角再往外、往上一段
      const diag = new V3(sx, 0, sz).normalize();
      const tip = pts[0].clone().addScaledVector(diag, 0.55 * s).add(new V3(0, 0.42 * s, 0));
      add('glaze', beamG(pts[0].clone().addScaledVector(diag, -0.05), tip, 0.26 * s, 0.26 * s));
      const tip2 = tip.clone().addScaledVector(diag, 0.12 * s).add(new V3(0, 0.22 * s, 0));
      add('glaze', beamG(tip.clone().addScaledVector(diag, -0.06), tip2, 0.2 * s, 0.2 * s));
      // 走獸（小凸塊）
      const nb = R.big ? 4 : 2;
      for (let b = 0; b < nb; b++) {
        const v = 0.1 + b * 0.075;
        const k = v * n, k0 = Math.floor(k);
        const p = pts[k0].clone().lerp(pts[k0 + 1], k - k0);
        const g = new THREE.BoxGeometry(0.17 * s, 0.34 * s, 0.17 * s);
        g.translate(p.x, p.y + 0.3 * s, p.z);
        add('glaze', g);
        const hd = new THREE.BoxGeometry(0.12 * s, 0.12 * s, 0.12 * s);
        hd.translate(p.x + diag.x * 0.08 * s, p.y + 0.5 * s, p.z + diag.z * 0.08 * s);
        add('glaze', hd);
      }
    }
    // 鴟吻（正脊兩端）
    if (R.chi > 0) {
      for (const dir of [-1, 1]) {
        const g = chiwenGeometry(R.chi, dir);
        let yBase = R.ridgeTop - CHI_MOUTH * R.chi;
        if (R.chiTopExact !== undefined) {
          g.computeBoundingBox();
          yBase = R.chiTopExact - g.boundingBox.max.y;
        }
        g.translate(0, yBase, R.cz + dir * R.rl);
        add('glaze', g);
      }
    }

    // 簷下：核心塊（擋住屋頂內部）、斗栱、飛椽
    const soffitAt = (x) => {
      const v = clamp01((R.hd - Math.abs(x)) / R.hd);
      return R.ye + (R.yr - R.ye) * prof(v) - R.th * (1 + 0.8 * v);
    };
    {
      const top = soffitAt(HT) - 0.08;
      box('marble', -HT + 0.02, HT - 0.02, R.base - 0.02, top, R.sup[0], R.sup[1]);
    }
    // 斗栱：沿前後面
    const br = R.br;
    const len = R.sup[1] - R.sup[0];
    const nSets = Math.max(1, Math.round(len / br.sp));
    const tip = HT + br.reach;
    const topAtTip = soffitAt(tip) - 0.03;
    for (const sx of [-1, 1]) {
      for (let k = 0; k < nSets; k++) {
        const z = R.sup[0] + (k + 0.5) * len / nSets;
        bracketSet(new V3(sx, 0, 0), new V3(sx * HT, R.base, z), R.base, topAtTip, br.reach, br.tiers, br.sc);
      }
    }
    // 自由端：角科（斜向）＋端面中央一朵
    R.endsFree.forEach((free, e) => {
      if (!free) return;
      const sz = e === 0 ? -1 : 1;
      const zf = sz < 0 ? R.sup[0] : R.sup[1];
      for (const sx of [-1, 1]) {
        const o = new V3(sx, 0, sz).normalize();
        bracketSet(o, new V3(sx * HT, R.base, zf), R.base, topAtTip + 0.05, br.reach * 1.3, br.tiers, br.sc);
      }
      bracketSet(new V3(0, 0, sz), new V3(0, R.base, zf), R.base, topAtTip, br.reach, br.tiers, br.sc);
    });
    // 飛椽（前後簷）
    if (R.rafters) {
      const stepR = R.big ? 0.42 : 0.5;
      const n = Math.floor((2 * R.hl) / stepR);
      for (const side of [0, 1]) for (let k = 1; k < n; k++) {
        const a = -1 + 2 * k / n;
        const p0 = pt(side, a, 0.01, true).add(new V3(0, -0.06, 0));
        const p1 = pt(side, a, Math.min(0.5, 1.6 / R.hd), true).add(new V3(0, -0.06, 0));
        add('soffit', beamG(p0, p1, 0.13 * (R.big ? 1 : 0.8), 0.13 * (R.big ? 1 : 0.8)));
      }
    }
  }

  // 一朵斗栱：o = 出跳方向（水平單位向量）、p = 牆面上的起點、y0/y1 = 底與頂、reach = 出跳距離
  function bracketSet(o, p, y0, y1, reach, tiers, sc) {
    const up = UP;
    const t = new V3().crossVectors(o, up).normalize();
    const m = new THREE.Matrix4().makeBasis(o, up, t);
    m.setPosition(p.x, 0, p.z);
    const th = (y1 - y0) / (tiers + 0.55);
    const parts = [];
    const pb = (s0, s1, ya, yb, t0, t1) => parts.push(boxG(s0, s1, ya, yb, t0, t1));
    // 坐斗
    pb(-0.05, 0.55 * sc, y0, y0 + th * 0.55, -0.3 * sc, 0.3 * sc);
    for (let k = 0; k < tiers; k++) {
      const yk = y0 + th * (0.55 + k);
      const rk = reach * (k + 1) / tiers;
      // 出跳的翹
      pb(-0.1, rk + 0.12 * sc, yk, yk + th * 0.55, -0.13 * sc, 0.13 * sc);
      // 跳頭的斗
      pb(rk - 0.2 * sc, rk + 0.18 * sc, yk + th * 0.55, yk + th, -0.2 * sc, 0.2 * sc);
      // 橫栱（愈上愈長）
      const L2 = (0.55 + 0.28 * k) * sc;
      pb(rk - 0.12 * sc, rk + 0.1 * sc, yk + th * 0.12, yk + th * 0.58, -L2, L2);
      // 橫栱兩端小斗（夾樓的小斗栱省略）
      if (sc >= 0.8) {
        pb(rk - 0.15 * sc, rk + 0.13 * sc, yk + th * 0.58, yk + th, -L2, -L2 + 0.3 * sc);
        pb(rk - 0.15 * sc, rk + 0.13 * sc, yk + th * 0.58, yk + th, L2 - 0.3 * sc, L2);
      }
    }
    // 耍頭（最上層挑出）
    const yt = y0 + th * (0.55 + tiers);
    pb(-0.1, reach + 0.38 * sc, yt - 0.02, y1, -0.14 * sc, 0.14 * sc);
    // 正心枋（貼牆的橫材，讓斗栱層不透光）
    pb(-0.02, 0.3 * sc, y0 + th * 0.55, y1, -0.75 * sc, 0.75 * sc);
    for (const g of parts) { g.applyMatrix4(m); add('bracket', g); }
  }

  // ------------------------------------------------------------------------
  // 鴟吻（程序造型）：側面輪廓擠出＋渦紋、眼、背鰭
  //   輪廓座標：s = 沿正脊向外（+）、y = 自吻底往上；高 2.4（scale = 1）
  //   龍口（s < 0 一側）咬住正脊，尾部在上方向外捲成渦（中間鏤空，逆光剪影看得到）
  // ------------------------------------------------------------------------
  function chiwenGeometry(k, dir) {
    const P = [
      [-0.60, 0.00], [0.62, 0.00], [0.70, 0.20], [0.68, 0.60], [0.63, 1.00], [0.60, 1.26],
      // 尾部外捲
      [0.68, 1.44], [0.83, 1.60], [0.93, 1.82], [0.93, 2.05], [0.83, 2.25], [0.64, 2.38], [0.42, 2.42], [0.22, 2.36],
      [0.08, 2.22], [0.04, 2.06], [0.12, 1.94], [0.06, 1.90],
      // 頭頂鬃毛
      [-0.06, 2.06], [-0.18, 2.14], [-0.28, 2.02], [-0.40, 2.04], [-0.46, 1.90], [-0.60, 1.86], [-0.58, 1.72],
      [-0.72, 1.62], [-0.66, 1.48], [-0.84, 1.36], [-0.72, 1.24],
      // 吻部、上顎、嘴、下顎
      [-0.92, 1.08], [-1.00, 0.92], [-0.90, 0.82], [-0.44, 0.74], [-0.82, 0.60], [-0.86, 0.46], [-0.74, 0.32], [-0.64, 0.12],
    ];
    const sh = shapeOf(P.map(([s, y]) => [s * dir * k, y * k]));
    // 渦眼鏤空
    const hole = new THREE.Path();
    const hc = [0.55 * dir * k, 1.9 * k], hr = 0.15 * k;
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2; const fn = i ? 'lineTo' : 'moveTo'; hole[fn](hc[0] + hr * Math.cos(a), hc[1] + hr * Math.sin(a)); }
    sh.holes.push(hole);
    const dep = 0.46 * k;
    const big = k >= 0.9;
    const g = new THREE.ExtrudeGeometry(sh, { depth: dep, bevelEnabled: true, bevelThickness: 0.06 * k, bevelSize: 0.05 * k, bevelSegments: big ? 2 : 1, curveSegments: 4 });
    g.translate(0, 0, -dep / 2);
    g.rotateY(-Math.PI / 2);   // shape x(s) → z、擠出 → x
    const parts = [g];
    // 兩側面：渦紋環、眼睛、背上的劍把孔環
    const faceX = dep / 2 + 0.06 * k;
    const ring = (cs, cy, r0, r1, d, seg = big ? 10 : 6) => {
      const s2 = new THREE.Shape();
      s2.absarc(0, 0, r1, 0, Math.PI * 2, false);
      const h2 = new THREE.Path(); h2.absarc(0, 0, r0, 0, Math.PI * 2, true);
      s2.holes.push(h2);
      for (const fx of [-1, 1]) {
        const rg = new THREE.ExtrudeGeometry(s2, { depth: d, bevelEnabled: false, curveSegments: seg });
        rg.rotateY(fx < 0 ? -Math.PI / 2 : Math.PI / 2);
        rg.translate(fx * (faceX - 0.01), cy, cs);
        parts.push(rg);
      }
    };
    if (k >= 0.5) {
      ring(hc[0], hc[1], hr + 0.06 * k, hr + 0.13 * k, 0.05 * k);
      if (big) ring(hc[0], hc[1], hr + 0.22 * k, hr + 0.3 * k, 0.05 * k);
    }
    const disc = (cs, cy, r, d) => {
      for (const fx of [-1, 1]) {
        const c = new THREE.CylinderGeometry(r, r, d, big ? 10 : 6, 1);
        c.rotateZ(Math.PI / 2);
        c.translate(fx * (faceX + d / 2 - 0.01), cy, cs);
        parts.push(c);
      }
    };
    disc(-0.62 * dir * k, 1.3 * k, 0.09 * k, 0.07 * k);   // 眼
    if (big) {
      disc(0.2 * dir * k, 0.55 * k, 0.16 * k, 0.05 * k);  // 腮上圓紋
      disc(0.2 * dir * k, 1.0 * k, 0.13 * k, 0.05 * k);
    }
    // 背鰭（外緣三片）
    const fins = [[0.68, 0.36], [0.66, 0.72], [0.62, 1.06]];
    for (const [fs, fy] of fins) {
      const fsh = shapeOf([[fs * dir * k, fy * k], [(fs + 0.2) * dir * k, (fy + 0.06) * k], [(fs - 0.02) * dir * k, (fy + 0.24) * k]]);
      const fg = new THREE.ExtrudeGeometry(fsh, { depth: 0.18 * k, bevelEnabled: false });
      fg.translate(0, 0, -0.09 * k);
      fg.rotateY(-Math.PI / 2);
      parts.push(fg);
    }
    const merged = utils.mergeGeometries(parts.map(normGeom(false)), false);
    return merged;
  }

  // ------------------------------------------------------------------------
  // 7. 浮雕鏡射到背面
  // ------------------------------------------------------------------------
  for (const [k, g] of DEC) {
    add(k, g);
    add(k, mirrorX(g));
  }

  // ------------------------------------------------------------------------
  // 8. 合併、建立 mesh
  // ------------------------------------------------------------------------
  const MAT = {
    marble: [M.marble, 'box'], smooth: [M.marbleSmooth, 'box'], tile: [M.roofTileBlue, 'keep'],
    glaze: [M.glazeBlue, 'none'], bracket: [M.bracketPaint, 'box'], soffit: [M.bracketPaintFlat, 'none'],
  };
  for (const [k, list] of Object.entries(B)) {
    if (!list.length) continue;
    const [mat, uvMode] = MAT[k];
    const geoms = list.map(normGeom(uvMode === 'keep'));
    const merged = utils.mergeGeometries(geoms, false);
    if (uvMode === 'box') boxProjectUV(merged);
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = `gate:${k}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    console.warn(`[gate] ${k}: ${merged.attributes.position.count / 3} tris`); // DEBUG
    for (const g of list) g.dispose();
  }

  return group;

  // ------------------------------------------------------------------------
  // 小工具
  // ------------------------------------------------------------------------
  function normGeom(keepUV) {
    return (g) => {
      let n = g.index ? g.toNonIndexed() : g;
      if (!n.attributes.normal) n.computeVertexNormals();
      for (const name of Object.keys(n.attributes)) {
        if (name === 'position' || name === 'normal' || (keepUV && name === 'uv')) continue;
        n.deleteAttribute(name);
      }
      if (keepUV && !n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
      n.morphAttributes = {};
      n.groups = [];
      return n;
    };
  }

  // x 鏡射（正面浮雕 → 背面），並修正三角形繞序
  function mirrorX(g) {
    const m = g.index ? g.toNonIndexed() : g.clone();
    m.scale(-1, 1, 1);
    for (const name of Object.keys(m.attributes)) {
      const at = m.attributes[name], sz = at.itemSize, arr = at.array;
      for (let t = 0; t < at.count; t += 3) {
        for (let c = 0; c < sz; c++) {
          const i1 = (t + 1) * sz + c, i2 = (t + 2) * sz + c;
          const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp;
        }
      }
    }
    return m;
  }

  // 方盒投影 UV（公尺）：沿用既有法線（不重算，保留曲面平滑）
  function boxProjectUV(g) {
    const p = g.attributes.position, n = g.attributes.normal;
    const uvs = new Float32Array(p.count * 2);
    for (let t = 0; t < p.count; t += 3) {
      let nx = 0, ny = 0, nz = 0;
      for (let k = 0; k < 3; k++) { nx += n.getX(t + k); ny += n.getY(t + k); nz += n.getZ(t + k); }
      const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      for (let k = 0; k < 3; k++) {
        const i = t + k, x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let u, v;
        if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
        uvs[i * 2] = u; uvs[i * 2 + 1] = v;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
}

// 鴟吻輪廓的兩個特徵高度（scale = 1）：龍口（咬正脊頂）與最高點（含 bevel）
const CHI_MOUTH = 0.76;
const CHI_TOP = 2.47;
