// 由 layout.js 畫出平面圖 SVG：node tools/plan.mjs > plan.svg
import * as L from '../src/layout.js';
import { halfRect } from '../src/geo.js';

const pad = 70, x0 = -540, x1 = 160, z0 = -260, z1 = 255;
const S = 1.6; // px / m
const W = (x1 - x0) * S, H = (z1 - z0) * S;
const X = (x) => ((x - x0) * S).toFixed(1), Z = (z) => ((z - z0) * S).toFixed(1);
const out = [];
const rect = (r, fill, stroke = 'none', extra = '') =>
  out.push(`<rect x="${X(r.x0)}" y="${Z(r.z0)}" width="${((r.x1 - r.x0) * S).toFixed(1)}" height="${((r.z1 - r.z0) * S).toFixed(1)}" fill="${fill}" stroke="${stroke}" ${extra}/>`);
const label = (x, z, t, size = 11, color = '#222') =>
  out.push(`<text x="${X(x)}" y="${Z(z)}" font-size="${size}" fill="${color}" text-anchor="middle" dominant-baseline="middle">${t}</text>`);
const circle = (x, z, r, fill, stroke = 'none') => out.push(`<circle cx="${X(x)}" cy="${Z(z)}" r="${(r * S).toFixed(1)}" fill="${fill}" stroke="${stroke}"/>`);

// 道路、人行道
for (const r of Object.values(L.ROADS)) { rect(r.rect, '#55575c'); if (r.median) rect(r.median, '#6f8a52'); }
for (const s of L.SIDEWALKS) rect(s.rect, '#b9ada0');
// 園區草地
rect({ x0: L.SITE.xMin, x1: L.SITE.xMax, z0: L.SITE.zMin, z1: L.SITE.zMax }, '#8fb46f');
// 林帶
for (const b of L.TREES.belts) rect(b, '#5f8f4a', 'none', 'opacity="0.75"');
// 鋪面
const P = L.PLAZA;
rect(P.libertySquare, '#d8d2c6');
rect({ x0: P.boulevard.x0, x1: P.boulevard.x1, z0: -P.boulevard.halfWidth, z1: P.boulevard.halfWidth }, '#d8d2c6');
for (const r of [...P.sideAvenues, ...P.sidePaths, ...P.crossPaths]) rect(r, '#d8d2c6');
rect(P.hallForecourt, '#d8d2c6');
rect(P.gateForecourt, '#b5604c');
const hr = P.hallRing;
rect({ x0: -hr.outerHalf, x1: hr.outerHalf, z0: -hr.outerHalf, z1: -hr.innerHalf }, '#d8d2c6');
rect({ x0: -hr.outerHalf, x1: hr.outerHalf, z0: hr.innerHalf, z1: hr.outerHalf }, '#d8d2c6');
rect({ x0: hr.innerHalf, x1: hr.outerHalf, z0: -hr.outerHalf, z1: hr.outerHalf }, '#d8d2c6');
const orn = P.libertySquare.ornament;
rect(halfRect(orn.x, orn.z, orn.half, orn.half), 'none', '#9a9286', 'stroke-dasharray="4 3"');
// 花壇
for (const p of L.GARDENS.parterres) rect(p, '#6d9a4e', '#3d6a28');
// 池
for (const p of L.GARDENS.ponds) {
  out.push(`<ellipse cx="${X(p.center.x)}" cy="${Z(p.center.z)}" rx="${p.radiusX * S}" ry="${p.radiusZ * S}" transform="rotate(${(p.rotation * 180 / Math.PI).toFixed(1)} ${X(p.center.x)} ${Z(p.center.z)})" fill="#4f7f9a"/>`);
  label(p.center.x, p.center.z, p.name, 11, '#fff');
}
// 主殿
for (const t of L.HALL.baseTiers) rect(halfRect(0, 0, t.half, t.half), '#f2efe8', '#8a857c');
const bh = L.HALL.body.coreHalf + L.HALL.body.cornerProtrusion;
rect(halfRect(0, 0, bh, bh), '#ffffff', '#555');
out.push(`<polygon points="${[...Array(8)].map((_, i) => { const a = Math.PI / 8 + i * Math.PI / 4; return `${X(L.HALL.roof.lowerEave.radius * Math.cos(a))},${Z(L.HALL.roof.lowerEave.radius * Math.sin(a))}`; }).join(' ')}" fill="#2f4f9a" opacity="0.85"/>`);
rect({ x0: L.HALL.stairs.x0, x1: L.HALL.stairs.x1, z0: -L.HALL.stairs.halfWidth, z1: L.HALL.stairs.halfWidth }, '#e6e1d6', '#8a857c');
label(0, 0, '主殿', 13, '#fff');
// 牌樓、側門
const G = L.GATE;
rect(halfRect(G.center.x, G.center.z, G.depth / 2, G.width / 2), '#ffffff', '#2f4f9a', 'stroke-width="2"');
label(G.center.x - 28, 0, '牌樓', 12);
for (const sg of Object.values(L.SIDE_GATES)) {
  rect(halfRect(sg.center.x, sg.center.z, sg.width / 2, sg.depth / 2), '#ffffff', '#2f4f9a', 'stroke-width="2"');
  label(sg.center.x, sg.center.z + (sg.facing === '-z' ? -22 : 22), sg.name, 11);
}
// 兩廳院
for (const b of [L.HALLS2.concertHall, L.HALLS2.theater]) {
  rect(halfRect(b.center.x, b.center.z, L.HALLS2.podium.halfX, L.HALLS2.podium.halfZ), '#e4dccb', '#8a857c');
  rect(halfRect(b.center.x, b.center.z, L.HALLS2.building.halfX, L.HALLS2.building.halfZ), '#d9a13a', '#a3201c');
  const sz = b.frontFacing === '+z' ? 1 : -1, fs = L.HALLS2.frontStairs;
  const zEdge = b.center.z + sz * L.HALLS2.podium.halfZ;
  rect({ x0: b.center.x - fs.halfWidth, x1: b.center.x + fs.halfWidth, z0: Math.min(zEdge, zEdge + sz * fs.run), z1: Math.max(zEdge, zEdge + sz * fs.run) }, '#e6e1d6', '#8a857c');
  label(b.center.x, b.center.z, b.name, 12);
}
// 圍牆
const S0 = L.SITE, d = L.WALL.depth;
out.push(`<rect x="${X(S0.xMin)}" y="${Z(S0.zMin)}" width="${(S0.xMax - S0.xMin) * S}" height="${(S0.zMax - S0.zMin) * S}" fill="none" stroke="#2f4f9a" stroke-width="${d * S}" opacity="0.7"/>`);
// 龍柏列、主角樹、造型松
const cr = L.TREES.cypressRows;
for (const z of cr.zs) for (let x = cr.x0; x <= cr.x1; x += cr.spacing) circle(x, z, 1.2, '#2f5a2c');
for (const p of L.TREES.hallPines) circle(p.x, p.z, 2.5, '#2c4a2a');
for (const p of L.TREES.hallTallConifers) circle(p.x, p.z, 3.5, '#1f3a20');
for (const pl of L.TREES.palms) for (let z = pl.z0; z <= pl.z1; z += pl.spacing) if (!(pl.skipZ && z > pl.skipZ[0] && z < pl.skipZ[1])) circle(pl.x, z, 1.5, '#6f8a32');
// 旗桿、燈
circle(P.flagpole.x, P.flagpole.z, 1.4, '#c33');
for (let x = P.lamps.x0; x <= P.lamps.x1; x += P.lamps.spacing) for (const z of P.lamps.zOffsets) circle(x, z, 0.8, '#333');
// 鏡頭焦點
for (const [k, f] of Object.entries(L.FOCUS)) { circle(f.x, f.z, 2.2, 'none', '#e0217a'); out.push(`<text x="${(+X(f.x) + 5).toFixed(1)}" y="${(+Z(f.z) - 5).toFixed(1)}" font-size="9" fill="#e0217a">${k}</text>`); }
// 太陽方向箭頭（從場地中心指向太陽）
const sd = L.SUN.dir, cx = -175, cz = 0, len = 140;
out.push(`<line x1="${X(cx)}" y1="${Z(cz)}" x2="${X(cx + sd.x / Math.hypot(sd.x, sd.z) * len)}" y2="${Z(cz + sd.z / Math.hypot(sd.x, sd.z) * len)}" stroke="#f08a1c" stroke-width="3" marker-end="url(#arr)"/>`);
label(cx + sd.x / Math.hypot(sd.x, sd.z) * (len + 20), cz + sd.z / Math.hypot(sd.x, sd.z) * (len + 20), '太陽 西南西 247.5°／仰角 7°', 12, '#c0600c');
// 路名
for (const r of Object.values(L.ROADS)) {
  const c = { x: (Math.max(r.rect.x0, x0) + Math.min(r.rect.x1, x1)) / 2, z: (Math.max(r.rect.z0, z0) + Math.min(r.rect.z1, z1)) / 2 };
  const vertical = r.rect.z1 - r.rect.z0 > r.rect.x1 - r.rect.x0;
  if (vertical) out.push(`<text x="${X(c.x)}" y="${Z(-120)}" font-size="12" fill="#fff" text-anchor="middle" transform="rotate(-90 ${X(c.x)} ${Z(-120)})">${r.name}</text>`);
  else label(c.x, c.z, r.name, 12, '#fff');
}
// 比例尺、指北
const sb = { x: -520, z: 238 };
out.push(`<line x1="${X(sb.x)}" y1="${Z(sb.z)}" x2="${X(sb.x + 100)}" y2="${Z(sb.z)}" stroke="#000" stroke-width="3"/>`);
label(sb.x + 50, sb.z + 8, '100 m', 11, '#000');
out.push(`<g transform="translate(${W - 40},${pad + 10})"><polygon points="0,-22 8,6 0,0 -8,6" fill="#000"/><text y="22" font-size="13" text-anchor="middle">N</text></g>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + pad}" viewBox="0 ${-pad} ${W} ${H + pad}" font-family="Noto Sans TC, WenQuanYi Zen Hei, sans-serif">
<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#f08a1c"/></marker></defs>
<rect x="0" y="${-pad}" width="${W}" height="${H + pad}" fill="#ece8df"/>
<text x="16" y="${-pad + 28}" font-size="20" font-weight="bold">中正紀念堂・黃昏　場景平面圖（layout.js）</text>
<text x="16" y="${-pad + 52}" font-size="12">座標：x 向東、z 向南、單位公尺；原點＝主殿中心。粉紅圈＝鏡頭特寫焦點。</text>
${out.join('\n')}
</svg>`;
process.stdout.write(svg);
