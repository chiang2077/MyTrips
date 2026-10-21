// 區域：gardens（庭園）
// 內容：民主大道兩側四塊幾何花壇（綠籬渦卷紋＋紫紅葉帶＋黃／紅／粉花帶）、
//       光華池／雲漢池（池岸草坡、不規則水面、池底、岸石、睡蓮）、假山＋瀑布、半圓拱橋、
//       中式庭園步道／踏石／杜鵑灌木團／景石、主殿三面灌木帶、階梯兩側草坪綠籬帶。
// 介面：export function build(ctx) → THREE.Object3D
//   ctx = { THREE, L(layout), geo, M(materials), makeRng, makeNoise2D, uv, makePlaqueTexture, utils, quality }
//
// 座標一律由 L.* 推算；本檔只寫局部尺寸（綠籬寬、花帶寬、欄杆間距…）。
// 本區自製材質（不屬於共用五類）：瀑布水簾 fallMat、水花泡沫 foamMat（白色微發光、半透明）。

export function build(ctx) {
  const { THREE, L, M, makeRng, makeNoise2D, utils } = ctx;
  const { mergeGeometries, mergeVertices } = utils;
  const LV = L.LEVELS, G = L.GARDENS;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const angDist = (a, b) => { let d = (a - b) % TAU; if (d < 0) d += TAU; return d > PI ? TAU - d : d; };
  const V3 = THREE.Vector3;

  const group = new THREE.Group();
  group.name = 'gardens';

  // ==========================================================================
  // 本區自製材質：瀑布水簾、水花
  // ==========================================================================
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }
  const fallTex = canvasTex(128, 256, (g, w, h) => {
    const r = makeRng('gardens/tex/fall');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { // 垂直水絲
      const x = r() * w, a = 0.25 + r() * 0.75, lw = 1 + r() * 4;
      const y0 = r() * h * 0.4, y1 = h * (0.6 + r() * 0.4);
      const grd = g.createLinearGradient(0, y0, 0, y1);
      grd.addColorStop(0, `rgba(255,255,255,0)`); grd.addColorStop(0.2, `rgba(255,255,255,${a})`);
      grd.addColorStop(0.85, `rgba(255,255,255,${a * 0.9})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(x, y0, lw, y1 - y0);
    }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, w, h);
  });
  const foamTex = canvasTex(128, 128, (g, w, h) => {
    const r = makeRng('gardens/tex/foam');
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.5})`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 7, 0, TAU); g.fill(); }
  });
  const fallMat = new THREE.MeshStandardMaterial({
    name: 'gardens/waterfall', color: 0xf2f5f7, emissive: 0xd8e2ea, emissiveIntensity: 0.28, roughness: 0.35,
    alphaMap: fallTex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const foamMat = new THREE.MeshStandardMaterial({
    name: 'gardens/foam', color: 0xffffff, emissive: 0xe4ecf0, emissiveIntensity: 0.22, roughness: 0.9,
    alphaMap: foamTex, transparent: true, depthWrite: false,
  });
  const splashMat = new THREE.MeshStandardMaterial({
    name: 'gardens/splash', color: 0xffffff, emissive: 0xe4ecf0, emissiveIntensity: 0.25, roughness: 0.8,
    transparent: true, opacity: 0.55, depthWrite: false,
  });

  // ==========================================================================
  // 網格桶：同材質合併成一個 mesh
  // ==========================================================================
  const DEF = {
    grass: { mat: M.grass, uv: 'planar' },
    soil: { mat: M.soil },
    paving: { mat: M.paving, uv: 'planar' },
    hedge: { mat: M.hedgeVC, cast: true, color: true },
    maroon: { mat: M.flowerMaroon, cast: true },
    yellow: { mat: M.flowerYellow, cast: true },
    red: { mat: M.flowerRed, cast: true },
    pink: { mat: M.flowerPink, cast: true },
    stone: { mat: M.stone, cast: true, uv: 'box' },
    marble: { mat: M.marble, cast: true, uv: 'box' },
    marbleSmooth: { mat: M.marbleSmooth, cast: true, uv: 'box' },
    marbleGrey: { mat: M.marbleGrey, cast: true, uv: 'box' },
    water: { mat: M.water },
    fall: { mat: fallMat, uv: 'keep' },
    foam: { mat: foamMat, uv: 'keep' },
  };
  const buckets = new Map();
  const add = (key, g) => { if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(g); };

  // 方盒投影 UV（保留原法線；每個三角形用面法線選投影面）
  function boxUVKeep(g) {
    const p = g.attributes.position, uvs = new Float32Array(p.count * 2);
    const a = new V3(), b = new V3(), c = new V3();
    for (let t = 0; t < p.count; t += 3) {
      a.fromBufferAttribute(p, t); b.fromBufferAttribute(p, t + 1); c.fromBufferAttribute(p, t + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      for (let k = 0; k < 3; k++) {
        const i = t + k, x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let u, v;
        if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
        uvs[i * 2] = u; uvs[i * 2 + 1] = v;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }

  const hedgeColNoise = makeNoise2D('gardens/hedgeColor');
  function hedgeColors(g) {
    const p = g.attributes.position, n = g.attributes.normal, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const f = hedgeColNoise.fbm(x * 0.3, z * 0.3, 3);
      const fine = hedgeColNoise(x * 4.1 + y * 3.3, z * 4.1 - y * 2.7);
      let k = 0.74 + 0.42 * f + 0.16 * (fine - 0.5);
      k *= 1 + 0.16 * Math.max(0, n.getY(i));          // 頂面新葉較亮
      col[i * 3] = k * (1.0 + 0.12 * (f - 0.5)); col[i * 3 + 1] = k * 1.03; col[i * 3 + 2] = k * 0.88;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  function finalizeBuckets() {
    for (const [key, list] of buckets) {
      const def = DEF[key];
      const prepared = list.map((g0) => {
        let g = g0.index ? g0.toNonIndexed() : g0;
        if (!g.attributes.normal) g.computeVertexNormals();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        if (def.uv === 'planar') {
          const p = g.attributes.position, uvs = new Float32Array(p.count * 2);
          for (let i = 0; i < p.count; i++) { uvs[i * 2] = p.getX(i); uvs[i * 2 + 1] = p.getZ(i); }
          g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        } else if (def.uv === 'box') boxUVKeep(g);
        else if (def.uv !== 'keep' && g.attributes.uv) g.deleteAttribute('uv');
        if (def.color) hedgeColors(g);
        g.clearGroups();
        return g;
      });
      const merged = mergeGeometries(prepared, false);
      const mesh = new THREE.Mesh(merged, def.mat);
      mesh.name = `gardens:${key}`;
      mesh.castShadow = !!def.cast;
      mesh.receiveShadow = def.mat !== fallMat && def.mat !== foamMat;
      if (def.mat === fallMat || def.mat === foamMat) mesh.renderOrder = 2;
      group.add(mesh);
    }
  }

  // InstancedMesh 小工具：list = [{x,y,z,sx,sy,sz,ry,rx,rz,c:[r,g,b]}]
  const dummy = new THREE.Object3D();
  function instanced(name, geom, mat, list, { cast = true, receive = true } = {}) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geom, mat, list.length);
    const col = new THREE.Color();
    list.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      dummy.scale.set(it.sx, it.sy ?? it.sx, it.sz ?? it.sx);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (it.c) im.setColorAt(i, col.setRGB(it.c[0], it.c[1], it.c[2]));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.name = `gardens:${name}`;
    im.castShadow = cast; im.receiveShadow = receive;
    group.add(im);
    return im;
  }

  // 不規則圓團（花團、灌木球、石塊）：二十面體細分＋位移
  function blob(detail, name, kind, amp) {
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const r = makeRng(`gardens/blob/${name}`);
    const lobes = [];
    const nL = kind === 'flower' ? 26 : kind === 'leafy' ? 20 : 9;
    for (let i = 0; i < nL; i++) {
      const v = new V3(r.gauss(), r.gauss(), r.gauss()).normalize();
      lobes.push({ v, f: r.range(0.6, 1.4), ph: r.range(0, TAU), w: r.range(0.5, 1) });
    }
    const p = g.attributes.position, v = new V3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      let d = 1;
      if (kind === 'flower' || kind === 'leafy') {
        let m = 0;
        const cut = kind === 'flower' ? 0.9 : 0.86;
        for (const l of lobes) m = Math.max(m, smooth(cut, 1, v.dot(l.v)) * l.w);
        d = 1 - amp * 0.45 + amp * m;
      } else { // rock：低頻起伏＋稜角
        let s = 0;
        for (const l of lobes) s += Math.cos(v.dot(l.v) * 3.2 * l.f + l.ph) * l.w;
        d = 1 + amp * s / Math.sqrt(nL);
        d = Math.max(0.55, d);
      }
      p.setXYZ(i, v.x * d, v.y * d, v.z * d);
    }
    g.computeVertexNormals();
    return g;
  }

  // ==========================================================================
  // 路徑工具（xz 平面上的折線；點 = {x, z, y?}）
  // ==========================================================================
  function densify(pts, closed, maxSeg = 0.04) {
    const out = [];
    const n = pts.length, segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const k = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / maxSeg));
      for (let j = 0; j < k; j++) out.push({ x: lerp(a.x, b.x, j / k), z: lerp(a.z, b.z, j / k), y: lerp(a.y || 0, b.y || 0, j / k) });
    }
    if (!closed) out.push({ ...pts[n - 1] });
    return out;
  }
  function resample(d, closed, stepFn, maxTurn = 0.2) {
    const out = [d[0]];
    let acc = 0, turn = 0;
    for (let i = 1; i < d.length; i++) {
      const a = d[i - 1], b = d[i];
      acc += Math.hypot(b.x - a.x, b.z - a.z);
      if (i >= 2) {
        const p = d[i - 2];
        const ux = a.x - p.x, uz = a.z - p.z, vx = b.x - a.x, vz = b.z - a.z;
        turn += Math.abs(Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz));
      }
      if (acc >= stepFn(b) || turn >= maxTurn) { out.push(b); acc = 0; turn = 0; }
    }
    const last = d[d.length - 1];
    if (!closed) {
      if (out[out.length - 1] !== last) { if (acc < 0.3 * stepFn(last) && out.length > 2) out[out.length - 1] = last; else out.push(last); }
    } else if (out.length > 3) {
      const l = out[out.length - 1];
      if (Math.hypot(l.x - out[0].x, l.z - out[0].z) < 0.5 * stepFn(l)) out.pop();
    }
    return out;
  }
  function offsetPath(pts, d, closed) {
    const n = pts.length;
    return pts.map((p, i) => {
      const a = pts[i > 0 ? i - 1 : closed ? n - 1 : 0], b = pts[i < n - 1 ? i + 1 : closed ? 0 : n - 1];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      return { x: p.x - tz * d, z: p.z + tx * d, y: p.y };
    });
  }
  // 超橢圓截面：由左下 → 頂 → 右下（p 大 → 方正；p = 2 → 半橢圓）
  function superProfile(w, h, n, p) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const th = PI * (1 - i / n), c = Math.cos(th), s = Math.sin(th);
      out.push([(w / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), h * Math.pow(Math.abs(s), 2 / p)]);
    }
    return out;
  }

  // 沿路徑掃掠截面
  // o: { closed, base: number|fn(x,z), disp: fn(x,y,z,hRel)→法線位移, loop: 截面頭尾相接（方管）, flat, capStart, capEnd, prev, next }
  function sweep(pts, profile, o = {}) {
    const closed = !!o.closed, n = pts.length, m = profile.length;
    const baseFn = typeof o.base === 'function' ? o.base : null, base0 = typeof o.base === 'number' ? o.base : 0;
    const pos = [], hrel = [], idx = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = i > 0 ? pts[i - 1] : closed ? pts[n - 1] : (o.prev || null);
      const b = i < n - 1 ? pts[i + 1] : closed ? pts[0] : (o.next || null);
      const A = a || p, B = b || p;
      let tx = B.x - A.x, tz = B.z - A.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      let k = 1;
      if (a && b) {
        const dx = p.x - a.x, dz = p.z - a.z, dl = Math.hypot(dx, dz);
        if (dl > 1e-6) k = 1 / Math.max(0.55, (dx * tx + dz * tz) / dl);
      }
      const nx = -tz * k, nz = tx * k, py = p.y || 0;
      for (let j = 0; j < m; j++) {
        const off = profile[j][0], h = profile[j][1];
        const x = p.x + nx * off, z = p.z + nz * off;
        pos.push(x, (baseFn ? baseFn(x, z) : base0) + py + h, z);
        hrel.push(h);
      }
    }
    const segs = closed ? n : n - 1, mm = o.loop ? m : m - 1;
    for (let i = 0; i < segs; i++) {
      const i1 = (i + 1) % n;
      for (let j = 0; j < mm; j++) {
        const j1 = (j + 1) % m;
        const a = i * m + j, b = i * m + j1, c = i1 * m + j, d = i1 * m + j1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const cap = (i, end) => {
      let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < m; j++) { cx += pos[(i * m + j) * 3]; cy += pos[(i * m + j) * 3 + 1]; cz += pos[(i * m + j) * 3 + 2]; }
      const ci = pos.length / 3;
      pos.push(cx / m, cy / m, cz / m); hrel.push(0.5);
      for (let j = 0; j < m; j++) {
        const j1 = (j + 1) % m, a = i * m + j, b = i * m + j1;
        if (end) idx.push(ci, a, b); else idx.push(ci, b, a);
      }
    };
    if (!closed) {
      if (o.capStart !== false) cap(0, false);
      if (o.capEnd !== false) cap(n - 1, true);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    if (o.disp) {
      const P = g.attributes.position, N = g.attributes.normal;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
        const d = o.disp(x, y, z, hrel[i]);
        P.setXYZ(i, x + N.getX(i) * d, y + N.getY(i) * d, z + N.getZ(i) * d);
      }
      g.computeVertexNormals();
    }
    if (o.flat) { const f = g.toNonIndexed(); f.computeVertexNormals(); return f; }
    return g;
  }

  // 依「是否靠近特寫點」分段，近段用細截面、遠段用粗截面
  function sweepLOD(pts, closed, profHi, profLo, isNear, o = {}) {
    const flags = pts.map(isNear);
    if (flags.every((f) => f)) return [sweep(pts, profHi, { ...o, closed })];
    if (flags.every((f) => !f)) return [sweep(pts, profLo, { ...o, closed })];
    let P = pts, F = flags;
    if (closed) {
      const s = F.findIndex((f, i) => f !== F[(i - 1 + F.length) % F.length]);
      P = [...pts.slice(s), ...pts.slice(0, s), pts[s]];
      F = [...flags.slice(s), ...flags.slice(0, s), flags[s]];
    }
    const out = [];
    let start = 0;
    for (let i = 1; i <= P.length; i++) {
      if (i === P.length || F[i] !== F[start]) {
        const end = Math.min(i, P.length - 1);
        if (end > start) {
          const run = P.slice(start, end + 1);
          out.push(sweep(run, F[start] ? profHi : profLo, {
            ...o, closed: false,
            capStart: !closed && start === 0 ? o.capStart : false,
            capEnd: !closed && end === P.length - 1 ? o.capEnd : false,
            prev: start > 0 ? P[start - 1] : null, next: end < P.length - 1 ? P[end + 1] : null,
          }));
        }
        start = i;
      }
    }
    return out;
  }

  // 位移噪聲
  const leafN = makeNoise2D('gardens/leaf');
  const n3 = (x, y, z) => (leafN(x + 0.37 * y, z - 0.21 * y) + leafN(y * 1.13 + 17.3, x * 0.71 - z * 0.69 + 5.1)) * 0.5;
  const hedgeDisp = (x, y, z, h) => {
    const k = Math.min(1, h / 0.12);
    return k * (0.05 * (n3(x * 6.5, y * 6.5, z * 6.5) - 0.5) + 0.07 * (n3(x * 1.6, y * 1.6, z * 1.6) - 0.5));
  };
  const flowerDisp = (x, y, z, h) => {
    const k = Math.min(1, h / 0.06);
    return k * (0.07 * (n3(x * 3.4, y * 3.4, z * 3.4) - 0.5) + 0.05 * (n3(x * 9, y * 9, z * 9) - 0.5));
  };

  // ==========================================================================
  // 1. 幾何花壇
  // ==========================================================================
  const FP = L.FOCUS.parterreBed;
  const dFocus = (x, z) => Math.hypot(x - FP.x, z - FP.z);
  const NEAR_R = 5.0, MID_R = 11.0;                         // 花團 instancing 的兩級半徑
  const pStep = (p) => clamp(0.05 + 0.04 * Math.max(0, dFocus(p.x, p.z) - 2.5), 0.06, 0.6);
  const pNear = (p) => dFocus(p.x, p.z) < 9;
  const lawnY = 0.03;                                       // 花壇草皮頂面（略高於地形草地 0）
  const bedY = LV.parterreBed;                              // 花帶土面
  const clumps = { maroon: [[], []], yellow: [[], []], red: [[], []], pink: [[], []] };
  const shrubBalls = { hedge: [], red: [], pink: [] };
  const rngCl = makeRng('gardens/clumps');
  const CLUMP_TINT = {
    maroon: () => { const k = rngCl.range(0.8, 1.2); return [k * rngCl.range(0.95, 1.1), k * 0.95, k]; },
    yellow: () => { const o = rngCl(); return o < 0.3 ? [1.05, 0.72, 0.5] : o < 0.55 ? [1.08, 0.92, 0.75] : [1, 1, 1]; },
    red: () => { const k = rngCl.range(0.85, 1.15); return [k, k * rngCl.range(0.9, 1.2), k]; },
    pink: () => { const k = rngCl.range(0.88, 1.12); return [k, k * rngCl.range(0.92, 1.1), k * rngCl.range(0.95, 1.1)]; },
  };
  function pushClump(key, x, y, z, rad) {
    const d = dFocus(x, z);
    const lod = d < NEAR_R ? 0 : d < MID_R ? 1 : -1;
    if (lod < 0) return;
    clumps[key][lod].push({ x, y, z, sx: rad, sy: rad * rngCl.range(0.62, 0.8), sz: rad * rngCl.range(0.9, 1.1),
      ry: rngCl.range(0, TAU), c: CLUMP_TINT[key]() });
  }

  function addHedge(dense, closed, w, h, o = {}) {
    const pts = resample(dense, closed, o.step || pStep, 0.2);
    const near = o.near || pNear;
    const hi = superProfile(w, h, 14, 4), lo = superProfile(w, h, 6, 4);
    for (const g of sweepLOD(pts, closed, hi, lo, near, { base: o.base ?? 0, disp: hedgeDisp })) add('hedge', g);
  }

  // 花帶：圓拱截面＋小凹凸；土面墊底；特寫範圍內撒一顆顆的花團
  function addBand(key, dense, closed, w, h) {
    const pts = resample(dense, closed, pStep, 0.2);
    for (const g of sweepLOD(pts, closed, superProfile(w, h, 10, 2.5), superProfile(w, h, 4, 2.5), pNear,
      { base: lawnY - 0.02, disp: flowerDisp })) add(key, g);
    const soilProf = [[-w / 2 - 0.13, lawnY - 0.01], [-w / 2 - 0.07, bedY], [w / 2 + 0.07, bedY], [w / 2 + 0.13, lawnY - 0.01]];
    add('soil', sweep(resample(dense, closed, (p) => pStep(p) * 1.5, 0.3), soilProf, { closed, base: 0 }));
    // 花團
    let acc = 1e9;
    const n = dense.length;
    for (let i = 0; i < n; i++) {
      const p = dense[i], d = dFocus(p.x, p.z);
      if (d > MID_R + w) { acc = 1e9; continue; }
      const sp = d < NEAR_R ? 0.2 : 0.3;
      const q = dense[Math.max(0, i - 1)];
      acc += Math.hypot(p.x - q.x, p.z - q.z);
      if (acc < sp) continue;
      acc = 0;
      const b = dense[Math.min(n - 1, i + 1)], a = dense[Math.max(0, i - 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nr = Math.max(1, Math.round(w / sp));
      for (let r = 0; r < nr; r++) {
        const off = (-(nr - 1) / 2 + r) * (w / nr) + rngCl.range(-0.25, 0.25) * sp;
        const jt = rngCl.range(-0.3, 0.3) * sp;
        const x = p.x - tz * off + tx * jt, z = p.z + tx * off + tz * jt;
        const surf = h * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * off / w), 2.5)), 0.4);
        const rad = sp * 0.62 * rngCl.range(0.85, 1.25);
        pushClump(key, x, lawnY + surf * 0.78, z, rad);
      }
    }
  }

  // 填滿式花床（超橢圓）
  function addFill(key, cx, cz, a, b, p, h) {
    const near = dFocus(cx, cz) < 12 + Math.max(a, b);
    const R = near ? 9 : 4, S = near ? 56 : 28;
    const pos = [], idx = [], hr = [];
    const bnd = (th) => {
      const c = Math.cos(th), s = Math.sin(th);
      return [a * Math.sign(c) * Math.pow(Math.abs(c), 2 / p), b * Math.sign(s) * Math.pow(Math.abs(s), 2 / p)];
    };
    for (let k = 0; k <= R; k++) {
      const s = k / R;
      for (let j = 0; j < S; j++) {
        const [du, dv] = bnd((j / S) * TAU);
        const yy = h * Math.sqrt(Math.max(0, 1 - Math.pow(s, 4)));
        pos.push(cx + du * s, lawnY - 0.02 + yy, cz + dv * s); hr.push(yy);
      }
    }
    for (let k = 0; k < R; k++) for (let j = 0; j < S; j++) {
      const j1 = (j + 1) % S;
      const A = k * S + j, B = (k + 1) * S + j, C = k * S + j1, D = (k + 1) * S + j1;
      idx.push(A, C, B, C, D, B);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), d = flowerDisp(x, y, z, hr[i]);
      P.setXYZ(i, x + N.getX(i) * d, y + N.getY(i) * d, z + N.getZ(i) * d);
    }
    g.computeVertexNormals();
    add(key, g);
    // 土面
    const sp = [], si = [];
    sp.push(cx, bedY, cz);
    for (let j = 0; j < 32; j++) { const [du, dv] = bnd((j / 32) * TAU); sp.push(cx + du * 1.08 + Math.sign(du) * 0.06, bedY, cz + dv * 1.08 + Math.sign(dv) * 0.06); }
    for (let j = 0; j < 32; j++) si.push(0, 1 + ((j + 1) % 32), 1 + j);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setIndex(si); sg.computeVertexNormals();
    add('soil', sg);
    // 花團
    if (dFocus(cx, cz) - Math.max(a, b) > MID_R) return;
    for (let u = -a; u <= a; u += 0.2) for (let v = -b; v <= b; v += 0.2) {
      const x = cx + u + rngCl.range(-0.06, 0.06), z = cz + v + rngCl.range(-0.06, 0.06);
      const d = dFocus(x, z);
      if (d > MID_R) continue;
      const sp2 = d < NEAR_R ? 0.2 : 0.3;
      // 中距離用較疏的格點
      if (sp2 > 0.2 && (Math.round(u / 0.2) % 3 === 1 || Math.round(v / 0.2) % 3 === 1)) continue;
      const s = Math.pow(Math.pow(Math.abs(u / a), p) + Math.pow(Math.abs(v / b), p), 1 / p);
      if (s > 0.96) continue;
      const yy = h * Math.sqrt(Math.max(0, 1 - Math.pow(s, 4)));
      pushClump(key, x, lawnY + yy * 0.78, z, sp2 * 0.62 * rngCl.range(0.85, 1.25));
    }
  }

  // 平面曲線產生器（模組區域座標 u,v → 世界 x,z）
  const ellipseLocal = (a, b, n = 400) => Array.from({ length: n }, (_, i) => ({ u: a * Math.cos((i / n) * TAU), v: b * Math.sin((i / n) * TAU) }));
  function bezier(P0, P1, P2, P3, n = 120) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, s = 1 - t;
      out.push({ u: s * s * s * P0.u + 3 * s * s * t * P1.u + 3 * s * t * t * P2.u + t * t * t * P3.u,
        v: s * s * s * P0.v + 3 * s * s * t * P1.v + 3 * s * t * t * P2.v + t * t * t * P3.v });
    }
    return out;
  }
  function roundRectWorld(cx, cz, hx, hz, rc) {
    const pts = [];
    const corners = [[hx - rc, hz - rc, 0], [-(hx - rc), hz - rc, PI / 2], [-(hx - rc), -(hz - rc), PI], [hx - rc, -(hz - rc), 1.5 * PI]];
    for (const [ox, oz, a0] of corners) for (let i = 0; i <= 12; i++) {
      const a = a0 + (i / 12) * (PI / 2);
      pts.push({ x: cx + ox + rc * Math.cos(a), z: cz + oz + rc * Math.sin(a) });
    }
    return densify(pts, true, 0.05);
  }

  function buildModule(mx, mz, ai, bi) {
    const W = (arr, su = 1, sv = 1) => arr.map((q) => ({ x: mx + q.u * su, z: mz + q.v * sv }));
    const hh = G.hedgeHeight;
    const ma = 0.34 * ai, mb = 0.42 * bi;
    // 中央圓章：外圈綠籬、內圈紫紅葉帶、中心紅花床
    addHedge(densify(W(ellipseLocal(ma, mb)), true, 0.05), true, 0.5, hh);
    addBand('maroon', densify(W(ellipseLocal(ma - 1.05, mb - 1.05)), true, 0.05), true, 0.8, 0.24);
    addFill('red', mx, mz, ma - 2.1, mb - 2.1, 2, 0.3);
    // 長軸兩側黃花葉形床、短軸兩側粉花床
    const la = 0.19 * ai, lb = 1.05, luc = ma + 0.7 + la;
    addFill('yellow', mx + luc, mz, la, lb, 2.3, 0.32);
    addFill('yellow', mx - luc, mz, la, lb, 2.3, 0.32);
    const va = 1.0, vb = 0.13 * bi, lvc = mb + 0.75 + vb;
    addFill('pink', mx, mz + lvc, va, vb, 2.3, 0.3);
    addFill('pink', mx, mz - lvc, va, vb, 2.3, 0.3);
    // 四角渦卷：由圓章引出 → 對數螺線收捲
    const c = { u: 0.66 * ai, v: 0.5 * bi }, r0 = 0.245 * Math.min(ai, bi), rEnd = 0.6, turns = 1.7 * PI;
    const S0 = { u: c.u, v: c.v - r0 };
    const Mu = ma * Math.sqrt(Math.max(0, 1 - (S0.v / mb) ** 2));
    const Lead = S0.u - Mu;
    const lead = bezier({ u: Mu, v: S0.v }, { u: Mu + Lead * 0.38, v: S0.v - 0.55 }, { u: S0.u - Lead * 0.35, v: S0.v }, S0, 80);
    const k = Math.log(r0 / rEnd) / turns;
    const spiral = [];
    for (let i = 1; i <= 260; i++) {
      const a = (i / 260) * turns, r = r0 * Math.exp(-k * a), al = -PI / 2 + a;
      spiral.push({ u: c.u + r * Math.cos(al), v: c.v + r * Math.sin(al), a });
    }
    const scroll = [...lead.map((q) => ({ ...q, a: -1 })), ...spiral];
    // 紫紅葉帶：渦卷外側平行帶
    const offRaw = offsetPath(scroll.map((q) => ({ x: q.u, z: q.v, a: q.a })), -1.15, false)
      .map((q, i) => ({ u: q.x, v: q.z, a: scroll[i].a }));
    const maroon = [];
    for (const q of offRaw) {
      if (q.a > 1.2 * PI) break;
      const inMed = (q.u / (ma + 0.65)) ** 2 + (q.v / (mb + 0.65)) ** 2 < 1;
      if (inMed) { if (maroon.length) break; continue; }
      maroon.push(q);
    }
    for (const [su, sv] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      addHedge(densify(W(scroll, su, sv), false, 0.05), false, 0.45, hh * 0.92);
      if (maroon.length > 4) addBand('maroon', densify(W(maroon, su, sv), false, 0.05), false, 0.9, 0.24);
    }
  }

  for (const r of G.parterres) {
    const Wd = r.x1 - r.x0, D = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    add('grass', new THREE.PlaneGeometry(Wd, D).rotateX(-PI / 2).translate(cx, lawnY, cz));
    // 外框綠籬＋沿邊黃花帶
    addHedge(roundRectWorld(cx, cz, Wd / 2 - 0.4, D / 2 - 0.4, 1.2), true, 0.55, G.hedgeHeight);
    addBand('yellow', roundRectWorld(cx, cz, Wd / 2 - 1.25, D / 2 - 1.25, 0.8), true, 0.85, 0.3);
    const nMod = Math.max(1, Math.round(Wd / 32)), A = Wd / nMod / 2, B = D / 2;
    const ai = A - 1.0, bi = B - 1.6;
    for (let k = 0; k < nMod; k++) {
      buildModule(r.x0 + A * (2 * k + 1), cz, ai, bi);
      if (k > 0) {
        const bx = r.x0 + 2 * A * k;
        addFill('red', bx, cz, 1.3, 2.4, 1.3, 0.28);
        for (const s of [-1, 1]) shrubBalls.hedge.push({ x: bx, z: cz + s * bi * 0.62, r: 0.62 });
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) shrubBalls.hedge.push({ x: cx + sx * (Wd / 2 - 2.6), z: cz + sz * (D / 2 - 2.6), r: 0.55 });
  }

  // ==========================================================================
  // 2. 池塘（光華池、雲漢池）：池岸地形、水面、岸石、睡蓮
  // ==========================================================================
  function bridgeParams(pond) {
    const b = pond.bridge;
    const springY = LV.pondWater + 0.25;
    const archR = b.rise - 1.2 - springY;          // 半圓拱半徑（拱頂內緣在橋面下 1.2 m）
    const Lh = b.span / 2 + 3.0;                   // 橋面半長（含兩端引道）
    const mat = new THREE.Matrix4();
    if (b.axis === 'z') mat.makeBasis(new V3(0, 0, 1), new V3(0, 1, 0), new V3(-1, 0, 0));
    else mat.identity();
    mat.setPosition(b.x, 0, b.z);
    const inv = mat.clone().invert();
    const toLocal = (x, z) => { const v = new V3(x, 0, z).applyMatrix4(inv); return { s: v.x, t: v.z }; };
    const toWorld = (s, t) => { const v = new V3(s, 0, t).applyMatrix4(mat); return { x: v.x, z: v.z }; };
    return { b, springY, archR, Lh, W: b.width, rise: b.rise, mat, toLocal, toWorld };
  }

  function makePond(pond, idx) {
    const c = pond.center, ra = pond.radiusX, rb = pond.radiusZ;
    const cs = Math.cos(-pond.rotation), sn = Math.sin(-pond.rotation);
    const ellR = (phi) => {
      const dx = Math.cos(phi), dz = Math.sin(phi);
      const u = dx * cs - dz * sn, v = dx * sn + dz * cs;
      return 1 / Math.sqrt((u * u) / (ra * ra) + (v * v) / (rb * rb));
    };
    const BP = bridgeParams(pond);
    const rng = makeRng(`gardens/pond/${idx}`);
    const harm = [2, 3, 4, 5, 7].map((k) => ({ k, a: rng.range(0.025, 0.06) * (3 / (k + 1)), p: rng.range(0, TAU) }));
    const Hh = (phi) => harm.reduce((s, h) => s + h.a * Math.sin(h.k * phi + h.p), 0);
    const bp1 = rng.range(0, TAU);
    const bankW = (phi) => 4.4 + 1.6 * (0.5 + 0.5 * Math.sin(3 * phi + bp1));
    // 橋的方向 = 水面最窄（頸部）方向
    const bdx = BP.b.x - c.x, bdz = BP.b.z - c.z;
    const waist = BP.b.axis === 'z' ? PI / 2 : 0;
    void bdx; void bdz;
    const neck = BP.archR + 0.35;
    const rwRaw = (phi) => {
      let r = (ellR(phi) - bankW(phi)) * (1 + Hh(phi));
      const d = Math.min(angDist(phi, waist), angDist(phi, waist + PI));
      const w = Math.exp(-Math.pow(d / 0.6, 4));
      return r * (1 - w) + neck * w;
    };
    const wf = pond.waterfall;
    const phiWF = Math.atan2(wf.z - c.z, wf.x - c.x), dWF = Math.hypot(wf.x - c.x, wf.z - c.z);
    const needWF = dWF + 2.2, baseWF = rwRaw(phiWF);
    const NA = 1440;
    const rwTab = new Float32Array(NA + 1), reTab = new Float32Array(NA + 1);
    for (let i = 0; i <= NA; i++) {
      const phi = -PI + (i / NA) * TAU;
      let r = rwRaw(phi) + Math.max(0, needWF - baseWF) * Math.exp(-((angDist(phi, phiWF) / 0.17) ** 2));
      reTab[i] = ellR(phi);
      rwTab[i] = Math.min(r, reTab[i] - 2.4);
    }
    const tab = (T, phi) => { const f = ((phi + PI) / TAU) * NA, i = clamp(Math.floor(f), 0, NA - 1), t = f - i; return lerp(T[i], T[i + 1], t); };
    const rw = (phi) => tab(rwTab, phi), re = (phi) => tab(reTab, phi);
    const kn = makeNoise2D(`gardens/knoll/${idx}`);
    // 橋位置附近不起伏
    const bridgeFade = (x, z) => {
      const q = BP.toLocal(x, z);
      const ds = Math.max(0, Math.abs(q.s) - BP.Lh - 0.5), dt = Math.max(0, Math.abs(q.t) - BP.W / 2 - 0.5);
      return smooth(1, 7, Math.hypot(ds, dt));
    };
    const rk = pond.rockery;
    // 地面高度（橢圓內由本區負責；橢圓外回傳 0）
    function height(x, z) {
      const dx = x - c.x, dz = z - c.z, r = Math.hypot(dx, dz), phi = Math.atan2(dz, dx);
      const rE = re(phi);
      if (r >= rE) return 0;
      const rW = rw(phi);
      if (r <= rW) { const t = r / rW; return -0.55 - 0.65 * (1 - smooth(0.5, 1, t)); }
      const e = r - rW, t = clamp(e / (rE - rW), 0, 1);
      let y = -0.55 + 0.35 * smooth(0, 0.8, e) + 0.2 * (1 - (1 - t) ** 2);
      let kf = Math.pow(Math.sin(PI * t), 1.5) * clamp((e - 0.8) / 2, 0, 1) * bridgeFade(x, z);
      kf *= smooth(4, 9, Math.hypot(x - rk.x, z - rk.z)) * 0.6 + 0.4;
      y += 1.45 * Math.max(0, kn.fbm(x * 0.045, z * 0.045, 3) - 0.38) * kf;
      return y;
    }
    // 是否在水中（含岸邊緩衝 m）
    const inWater = (x, z, m = 0) => { const dx = x - c.x, dz = z - c.z; return Math.hypot(dx, dz) < rw(Math.atan2(dz, dx)) + m; };
    return { pond, idx, c, ellR, rw, re, height, inWater, BP, rng };
  }

  const ponds = G.ponds.map(makePond);
  const groundH = (x, z) => {
    for (const P of ponds) {
      const dx = x - P.c.x, dz = z - P.c.z;
      if (Math.hypot(dx, dz) < P.re(Math.atan2(dz, dx))) return P.height(x, z);
    }
    return 0;
  };

  // 池岸地形網格（極座標格網）＋水面
  function buildPondGround(P) {
    const NA = 220;
    const ringsFor = (rW, rE) => {
      const out = [0, 0.45 * rW, 0.75 * rW, rW - 0.9, rW - 0.35, rW, rW + 0.2, rW + 0.45, rW + 0.75, rW + 1.1];
      const J = 10;
      for (let j = 1; j <= J; j++) out.push(rW + 1.1 + (rE - rW - 1.1) * Math.pow(j / J, 1.2));
      out.push(rE + 1.5, rE + 3.0);
      return out;
    };
    const NR = ringsFor(10, 20).length;
    const pos = [];
    for (let i = 0; i < NA; i++) {
      const phi = -PI + (i / NA) * TAU, rW = P.rw(phi), rE = P.re(phi);
      const rings = ringsFor(rW, rE);
      for (let k = 0; k < NR; k++) {
        const r = rings[k], x = P.c.x + r * Math.cos(phi), z = P.c.z + r * Math.sin(phi);
        const y = r >= rE - 1e-4 ? (r > rE + 0.01 ? -0.006 : 0) : P.height(x, z);
        pos.push(x, y, z);
      }
    }
    const gi = [], si = [];
    for (let i = 0; i < NA; i++) {
      const i1 = (i + 1) % NA;
      for (let k = 0; k < NR - 1; k++) {
        const A = i * NR + k, B = i * NR + k + 1, C = i1 * NR + k, D = i1 * NR + k + 1;
        const ya = (pos[A * 3 + 1] + pos[B * 3 + 1] + pos[C * 3 + 1] + pos[D * 3 + 1]) / 4;
        (ya < -0.47 ? si : gi).push(A, C, B, C, D, B);
      }
    }
    const base = new THREE.BufferGeometry();
    base.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    base.setIndex(gi.concat(si));
    base.computeVertexNormals();
    const mk = (ix) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', base.attributes.position); g.setAttribute('normal', base.attributes.normal); g.setIndex(ix); return g; };
    add('grass', mk(gi));
    add('soil', mk(si));
    // 水面
    const wp = [P.c.x, LV.pondWater, P.c.z], wi = [];
    for (let i = 0; i < NA; i++) {
      const phi = -PI + (i / NA) * TAU, r = P.rw(phi) + 0.95;
      wp.push(P.c.x + r * Math.cos(phi), LV.pondWater, P.c.z + r * Math.sin(phi));
    }
    for (let i = 0; i < NA; i++) wi.push(0, 1 + ((i + 1) % NA), 1 + i);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    wg.setIndex(wi); wg.computeVertexNormals();
    add('water', wg);
  }

  // 岸石（三種石塊 instancing）、景石
  const rockGeoms = [0, 1, 2].map((i) => { const g = blob(1, `rock${i}`, 'rock', 0.32).toNonIndexed(); g.computeVertexNormals(); boxUVKeep(g); return g; });
  const rockLists = [[], [], []];
  const rockRng = makeRng('gardens/rocks');
  const pushRock = (x, y, z, sx, sy, sz) => rockLists[rockRng.int(0, 2)].push({ x, y, z, sx, sy, sz, ry: rockRng.range(0, TAU), rx: rockRng.range(-0.2, 0.2) });

  const bridgeFoot = (P, x, z, m) => { const q = P.BP.toLocal(x, z); return Math.abs(q.s) < P.BP.Lh + 0.3 + m && Math.abs(q.t) < P.BP.W / 2 + m; };

  function buildShoreRocks(P) {
    const r = P.rng.fork('shore');
    const rk = P.pond.rockery;
    let phi = -PI;
    while (phi < PI) {
      const rW = P.rw(phi);
      phi += r.range(0.9, 1.7) / rW;
      if (r() < 0.3) continue;
      const rr = rW + r.range(-0.15, 0.55);
      const x = P.c.x + rr * Math.cos(phi), z = P.c.z + rr * Math.sin(phi);
      if (bridgeFoot(P, x, z, 0.5)) continue;
      if (Math.hypot(x - rk.x, z - rk.z) < 5.5) continue;
      const s = r.range(0.35, 0.85);
      pushRock(x, P.height(x, z) - 0.06, z, s * r.range(1, 1.5), s * r.range(0.45, 0.75), s * r.range(0.8, 1.2));
      if (r() < 0.35) { // 小石伴
        const a = r.range(0, TAU), d = s * 1.1;
        pushRock(x + Math.cos(a) * d, P.height(x, z) - 0.05, z + Math.sin(a) * d, s * 0.5, s * 0.35, s * 0.45);
      }
    }
  }

  // 睡蓮葉＋少量花
  const padGeom = new THREE.CircleGeometry(1, 16, 0.35, TAU - 0.35).rotateX(-PI / 2);
  const pads = [], lotus = [];
  function buildLilies(P) {
    const r = P.rng.fork('lily');
    const wf = P.pond.waterfall;
    let tries = 0, clusters = 0;
    while (clusters < 8 && tries++ < 200) {
      const phi = r.range(-PI, PI);
      const d = Math.min(angDist(phi, PI / 2), angDist(phi, -PI / 2));
      if (P.BP.b.axis === 'z' && d < 0.75) continue;
      const rr = P.rw(phi) - r.range(1.6, 5);
      const cx = P.c.x + rr * Math.cos(phi), cz = P.c.z + rr * Math.sin(phi);
      if (Math.hypot(cx - wf.x, cz - wf.z) < 6) continue;
      clusters++;
      const n = r.int(8, 16);
      for (let i = 0; i < n; i++) {
        const x = cx + r.gauss() * 1.3, z = cz + r.gauss() * 1.0;
        if (!P.inWater(x, z, -0.5) || bridgeFoot(P, x, z, 1)) continue;
        const s = r.range(0.2, 0.42);
        const k = r.range(0.75, 1.1);
        pads.push({ x, y: LV.pondWater + 0.012 + r() * 0.006, z, sx: s, sy: 1, sz: s * r.range(0.9, 1.05), ry: r.range(0, TAU), c: [k * r.range(0.95, 1.12), k, k * 0.9] });
        if (r() < 0.12) lotus.push({ x: x + r.range(-0.08, 0.08), y: LV.pondWater + 0.07, z: z + r.range(-0.08, 0.08), sx: 0.1, sy: 0.08, sz: 0.1, ry: r() * TAU, c: r() < 0.5 ? [1, 1, 1] : [1.15, 1.2, 1.2] });
      }
    }
  }

  // ==========================================================================
  // 3. 假山＋瀑布
  // ==========================================================================
  const splashes = [];
  function buildRockery(P) {
    const rk = P.pond.rockery, wf = P.pond.waterfall;
    const r = P.rng.fork('rockery');
    let dx = wf.x - rk.x, dz = wf.z - rk.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const px = -dz, pz = dx;                       // 水簾寬度方向
    const g0 = P.height(rk.x, rk.z);
    const top = rk.height * 0.6;                   // 瀑布出水口高度
    const lip = { x: wf.x - dx * 0.35, z: wf.z - dz * 0.35 };
    const rotY = Math.atan2(-dz, dx);
    let bi = 0;
    const boulder = (x, y, z, sx, sy, sz, ry = r.range(0, TAU), detail = 2) => {
      const g = blob(detail, `rk${P.idx}/${bi++}`, 'rock', 0.24);
      g.scale(sx, sy, sz); g.rotateY(ry); g.translate(x, y, z);
      add('stone', g);
    };
    const at = (fd, fp) => ({ x: rk.x + dx * fd + px * fp, z: rk.z + dz * fd + pz * fp });
    // 主峰（瀑布後方，三塊疊石）
    let q = at(-1.2, 0); boulder(q.x, g0 + 1.3, q.z, 2.7, 2.1, 2.9, rotY);
    q = at(-1.7, 0.5); boulder(q.x, g0 + 3.2, q.z, 2.0, 1.9, 2.2);
    q = at(-2.0, -0.3); boulder(q.x, g0 + 4.85, q.z, 1.25, 1.35, 1.35);
    q = at(-0.6, -1.6); boulder(q.x, g0 + 2.5, q.z, 1.3, 1.6, 1.2);
    // 出水口平台
    q = { x: lip.x - dx * 0.6, z: lip.z - dz * 0.6 };
    boulder(q.x, top - 0.38, q.z, 0.75, 0.42, 1.35, rotY);
    // 水簾兩側夾石
    for (const s of [-1, 1]) {
      q = { x: lip.x + px * s * 1.75 - dx * 0.25, z: lip.z + pz * s * 1.75 - dz * 0.25 };
      boulder(q.x, g0 + top * 0.45, q.z, 1.05, top * 0.62, 1.0, rotY + s * 0.4);
      q = { x: lip.x + px * s * 2.6 + dx * 0.4, z: lip.z + pz * s * 2.6 + dz * 0.4 };
      boulder(q.x, P.height(q.x, q.z) + 0.6, q.z, 1.1, 1.2, 1.0);
    }
    // 外圍散石
    const fwd = Math.atan2(dz, dx);
    for (let i = 0; i < 10; i++) {
      const a = fwd + PI * 0.45 + (i / 9) * PI * 1.1 + r.range(-0.12, 0.12);
      const d = r.range(2.8, 5.2), x = rk.x + Math.cos(a) * d, z = rk.z + Math.sin(a) * d;
      const s = r.range(0.8, 1.8);
      boulder(x, P.height(x, z) + s * 0.35, z, s * r.range(1, 1.4), s * r.range(0.7, 1.2), s, undefined, 1);
    }
    // 瀑布腳下的池石
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
      const x = wf.x + dx * (0.9 + i * 0.9) + px * s * (1.5 + i * 0.4), z = wf.z + dz * (0.9 + i * 0.9) + pz * s * (1.5 + i * 0.4);
      const sz = r.range(0.5, 0.75);
      boulder(x, LV.pondWater - 0.1, z, sz * 1.3, sz * 0.8, sz, undefined, 1);
    }
    // 水簾（兩層）
    const bottom = LV.pondWater;
    for (let layer = 0; layer < 2; layer++) {
      const NW = 10, NV = 18, pos = [], uvs = [], idx = [];
      for (let iv = 0; iv <= NV; iv++) {
        const v = iv / NV;
        const drift = 0.1 + layer * 0.1 + 0.7 * Math.pow(v, 0.65);
        const y = top - 0.05 - (top - 0.05 - bottom) * v;
        const hw = lerp(0.72, 0.98, v) * (layer ? 0.88 : 1);
        for (let iu = 0; iu <= NW; iu++) {
          const u = iu / NW, o = (u - 0.5) * 2 * hw, bul = 0.08 * Math.sin(PI * u);
          pos.push(lip.x + dx * (drift + bul) + px * o, y, lip.z + dz * (drift + bul) + pz * o);
          uvs.push(u * 1.4 + layer * 0.37, v * 1.6 + layer * 0.21);
        }
      }
      for (let iv = 0; iv < NV; iv++) for (let iu = 0; iu < NW; iu++) {
        const a = iv * (NW + 1) + iu, b = a + 1, c2 = a + NW + 1, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(idx); g.computeVertexNormals();
      add('fall', g);
    }
    // 水花：泡沫圓盤＋白色水霧團
    const foot = { x: lip.x + dx * 0.85, z: lip.z + dz * 0.85 };
    const fg = new THREE.CircleGeometry(2.2, 28).rotateX(-PI / 2).translate(foot.x, LV.pondWater + 0.015, foot.z);
    add('foam', fg);
    for (let i = 0; i < 34; i++) {
      const a = r.range(0, TAU), d = r.range(0.1, 1.3);
      const s = r.range(0.14, 0.42) * (1.2 - d * 0.4);
      splashes.push({ x: foot.x + Math.cos(a) * d * 1.1 + px * r.range(-0.6, 0.6), y: LV.pondWater + r.range(0, 0.25), z: foot.z + Math.sin(a) * d * 0.8,
        sx: s, sy: s * r.range(0.6, 1), sz: s, ry: r() * TAU });
    }
  }

  // ==========================================================================
  // 4. 半圓拱橋
  // ==========================================================================
  function buildBridge(P) {
    const BP = P.BP, { springY, archR, Lh, W, rise, mat } = BP;
    const endA = BP.toWorld(-Lh, 0), endB = BP.toWorld(Lh, 0);
    const yEn = groundH(endA.x, endA.z) + 0.05, yEp = groundH(endB.x, endB.z) + 0.05;
    const yd = (s) => { const yE = s < 0 ? yEn : yEp; return yE + (rise - yE) * Math.cos((PI * Math.min(Lh, Math.abs(s))) / (2 * Lh)); };
    const sOf = (y, sign) => { const yE = sign < 0 ? yEn : yEp; return sign * (2 * Lh / PI) * Math.acos(clamp((y - yE) / (rise - yE), -1, 1)); };
    const yBase = LV.pondBottom - 0.1;
    const parts = { marble: [], marbleSmooth: [], marbleGrey: [] };
    const put = (k, g) => parts[k].push(g);

    // 橋身（側面輪廓擠出）
    const sh = new THREE.Shape();
    sh.moveTo(-Lh, yBase);
    const NT = 64;
    for (let i = 0; i <= NT; i++) { const s = -Lh + (2 * Lh * i) / NT; sh.lineTo(s, yd(s) - 0.06); }
    sh.lineTo(Lh, yBase);
    sh.lineTo(archR, yBase);
    sh.lineTo(archR, springY);
    const NAr = 36;
    for (let i = 1; i < NAr; i++) { const a = (PI * i) / NAr; sh.lineTo(archR * Math.cos(a), springY + archR * Math.sin(a)); }
    sh.lineTo(-archR, springY);
    sh.lineTo(-archR, yBase);
    sh.lineTo(-Lh, yBase);
    put('marble', new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -W / 2));
    // 拱圈（略凸出牆面）＋拱心石
    const ring = new THREE.Shape();
    const Ro = archR + 0.5, Ri = archR - 0.05;
    ring.moveTo(Ro, springY);
    for (let i = 1; i <= NAr; i++) { const a = (PI * i) / NAr; ring.lineTo(Ro * Math.cos(a), springY + Ro * Math.sin(a)); }
    for (let i = NAr; i >= 0; i--) { const a = (PI * i) / NAr; ring.lineTo(Ri * Math.cos(a), springY + Ri * Math.sin(a)); }
    put('marbleSmooth', new THREE.ExtrudeGeometry(ring, { depth: W + 0.12, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -(W + 0.12) / 2));
    put('marbleSmooth', new THREE.BoxGeometry(0.55, 0.8, W + 0.2).translate(0, springY + archR + 0.25, 0));
    // 橋面踏步
    const riser = 0.15, tIn = W / 2 - 0.24;
    for (const sign of [-1, 1]) {
      const yE = sign < 0 ? yEn : yEp;
      const K = Math.floor((rise - 0.04 - yE) / riser);
      for (let k = 1; k <= K; k++) {
        const yk = yE + k * riser;
        const sOut = sOf(yk - riser, sign), sIn = k < K ? sOf(yk, sign) : 0;
        const len = Math.abs(sOut - sIn);
        if (len < 0.02) continue;
        const top = k < K ? yk : rise;
        put('marbleGrey', new THREE.BoxGeometry(len + 0.02, 0.45, 2 * tIn).translate((sOut + sIn) / 2, top - 0.225, 0));
      }
    }
    // 欄杆（地栿、欄板、尋杖、望柱、淨瓶、抱鼓石）
    const NS = 90;
    const curvePts = (s0, s1, dy = 0, t = 0) => Array.from({ length: NS + 1 }, (_, i) => { const s = lerp(s0, s1, i / NS); return { x: s, z: t, y: yd(s) + dy }; });
    const boxProf = (hw, y0, y1) => [[-hw, y0], [-hw, y1], [hw, y1], [hw, y0]];
    // 弧長表（擺望柱）
    const arc = [{ s: -Lh, l: 0 }];
    for (let i = 1; i <= 400; i++) { const s = -Lh + (2 * Lh * i) / 400, p = arc[i - 1]; arc.push({ s, l: p.l + Math.hypot(s - p.s, yd(s) - yd(p.s)) }); }
    const sAtL = (l) => { for (let i = 1; i < arc.length; i++) if (arc[i].l >= l) { const a = arc[i - 1], b = arc[i]; return lerp(a.s, b.s, (l - a.l) / (b.l - a.l)); } return Lh; };
    const lA = arc.find((q) => q.s >= -Lh + 0.35).l, lB = arc.findLast((q) => q.s <= Lh - 0.35).l;
    const nPost = Math.max(2, Math.round((lB - lA) / 1.35) + 1);
    const postS = Array.from({ length: nPost }, (_, i) => sAtL(lerp(lA, lB, i / (nPost - 1))));
    const capG = new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.13, 0.05], [0.1, 0.12], [0.06, 0.2], [0.02, 0.25], [0, 0.26]].map(([a, b]) => new THREE.Vector2(a, b)), 8);
    const vaseG = new THREE.LatheGeometry([[0, 0], [0.07, 0], [0.05, 0.05], [0.1, 0.15], [0.06, 0.26], [0.04, 0.3], [0.08, 0.34], [0, 0.34]].map(([a, b]) => new THREE.Vector2(a, b)), 8);
    for (const side of [-1, 1]) {
      const tc = side * (W / 2 - 0.12);
      const sA = postS[0], sB = postS[postS.length - 1];
      put('marble', sweep(curvePts(-Lh, Lh, 0, tc), boxProf(0.13, -0.12, 0.2), { loop: true, flat: true }));               // 地栿
      put('marble', sweep(curvePts(sA, sB, 0, tc), boxProf(0.05, 0.2, 0.56), { loop: true, flat: true }));                 // 欄板
      put('marbleSmooth', sweep(curvePts(sA, sB, 0, tc), boxProf(0.065, 0.86, 0.97), { loop: true, flat: true }));        // 尋杖
      put('marbleSmooth', sweep(curvePts(-Lh, Lh, -0.2, side * (W / 2 + 0.02)), boxProf(0.05, -0.1, 0.06), { loop: true, flat: true })); // 橋側束腰線
      for (const s of postS) {
        const y = yd(s);
        put('marble', new THREE.BoxGeometry(0.2, 1.0, 0.2).translate(s, y + 0.2 + 0.5, tc));
        put('marbleSmooth', capG.clone().translate(s, y + 1.2, tc));
      }
      for (let i = 0; i < postS.length - 1; i++) {
        const s = (postS[i] + postS[i + 1]) / 2;
        put('marbleSmooth', vaseG.clone().scale(1, 0.88, 1).translate(s, yd(s) + 0.56, tc));
      }
      for (const e of [-1, 1]) { // 抱鼓石
        const s = e * (Lh + 0.12), yE = e < 0 ? yEn : yEp;
        put('marble', new THREE.CylinderGeometry(0.45, 0.45, 0.22, 18).rotateX(PI / 2).translate(s, yE + 0.42, tc));
        put('marble', new THREE.BoxGeometry(0.7, 0.18, 0.3).translate(s - e * 0.05, yE - 0.02, tc));
      }
    }
    for (const k of Object.keys(parts)) for (const g of parts[k]) { g.applyMatrix4(mat); add(k, g); }
  }

  // ==========================================================================
  // 5. 中式庭園：步道、踏石、杜鵑灌木團、景石
  // ==========================================================================
  const pathLines = [];   // 供灌木避讓的步道中心線（世界座標密點）
  function catmull(ctrl, n = 30) {
    const curve = new THREE.CatmullRomCurve3(ctrl.map((p) => new V3(p.x, 0, p.z)), false, 'centripetal');
    return curve.getSpacedPoints(n * ctrl.length).map((v) => ({ x: v.x, z: v.z }));
  }
  function pushOut(P, p, m) { // 推出水面外
    const dx = p.x - P.c.x, dz = p.z - P.c.z, phi = Math.atan2(dz, dx), r = Math.hypot(dx, dz), need = P.rw(phi) + m;
    return r < need ? { x: P.c.x + need * Math.cos(phi), z: P.c.z + need * Math.sin(phi) } : p;
  }
  function buildGardenPaths(P) {
    const c = P.c, sz = Math.sign(c.z) || 1, BP = P.BP;
    const sp = L.PLAZA.sidePaths.find((r) => Math.sign((r.z0 + r.z1) / 2) === sz) || L.PLAZA.sidePaths[0];
    const E1 = BP.toWorld(-sz * BP.Lh, 0), E2 = BP.toWorld(sz * BP.Lh, 0);
    // 橋端延伸方向
    const ext = (E, d) => ({ x: E.x + (E.x - BP.b.x) / BP.Lh * d, z: E.z + (E.z - BP.b.z) / BP.Lh * d });
    const rel = (dx, dz) => pushOut(P, { x: c.x + dx, z: c.z + sz * dz }, 2.4);
    const paths = [
      [E1, ext(E1, 2.2), rel(9, -15), rel(25, -21), { x: sp.x0 + 1.0, z: c.z - sz * 23 }],
      [E2, ext(E2, 2.2), rel(10, 16), rel(27, 25), { x: sp.x0 + 1.0, z: c.z + sz * 28 }],
      [ext(E1, 2.2), rel(-10, -14.5), rel(-26, -16), rel(-42, -11), rel(-48, 2), rel(-44, 14)],
    ];
    const prof = [[-1.2, -0.04], [-1.15, 0.06], [1.15, 0.06], [1.2, -0.04]];
    for (const ctrl of paths) {
      const dense = densify(catmull(ctrl), false, 0.1);
      pathLines.push(dense);
      const pts = resample(dense, false, () => 0.9, 0.12);
      add('paving', sweep(pts, prof, { base: (x, z) => groundH(x, z) + 0.002, capStart: false, capEnd: false }));
    }
    // 踏石小徑：沿遠側池岸往假山
    const rk = P.pond.rockery;
    const trail = catmull([ext(E2, 1.0), rel(-6, 17), rel(-16, 19), { x: rk.x + 7, z: rk.z + sz * 2 * Math.sign(rk.z - c.z) * 0 + (rk.z - c.z > 0 ? 3 : -3) }], 20);
    const tr = P.rng.fork('trail');
    let acc = 0;
    const stoneG = [];
    for (let i = 1; i < trail.length; i++) {
      acc += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].z - trail[i - 1].z);
      if (acc < 0.72) continue;
      acc = 0;
      const p = pushOut(P, { x: trail[i].x + tr.range(-0.12, 0.12), z: trail[i].z + tr.range(-0.12, 0.12) }, 1.0);
      if (bridgeFoot(P, p.x, p.z, 0.5)) continue;
      const g = new THREE.CylinderGeometry(1, 1.05, 0.14, 9);
      const s = tr.range(0.28, 0.38);
      g.scale(s * tr.range(1, 1.3), 1, s).rotateY(tr.range(0, TAU)).translate(p.x, groundH(p.x, p.z) + 0.03, p.z);
      stoneG.push(g);
    }
    for (const g of stoneG) add('stone', g);
    pathLines.push(trail);
  }

  const distToPaths = (x, z) => {
    let m = 1e9;
    for (const line of pathLines) for (let i = 0; i < line.length; i += 2) { const d = Math.hypot(line[i].x - x, line[i].z - z); if (d < m) m = d; }
    return m;
  };

  function buildGardenPlants(P, gr) {
    const r = P.rng.fork('plants');
    const rk = P.pond.rockery;
    const ok = (x, z, m) => {
      if (x < gr.x0 + 1 || x > gr.x1 - 1 || z < gr.z0 + 1 || z > gr.z1 - 1) return false;
      if (P.inWater(x, z, 1.4 + m)) return false;
      if (distToPaths(x, z) < 1.5 + m) return false;
      for (const sp of L.PLAZA.sidePaths) if (x > sp.x0 - 1 - m && x < sp.x1 + 1 + m && z > sp.z0 - 1 - m && z < sp.z1 + 1 + m) return false;
      if (bridgeFoot(P, x, z, 1.5 + m)) return false;
      if (Math.hypot(x - rk.x, z - rk.z) < 6.5 + m) return false;
      return true;
    };
    // 灌木團
    let made = 0, tries = 0;
    while (made < 46 && tries++ < 900) {
      let cx, cz;
      if (r() < 0.6) { // 沿步道兩側
        const line = r.pick(pathLines), p = line[r.int(0, line.length - 1)];
        const a = r.range(0, TAU), d = r.range(2.6, 4.5);
        cx = p.x + Math.cos(a) * d; cz = p.z + Math.sin(a) * d;
      } else { cx = r.range(gr.x0, gr.x1); cz = r.range(gr.z0, gr.z1); }
      if (!ok(cx, cz, 0.8)) continue;
      made++;
      const t = r();
      const key = t < 0.42 ? 'pink' : t < 0.72 ? 'red' : 'hedge';
      const n = r.int(3, 8);
      for (let i = 0; i < n; i++) {
        const x = cx + r.gauss() * 1.3, z = cz + r.gauss() * 1.3;
        if (!ok(x, z, 0)) continue;
        shrubBalls[key].push({ x, z, r: r.range(0.45, 0.85), flat: key === 'hedge' ? 0.75 : 0.62 });
      }
    }
    // 景石
    let st = 0; tries = 0;
    while (st < 7 && tries++ < 300) {
      const line = r.pick(pathLines.slice(0, 3)), p = line[r.int(0, line.length - 1)];
      const a = r.range(0, TAU), d = r.range(2.2, 3.4), x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (!ok(x, z, -0.6)) continue;
      st++;
      const h = r.range(0.9, 2.1);
      pushRock(x, groundH(x, z) + h * 0.35, z, r.range(0.5, 0.8), h, r.range(0.45, 0.7));
      if (r() < 0.6) pushRock(x + r.range(-1, 1), groundH(x, z) + 0.1, z + r.range(-1, 1), 0.45, 0.3, 0.4);
    }
  }

  ponds.forEach((P, i) => {
    buildPondGround(P);
    buildShoreRocks(P);
    buildLilies(P);
    buildRockery(P);
    buildBridge(P);
    const lines0 = pathLines.length;
    buildGardenPaths(P);
    const gr = G.chineseGardens.find((g) => P.c.x >= g.x0 && P.c.x <= g.x1 && P.c.z >= g.z0 && P.c.z <= g.z1) || G.chineseGardens[i];
    // 只用本池的步道做避讓
    const mine = pathLines.splice(lines0);
    const others = pathLines.splice(0);
    pathLines.push(...mine);
    buildGardenPlants(P, gr);
    pathLines.splice(0);
    pathLines.push(...others, ...mine);
  });

  // ==========================================================================
  // 6. 主殿三面灌木帶、階梯兩側草坪綠籬帶
  // ==========================================================================
  const HB = G.hallShrubBands, hc = L.HALL.center;
  const mid = (HB.innerHalf + HB.outerHalf) / 2;
  const has = (s) => HB.sides.includes(s);
  const hbRng = makeRng('gardens/hallBands');
  const line = (x0, z0, x1, z1) => densify([{ x: x0, z: z0 }, { x: x1, z: z1 }], false, 0.1);
  const farStep = () => 0.7;
  for (const side of HB.sides) {
    const horiz = side === 'north' || side === 'south';
    const sgn = side === 'north' || side === 'west' ? -1 : 1;
    const lo = horiz ? (has('west') ? -mid : -HB.outerHalf + 0.8) : (has('north') ? -mid : -HB.outerHalf + 0.8);
    const hi = horiz ? (has('east') ? mid : HB.outerHalf - 0.8) : (has('south') ? mid : HB.outerHalf - 0.8);
    const P0 = horiz ? { x: hc.x + lo, z: hc.z + sgn * mid } : { x: hc.x + sgn * mid, z: hc.z + lo };
    const P1 = horiz ? { x: hc.x + hi, z: hc.z + sgn * mid } : { x: hc.x + sgn * mid, z: hc.z + hi };
    addHedge(line(P0.x, P0.z, P1.x, P1.z), false, 1.1, 0.75, { step: farStep, near: () => false });
    // 灌木球（內外兩排交錯）
    let k = 0;
    for (let a = lo + 3; a <= hi - 3; a += 6.5, k++) {
      const off = k % 2 ? HB.innerHalf + 1.7 : HB.outerHalf - 1.7;
      const along = a + hbRng.range(-0.6, 0.6);
      const x = horiz ? hc.x + along : hc.x + sgn * off, z = horiz ? hc.z + sgn * off : hc.z + along;
      const t = hbRng();
      shrubBalls[t < 0.18 ? 'red' : t < 0.3 ? 'pink' : 'hedge'].push({ x, z, r: hbRng.range(0.6, 0.85) });
    }
  }
  for (const r of L.PLAZA.stairLawns) {
    const backAtX1 = Math.abs(r.x1 - hc.x) < Math.abs(r.x0 - hc.x);
    const xb = backAtX1 ? r.x1 - 1.0 : r.x0 + 1.0, xf = backAtX1 ? r.x0 + 0.7 : r.x1 - 0.7;
    addHedge(line(xb, r.z0 + 0.6, xb, r.z1 - 0.6), false, 1.3, 1.0, { step: farStep, near: () => false });
    addHedge(line(xf, r.z0 + 0.6, xf, r.z1 - 0.6), false, 0.6, 0.45, { step: farStep, near: () => false });
    const xs = backAtX1 ? xb - 1.7 : xb + 1.7;
    for (let z = r.z0 + 4; z <= r.z1 - 3; z += 8.5) shrubBalls.hedge.push({ x: xs, z: z + hbRng.range(-0.5, 0.5), r: hbRng.range(0.55, 0.75) });
  }

  // ==========================================================================
  // 合併與 instancing
  // ==========================================================================
  finalizeBuckets();

  // 花團（兩級細緻度）
  const clumpGeo = [blob(2, 'clump0', 'flower', 0.32), blob(1, 'clump1', 'flower', 0.28)];
  const flowerMat = { maroon: M.flowerMaroon, yellow: M.flowerYellow, red: M.flowerRed, pink: M.flowerPink };
  for (const key of Object.keys(clumps)) for (const lod of [0, 1]) instanced(`clump-${key}-${lod}`, clumpGeo[lod], flowerMat[key], clumps[key][lod]);

  // 灌木球／杜鵑
  const shrubGeo = blob(1, 'shrub', 'leafy', 0.22);
  const shrubMat = { hedge: M.hedge, red: M.flowerRed, pink: M.flowerPink };
  const sr = makeRng('gardens/shrubTint');
  for (const key of Object.keys(shrubBalls)) {
    const list = shrubBalls[key].map((s) => {
      const k = sr.range(0.82, 1.15), fl = s.flat ?? 0.85;
      const tint = key === 'hedge' ? [k * sr.range(0.92, 1.08), k, k * sr.range(0.85, 1.0)] : [k, k * sr.range(0.9, 1.15), k];
      return { x: s.x, y: groundH(s.x, s.z) + s.r * fl * 0.72, z: s.z, sx: s.r * sr.range(0.95, 1.15), sy: s.r * fl, sz: s.r * sr.range(0.95, 1.15), ry: sr.range(0, TAU), c: tint };
    });
    instanced(`shrub-${key}`, shrubGeo, shrubMat[key], list);
  }

  // 石塊
  rockLists.forEach((list, i) => instanced(`rocks${i}`, rockGeoms[i], M.stone, list));
  // 睡蓮
  instanced('lilypads', padGeom, M.foliage, pads, { cast: false });
  instanced('lotus', blob(1, 'lotus', 'flower', 0.4), M.flowerPink, lotus, { cast: false });
  // 水花
  const sp = instanced('splash', blob(1, 'splash', 'leafy', 0.3), splashMat, splashes, { cast: false, receive: false });
  if (sp) sp.renderOrder = 3;

  return group;
}
