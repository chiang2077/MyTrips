// 後製管線：場景 → 清除壞像素 → 光暈 → 色調映射輸出
// 「清除壞像素」：某些 GPU 遇到退化幾何會算出 NaN／無限大的像素，
// 光暈的多層模糊會把一個壞像素擴散成畫面上的大黑塊，所以在光暈前先清掉並限制最大亮度。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const ScrubShader = {
  name: 'ScrubShader',
  uniforms: { tDiffuse: { value: null }, maxValue: { value: 64.0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float maxValue;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      bool bad = any(isnan(c)) || any(isinf(c)) || !(c.r == c.r && c.g == c.g && c.b == c.b)
        || any(greaterThan(abs(c.rgb), vec3(1.0e4)));
      gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : vec4(clamp(c.rgb, 0.0, maxValue), 1.0);
    }`,
};

export function makeComposer(renderer, scene, camera, { width, height, msaa = 4, bloom = true }) {
  const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: msaa });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass(ScrubShader));
  if (bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.22, 0.6, 0.92));
  composer.addPass(new OutputPass());
  return composer;
}
