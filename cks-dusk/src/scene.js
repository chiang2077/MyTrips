// 組裝場景：天空、太陽、環境光、霧、各區模型
import * as THREE from 'three';
import { makeSky } from './sky.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as L from './layout.js';
import * as geo from './geo.js';
import { makeRng, makeNoise2D } from './rng.js';
import { getMaterials, planarUV, boxUV, roofUV, makePlaqueTexture } from './materials.js';

// 保險：任何人（含函式庫）呼叫 Math.random 都拿到固定序列
Math.random = makeRng('Math.random');

export const ZONES = ['terrain', 'hall', 'gate', 'plaza', 'theaters', 'gardens', 'trees', 'walls'];

export function makeContext(quality = 'high') {
  return {
    THREE, L, geo, M: getMaterials(), makeRng, makeNoise2D,
    uv: { planarUV, boxUV, roofUV }, makePlaqueTexture,
    utils: { mergeGeometries, mergeVertices },
    quality,
  };
}

export function createRenderer(canvas, { width, height, pixelRatio = 1 }) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, logarithmicDepthBuffer: true, preserveDrawingBuffer: true, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export async function buildScene(renderer, { zones = ZONES, quality = 'high' } = {}) {
  const scene = new THREE.Scene();
  const ctx = makeContext(quality);
  const sd = L.SUN.dir;
  const sunVec = new THREE.Vector3(sd.x, sd.y, sd.z).normalize();

  // --- 天空（程式生成的黃昏漸層，見 sky.js）---
  const sky = makeSky(sunVec, { exposure: 0.8 });  // 補償整體曝光提高，天空維持原亮度
  scene.add(sky);

  // 環境光照：把天空烘成 PMREM，給琉璃、水面反射
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(makeSky(sunVec, { radius: 100 }));
  // 地面反射色（避免環境光下半球全黑）
  const groundDome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x3b3428, side: THREE.BackSide }));
  envScene.add(groundDome);
  scene.environment = pmrem.fromScene(envScene, 0.02, 0.1, 400).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  // --- 太陽 ---
  const sun = new THREE.DirectionalLight(L.SUN.color, L.SUN.intensity);
  sun.name = 'sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  // 天光補光（偏藍）＋地面反彈（偏暖）
  const hemi = new THREE.HemisphereLight(0x9cb2d6, 0x6a5440, 0.7);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2(0xc4a28c, 0.00024);

  // --- 各區 ---
  const loaded = {};
  for (const z of zones) {
    const mod = await import(`./zones/${z}.js`);
    const t0 = performance.now();
    const obj = await mod.build(ctx);
    obj.name = `zone:${z}`;
    scene.add(obj);
    loaded[z] = { ms: Math.round(performance.now() - t0), triangles: countTriangles(obj) };
  }

  // 陰影範圍：預設涵蓋整個園區；鏡頭可呼叫 setShadowFocus 收緊以提高解析度
  const setShadowFocus = (center, radius) => {
    const c = new THREE.Vector3(center.x, center.y ?? 0, center.z);
    sun.target.position.copy(c);
    sun.position.copy(c).addScaledVector(sunVec, 1500);
    const cam = sun.shadow.camera;
    cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
    cam.near = 1; cam.far = 3000;
    cam.updateProjectionMatrix();
    // 依解析度調整 normalBias（每 texel 尺寸）
    sun.shadow.normalBias = Math.max(0.05, (2 * radius / sun.shadow.mapSize.x) * 1.5);
    sun.target.updateMatrixWorld();
  };
  setShadowFocus(L.FOCUS.siteCenter, 360);

  return { scene, sun, sky, hemi, setShadowFocus, stats: loaded, ctx };
}

export function countTriangles(obj) {
  let n = 0;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const tri = (g.index ? g.index.count : g.attributes.position.count) / 3;
    n += tri * (o.isInstancedMesh ? o.count : 1);
  });
  return Math.round(n);
}
