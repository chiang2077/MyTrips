// ============================================================================
// 中正紀念堂・黃昏 — 場景平面圖（唯一座標來源）
// ----------------------------------------------------------------------------
// 規則：所有建模、樹木、鏡頭程式「只能」從這份檔案讀座標與尺寸，不准自己寫死位置。
//
// 座標系（右手系，three.js 預設）：
//   x = 東（+）／西（−）
//   z = 南（+）／北（−）
//   y = 上
//   單位：公尺。原點 = 主殿（紀念堂主體）平面中心、廣場地坪高程 y = 0。
//
// 簡化：真實園區的中軸大致東西向，本模型把中軸對齊 x 軸（正東西）。
//       主殿在東、坐東朝西；正面牌樓在西端、面向中山南路。
//
// 數字的可信度：
//   [官方]  = 國立中正紀念堂管理處官網／園區建築導覽的數字
//   [估]    = 官方查不到，依參考照片比例估算（之後可修正，改這裡即可）
//
// 資料來源（可複查）：
//   S1 國立中正紀念堂－環境介紹      https://www.cksmh.gov.tw/cp.aspx?n=6022
//   S2 園區建築導覽－主堂體           https://tour.cksmh.gov.tw/home/zh-tw/hot/31040
//   S3 園區建築導覽－正面牌樓         https://tour.cksmh.gov.tw/home/zh-tw/hot/31044
//   S4 園區建築導覽－大忠門及大孝門   https://tour.cksmh.gov.tw/home/zh-tw/Point/31074
//   S5 國立中正紀念堂－園區介紹       https://www.cksmh.gov.tw/cp.aspx?n=5882
//   S6 國立中正紀念堂－雲漢池與光華池 https://www.cksmh.gov.tw/cp.aspx?n=6186
//   S7 維基百科－國家戲劇院（重檐廡殿頂）https://zh.wikipedia.org/zh-tw/國家戲劇院
//   S8 The Archway (official, EN)     https://www.cksmh.gov.tw/en/cp.aspx?n=6346
// ============================================================================

const deg = Math.PI / 180;

// ---------------------------------------------------------------------------
// 全域
// ---------------------------------------------------------------------------
export const SEED = 19800405; // 全案共用種子（各區再用字串衍生子種子，見 rng.js）

export const LEVELS = {
  // 疊圖高程，避免 z-fighting。各區鋪面「頂面」請對齊這些值。
  outsideGround: -0.02, // 園區外的人行道以外地面（城市地坪）
  road: 0.0,            // 柏油路面頂
  sidewalk: 0.15,       // 人行道頂
  lawn: 0.0,            // 園區內草地（terrain 鋪滿整個園區）
  paving: 0.06,         // 園區內鋪面（廣場、民主大道、步道）頂面
  parterreBed: 0.12,    // 花壇土面
  pondWater: -0.35,     // 池水面
  pondBottom: -1.2,
};

// 園區範圍（圍牆外緣線）。590 × 420 = 247,800 m² ≈ 25 公頃 [官方 S5：約 25 公頃；外形為 估]
export const SITE = { xMin: -470, xMax: 120, zMin: -210, zMax: 210 };

// 整個世界的繪製範圍（城市背景、遠山都在這裡面）
export const WORLD = {
  groundRadius: 4000,   // 城市地坪圓盤半徑
  cityRadius: 1600,     // 程序生成城市街廓的最遠距離
  mountainRadius: [9000, 16000], // 遠山環帶
};

// ---------------------------------------------------------------------------
// 周邊道路（園區外）[估：路寬依照片]
// rect = 平面矩形 {x0,x1,z0,z1}；median = 中央分隔島矩形（可為 null）
// ---------------------------------------------------------------------------
export const ROADS = {
  zhongshanS: { name: '中山南路', rect: { x0: -524, x1: -484, z0: -700, z1: 700 }, lanes: 8,
    median: { x0: -506, x1: -502, z0: -700, z1: 700 } },
  xinyi:      { name: '信義路一段', rect: { x0: -700, x1: 600, z0: -246, z1: -216 }, lanes: 6, median: null },
  aiguoE:     { name: '愛國東路', rect: { x0: -700, x1: 600, z0: 216, z1: 240 }, lanes: 4, median: null },
  hangzhouS:  { name: '杭州南路', rect: { x0: 126, x1: 146, z0: -700, z1: 700 }, lanes: 4, median: null },
};

export const SIDEWALKS = [
  // 園區側人行道（緊貼圍牆外）
  { name: '中山南路園區側（牌樓前廣場）', rect: { x0: -484, x1: -470, z0: -246, z1: 240 } },
  { name: '信義路園區側', rect: { x0: -484, x1: 146, z0: -216, z1: -210 } },
  { name: '愛國東路園區側', rect: { x0: -484, x1: 146, z0: 210, z1: 216 } },
  { name: '杭州南路園區側', rect: { x0: 120, x1: 126, z0: -216, z1: 216 } },
  // 對街人行道
  { name: '中山南路對街', rect: { x0: -530, x1: -524, z0: -700, z1: 700 } },
  { name: '信義路對街', rect: { x0: -700, x1: 600, z0: -252, z1: -246 } },
  { name: '愛國東路對街', rect: { x0: -700, x1: 600, z0: 240, z1: 246 } },
  { name: '杭州南路對街', rect: { x0: 146, x1: 152, z0: -700, z1: 700 } },
];

// 程序生成城市：這些矩形以外、WORLD.cityRadius 以內才放街廓建築
export const CITY = {
  keepOut: { x0: -530, x1: 152, z0: -252, z1: 246 },  // 園區 + 四周道路
  blockSize: [70, 110],      // 街廓邊長範圍 [估]
  streetWidth: 16,
  heightNear: [12, 45],      // 近處建築高度（周邊限高；照片中多為 10~15 層）
  heightFar: [20, 120],
  // 地標：台北 101（程序生成的剪影即可）
  // 相對位置由經緯度換算：主殿約 25.0346N,121.5216E；101 約 25.0340N,121.5645E
  // → 東 ≈ 4.33 km、南 ≈ 0.07 km
  taipei101: { x: 4330, z: 70, height: 508, baseHalf: 32 },
};

// ---------------------------------------------------------------------------
// 主殿（紀念堂主體）— 坐東朝西，正面朝 −x
// ---------------------------------------------------------------------------
export const HALL = {
  center: { x: 0, z: 0 },
  facing: '-x',
  // 總高 70 m = 臺基 14.5 + 主體牆 24 + 斗栱至寶頂尖 31.5 [官方 S1/S2]
  totalHeight: 70,
  // 三層臺基（正方形，邊長為 估；總高 14.5 為官方）
  baseTiers: [
    { half: 65, top: 5.0 },   // 第一層：邊長 130 [估]
    { half: 52, top: 10.0 },  // 第二層：邊長 104 [估]
    { half: 40, top: 14.5 },  // 第三層：邊長 80  [估]；頂面 14.5 [官方]
  ],
  balustradeHeight: 1.1,      // 每層臺基外緣的白石欄杆 [估]
  // 主體：上層銅像大廳 40 m 見方，四角各突出 7.5 m [官方 S1]
  body: {
    bottom: 14.5,
    top: 38.5,                // 14.5 + 24 [官方]
    coreHalf: 20,             // 40 / 2
    cornerProtrusion: 7.5,    // 四角突出 → 外輪廓半寬 27.5
    wallBatter: 0.06,         // 牆面微內傾（照片可見略呈梯形）[估]
  },
  door: { width: 9, height: 16, bottom: 14.5 }, // 大門高 16 m [官方 S1]；寬 [估]
  plaque: { text: '中正紀念堂', y: 33.5, width: 3.2, height: 7.5 }, // 直式匾額 [估]
  // 屋頂：八角攢尖重簷，藍色琉璃瓦；寶頂 5.25 m [官方 S2]；出簷寬 [估]
  roof: {
    bracketBottom: 38.5,
    lowerEave: { y: 44.0, radius: 33.0 },    // 下簷（八角形外接圓半徑）[估]
    drum:      { y0: 47.0, y1: 52.5, radius: 22.0 }, // 兩簷之間的斗栱層 [估]
    upperEave: { y: 54.0, radius: 26.0 },    // 上簷 [估]
    apex: 64.75,              // 屋面尖 = 70 − 5.25
    finial: { y0: 64.75, y1: 70.0, maxRadius: 2.2 }, // 寶頂（金色）
    sides: 8,
  },
  // 正面大階梯：84 階 + 大廳前 5 階 = 89 階 [官方 S1]
  stairs: {
    steps: 84,
    upperSteps: 5,
    // 平面範圍：從廣場 x = −95 爬到第三層臺基前緣 x = −40 [估]
    x0: -95, x1: -40,
    halfWidth: 23,            // 含中央雕刻御路 [估]
    centerRampHalf: 6,        // 中央雕刻石面（不能走）的半寬 [估]
    landingX: -65,            // 中途平台（位於第一層臺基前緣）[估]
  },
  // 鏡頭用：主殿正面大門中心
  focus: { x: -27.5, y: 22, z: 0 },
};

// ---------------------------------------------------------------------------
// 正面牌樓（大中至正 → 現匾額「自由廣場」）
// 高 30 m、寬 80 m、五間六柱十一樓；距紀念堂中心線 470 m [官方 S1/S3/S8]
// ---------------------------------------------------------------------------
export const GATE = {
  center: { x: -470, z: 0 },
  facing: '-x',               // 正面朝西（中山南路）
  width: 80,                  // 沿 z 方向
  height: 30,
  depth: 11,                  // 沿 x 方向 [估]
  bays: 5,                    // 五間
  pillars: 6,                 // 六柱
  roofs: 11,                  // 十一樓
  // 五個拱門（由北到南），z = 拱門中心；w = 淨寬；h = 拱頂高 [估]
  arches: [
    { z: -30.5, w: 7.5, h: 10.5 },
    { z: -15.5, w: 9.0, h: 13.0 },
    { z: 0,     w: 11.0, h: 15.5 },
    { z: 15.5,  w: 9.0, h: 13.0 },
    { z: 30.5,  w: 7.5, h: 10.5 },
  ],
  plinthHeight: 1.2,          // 柱基座 [估]
  plaque: { text: '自由廣場', y: 21.5, width: 14, height: 3.6, bothFaces: true }, // 橫匾，傳統由右至左 [估]
  // 中央最高樓的正脊：沿 z 方向、脊頂（含鴟吻）達 height；兩端鴟吻中心在 z = ±halfLength [估]
  topRidge: { halfLength: 7 },
  focus: { x: -476, y: 21.5, z: 0 },  // 西面匾額中心（鏡頭用）
};

// 側門：大忠門（信義路）、大孝門（愛國東路）
// 高 13.8 m、寬 19.7 m、三間四柱三樓 [官方 S4]；x 位置 [估]
export const SIDE_GATES = {
  dazhong: { name: '大忠門', center: { x: -180, z: -210 }, facing: '-z', width: 19.7, height: 13.8, depth: 6 },
  daxiao:  { name: '大孝門', center: { x: -180, z: 210 },  facing: '+z', width: 19.7, height: 13.8, depth: 6 },
};

// ---------------------------------------------------------------------------
// 圍牆（園區環外迴廊）：白牆、藍色琉璃瓦頂、漏窗 [S1 提到環外迴廊；尺寸 估]
// path = 牆外緣中心線（逆時針），openings = 要留空給門的區段
// ---------------------------------------------------------------------------
export const WALL = {
  outline: [
    { x: -470, z: -210 }, { x: 120, z: -210 },
    { x: 120, z: 210 },  { x: -470, z: 210 },
  ], // 封閉矩形（最後一點接回第一點）
  depth: 4.5,              // 迴廊進深（往園區內側）
  eaveHeight: 4.2,
  ridgeHeight: 5.6,
  windowSpacing: 4.0,      // 漏窗間距
  windowSize: { w: 1.6, h: 1.6, sill: 1.4 },
  // 不建牆的開口（牌樓本身與側門自成結構）
  openings: [
    { side: 'west',  from: GATE.center.z - GATE.width / 2, to: GATE.center.z + GATE.width / 2 },   // 牌樓 z 範圍
    { side: 'north', from: SIDE_GATES.dazhong.center.x - SIDE_GATES.dazhong.width / 2,
      to: SIDE_GATES.dazhong.center.x + SIDE_GATES.dazhong.width / 2 },                            // 大忠門 x 範圍
    { side: 'south', from: SIDE_GATES.daxiao.center.x - SIDE_GATES.daxiao.width / 2,
      to: SIDE_GATES.daxiao.center.x + SIDE_GATES.daxiao.width / 2 },                              // 大孝門 x 範圍
  ],
  cornerPavilions: true,   // 四角可加小亭 [估，非必要]
};

// ---------------------------------------------------------------------------
// 兩廳院：北＝國家音樂廳（重檐歇山）、南＝國家戲劇院（重檐廡殿）[S7；尺寸 估]
// 屋脊東西向，長邊面向中軸廣場；黃色琉璃瓦、紅柱
// ---------------------------------------------------------------------------
export const HALLS2 = {
  concertHall: {
    name: '國家音樂廳', roofType: 'xieshan',  // 歇山（山牆三角面朝東西）
    center: { x: -385, z: -125 }, frontFacing: '+z', // 正面朝南（朝廣場）
  },
  theater: {
    name: '國家戲劇院', roofType: 'wudian',   // 廡殿（四坡）
    center: { x: -385, z: 125 }, frontFacing: '-z',  // 正面朝北（朝廣場）
  },
  // 兩棟共用的量體尺寸 [估]
  podium: { halfX: 56, halfZ: 36, top: 3.5 },        // 平臺
  building: { halfX: 46, halfZ: 26 },                 // 柱列外緣
  colonnade: { columnHeight: 13.5, spacing: 6.0, diameter: 1.4 },
  roof: {
    lowerEave: { y: 18.5, overhang: 5.0 },
    upperEave: { y: 25.0, inset: 7.0 },
    ridge: 33.0,
  },
  frontStairs: { halfWidth: 22, run: 9 },            // 面向廣場的大台階 [估]
};

// ---------------------------------------------------------------------------
// 廣場與鋪面
// ---------------------------------------------------------------------------
export const PLAZA = {
  // 民主大道：寬 40 m、長 380 m [官方 S1]。這裡從牌樓內側到主殿階梯前。
  boulevard: { x0: -464, x1: -95, halfWidth: 20 },
  // 兩旁林蔭大道各寬 9 m [官方 S1]；位置 [估]
  sideAvenues: [
    { x0: -320, x1: -135, z0: -69, z1: -60 },
    { x0: -320, x1: -135, z0: 60, z1: 69 },
  ],
  // 自由廣場（兩廳院之間）[估]
  libertySquare: { x0: -464, x1: -320, z0: -88, z1: 88,
    ornament: { x: -395, z: 0, half: 52 } },   // 地面大型回字紋＋中心四瓣花紋
  // 主殿前廣場（衛兵、遊客集結處）[估]
  hallForecourt: { x0: -135, x1: -95, z0: -72, z1: 72 },
  // 環堂道路：主殿北、南、東三面的鋪面帶（第一層臺基外）。正面（西）是階梯兩側草坪＋主殿前廣場 [估]
  hallRing: { innerHalf: 65, outerHalf: 80, sides: ['north', 'south', 'east'] },
  // 階梯兩側草坪（造型松所在）：x −95..−65、|z| 23..80
  stairLawns: [ { x0: -95, x1: -65, z0: -80, z1: -23 }, { x0: -95, x1: -65, z0: 23, z1: 80 } ],
  // 牌樓前（園區外）紅磚前庭 [估]
  gateForecourt: { x0: -484, x1: -470, z0: -60, z1: 60 },
  // 連接側門的步道 [估]
  sidePaths: [
    { x0: -187, x1: -173, z0: -206, z1: -69 },
    { x0: -187, x1: -173, z0: 69, z1: 206 },
  ],
  // 花壇之間的橫向步道 [估]
  crossPaths: [
    { x0: -222, x1: -208, z0: -60, z1: -20 },
    { x0: -222, x1: -208, z0: 20, z1: 60 },
  ],
  paveModule: 1.0, // 地磚模數（m）
  flagpole: { x: -300, z: 0, height: 30 }, // 照片 7 可見 [估]
  // 燈柱：沿民主大道兩側
  lamps: { x0: -455, x1: -110, spacing: 20, zOffsets: [-21.5, 21.5], height: 6.5 },
};

// ---------------------------------------------------------------------------
// 庭園
// ---------------------------------------------------------------------------
export const GARDENS = {
  // 民主大道兩側的幾何花壇（綠籬渦卷紋＋色塊花帶），中間被橫向步道切開 [估]
  parterres: [
    { x0: -315, x1: -222, z0: -58, z1: -22 },
    { x0: -208, x1: -140, z0: -58, z1: -22 },
    { x0: -315, x1: -222, z0: 22, z1: 58 },
    { x0: -208, x1: -140, z0: 22, z1: 58 },
  ],
  hedgeHeight: 0.6,
  // 中式庭園：兩座不規則人工池，各約 3,000 m²，含假山、瀑布、半圓拱橋 [官方 S6]
  // 位置與南北歸屬 [估]：北＝光華池、南＝雲漢池（南北對應待官方平面圖確認）
  ponds: [
    { name: '光華池', center: { x: -240, z: -138 }, radiusX: 38, radiusZ: 26, rotation: 0.15,
      bridge: { x: -240, z: -138, span: 14, width: 3.2, rise: 5.5, axis: 'z' },
      rockery: { x: -268, z: -150, height: 6 }, waterfall: { x: -266, z: -147 } },
    { name: '雲漢池', center: { x: -240, z: 138 }, radiusX: 38, radiusZ: 26, rotation: -0.15,
      bridge: { x: -240, z: 138, span: 14, width: 3.2, rise: 5.5, axis: 'z' },
      rockery: { x: -268, z: 150, height: 6 }, waterfall: { x: -266, z: 147 } },
  ],
  // 中式庭園範圍（池、步道、草坡、小灌木）
  chineseGardens: [
    { x0: -320, x1: -150, z0: -185, z1: -80 },
    { x0: -320, x1: -150, z0: 80, z1: 185 },
  ],
  // 主殿四周草坪上的低矮灌木帶 [估]
  hallShrubBands: { innerHalf: 80, outerHalf: 92, sides: ['north', 'south', 'east'] },
};

// ---------------------------------------------------------------------------
// 樹木（只放位置與規則，樹的造型由 trees.js 程序生成）
// ---------------------------------------------------------------------------
export const TREES = {
  // 林蔭大道兩側的龍柏（圓錐造型）列：每條 z 一列，沿 x 每 spacing 一棵
  cypressRows: { x0: -315, x1: -140, spacing: 6, zs: [-70.5, -58.5, 58.5, 70.5], height: [6.5, 7.5] },
  // 周界林帶（圍牆內側）
  belts: [
    { name: 'north', x0: -440, x1: 110, z0: -200, z1: -172, density: 1 / 70 },
    { name: 'south', x0: -440, x1: 110, z0: 172, z1: 200, density: 1 / 70 },
    { name: 'east',  x0: 88, x1: 111, z0: -172, z1: 172, density: 1 / 70 },
    { name: 'gateNW', x0: -460, x1: -444, z0: -200, z1: -92, density: 1 / 80 },
    { name: 'gateSW', x0: -460, x1: -444, z0: 92, z1: 200, density: 1 / 80 },
    { name: 'hallN', x0: -60, x1: 86, z0: -170, z1: -95, density: 1 / 110 },
    { name: 'hallS', x0: -60, x1: 86, z0: 95, z1: 170, density: 1 / 110 },
  ],
  // 中式庭園內的散植（避開池面與步道）
  gardenScatter: { density: 1 / 160 },
  // 主殿前的造型松（照片 1、10 可見的團狀松）[估]
  hallPines: [
    { x: -90, z: -32 }, { x: -90, z: 32 },
    { x: -80, z: -52 }, { x: -80, z: 52 },
    { x: -72, z: -70 }, { x: -72, z: 70 },
  ],
  // 主殿兩側高大針葉樹（照片 1 右側）
  hallTallConifers: [
    { x: -40, z: -100 }, { x: -20, z: -104 }, { x: 0, z: -101 }, { x: 22, z: -106 },
    { x: -40, z: 100 },  { x: -20, z: 104 },  { x: 0, z: 101 },  { x: 22, z: 106 },
  ],
  // 園區外：中山南路王椰（照片 4）
  palms: [
    { x: -504, z0: -460, z1: 460, spacing: 12 },  // 分隔島
    { x: -479, z0: -240, z1: 236, spacing: 12, skipZ: [-62, 62] }, // 園區側人行道，牌樓前不種
  ],
  // 園區外：信義路、愛國東路、杭州南路行道樹
  streetTrees: [
    { axis: 'x', z: -213, from: -470, to: 140, spacing: 10 },
    { axis: 'x', z: 213, from: -470, to: 140, spacing: 10 },
    { axis: 'z', x: 123, from: -205, to: 205, spacing: 10 },
  ],
  // 鏡頭指定的「主角樹」：trees.js 必須在這些位置放出指定樹種與高度
  heroes: {
    cypress:   { x: -309, z: -58.5, species: 'cypress', height: 7.2 },   // 鏡頭 3
    hallPine:  { x: -90, z: -32, species: 'pomPine', height: 6.0 },     // 鏡頭 7（= hallPines[0]）
    backlit:   { x: -452, z: -150, species: 'broadleaf', height: 16 },   // 鏡頭 10（逆光樹）
    backlit2:  { x: -458, z: -168, species: 'broadleaf', height: 13 },
  },
};

// 全域禁止種樹的區域（建物、鋪面、池、道路）— trees.js 用 geo.js 的 isFree() 檢查
// （由上面各項自動組合，見 geo.js；這裡只補充特別要留空的地方）
export const TREE_KEEPOUT_EXTRA = [
  { x0: -470, x1: -440, z0: -45, z1: 45 },   // 牌樓背面保持開闊
];

// ---------------------------------------------------------------------------
// 太陽與天空：西南西、仰角約 7°、暖色
// 方位角以「北＝0°、順時針」計：西南西 = 247.5°
// ---------------------------------------------------------------------------
export const SUN = {
  azimuthDeg: 247.5,
  elevationDeg: 7,
  color: 0xffb070,      // 約 2,800 K 的暖光
  intensity: 3.2,
  // 指向太陽的單位向量（x 東、y 上、z 南）
  get dir() {
    const az = this.azimuthDeg * deg, el = this.elevationDeg * deg;
    return { x: Math.sin(az) * Math.cos(el), y: Math.sin(el), z: -Math.cos(az) * Math.cos(el) };
  },
};

// ---------------------------------------------------------------------------
// 鏡頭焦點：10 顆鏡頭的「特寫物件」都從這裡取座標（shots.js 讀這份）
// ---------------------------------------------------------------------------
export const FOCUS = {
  gatePlaque:    GATE.focus,
  parterreBed:   { x: -262, y: 0.6, z: 40 },
  cypressTip:    { x: TREES.heroes.cypress.x, y: TREES.heroes.cypress.height, z: TREES.heroes.cypress.z },
  squareLamp:    { x: -435, y: PLAZA.lamps.height - 0.6, z: 21.5 },  // 燈柱 x0 + 20 的那支
  pondBridge:    { x: GARDENS.ponds[1].bridge.x, y: 4.5, z: GARDENS.ponds[1].bridge.z },
  sideGate:      { x: SIDE_GATES.daxiao.center.x, y: 11.5, z: SIDE_GATES.daxiao.center.z + 3.5 },
  hallPine:      { x: TREES.heroes.hallPine.x, y: 4.2, z: TREES.heroes.hallPine.z },
  flagpoleBase:  { x: PLAZA.flagpole.x, y: 1.2, z: PLAZA.flagpole.z },
  gateRidgeEnd:  { x: GATE.center.x, y: GATE.height - 1.2, z: GATE.topRidge.halfLength },  // 中央最高樓正脊南端的鴟吻
  backlitTree:   { x: TREES.heroes.backlit.x, y: 9, z: TREES.heroes.backlit.z },
  hall:          HALL.focus,
  siteCenter:    { x: -175, y: 0, z: 0 },
};
