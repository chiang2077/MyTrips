// 漫遊模式：第一人稱在園區裡走動，也可切換播放 70 秒鏡頭
// 鍵盤：WASD／方向鍵移動、Shift 跑、Q/E 升降、R 回到地面；滑鼠拖曳轉頭
// 觸控：左半邊搖桿移動、右半邊拖曳轉頭、▲▼ 升降
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildScene, createRenderer } from './scene.js';
import { evaluateTimeline, TOTAL_DURATION, SHOTS } from './shots.js';
import * as L from './layout.js';

const EYE = 1.65;
const ZONE_NAMES = { terrain: '地形與城市', hall: '主殿', gate: '牌樓', plaza: '廣場', theaters: '兩廳院', gardens: '庭園', trees: '樹木', walls: '圍牆迴廊' };
const $ = (id) => document.getElementById(id);
const coarse = matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------------------
// 地面高度：從 layout 推算（臺基、主殿大階梯、兩廳院平臺與台階）
// ---------------------------------------------------------------------------
function groundAt(x, z) {
  let h = 0;
  const H = L.HALL, cx = x - H.center.x, cz = z - H.center.z;
  for (const t of H.baseTiers) if (Math.abs(cx) <= t.half && Math.abs(cz) <= t.half) h = Math.max(h, t.top);
  const s = H.stairs;
  if (x >= s.x0 && x <= s.x1 && Math.abs(cz) <= s.halfWidth) h = Math.max(h, H.baseTiers[2].top * (x - s.x0) / (s.x1 - s.x0));
  const P = L.HALLS2.podium, fs = L.HALLS2.frontStairs;
  for (const b of [L.HALLS2.concertHall, L.HALLS2.theater]) {
    const dx = x - b.center.x, dz = z - b.center.z;
    if (Math.abs(dx) <= P.halfX && Math.abs(dz) <= P.halfZ) h = Math.max(h, P.top);
    const sz = b.frontFacing === '+z' ? 1 : -1, d = dz * sz - P.halfZ; // 0 = 平臺邊、fs.run = 台階底
    if (Math.abs(dx) <= fs.halfWidth && d > 0 && d <= fs.run) h = Math.max(h, P.top * (1 - d / fs.run));
  }
  return h;
}

// ---------------------------------------------------------------------------
// 傳送點（位置與視線都由 layout 推算）
// ---------------------------------------------------------------------------
const G = L.GATE, F = L.FOCUS, Hc = L.HALL.center;
const SPOTS = [
  { name: '自由廣場', pos: [G.center.x + 30, null, 30], look: [L.HALL.focus.x, 26, 0] },
  { name: '牌樓前', pos: [G.center.x - 28, null, 8], look: [F.gatePlaque.x, F.gatePlaque.y - 4, 0] },
  { name: '旗桿・民主大道', pos: [L.PLAZA.flagpole.x - 12, null, 7], look: [L.HALL.focus.x, 26, 0] },
  { name: '花壇', pos: [F.parterreBed.x - 4, null, F.parterreBed.z + 8], look: [L.HALL.focus.x, 20, 0] },
  { name: '雲漢池拱橋', pos: [F.pondBridge.x + 8, 6.6, F.pondBridge.z - 9], look: [L.HALLS2.theater.center.x, 14, L.HALLS2.theater.center.z] },
  { name: '主殿前廣場', pos: [L.PLAZA.hallForecourt.x0 + 18, null, 0], look: [L.HALL.focus.x, 36, 0] },
  // 站在第三層臺基前緣、略高於欄杆，回望民主大道與夕陽
  { name: '主殿大門回望', pos: [Hc.x - L.HALL.baseTiers[2].half + 3, L.HALL.baseTiers[2].top + 3.4, 12], look: [G.center.x, 6, 0] },
  { name: '大孝門外', pos: [L.SIDE_GATES.daxiao.center.x - 6, null, L.SIDE_GATES.daxiao.center.z + 22], look: [L.SIDE_GATES.daxiao.center.x, 9, L.SIDE_GATES.daxiao.center.z] },
  { name: '空拍', pos: [F.siteCenter.x - 470, 340, F.siteCenter.z + 400], look: [F.siteCenter.x + 30, -20, F.siteCenter.z - 20] },
];

// ---------------------------------------------------------------------------
// 啟動
// ---------------------------------------------------------------------------
const canvas = $('view');
const renderer = createRenderer(canvas, { width: innerWidth, height: innerHeight, pixelRatio: Math.min(devicePixelRatio, coarse ? 1.5 : 2) });
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 60000);

// 匾額用的字型先載好，canvas 才畫得出正確字形
try { await document.fonts.load('700 64px "Noto Serif TC"', '自由廣場中正紀念堂大忠孝門'); } catch (e) { /* 用後備字型 */ }

const list = $('load-list');
const world = await buildScene(renderer, {
  quality: 'high',
  onProgress: async (z, i, n) => {
    $('load-bar').style.setProperty('--p', `${(i / n) * 100}%`);
    const li = document.createElement('li');
    li.textContent = ZONE_NAMES[z] || z;
    list.appendChild(li);
    await new Promise((r) => requestAnimationFrame(r)); // 讓進度條先畫出來
  },
});
const { scene, sun, setShadowFocus } = world;
if (coarse) sun.shadow.mapSize.setScalar(2048);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: coarse ? 2 : 4 }));
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.6, 0.92));
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  dirty = 3;
});

// ---------------------------------------------------------------------------
// 狀態
// ---------------------------------------------------------------------------
const st = { x: 0, z: 0, eyeY: EYE, fly: 0, yaw: 0, pitch: 0 };
let mode = 'walk', playT = 0, dirty = 3;

function goSpot(s) {
  st.x = s.pos[0]; st.z = s.pos[2];
  const g = groundAt(st.x, st.z);
  st.fly = s.pos[1] == null ? 0 : Math.max(0, s.pos[1] - g - EYE);
  st.eyeY = g + EYE + st.fly;
  const dx = s.look[0] - st.x, dy = s.look[1] - st.eyeY, dz = s.look[2] - st.z;
  st.yaw = Math.atan2(dz, dx);
  st.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  document.querySelectorAll('#spots button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.name === s.name)));
  if (mode !== 'walk') setMode('walk');
  dirty = 3;
}

const spotsEl = $('spots');
for (const s of SPOTS) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = s.name; b.dataset.name = s.name;
  b.addEventListener('click', () => { goSpot(s); b.blur(); }); // 移開焦點，WASD 才不會被按鈕吃掉
  spotsEl.appendChild(b);
}

// ---------------------------------------------------------------------------
// 輸入
// ---------------------------------------------------------------------------
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') { st.fly = 0; dirty = 3; }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// 拖曳轉頭（滑鼠、觸控右半邊）；觸控左半邊為搖桿
const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
const look = { id: null, x: 0, y: 0 };
const stickEl = $('stick'), knobEl = $('knob');
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'walk') return;
  canvas.setPointerCapture(e.pointerId);
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && stick.id === null) {
    Object.assign(stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
    stickEl.hidden = false;
    stickEl.style.transform = `translate(${e.clientX - 60}px, ${e.clientY - 60}px)`;
    knobEl.style.transform = 'translate(0px, 0px)';
  } else if (look.id === null) {
    Object.assign(look, { id: e.pointerId, x: e.clientX, y: e.clientY });
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === stick.id) {
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const r = Math.hypot(dx, dy), m = 50;
    if (r > m) { dx *= m / r; dy *= m / r; }
    stick.dx = dx / m; stick.dy = dy / m;
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (e.pointerId === look.id) {
    const k = e.pointerType === 'touch' ? 0.005 : 0.0035;
    st.yaw += (e.clientX - look.x) * k;
    st.pitch = THREE.MathUtils.clamp(st.pitch - (e.clientY - look.y) * k, -1.45, 1.45);
    look.x = e.clientX; look.y = e.clientY;
    dirty = 2;
  }
});
const endPtr = (e) => {
  if (e.pointerId === stick.id) { stick.id = null; stick.dx = stick.dy = 0; stickEl.hidden = true; }
  if (e.pointerId === look.id) look.id = null;
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { st.fly = Math.max(0, st.fly - e.deltaY * 0.05); dirty = 2; e.preventDefault(); }, { passive: false });

// ▲▼ 升降按鈕（按住連續）
const hold = { up: false, down: false };
for (const [id, k] of [['btn-up', 'up'], ['btn-down', 'down']]) {
  const el = $(id);
  el.addEventListener('pointerdown', (e) => { hold[k] = true; el.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { hold[k] = false; });
}
$('btn-ground').addEventListener('click', () => { st.fly = 0; dirty = 3; });

// ---------------------------------------------------------------------------
// 播放鏡頭
// ---------------------------------------------------------------------------
const playBtn = $('btn-play'), progEl = $('play-prog'), shotEl = $('shot-title');
function setMode(m) {
  mode = m;
  document.body.dataset.mode = m;
  playBtn.textContent = m === 'play' ? '回到漫遊' : '播放 70 秒鏡頭';
  playBtn.setAttribute('aria-pressed', String(m === 'play'));
  if (m === 'play') playT = 0;
  else camera.fov = 60, camera.updateProjectionMatrix();
  dirty = 3;
}
playBtn.addEventListener('click', () => setMode(mode === 'play' ? 'walk' : 'play'));

// ---------------------------------------------------------------------------
// 讀數
// ---------------------------------------------------------------------------
const DIRS = ['東', '東南', '南', '西南', '西', '西北', '北', '東北'];
const fmt = (v) => (v < 0 ? '−' : '') + Math.abs(Math.round(v));
function updateReadout() {
  // yaw 0 = 朝 +x（東），+z 是南
  const deg = ((st.yaw * 180 / Math.PI) % 360 + 360) % 360;
  $('ro-pos').textContent = `x ${fmt(st.x)} m　z ${fmt(st.z)} m`;
  $('ro-alt').textContent = `視高 ${st.eyeY.toFixed(1)} m`;
  $('ro-dir').textContent = `面向${DIRS[Math.round(deg / 45) % 8]}`;
}

// ---------------------------------------------------------------------------
// 主迴圈
// ---------------------------------------------------------------------------
const fwd = new THREE.Vector3(), tgt = new THREE.Vector3();
let last = performance.now(), lastShadow = { x: 1e9, z: 1e9, r: 0 };
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.25, (now - last) / 1000); // 慢的裝置每格最多推進 0.25 秒
  last = now;

  if (mode === 'play') {
    playT += dt;
    if (playT >= TOTAL_DURATION) { setMode('walk'); return; }
    const s = evaluateTimeline(playT);
    camera.position.copy(s.position);
    camera.lookAt(s.target);
    camera.fov = s.fov; camera.updateProjectionMatrix();
    setShadowFocus(s.shadowCenter, s.shadowRadius);
    progEl.style.setProperty('--p', `${(playT / TOTAL_DURATION) * 100}%`);
    shotEl.textContent = `鏡頭 ${s.index + 1}／${SHOTS.length}　${s.title}`;
    composer.render();
    return;
  }

  // 移動輸入
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
  if (keys.has('KeyD')) mx += 1;
  if (keys.has('KeyA')) mx -= 1;
  if (keys.has('ArrowLeft')) { st.yaw -= 1.6 * dt; dirty = 2; }
  if (keys.has('ArrowRight')) { st.yaw += 1.6 * dt; dirty = 2; }
  mx += stick.dx; mz -= stick.dy;
  let vy = 0;
  if (keys.has('KeyE') || keys.has('PageUp') || hold.up) vy += 1;
  if (keys.has('KeyQ') || keys.has('PageDown') || hold.down) vy -= 1;

  const run = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3 : 1;
  const speed = (4.5 + st.fly * 0.6) * run; // 越高飛越快
  if (mx || mz) {
    const len = Math.min(1, Math.hypot(mx, mz));
    const a = Math.atan2(mx, mz);
    st.x += Math.cos(st.yaw + a) * speed * len * dt;
    st.z += Math.sin(st.yaw + a) * speed * len * dt;
    st.x = THREE.MathUtils.clamp(st.x, -3000, 3000);
    st.z = THREE.MathUtils.clamp(st.z, -3000, 3000);
    dirty = 2;
  }
  if (vy) { st.fly = THREE.MathUtils.clamp(st.fly + vy * (6 + st.fly * 0.9) * dt, 0, 900); dirty = 2; }

  // 視高平滑追地面（上階梯、上臺基）
  const want = groundAt(st.x, st.z) + EYE + st.fly;
  if (Math.abs(want - st.eyeY) > 0.005) { st.eyeY += (want - st.eyeY) * Math.min(1, dt * 8); dirty = Math.max(dirty, 1); }

  if (dirty <= 0) return; // 沒動就不重畫，省電
  dirty--;

  camera.position.set(st.x, st.eyeY, st.z);
  fwd.set(Math.cos(st.yaw) * Math.cos(st.pitch), Math.sin(st.pitch), Math.sin(st.yaw) * Math.cos(st.pitch));
  camera.lookAt(tgt.copy(camera.position).add(fwd));

  // 陰影範圍跟著視點（越高範圍越大）；移動超過一段距離才重算
  const r = THREE.MathUtils.clamp(140 + st.fly * 1.2, 140, 420);
  const cx = st.x + fwd.x * r * 0.6, cz = st.z + fwd.z * r * 0.6;
  if (Math.hypot(cx - lastShadow.x, cz - lastShadow.z) > r * 0.15 || Math.abs(r - lastShadow.r) > 20) {
    setShadowFocus({ x: cx, z: cz }, r);
    lastShadow = { x: cx, z: cz, r };
  }
  composer.render();
  updateReadout();
});

goSpot(SPOTS[0]);
document.body.dataset.ready = '1';
$('loading').hidden = true;
window.__ready = true;
