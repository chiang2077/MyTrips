// 預覽／輸出入口
// URL 參數：
//   zones=all | hall,gate,...      要載入的區域
//   mode=shots（預設，播放 10 顆鏡頭）| free（自由視角）| still（固定鏡頭，給截圖用）
//   cam=x,y,z & target=x,y,z & fov=40   （mode=still / free 的初始鏡頭）
//   t=秒數                          （mode=shots 時跳到該時間）
//   w=1280&h=720                    （固定輸出解析度；省略則填滿視窗）
//   shadow=cx,cz,radius             （mode=still 時的陰影範圍）
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildScene, createRenderer, ZONES } from './scene.js';
import { SHOTS, TOTAL_DURATION, evaluateTimeline } from './shots.js';

const q = new URLSearchParams(location.search);
const num3 = (s) => (s ? s.split(',').map(Number) : null);
const zones = !q.get('zones') || q.get('zones') === 'all' ? ZONES : q.get('zones').split(',');
const mode = q.get('mode') || 'shots';
const fixedW = Number(q.get('w')) || 0, fixedH = Number(q.get('h')) || 0;

const canvas = document.getElementById('c');
const W = () => fixedW || window.innerWidth, H = () => fixedH || window.innerHeight;
const renderer = createRenderer(canvas, { width: W(), height: H(), pixelRatio: fixedW ? 1 : Math.min(2, devicePixelRatio) });

const camera = new THREE.PerspectiveCamera(Number(q.get('fov')) || 40, W() / H(), 0.3, 60000);
const world = await buildScene(renderer, { zones, quality: q.get('quality') || 'high' });
const { scene, setShadowFocus } = world;

const rt = new THREE.WebGLRenderTarget(W(), H(), { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(W(), H());
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.22, 0.6, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  if (fixedW) return;
  renderer.setSize(W(), H(), false);
  composer.setSize(W(), H());
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

function applyShotState(s) {
  camera.position.copy(s.position);
  camera.lookAt(s.target);
  if (camera.fov !== s.fov) { camera.fov = s.fov; camera.updateProjectionMatrix(); }
  setShadowFocus(s.shadowCenter, s.shadowRadius);
}

function draw() { composer.render(); }

// 給輸出工具用：渲染指定時間的畫面
window.__renderAt = (t) => { applyShotState(evaluateTimeline(t)); draw(); return true; };
// 給截圖工具用：換一個固定鏡頭再畫一張（字串 'x,y,z'）
window.__still = (cam, target, fov = 40) => {
  const c = num3(cam), t = num3(target);
  camera.position.set(...c);
  camera.lookAt(...t);
  camera.fov = fov; camera.updateProjectionMatrix();
  setShadowFocus({ x: t[0], z: t[2] }, Math.min(400, Math.max(60, camera.position.distanceTo(new THREE.Vector3(...t)) * 1.2)));
  draw();
  return true;
};
window.__stats = world.stats;
window.__shots = SHOTS.map((s) => ({ id: s.id, title: s.title }));
window.__duration = TOTAL_DURATION;

const hud = document.getElementById('hud');
const scrub = document.getElementById('scrub');

if (mode === 'still' || mode === 'free') {
  const c = num3(q.get('cam')) || [-700, 160, 250];
  const t = num3(q.get('target')) || [-150, 0, 0];
  camera.position.set(...c);
  camera.lookAt(...t);
  const sh = num3(q.get('shadow'));
  if (sh) setShadowFocus({ x: sh[0], z: sh[1] }, sh[2]);
  else setShadowFocus({ x: t[0], z: t[2] }, Math.min(400, Math.max(60, camera.position.distanceTo(new THREE.Vector3(...t)) * 1.2)));
  if (mode === 'free') {
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(...t);
    controls.update();
    controls.addEventListener('change', () => { setShadowFocus({ x: controls.target.x, z: controls.target.z }, 360); });
    renderer.setAnimationLoop(() => { controls.update(); draw(); });
  } else {
    draw();
  }
  if (hud) hud.textContent = `zones: ${zones.join(', ')}`;
} else if (q.has('capture') || fixedW) {
  // 輸出／截圖模式：不跑動畫迴圈，由 __renderAt(t) 逐格驅動
  window.__renderAt(Number(q.get('t')) || 0);
} else {
  let t = Number(q.get('t')) || 0;
  let playing = !q.has('t');
  let last = performance.now();
  if (scrub) {
    scrub.max = String(TOTAL_DURATION);
    scrub.addEventListener('input', () => { t = Number(scrub.value); playing = false; });
    document.getElementById('play').addEventListener('click', () => { playing = !playing; last = performance.now(); });
  }
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    if (playing) { t = (t + (now - last) / 1000) % TOTAL_DURATION; if (scrub) scrub.value = String(t); }
    last = now;
    const s = evaluateTimeline(t);
    applyShotState(s);
    draw();
    if (hud) hud.textContent = `${t.toFixed(2)} s　鏡頭 ${s.index + 1}／${SHOTS.length}　${s.title}`;
  });
}

window.__ready = true;
document.body.dataset.ready = '1';
