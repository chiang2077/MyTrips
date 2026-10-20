// 區域：walls（施工中）
// 介面：export function build(ctx) → THREE.Object3D
//   ctx = { THREE, L(layout), geo, M(materials), makeRng, makeNoise2D, uv:{planarUV,boxUV,roofUV},
//           makePlaqueTexture, utils:{mergeGeometries,mergeVertices}, quality }
export function build({ THREE }) {
  const group = new THREE.Group();
  return group;
}
