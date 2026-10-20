# 施工規範（8 區平行施工共用）

專案：用 three.js（`vendor/three.module.js`，r170）全程式生成「黃昏時刻的中正紀念堂」，最後輸出 70 秒影片（10 顆鏡頭 × 7 秒）。

## 鐵則

1. **不准用任何 3D 模型、貼圖或照片。** 所有幾何、紋理都用程式生成（canvas 程序紋理可以，但不能載入任何圖檔）。
2. **座標只能從 `src/layout.js` 讀。** 不准在區域程式裡寫死世界座標。局部尺寸（柱徑、斗栱大小、欄杆間距之類）可以寫成區域內常數，但「放在哪裡」一定要從 `L.*` 推算。layout 有錯或缺東西 → **不要改它**，在完工回報裡提出。
3. **每個人只能改自己的檔案**：`src/zones/<區名>.js`。不准動 `layout.js`、`materials.js`、`rng.js`、`geo.js`、`scene.js`、`main.js`、`shots.js`、別區檔案。暫存檔請放自己的 scratchpad。
4. **共用材質**一律用 `ctx.M`（`src/materials.js`）：草地、琉璃、屋瓦、木頭、地磚以及其他列在裡面的材質。不准自己另做這五類材質。真的是本區獨有的（例如匾額文字）才自己做，並在回報說明。
5. **隨機數一律用固定種子**：`ctx.makeRng('<區名>/<用途>')`。禁止 `Math.random()`。每次打開必須長得一模一樣。
6. 不要 git commit（統包會整合後 commit）。

## 介面

```js
// src/zones/<區名>.js
export function build(ctx) {   // 可以是 async
  const { THREE, L, geo, M, makeRng, makeNoise2D, uv, makePlaqueTexture, utils, quality } = ctx;
  const group = new THREE.Group();
  // ...
  return group;
}
```

- `L` = `layout.js` 全部匯出；`geo` = `geo.js`（`inRect`、`inPond`、`isFree`、`halfRect`…）
- `uv.planarUV(geom)`、`uv.boxUV(geom)`、`uv.roofUV(geom, eaveDir, downDir)`：材質 UV 單位是**公尺**（見 materials.js 開頭說明）
- `utils.mergeGeometries`、`utils.mergeVertices`（BufferGeometryUtils）
- `makePlaqueTexture({ text, vertical, rightToLeft, ... })`：匾額字

座標系：x 向東、z 向南、y 向上，公尺；原點＝主殿中心、廣場地坪 y = 0。各類鋪面頂面高度看 `L.LEVELS`。

## 效能預算（很重要）

影片是在**沒有 GPU 的雲端容器裡用 SwiftShader 軟體算圖**，要算 2,100 張。

- 同材質的靜態網格請 **merge** 成一個 mesh；大量重複物件用 **InstancedMesh**。
- 每區 draw call 盡量 < 60（樹木區用 instancing 例外）。
- 三角面預算（約）：terrain 300k、hall 400k、gate 150k、theaters 300k（兩棟合計）、plaza 120k、gardens 250k、trees 1.5M（含 instancing 展開）、walls 200k。
- `castShadow`：建築、樹、欄杆等立體物要開；地面、鋪面不用開。`receiveShadow`：幾乎全部都開。
- 鏡頭會在 `L.FOCUS` 的點做 3～10 公尺的特寫，那些地方要經得起近看；遠處可以簡化。

## 自我檢查

```bash
cd /home/user/MyTrips/cks-dusk
node tools/snap.mjs --zones <區名> --out /你的scratchpad/a.png --cam x,y,z --target x,y,z [--fov 40] \
                                   --out /你的scratchpad/b.png --cam ... --target ...
```

- 同一次執行可以拍多張（`--out/--cam/--target` 依序配對），場景只載一次。
- 會印出建模耗時、三角面數、瀏覽器錯誤。截圖用 Read 工具看。
- 8 區同時施工、共用 4 核 CPU，請一次批次拍好幾張，不要頻繁重開。
- 只載自己的區（別區可能正在改到一半）。
- 太陽固定在西南西、仰角 7°（從 −x、略偏 +z 方向打過來），所以朝西、朝南的立面是亮面。

## 完工回報（最後一則訊息）

1. 做了什麼（主要構件清單）
2. 三角面數、建模耗時、draw call 估計
3. 對 `layout.js` 的疑問或修改建議（如果有）
4. 截圖路徑
