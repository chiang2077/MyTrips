// 10 顆鏡頭 × 7 秒 = 70 秒
// 每顆：特寫小物件 → 停一下 → 加速拉遠 → 結尾放慢，露出整個場景
// 所有位置都由 layout.js 的 FOCUS／建物座標推算（這裡只寫「相對位移」）
import * as THREE from 'three';
import { FOCUS as F, HALL, GATE, HALLS2 } from './layout.js';

export const SHOT_DURATION = 7;
export const HOLD = 0.9;          // 開頭停留秒數

const v = (p, dx = 0, dy = 0, dz = 0) => new THREE.Vector3(p.x + dx, (p.y ?? 0) + dy, p.z + dz);
const theater = HALLS2.theater.center;

export const SHOTS = [
  {
    id: 1, title: '牌樓匾額 → 牌樓與民主大道全景', subject: '牌樓',
    from: { pos: v(F.gatePlaque, -13, -1.6, 4.5), target: v(F.gatePlaque), fov: 30 },
    to:   { pos: v(GATE.center, -52, 56, 55), target: v(GATE.center, 150, 8, 0), fov: 46 },  // 中山南路對街上空
    shadow: [30, 320],
  },
  {
    id: 2, title: '花壇花帶 → 庭園與主殿', subject: '庭園',
    from: { pos: v(F.parterreBed, -3.5, 0.9, 3.2), target: v(F.parterreBed, 0, -0.3, 0), fov: 34 },
    to:   { pos: v(F.parterreBed, -58, 34, 40), target: v(HALL.focus, -20, -2, 0), fov: 44 },
    via:  v(F.parterreBed, -20, 6, 22),
    shadow: [14, 320],
  },
  {
    id: 3, title: '龍柏樹梢 → 林蔭大道', subject: '樹木',
    from: { pos: v(F.cypressTip, -2.6, 0.5, 3.0), target: v(F.cypressTip, 0, -0.6, 0), fov: 32 },
    to:   { pos: v(F.cypressTip, -36, 9, 23), target: v(F.cypressTip, 160, -2, -6), fov: 46 },
    shadow: [12, 260],
  },
  {
    id: 4, title: '廣場燈柱 → 自由廣場與兩廳院', subject: '廣場',
    from: { pos: v(F.squareLamp, -2.6, 0.4, 3.0), target: v(F.squareLamp, 0, -0.2, 0), fov: 32 },
    to:   { pos: v(F.squareLamp, -15, 44, 10), target: v(GATE.center, 145, 4, 0), fov: 50 },
    via:  v(F.squareLamp, -12, 10, 12),
    shadow: [10, 240],
  },
  {
    id: 5, title: '拱橋 → 雲漢池與國家戲劇院（逆光水面）', subject: '庭園',
    from: { pos: v(F.pondBridge, 6, -0.3, -10), target: v(F.pondBridge, 0, 0.2, 0), fov: 32 },
    to:   { pos: v(F.pondBridge, 62, 22, -14), target: v(theater, 40, 12, 0), fov: 46 },
    shadow: [24, 260],
  },
  {
    id: 6, title: '大孝門 → 圍牆迴廊與主殿', subject: '牌樓',
    from: { pos: v(F.sideGate, -4.5, -0.6, 7.5), target: v(F.sideGate), fov: 32 },
    to:   { pos: v(F.sideGate, -62, 34, 26), target: v(F.sideGate, 90, -14, -105), fov: 48 },
    via:  v(F.sideGate, -18, 6, 20),
    shadow: [18, 260],
  },
  {
    id: 7, title: '造型松 → 主殿正面', subject: '樹木',
    from: { pos: v(F.hallPine, -4.2, 0.2, 3.0), target: v(F.hallPine, 0, 0.3, 0), fov: 32 },
    to:   { pos: v(F.hallPine, -105, 20, -14), target: v(HALL.focus, 5, 8, 0), fov: 44 },
    via:  v(F.hallPine, -30, 4, 2),
    shadow: [12, 220],
  },
  {
    id: 8, title: '旗桿基座 → 民主大道中軸', subject: '廣場',
    from: { pos: v(F.flagpoleBase, -3.0, 0.2, 2.4), target: v(F.flagpoleBase), fov: 32 },
    to:   { pos: v(F.flagpoleBase, -62, 4.5, 7), target: v(HALL.focus, 0, 10, 0), fov: 34 },
    shadow: [10, 320],
  },
  {
    id: 9, title: '牌樓屋脊剪影 → 夕陽下的牌樓', subject: '牌樓',
    from: { pos: v(F.gateRidgeEnd, 6.5, -0.6, 3.2), target: v(F.gateRidgeEnd), fov: 32 },
    to:   { pos: v(GATE.center, 135, 26, 30), target: v(GATE.center, -20, 18, 8), fov: 50 },
    shadow: [20, 260],
  },
  {
    id: 10, title: '逆光樹木 → 空拍整座中正紀念堂', subject: '樹木',
    from: { pos: v(F.backlitTree, 12.8, -2.5, -5.3), target: v(F.backlitTree, 0, 0.5, 0), fov: 36 },  // 相機在樹的東北東，正對西南西的夕陽
    to:   { pos: v(F.siteCenter, -470, 340, 400), target: v(F.siteCenter, 30, -20, -20), fov: 42 },
    via:  v(F.backlitTree, -40, 110, 120),
    shadow: [30, 420],
  },
];

export const TOTAL_DURATION = SHOTS.length * SHOT_DURATION;

// 時間曲線：前 HOLD 秒靜止；之後 0→1，起步加速、結尾放慢（減速段比加速段長）
const smootherstep = (x) => x * x * x * (x * (x * 6 - 15) + 10);
export function motionCurve(t) {
  if (t <= HOLD) return 0;
  const u = Math.min(1, (t - HOLD) / (SHOT_DURATION - HOLD));
  return smootherstep(Math.pow(u, 0.82));
}

const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };
function bezier2(p0, p1, p2, t, out) {
  const s = 1 - t;
  return out.set(0, 0, 0).addScaledVector(p0, s * s).addScaledVector(p1, 2 * s * t).addScaledVector(p2, t * t);
}

// 給定全片時間（秒）→ 鏡頭狀態
export function evaluateTimeline(time) {
  const t = Math.max(0, Math.min(TOTAL_DURATION - 1e-6, time));
  const index = Math.floor(t / SHOT_DURATION);
  const shot = SHOTS[index];
  const local = t - index * SHOT_DURATION;
  const p = motionCurve(local);
  const via = shot.via || tmp.a.copy(shot.from.pos).lerp(shot.to.pos, 0.5)
    .add(new THREE.Vector3(0, 0.12 * shot.from.pos.distanceTo(shot.to.pos), 0));
  const position = bezier2(shot.from.pos, via, shot.to.pos, p, new THREE.Vector3());
  // 目標點略早到位，讓構圖先穩住再繼續後退
  const pt = Math.min(1, p * 1.12);
  const target = new THREE.Vector3().copy(shot.from.target).lerp(shot.to.target, pt);
  const fov = THREE.MathUtils.lerp(shot.from.fov, shot.to.fov, p);
  const shadowRadius = THREE.MathUtils.lerp(shot.shadow[0], shot.shadow[1], Math.pow(p, 0.7));
  const shadowCenter = tmp.b.copy(shot.from.target).lerp(shot.to.target, Math.pow(p, 0.7)).clone();
  return { index, id: shot.id, title: shot.title, local, p, position, target, fov, shadowRadius, shadowCenter };
}

