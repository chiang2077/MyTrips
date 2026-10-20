// 黃昏天空（程式生成）：天頂藍紫 → 地平線橘粉；太陽方向的光暈與日輪；被夕陽打亮的薄雲
import * as THREE from 'three';

const vert = /* glsl */`
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = normalize(wp.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w * 0.9999; // 永遠在最遠處
}`;

const frag = /* glsl */`
uniform vec3 sunDir;
uniform vec3 zenith;
uniform vec3 midSky;
uniform vec3 horizonWarm;
uniform vec3 horizonCool;
uniform vec3 sunColor;
uniform vec3 ground;
uniform float cloudAmount;
uniform float exposure;
varying vec3 vDir;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float sunDot = max(dot(d, sunDir), 0.0);
  // 水平方向與太陽的夾角（決定地平線冷暖）
  vec2 hd = normalize(d.xz + 1e-5), hs = normalize(sunDir.xz);
  float side = dot(hd, hs) * 0.5 + 0.5;
  vec3 horizon = mix(horizonCool, horizonWarm, pow(side, 1.6));

  float hh = max(h, 0.0);
  vec3 col = mix(horizon, midSky, smoothstep(0.0, 0.28, hh));
  col = mix(col, zenith, smoothstep(0.22, 0.9, hh));
  // 地平線附近一條亮霧帶
  col += horizon * 0.35 * exp(-hh * 22.0);

  // 太陽光暈與日輪
  col += sunColor * (0.55 * pow(sunDot, 6.0) + 1.4 * pow(sunDot, 60.0) + 3.0 * pow(sunDot, 600.0));
  col += sunColor * 40.0 * smoothstep(0.99985, 0.99995, sunDot);

  // 薄雲（高空層狀雲，投影到平面）
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.6;
    float c = fbm(uv * vec2(1.0, 3.2) + vec2(3.0, 0.0));
    c = smoothstep(0.52, 0.85, c) * cloudAmount * smoothstep(0.0, 0.08, h);
    vec3 lit = mix(vec3(0.42, 0.36, 0.42), sunColor * 1.4, pow(sunDot, 3.0) * 0.9 + 0.25 * side);
    col = mix(col, lit, c * 0.85);
  }

  // 地平線以下（遠方被城市地坪擋住，這裡只是保險）
  col = mix(col, ground, smoothstep(0.0, -0.06, h));
  gl_FragColor = vec4(col * exposure, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeSky(sunVec, opts = {}) {
  const c = (x) => new THREE.Color(x);
  const mat = new THREE.ShaderMaterial({
    name: 'duskSky',
    vertexShader: vert, fragmentShader: frag,
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      sunDir: { value: sunVec.clone().normalize() },
      zenith: { value: c(0x2c4a7c) },
      midSky: { value: c(0x7f9cc4) },
      horizonWarm: { value: c(0xffa25a) },
      horizonCool: { value: c(0xd2a9a0) },
      sunColor: { value: c(0xffb36b) },
      ground: { value: c(0x6f6258) },
      cloudAmount: { value: opts.clouds ?? 0.75 },
      exposure: { value: opts.exposure ?? 1.0 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
  mesh.scale.setScalar(opts.radius ?? 50000);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.name = 'sky';
  return mesh;
}
