// 區域：theaters — 兩廳院
//   北＝國家音樂廳：重檐歇山頂（山牆三角面朝東、西，藍底金色雲紋）
//   南＝國家戲劇院：重檐廡殿頂（四坡、正脊東西向）
// 介面：export function build(ctx) → THREE.Object3D
//
// 做法：
//   - 兩棟在「局部座標」建模：x＝沿正脊（東西）、z＝進深方向、+z＝正面（朝廣場）。
//     最後依 L.HALLS2.*.frontFacing 轉向、平移到 center（音樂廳不轉；戲劇院轉 180°）。
//   - 屋面用「高度場」概念：每個點的坡面參數 t（0＝簷口、1＝正脊／內緣）由平面位置推得，
//     t → 中式凹曲線剖面；角落再加起翹（往上）與出翹（往外），四個坡面在戧脊處自然吻合。
//   - 同材質靜態網格全部 merge；柱子、斗栱、欄杆望柱、走獸用 InstancedMesh。
export function build(ctx) {
  const { THREE, L, M, makeRng, uv, utils } = ctx;
  const V3 = THREE.Vector3;
  const H2 = L.HALLS2;

  // ---------------------------------------------------------------------------
  // 量體尺寸（位置全部由 L.HALLS2 推算；以下常數只是局部構件尺寸）
  // ---------------------------------------------------------------------------
  const PT = H2.podium.top;                                // 平臺頂面
  const PX = H2.podium.halfX, PZ = H2.podium.halfZ;
  const BX = H2.building.halfX, BZ = H2.building.halfZ;    // 柱列中心線
  const COL = H2.colonnade;
  const colTop = PT + COL.columnHeight;                    // 柱頂
  const R = H2.roof;
  const lowHx = BX + R.lowerEave.overhang, lowHz = BZ + R.lowerEave.overhang;   // 下簷口
  const upHx = BX - R.upperEave.inset, upHz = BZ - R.upperEave.inset;           // 上簷口
  const UP_OVERHANG = 4.0;                                  // 上簷出簷（上層身牆 → 上簷口）
  const UWx = upHx - UP_OVERHANG, UWz = upHz - UP_OVERHANG; // 上層身（兩簷之間）牆面
  const VERANDA = 4.5;                                      // 迴廊進深（柱列 → 室內牆）
  const IWx = BX - VERANDA, IWz = BZ - VERANDA;
  const THICK = 0.55;                                       // 簷口厚度（瓦＋望板＋椽）
  const lowRise = Math.min(4.0, R.upperEave.y - R.lowerEave.y - 2.4);
  const lowTop = R.lowerEave.y + lowRise;                   // 下簷屋面與上層身交線
  const upRise = R.ridge - R.upperEave.y;                   // R.ridge 視為兩坡交線（正脊瓦件再往上疊）
  const colR = COL.diameter / 2;
  const beamBot = colTop - 1.1, plankTop = colTop + 0.25;   // 額枋、平板枋

  // ---------------------------------------------------------------------------
  // 材質收集：同材質 merge
  // ---------------------------------------------------------------------------
  const buckets = new Map();
  function prep(g) {
    let h = g.index ? g.toNonIndexed() : g;
    if (!h.attributes.normal) h.computeVertexNormals();
    if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
    for (const k of Object.keys(h.attributes)) if (!['position', 'normal', 'uv'].includes(k)) h.deleteAttribute(k);
    return h;
  }
  const addGeom = (mat, g) => {
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(prep(g));
  };

  // 三角形湯（非索引、平面法線）：給脊、牆帶、台階側牆這類自訂形狀
  class Soup {
    constructor() { this.p = []; this.u = []; }
    tri(a, b, c, hint, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
      if (hint) {
        const n = new V3().subVectors(b, a).cross(new V3().subVectors(c, a));
        if (n.dot(hint) < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; }
      }
      this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      this.u.push(...ua, ...ub, ...uc);
    }
    quad(a, b, c, d, hint, ua, ub, uc, ud) { this.tri(a, b, c, hint, ua, ub, uc); this.tri(a, c, d, hint, ua, uc, ud); }
    geom() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      g.computeVertexNormals();
      return g;
    }
    get empty() { return this.p.length === 0; }
  }

  const box = (w, h, d, x, y, z) => uv.boxUV(new THREE.BoxGeometry(w, h, d).translate(x, y, z));

  // 沿折線掃掠一個斷面（脊、博風板）。prof = [[側向, 上向], ...] 凸多邊形
  function sweep(points, prof, soup) {
    const n = points.length;
    const Y = new V3(0, 1, 0);
    const rings = [];
    for (let i = 0; i < n; i++) {
      const T = new V3().subVectors(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)]).normalize();
      let side = new V3().crossVectors(T, Y);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const up = new V3().crossVectors(side, T).normalize();
      rings.push(prof.map(([s, u]) => points[i].clone().addScaledVector(side, s).addScaledVector(up, u)));
    }
    const k = prof.length;
    for (let i = 0; i < n - 1; i++) {
      const mid = points[i].clone().add(points[i + 1]).multiplyScalar(0.5);
      for (let j = 0; j < k; j++) {
        const a = rings[i][j], b = rings[i][(j + 1) % k], c = rings[i + 1][(j + 1) % k], d = rings[i + 1][j];
        const hint = a.clone().add(b).add(c).add(d).multiplyScalar(0.25).sub(mid);
        soup.quad(a, b, c, d, hint);
      }
    }
    for (const [ri, dir] of [[0, -1], [n - 1, 1]]) {
      const T = new V3().subVectors(points[Math.min(n - 1, ri + 1)], points[Math.max(0, ri - 1)]).normalize().multiplyScalar(dir);
      const ring = rings[ri];
      for (let j = 1; j < k - 1; j++) soup.tri(ring[0], ring[j], ring[j + 1], T);
    }
  }
  const ridgeProf = (w, h, base = -0.1) => [[-w / 2, base], [w / 2, base], [w / 2, base + h * 0.62], [w * 0.22, base + h], [-w * 0.22, base + h], [-w / 2, base + h * 0.62]];

  // ---------------------------------------------------------------------------
  // 屋面
  // ---------------------------------------------------------------------------
  const prof = (t) => 0.35 * t + 0.65 * Math.pow(t, 2.4);  // 凹曲線：簷口緩、近脊陡

  function makeRoof(o) {
    // o = { Hx, Hz（簷口半寬）, Rx, Rz（坡面水平跨距）, Y0（簷口高）, rise, type: ring|wudian|xieshan,
    //       tg（歇山：山花底的 t）, lift（起翹）, flare（出翹）, k（起翹範圍）, hl（起翹往上衰減）,
    //       Wx, Wz（簷下牆／柱列線，底面只做到這裡）}
    const r = { ...o };
    if (o.type === 'xieshan') { r.Gx = o.Hx - o.Rx * o.tg; r.Zg = o.Hz - o.Rz * o.tg; r.Yg = o.Y0 + o.rise * prof(o.tg); }
    r.ab = (xp, zp) => [Math.max(0, (o.Hx - Math.abs(xp)) / o.Rx), Math.max(0, (o.Hz - Math.abs(zp)) / o.Rz)];
    r.tOf = (xp, zp) => {
      const [a, b] = r.ab(xp, zp);
      if (o.type === 'xieshan' && b > o.tg && Math.abs(xp) <= r.Gx + 1e-6) return Math.min(b, 1);
      return Math.min(a, b, 1);
    };
    // 平面點（未起翹）→ 屋面頂點
    r.P = (xp, zp, t = r.tOf(xp, zp), out = new V3()) => {
      const [a, b] = r.ab(xp, zp);
      const g = Math.pow(Math.max(0, 1 - Math.max(a, b) / o.k), 2.2);
      const h = Math.pow(Math.max(0, 1 - Math.min(a, b) / o.hl), 2);
      const w = g * h;
      const sx = Math.sign(xp) || 1, sz = Math.sign(zp) || 1;
      return out.set(xp + sx * o.flare * w, o.Y0 + o.rise * prof(t) + o.lift * w, zp + sz * o.flare * w);
    };
    const arc = (run) => {
      const n = 64, tab = [0];
      let s = 0;
      for (let i = 1; i <= n; i++) { s += Math.hypot(run / n, o.rise * (prof(i / n) - prof((i - 1) / n))); tab.push(s); }
      return (t) => { const x = t * n, i = Math.min(n - 1, Math.floor(x)); return tab[i] + (tab[i + 1] - tab[i]) * (x - i); };
    };
    const Sside = arc(o.Rz), Send = arc(o.Rx);
    const X = (t) => (o.type === 'xieshan' ? Math.max(o.Hx - o.Rx * t, r.Gx) : o.Hx - o.Rx * t);
    const Z = (t) => o.Hz - o.Rz * t;
    const endMax = o.type === 'xieshan' ? o.tg : 1;
    r.faces = [
      ...[1, -1].map((sg) => ({ kind: 'side', out: new V3(0, 0, sg), tMax: 1, nu: 56, tWall: (o.Hz - o.Wz) / o.Rz,
        plan: (s, t) => [s * X(t), sg * Z(t)], uvf: (xp, zp, t) => [xp, Sside(t)] })),
      ...[1, -1].map((sg) => ({ kind: 'end', out: new V3(sg, 0, 0), tMax: endMax, nu: 28, tWall: (o.Hx - o.Wx) / o.Rx,
        plan: (s, t) => [sg * (o.Hx - o.Rx * t), s * Z(t)], uvf: (xp, zp, t) => [zp, Send(t)] })),
    ];
    return r;
  }

  function grid(r, F, tl, drop, wantUp) {
    const nu = F.nu, row = nu + 1, pos = [], uvs = [], p = new V3();
    for (const t of tl) for (let i = 0; i <= nu; i++) {
      const [xp, zp] = F.plan(-1 + (2 * i) / nu, t);
      r.P(xp, zp, t, p);
      pos.push(p.x, p.y - drop, p.z);
      uvs.push(...F.uvf(xp, zp, t));
    }
    const idx = [];
    for (let j = 0; j < tl.length - 1; j++) for (let i = 0; i < nu; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    // 檢查繞序（以第一列中間的三角形）
    const k = (nu >> 1) * 6, A = new V3(), B = new V3(), C = new V3();
    A.fromArray(pos, idx[k] * 3); B.fromArray(pos, idx[k + 1] * 3); C.fromArray(pos, idx[k + 2] * 3);
    const ny = B.sub(A).cross(C.sub(A)).y;
    if ((ny > 0) !== wantUp) for (let q = 0; q < idx.length; q += 3) [idx[q + 1], idx[q + 2]] = [idx[q + 2], idx[q + 1]];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (!wantUp) {
      // 簷下底面：法線往外傾（模擬廣場地面反光照亮簷下彩畫，不然整片全黑）
      const n = g.attributes.normal, v = new V3();
      for (let i = 0; i < n.count; i++) {
        v.fromBufferAttribute(n, i).multiplyScalar(0.55).addScaledVector(F.out, 0.85).normalize();
        n.setXYZ(i, v.x, v.y, v.z);
      }
    }
    return g;
  }

  // 屋面三件：瓦面（roofTileGold）、簷下底面（彩畫單色）、簷口封邊（琉璃）
  function roofSurfaces(r, mats, nt = 18) {
    const fascia = new Soup();
    for (const F of r.faces) {
      const ts = new Set();
      for (let j = 0; j <= nt; j++) ts.add(+((F.tMax * j) / nt).toFixed(5));
      const tw = Math.min(F.tWall, F.tMax);
      ts.add(+tw.toFixed(5));
      if (r.type === 'xieshan' && F.kind === 'side') ts.add(+r.tg.toFixed(5));
      const tl = [...ts].sort((a, b) => a - b);
      mats.tile.push(grid(r, F, tl, 0, true));
      const tu = tl.filter((t) => t <= tw + 1e-6);
      mats.under.push(grid(r, F, tu, THICK, false));
      // 簷口封邊
      const p0 = new V3(), p1 = new V3();
      for (let i = 0; i < F.nu; i++) {
        const [x0, z0] = F.plan(-1 + (2 * i) / F.nu, 0), [x1, z1] = F.plan(-1 + (2 * (i + 1)) / F.nu, 0);
        r.P(x0, z0, 0, p0); r.P(x1, z1, 0, p1);
        fascia.quad(p0.clone(), p1.clone(), p1.clone().setY(p1.y - THICK), p0.clone().setY(p0.y - THICK), F.out);
      }
    }
    mats.glaze.push(fascia.geom());
  }

  // 戧脊／角脊：沿四條斜脊，簷角端再往外上翹
  function hipRidges(r, sEnd, w, h, soup, n = 18) {
    const tips = [];
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const s = (sEnd * i) / n;
        pts.push(r.P(sx * (r.Hx - r.Rx * s), sz * (r.Hz - r.Rz * s), s));
      }
      // 翹角端：沿斜脊方向往外延伸並上翹
      const d = new V3().subVectors(pts[0], pts[2]).setY(0).normalize();
      const tip = pts[0].clone().addScaledVector(d, 1.0).add(new V3(0, 0.75, 0));
      const tip2 = pts[0].clone().addScaledVector(d, 1.55).add(new V3(0, 1.45, 0));
      sweep([tip2, tip, ...pts], ridgeProf(w, h), soup);
      tips.push({ sx, sz, pts });
    }
    return tips;
  }

  // ---------------------------------------------------------------------------
  // 程序紋理（本區獨有：室內牆面與高窗、歇山山花）
  // ---------------------------------------------------------------------------
  const WALL_BAYS = 8;
  function makeWallMaterial() {
    const rng = makeRng('theaters/wallTex');
    const PW = 160, H = 512, W = WALL_BAYS * PW;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const c = mk(), e = mk();
    const g = c.getContext('2d'), ge = e.getContext('2d');
    g.fillStyle = '#cdb38c'; g.fillRect(0, 0, W, H);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
    const Y = (v) => H * (1 - v);
    for (let b = 0; b < WALL_BAYS; b++) {
      const x0 = b * PW, ox0 = x0 + PW * 0.17, ox1 = x0 + PW * 0.83;
      // 牆墩上的淺色勒腳與分隔線
      g.fillStyle = '#bba077'; g.fillRect(x0, Y(0.05), PW, H * 0.05);
      // 開口：朱紅框
      g.fillStyle = '#7d1f18'; g.fillRect(ox0, Y(0.9), ox1 - ox0, H * 0.9);
      const lit = rng() < 0.85;
      const glow = lit ? 0.45 + 0.55 * rng() : 0.05;
      const warm = (k) => `rgb(${255 * k | 0},${178 * k | 0},${96 * k | 0})`;
      const pane = (x, y0, y1, w, k) => {
        g.fillStyle = '#2b2520'; g.fillRect(x, Y(y1), w, Y(y0) - Y(y1));
        ge.fillStyle = warm(k); ge.fillRect(x, Y(y1), w, Y(y0) - Y(y1));
      };
      // 下段：三扇玻璃門
      const dw = (ox1 - ox0 - 8) / 3;
      for (let i = 0; i < 3; i++) pane(ox0 + 4 + i * dw + 3, 0.02, 0.4, dw - 6, glow);
      // 中段：橫楣
      g.fillStyle = '#5e1a14'; g.fillRect(ox0, Y(0.47), ox1 - ox0, H * 0.07);
      // 上段：格子高窗（3 × 5）
      const gw = (ox1 - ox0 - 8) / 3, gh = (0.86 - 0.5) / 5;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) {
        pane(ox0 + 4 + i * gw + 3, 0.5 + j * gh + 0.006, 0.5 + (j + 1) * gh - 0.006, gw - 6, glow * (0.7 + 0.3 * rng()));
      }
      // 門扇金色把手線
      g.fillStyle = '#c9a050';
      g.fillRect(ox0, Y(0.905), ox1 - ox0, 3);
    }
    // 牆頂飾帶
    g.fillStyle = '#9c7d55'; g.fillRect(0, 0, W, H * 0.04);
    const tex = (cv, color) => {
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = 8;
      return t;
    };
    return new THREE.MeshStandardMaterial({
      name: 'theaterWall', map: tex(c, true), emissiveMap: tex(e, true), emissive: 0xffffff,
      emissiveIntensity: 0.85, roughness: 0.7,
    });
  }

  // 歇山山花：藍底、金色卷雲紋（程序繪製）。topV(u) = 該 u 處三角形頂緣的 v（0..1）
  function makeGableMaterial(topV) {
    const rng = makeRng('theaters/gableTex');
    const W = 1024, H = 320;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const cy = (u) => H * (1 - topV(u));
    g.fillStyle = '#8e2a1d'; g.fillRect(0, 0, W, H);       // 三角形外（取樣滲色用博風紅）
    const tri = () => {
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, cy(x / W));
      g.lineTo(W, H); g.closePath();
    };
    g.save(); tri(); g.clip();
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a3a8c'); bg.addColorStop(1, '#14307a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // 卷雲（如意雲頭）：三個漩渦＋一條雲尾
    const spiral = (x, y, r, dir, turns = 1.6, a0 = 0) => {
      g.beginPath();
      const n = 48;
      for (let i = 0; i <= n; i++) {
        const a = a0 + dir * (i / n) * turns * Math.PI * 2;
        const rr = r * (1 - (i / n) * 0.82);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    };
    const cloud = (x, y, s, mirror) => {
      const d = mirror ? -1 : 1;
      g.fillStyle = '#2f5cc0';
      for (const [dx, dy, rr] of [[0, -0.35, 0.55], [-0.62, 0.1, 0.42], [0.62, 0.1, 0.42]]) {
        g.beginPath(); g.arc(x + dx * s * d, y + dy * s, rr * s, 0, Math.PI * 2); g.fill();
      }
      for (const [col, lw] of [['#e0b04a', 0.16], ['#f8e7a8', 0.05]]) {
        g.strokeStyle = col; g.lineWidth = Math.max(1.5, s * lw); g.lineCap = 'round';
        spiral(x, y - 0.35 * s, 0.5 * s, d, 1.5, Math.PI);
        spiral(x - 0.62 * s * d, y + 0.1 * s, 0.38 * s, -d, 1.3, 0);
        spiral(x + 0.62 * s * d, y + 0.1 * s, 0.38 * s, d, 1.3, Math.PI);
        // 雲尾
        g.beginPath();
        g.moveTo(x - 0.95 * s * d, y + 0.45 * s);
        g.bezierCurveTo(x - 0.2 * s * d, y + 0.75 * s, x + 0.6 * s * d, y + 0.7 * s, x + 1.5 * s * d, y + 0.35 * s);
        g.stroke();
      }
    };
    const inside = (x, y, m) => y - m > cy(x / W) && y + m < H && x - m > 0 && x + m < W;
    // 中央大雲頭＋兩側對稱小雲（左右鏡射）
    // 先畫細金色流雲線（底紋），再疊雲頭
    g.strokeStyle = 'rgba(224,176,74,0.55)'; g.lineWidth = 3;
    for (let k = 0; k < 7; k++) {
      const y0 = H * (0.3 + k * 0.1);
      g.beginPath(); g.moveTo(0, y0);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 + Math.sin(x / 38 + k * 1.7) * H * 0.025 * (1 - Math.abs(x / W - 0.5)));
      g.stroke();
    }
    cloud(W / 2, H * 0.6, H * 0.22, false);
    const rows = [[0.88, 0.1], [0.7, 0.1], [0.52, 0.095], [0.36, 0.085]];
    for (const [ry, rs] of rows) {
      const s = H * rs;
      const start = ry > 0.8 ? s * 1.5 : s * 3.2;
      for (let dx = start; dx < W / 2; dx += s * 2.6) {
        const y = H * ry + (rng() - 0.5) * s * 0.4;
        if (!inside(W / 2 + dx, y, s * 1.2)) continue;
        cloud(W / 2 + dx, y, s, false);
        cloud(W / 2 - dx, y, s, true);
      }
    }
    // 散點金星
    g.fillStyle = '#d9a843';
    for (let i = 0; i < 60; i++) {
      const x = W / 2 + rng() * W / 2, y = rng() * H;
      if (!inside(x, y, 6)) continue;
      for (const xx of [x, W - x]) { g.beginPath(); g.arc(xx, y, 2.5, 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
    // 邊框：金＋白＋金
    g.save(); tri(); g.clip();
    for (const [col, lw] of [['#d9a843', 26], ['#f2ead2', 14], ['#d9a843', 6]]) { g.strokeStyle = col; g.lineWidth = lw; tri(); g.stroke(); }
    g.restore();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ name: 'gablePanel', map: t, roughness: 0.55 });
  }

  // ---------------------------------------------------------------------------
  // 共用幾何（單位件，給 InstancedMesh）
  // ---------------------------------------------------------------------------
  const cyl = (rt, rb, h, seg, y0) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, true).translate(0, y0 + h / 2, 0);
    const a = g.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * Math.PI * (rt + rb), y0 + a.getY(i) * h);
    return g;
  };
  const shaftH = beamBot - 0.15 - (PT + 0.45);
  const geoShaft = cyl(colR * 0.95, colR, shaftH, 20, PT + 0.45);
  const geoHead = cyl(colR * 0.95, colR * 0.95, colTop - (PT + 0.45 + shaftH), 20, PT + 0.45 + shaftH);
  const geoPlinth = utils.mergeGeometries([
    prep(cyl(colR * 1.25, colR * 1.4, 0.45, 20, PT)),
    prep(box(colR * 3.2, 0.12, colR * 3.2, 0, PT + 0.06, 0)),
  ]);

  // 斗栱單元：局部 x＝沿牆、z＝往外、y＝上；總高 1（實例時縮放 y）
  const geoBracket = (() => {
    const parts = [
      box(0.55, 0.26, 0.55, 0, 0.13, 0.05),          // 坐斗
      box(1.5, 0.2, 0.26, 0, 0.36, 0.05),            // 泥道栱
      box(0.26, 0.2, 1.25, 0, 0.36, 0.45),           // 華栱（第一跳）
      box(0.32, 0.16, 0.32, -0.62, 0.54, 0.05), box(0.32, 0.16, 0.32, 0.62, 0.54, 0.05),
      box(0.32, 0.16, 0.32, 0, 0.54, 0.95),          // 散斗
      box(2.0, 0.2, 0.26, 0, 0.72, 0.05),            // 慢栱
      box(1.3, 0.2, 0.26, 0, 0.72, 0.95),            // 瓜栱
      box(0.26, 0.22, 1.9, 0, 0.73, 0.8),            // 第二跳（耍頭）
      box(2.3, 0.18, 0.3, 0, 0.91, 1.55),            // 挑簷枋
      box(2.3, 0.18, 0.3, 0, 0.91, 0.05),            // 正心枋
    ];
    return utils.mergeGeometries(parts.map(prep));
  })();

  // 欄杆望柱
  const geoPost = utils.mergeGeometries([
    prep(box(0.24, 1.0, 0.24, 0, 0.5, 0)),
    prep(uv.boxUV(new THREE.CylinderGeometry(0.08, 0.14, 0.28, 8).translate(0, 1.14, 0))),
    prep(uv.boxUV(new THREE.SphereGeometry(0.09, 8, 6).translate(0, 1.3, 0))),
  ]);

  // 走獸（簡化：底座＋身＋頭），局部 +z＝朝簷角外
  const geoBeast = utils.mergeGeometries([
    prep(box(0.22, 0.06, 0.42, 0, 0.03, 0)),                                                     // 底座
    prep(new THREE.SphereGeometry(0.15, 8, 6).scale(0.8, 1.0, 1.25).translate(0, 0.2, -0.04)),   // 蹲坐的身
    prep(new THREE.SphereGeometry(0.1, 8, 6).scale(0.9, 1.0, 1.1).translate(0, 0.42, 0.06)),     // 頭（朝外）
    prep(new THREE.ConeGeometry(0.035, 0.12, 5).translate(0, 0.55, 0.03)),                       // 角／冠
  ]);

  // 鴟吻：側面輪廓擠出（x＝往脊外、y＝上）
  const geoChiwen = (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.6, 0);
    s.lineTo(1.25, 0);
    s.lineTo(1.25, 1.1);
    s.quadraticCurveTo(1.75, 2.1, 1.35, 3.0);   // 外緣往上
    s.quadraticCurveTo(1.0, 3.75, 0.35, 3.35);   // 尾部向內捲
    s.quadraticCurveTo(-0.05, 3.0, 0.3, 2.65);
    s.quadraticCurveTo(0.6, 2.45, 0.75, 2.75);   // 小漩渦
    s.quadraticCurveTo(0.8, 2.25, 0.45, 2.0);
    s.lineTo(0.1, 1.55);                          // 背鰭
    s.lineTo(-0.15, 1.35);
    s.quadraticCurveTo(-0.6, 1.1, -0.85, 0.75);   // 吻口咬脊
    s.lineTo(-0.35, 0.55);
    s.lineTo(-0.6, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 1, curveSegments: 6 });
    g.translate(0, 0, -0.35);
    return g;
  })();

  // 實例矩陣收集
  const inst = { shaft: [], head: [], plinth: [], bracket: [], post: [], beast: [] };
  const mtx = (pos, yaw = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(
    pos, new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), yaw), new V3(sx, sy, sz));

  // 沿矩形周邊排斗栱。heightAt(x,z) = 該處簷下底面高度
  function bracketsAround(hx, hz, nx, nz, perBay, yBot, heightAt, out, scaleXZ = 1) {
    const add = (x, z, yaw) => {
      const h = Math.max(0.6, heightAt(x, z) - yBot + 0.05);
      out.push(mtx(new V3(x, yBot, z), yaw, scaleXZ, h, scaleXZ));
    };
    for (const sg of [1, -1]) {
      const n = nx * perBay;
      for (let i = 1; i < n; i++) add(-hx + (2 * hx * i) / n, sg * hz, sg > 0 ? 0 : Math.PI);
      const m = nz * perBay;
      for (let j = 1; j < m; j++) add(sg * hx, -hz + (2 * hz * j) / m, sg * Math.PI / 2);
    }
    for (const sx of [1, -1]) for (const sz of [1, -1]) add(sx * hx, sz * hz, Math.atan2(sx, sz));
  }

  // 矩形一圈的垂直牆帶（朝外）。yb、yt 可為函式 (x,z)
  function bandAround(hx, hz, yb, yt, soup, step = 2.0) {
    const fy = (f, x, z) => (typeof f === 'function' ? f(x, z) : f);
    const corners = [[-hx, hz], [hx, hz], [hx, -hz], [-hx, -hz], [-hx, hz]];
    let along = 0;
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = corners[k], [x1, z1] = corners[k + 1];
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / step));
      const outN = new V3(z1 - z0, 0, -(x1 - x0)).normalize();
      // 讓法線朝外：外向＝離中心
      if (outN.x * (x0 + x1) + outN.z * (z0 + z1) < 0) outN.negate();
      for (let i = 0; i < n; i++) {
        const xa = x0 + ((x1 - x0) * i) / n, za = z0 + ((z1 - z0) * i) / n;
        const xb = x0 + ((x1 - x0) * (i + 1)) / n, zb = z0 + ((z1 - z0) * (i + 1)) / n;
        const ua = along + (len * i) / n, ub = along + (len * (i + 1)) / n;
        const yba = fy(yb, xa, za), ybb = fy(yb, xb, zb), yta = fy(yt, xa, za), ytb = fy(yt, xb, zb);
        soup.quad(new V3(xa, yba, za), new V3(xb, ybb, zb), new V3(xb, ytb, zb), new V3(xa, yta, za), outN,
          [ua, yba], [ub, ybb], [ub, ytb], [ua, yta]);
      }
      along += len;
    }
  }

  // ---------------------------------------------------------------------------
  // 單棟建模（局部座標）→ 依 frontFacing 轉向後收進 buckets / inst
  // ---------------------------------------------------------------------------
  const wallMat = makeWallMaterial();
  let gableMat = null;
  const yawOf = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };
  const nx = Math.max(1, Math.round((2 * BX) / COL.spacing));   // 長邊開間數
  const nz = Math.max(1, Math.round((2 * BZ) / COL.spacing));   // 短邊開間數

  function buildHall(spec) {
    const W = mtx(new V3(spec.center.x, 0, spec.center.z), yawOf[spec.frontFacing] ?? 0);
    const local = new Map();   // material → geoms（局部）
    const put = (mat, g) => { if (!local.has(mat)) local.set(mat, []); local.get(mat).push(g); };
    const S = { marble: new Soup(), grey: new Soup(), smooth: new Soup(), glaze: new Soup(), red: new Soup(),
      paint: new Soup(), flat: new Soup(), wall: new Soup(), gable: new Soup() };
    const linst = { shaft: [], head: [], plinth: [], bracket: [], post: [], beast: [] };

    // ---- 平臺 ----
    const pb = -0.3;
    bandAround(PX, PZ, pb, PT, S.marble, 4.8);
    S.grey.quad(new V3(-PX, PT, -PZ), new V3(PX, PT, -PZ), new V3(PX, PT, PZ), new V3(-PX, PT, PZ), new V3(0, 1, 0),
      [-PX, -PZ], [PX, -PZ], [PX, PZ], [-PX, PZ]);
    // 平臺頂緣壓條
    bandAround(PX + 0.12, PZ + 0.12, PT - 0.35, PT + 0.02, S.smooth, 8);
    S.smooth.quad(new V3(-PX - 0.12, PT + 0.02, -PZ - 0.12), new V3(PX + 0.12, PT + 0.02, -PZ - 0.12),
      new V3(PX + 0.12, PT + 0.02, -PZ), new V3(-PX - 0.12, PT + 0.02, -PZ), new V3(0, 1, 0));

    // ---- 正面大台階（朝 +z）----
    const st = H2.frontStairs, SW = st.halfWidth, run = st.run;
    const N = Math.max(4, Math.round(PT / 0.16)), riser = PT / N, tread = run / (N - 1);
    for (let i = 0; i < N - 1; i++) {
      const zf = PZ + tread * (N - 1 - i), yt = (i + 1) * riser;
      put(M.marbleGrey, box(2 * SW, yt - pb, zf - PZ + 0.2, 0, (yt + pb) / 2, (zf + PZ - 0.2) / 2));
    }
    // 垂帶（台階兩側斜牆）＋斜欄杆
    const CW = 1.3;
    for (const sx of [1, -1]) {
      const xi = sx * SW, xo = sx * (SW + CW);
      const zTop = PZ, zBot = PZ + run + 0.4, yTop = PT + 0.15, yBot = 0.2;
      const a = new V3(xi, pb, zTop), b = new V3(xo, pb, zTop), c = new V3(xo, pb, zBot), d = new V3(xi, pb, zBot);
      const at = new V3(xi, yTop, zTop), bt = new V3(xo, yTop, zTop), ct = new V3(xo, yBot, zBot), dt = new V3(xi, yBot, zBot);
      S.marble.quad(at, bt, ct, dt, new V3(0, 1, 0.3), [xi, 0], [xo, 0], [xo, run], [xi, run]);
      S.marble.quad(b, c, ct, bt, new V3(sx, 0, 0), [zTop, pb], [zBot, pb], [zBot, yBot], [zTop, yTop]);
      S.marble.quad(a, d, dt, at, new V3(-sx, 0, 0), [zTop, pb], [zBot, pb], [zBot, yBot], [zTop, yTop]);
      S.marble.quad(d, c, ct, dt, new V3(0, 0, 1), [xi, pb], [xo, pb], [xo, yBot], [xi, yBot]);
      // 斜欄杆
      const xm = sx * (SW + CW / 2), np = 5;
      for (let k = 0; k <= np; k++) {
        const z = zTop + 0.3 + ((zBot - zTop - 0.6) * k) / np;
        const y = yTop + ((yBot - yTop) * (z - zTop)) / (zBot - zTop);
        linst.post.push(mtx(new V3(xm, y, z)));
      }
      const r0 = new V3(xm, yTop + 0.95, zTop + 0.3), r1 = new V3(xm, yBot + 0.95, zBot - 0.3);
      sweep([r0, r1], [[-0.1, -0.08], [0.1, -0.08], [0.1, 0.08], [-0.1, 0.08]], S.smooth);
      const q0 = new V3(xm, yTop + 0.12, zTop + 0.3), q1 = new V3(xm, yBot + 0.12, zBot - 0.3);
      sweep([q0, q1], [[-0.06, 0], [0.06, 0], [0.06, 0.62], [-0.06, 0.62]], S.smooth);
    }

    // ---- 平臺欄杆（正面台階處留開口）----
    const bx = PX - 0.4, bz = PZ - 0.4, gap = SW + CW;
    const railSeg = (x0, z0, x1, z1) => {
      const a = new V3(x0, PT, z0), b = new V3(x1, PT, z1);
      sweep([a.clone().setY(PT + 0.95), b.clone().setY(PT + 0.95)], [[-0.11, 0], [0.11, 0], [0.11, 0.12], [-0.11, 0.12]], S.smooth);
      sweep([a, b], [[-0.05, 0.0], [0.05, 0.0], [0.05, 0.75], [-0.05, 0.75]], S.smooth);
      sweep([a, b], [[-0.16, 0.0], [0.16, 0.0], [0.16, 0.16], [-0.16, 0.16]], S.smooth);
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 2.2));
      for (let i = 0; i <= n; i++) linst.post.push(mtx(new V3(x0 + ((x1 - x0) * i) / n, PT, z0 + ((z1 - z0) * i) / n)));
    };
    railSeg(-bx, -bz, bx, -bz);
    railSeg(bx, -bz, bx, bz);
    railSeg(-bx, -bz, -bx, bz);
    railSeg(-bx, bz, -gap, bz);
    railSeg(gap, bz, bx, bz);

    // ---- 室內牆（柱廊後方）：暖色牆＋玻璃門＋格子高窗（自發光）----
    {
      const sides = [
        { a: new V3(-IWx, 0, IWz), b: new V3(IWx, 0, IWz), n: new V3(0, 0, 1), bay: (2 * BX) / nx, off: 0 },
        { a: new V3(IWx, 0, -IWz), b: new V3(-IWx, 0, -IWz), n: new V3(0, 0, -1), bay: (2 * BX) / nx, off: 3 },
        { a: new V3(IWx, 0, IWz), b: new V3(IWx, 0, -IWz), n: new V3(1, 0, 0), bay: (2 * BZ) / nz, off: 5 },
        { a: new V3(-IWx, 0, -IWz), b: new V3(-IWx, 0, IWz), n: new V3(-1, 0, 0), bay: (2 * BZ) / nz, off: 1 },
      ];
      for (const sd of sides) {
        const len = sd.a.distanceTo(sd.b);
        // 讓窗洞落在柱間：u 原點對齊柱位
        const colStart = (len - 2 * (sd.n.x ? BZ : BX)) / 2;
        const u0 = (sd.off - colStart / sd.bay) / WALL_BAYS, u1 = u0 + len / sd.bay / WALL_BAYS;
        const yb = PT, yt = colTop;
        const v0 = 0, v1 = 1;
        S.wall.quad(sd.a.clone().setY(yb), sd.b.clone().setY(yb), sd.b.clone().setY(yt), sd.a.clone().setY(yt), sd.n,
          [u0, v0], [u1, v0], [u1, v1], [u0, v1]);
      }
    }
    // 迴廊天花（朝下）
    {
      const y = beamBot + 0.05;
      const rings = [[-IWx, -IWz, -BX, -BZ], [IWx, -IWz, BX, -BZ], [IWx, IWz, BX, BZ], [-IWx, IWz, -BX, BZ]];
      for (let k = 0; k < 4; k++) {
        const [ax, az, Ax, Az] = rings[k], [bx2, bz2, Bx, Bz] = rings[(k + 1) % 4];
        S.flat.quad(new V3(ax, y, az), new V3(bx2, y, bz2), new V3(Bx, y, Bz), new V3(Ax, y, Az), new V3(0, -1, 0));
      }
    }

    // ---- 柱列 ----
    const colPos = [];
    for (let i = 0; i <= nx; i++) for (const sz of [1, -1]) colPos.push([-BX + (2 * BX * i) / nx, sz * BZ]);
    for (let j = 1; j < nz; j++) for (const sx of [1, -1]) colPos.push([sx * BX, -BZ + (2 * BZ * j) / nz]);
    for (const [x, z] of colPos) {
      const m = mtx(new V3(x, 0, z));
      linst.shaft.push(m); linst.head.push(m); linst.plinth.push(m);
    }
    // 額枋＋平板枋（彩畫）、柱頭間雀替（簡化）
    for (const sg of [1, -1]) {
      put(M.bracketPaint, box(2 * BX + 1.2, colTop - beamBot, 0.62, 0, (beamBot + colTop) / 2, sg * BZ));
      put(M.bracketPaint, box(0.62, colTop - beamBot, 2 * BZ + 1.2, sg * BX, (beamBot + colTop) / 2, 0));
      put(M.bracketPaint, box(2 * BX + 1.8, plankTop - colTop, 0.95, 0, (colTop + plankTop) / 2, sg * BZ));
      put(M.bracketPaint, box(0.95, plankTop - colTop, 2 * BZ + 1.8, sg * BX, (colTop + plankTop) / 2, 0));
    }
    // 雀替：柱頭兩側的三角托（woodRed＋金邊用 bracketPaint 簡化成彩畫）
    for (const [x, z] of colPos) {
      const alongX = Math.abs(Math.abs(z) - BZ) < 1e-6;
      for (const d of [1, -1]) {
        if (alongX && Math.abs(x + d * 1.2) > BX + 0.1) continue;
        if (!alongX && Math.abs(z + d * 1.2) > BZ + 0.1) continue;
        const ax = alongX ? new V3(d, 0, 0) : new V3(0, 0, d);
        const side = alongX ? new V3(0, 0, 1) : new V3(1, 0, 0);
        const base = new V3(x, beamBot, z).addScaledVector(ax, colR * 0.9);
        const p0 = base.clone(), p1 = base.clone().addScaledVector(ax, 1.5), p2 = base.clone().add(new V3(0, -0.9, 0));
        for (const o of [0.14, -0.14]) {
          const q0 = p0.clone().addScaledVector(side, o), q1 = p1.clone().addScaledVector(side, o), q2 = p2.clone().addScaledVector(side, o);
          S.paint.tri(q0, q1, q2, side.clone().multiplyScalar(Math.sign(o)), [0, 0], [1.5, 0], [0, -0.9]);
        }
        const s0 = p1.clone().addScaledVector(side, 0.14), s1 = p1.clone().addScaledVector(side, -0.14);
        const s2 = p2.clone().addScaledVector(side, -0.14), s3 = p2.clone().addScaledVector(side, 0.14);
        S.paint.quad(s0, s1, s2, s3, ax.clone().add(new V3(0, -1, 0)));
      }
    }

    // ---- 下簷（腰簷，四坡環形）----
    const lower = makeRoof({ Hx: lowHx, Hz: lowHz, Rx: lowHx - UWx, Rz: lowHz - UWz, Y0: R.lowerEave.y, rise: lowRise,
      type: 'ring', lift: 1.15, flare: 0.9, k: 0.9, hl: 0.45, Wx: BX, Wz: BZ });
    const rm = { tile: [], under: [], glaze: [] };
    roofSurfaces(lower, rm, 14);
    const lowerUnder = (x, z) => lower.P(x, z).y - THICK;
    // 斗栱背板（柱列線上，平板枋頂 → 簷下底面）
    bandAround(BX - 0.25, BZ - 0.25, plankTop - 0.02, (x, z) => lowerUnder(x, z) + 0.05, S.flat, 2.0);
    bracketsAround(BX, BZ, nx, nz, 3, plankTop, lowerUnder, linst.bracket, 1.0);
    // 角脊
    const lowTips = hipRidges(lower, 1, 0.55, 0.6, S.glaze);
    // 圍脊（下簷頂與上層身交線）
    bandAround(UWx + 0.42, UWz + 0.42, lowTop - 0.2, lowTop + 0.55, S.glaze, 4);
    S.glaze.quad(new V3(-UWx - 0.42, lowTop + 0.55, -UWz - 0.42), new V3(UWx + 0.42, lowTop + 0.55, -UWz - 0.42),
      new V3(UWx + 0.42, lowTop + 0.55, UWz + 0.42), new V3(-UWx - 0.42, lowTop + 0.55, UWz + 0.42), new V3(0, 1, 0));

    // ---- 上層身（兩簷之間）：紅牆＋彩畫額枋＋斗栱 ----
    const upper = spec.roofType === 'xieshan'
      ? makeRoof({ Hx: upHx, Hz: upHz, Rx: upHz, Rz: upHz, Y0: R.upperEave.y, rise: upRise, type: 'xieshan', tg: 0.25,
        lift: 1.5, flare: 1.1, k: 0.9, hl: 0.45, Wx: UWx, Wz: UWz })
      : makeRoof({ Hx: upHx, Hz: upHz, Rx: upHz * 0.8, Rz: upHz, Y0: R.upperEave.y, rise: upRise, type: 'wudian',
        lift: 1.5, flare: 1.1, k: 0.9, hl: 0.45, Wx: UWx, Wz: UWz });
    roofSurfaces(upper, rm, 20);
    const upperUnder = (x, z) => upper.P(x, z).y - THICK;
    const ubRed0 = lowTop - 0.3, ubBeam0 = lowTop + 0.75, ubBeam1 = lowTop + 1.35;
    bandAround(UWx, UWz, ubRed0, ubBeam0, S.red, 3);
    bandAround(UWx + 0.15, UWz + 0.15, ubBeam0, ubBeam1, S.paint, 2);
    S.paint.quad(new V3(-UWx - 0.15, ubBeam1, -UWz - 0.15), new V3(UWx + 0.15, ubBeam1, -UWz - 0.15),
      new V3(UWx + 0.15, ubBeam1, UWz + 0.15), new V3(-UWx - 0.15, ubBeam1, UWz + 0.15), new V3(0, 1, 0));
    bandAround(UWx - 0.1, UWz - 0.1, ubBeam1 - 0.05, (x, z) => upperUnder(x, z) + 0.05, S.flat, 2.0);
    const upNx = Math.max(1, Math.round((2 * UWx) / COL.spacing)), upNz = Math.max(1, Math.round((2 * UWz) / COL.spacing));
    bracketsAround(UWx + 0.1, UWz + 0.1, upNx, upNz, 3, ubBeam1, upperUnder, linst.bracket, 0.9);

    // ---- 上簷屋脊 ----
    const ridgeY = upper.Y0 + upper.rise;
    const RIDGE_W = 1.1, RIDGE_H = 1.45;
    let ridgeHalf;
    if (upper.type === 'wudian') {
      ridgeHalf = upper.Hx - upper.Rx;
      const tips = hipRidges(upper, 1, 0.7, 0.8, S.glaze, 22);
      lowTips.push(...tips.map((t) => ({ ...t, upper: true })));
    } else {
      ridgeHalf = upper.Gx + 0.3;
      const tips = hipRidges(upper, upper.tg, 0.7, 0.8, S.glaze, 10);
      lowTips.push(...tips.map((t) => ({ ...t, upper: true })));
      // 垂脊（沿山花兩側斜邊）、博風板、博脊、山花板
      const zs = [];
      for (let i = 0; i <= 24; i++) zs.push(-upper.Zg + (2 * upper.Zg * i) / 24);
      const yAt = (x, z) => upper.P(x, z, Math.min(1, (upper.Hz - Math.abs(z)) / upper.Rz)).y;
      for (const sx of [1, -1]) {
        // 垂脊：兩半，從正脊往下到山花底
        for (const half of [1, -1]) {
          const pts = [];
          for (let i = 0; i <= 12; i++) {
            const z = half * (upper.Zg * i) / 12;
            pts.push(new V3(sx * (upper.Gx - 0.3), yAt(sx * (upper.Gx - 0.3), z), z));
          }
          const last = pts[pts.length - 1];
          pts.push(last.clone().add(new V3(0, -0.35, half * 0.8)));
          sweep(pts, ridgeProf(0.62, 0.72), S.glaze);
        }
        // 博風板（紅）：貼在坡面端緣之下
        const bp = zs.map((z) => new V3(sx * (upper.Gx - 0.12), yAt(sx * upper.Gx, z) - 0.06, z));
        sweep(bp, [[-0.16, -1.05], [0.16, -1.05], [0.16, 0], [-0.16, 0]], S.red);
        // 博風板外緣金邊
        const bp2 = zs.map((z) => new V3(sx * (upper.Gx + 0.06), yAt(sx * upper.Gx, z) - 0.06, z));
        sweep(bp2, [[-0.04, -1.1], [0.04, -1.1], [0.04, -0.85], [-0.04, -0.85]], S.glaze);
        // 博脊
        const yg = upper.Yg;
        put(M.glazeGold, box(0.85, 0.75, 2 * upper.Zg + 0.6, sx * (upper.Gx - 0.6), yg + 0.18, 0));
        // 山花板（藍底金雲紋）
        const xg = sx * (upper.Gx - 0.75), yb = yg - 0.25;
        const Ht = ridgeY - yb;
        for (let i = 0; i < zs.length - 1; i++) {
          const za = zs[i], zb = zs[i + 1];
          const ya = Math.max(yb, yAt(xg, za) - 0.15), ybb = Math.max(yb, yAt(xg, zb) - 0.15);
          const ua = (za + upper.Zg) / (2 * upper.Zg), ub = (zb + upper.Zg) / (2 * upper.Zg);
          S.gable.quad(new V3(xg, yb, za), new V3(xg, yb, zb), new V3(xg, ybb, zb), new V3(xg, ya, za), new V3(sx, 0, 0),
            [ua, 0], [ub, 0], [ub, (ybb - yb) / Ht], [ua, (ya - yb) / Ht]);
        }
        if (!gableMat) {
          gableMat = makeGableMaterial((u) => {
            const z = -upper.Zg + 2 * upper.Zg * u;
            return Math.max(0, (yAt(xg, z) - 0.15 - yb) / Ht);
          });
        }
      }
    }
    // 正脊
    sweep([new V3(-ridgeHalf, ridgeY, 0), new V3(ridgeHalf, ridgeY, 0)], ridgeProf(RIDGE_W, RIDGE_H, -0.35), S.glaze);
    // 鴟吻
    for (const sx of [1, -1]) {
      const g = geoChiwen.clone().scale(1.05, 1.05, 1.05);
      g.applyMatrix4(mtx(new V3(sx * (ridgeHalf - 0.75), ridgeY - 0.35, 0), sx > 0 ? 0 : Math.PI));
      put(M.glazeGold, g);
    }
    // 走獸：每條戧脊／角脊靠簷角端一列
    for (const t of lowTips) {
      const n = t.upper ? 5 : 4, sc = t.upper ? 1.15 : 0.95;
      for (let i = 0; i < n; i++) {
        const idx = Math.min(t.pts.length - 2, 1 + i);
        const p = t.pts[idx], q = t.pts[idx - 1];
        const yaw = Math.atan2(q.x - p.x, q.z - p.z);
        linst.beast.push(mtx(p.clone().add(new V3(0, 0.5, 0)), yaw, sc, sc, sc));
      }
    }

    // ---- 收進 buckets（套用世界轉換）----
    for (const g of rm.tile) put(M.roofTileGold, g);
    for (const g of rm.under) put(M.bracketPaintFlat, g);
    for (const g of rm.glaze) put(M.glazeGold, g);
    const soupMat = { marble: M.marble, grey: M.marbleGrey, smooth: M.marbleSmooth, glaze: M.glazeGold, red: M.woodRed,
      paint: M.bracketPaint, flat: M.bracketPaintFlat, wall: wallMat, gable: gableMat };
    for (const [k, s] of Object.entries(S)) if (!s.empty) put(soupMat[k], s.geom());
    for (const [mat, gs] of local) for (const g of gs) { g.applyMatrix4(W); addGeom(mat, g); }
    for (const k of Object.keys(inst)) for (const m of linst[k]) inst[k].push(new THREE.Matrix4().multiplyMatrices(W, m));
  }

  buildHall(H2.concertHall);
  buildHall(H2.theater);

  // ---------------------------------------------------------------------------
  // 組合輸出
  // ---------------------------------------------------------------------------
  const group = new THREE.Group();
  group.name = 'theaters';
  for (const [mat, gs] of buckets) {
    const mesh = new THREE.Mesh(utils.mergeGeometries(gs), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = `theaters:${mat.name}`;
    group.add(mesh);
  }
  const instDefs = [
    ['shaft', geoShaft, M.woodRed], ['head', geoHead, M.bracketPaint], ['plinth', geoPlinth, M.marbleSmooth],
    ['bracket', geoBracket, M.bracketPaint], ['post', geoPost, M.marbleSmooth], ['beast', geoBeast, M.glazeGold],
  ];
  for (const [k, g, mat] of instDefs) {
    const list = inst[k];
    if (!list.length) continue;
    const im = new THREE.InstancedMesh(prep(g), mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = true; im.receiveShadow = true;
    im.name = `theaters:${k}`;
    group.add(im);
  }
  return group;
}
