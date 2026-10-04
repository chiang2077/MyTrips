# 封面影片 v2：AI 擬真補圖（Codex 執行）

- status: 完成
- assignee: Codex（實作）；主導與驗收：Claude
- 上層任務：docs/tasks/kyushu-film-v2.md
- 來源：使用者 2026-10-04「缺少的部分找 codex 協助用最新的 image 模型生出，關鍵是圖片要擬真」

## 範圍
只做一件事：用你內建的圖片生成工具產出下列 10 張圖，存到 `2026fukuoka/film2-ai/`（檔名照表）。
**不要改任何其他檔案、不要 git commit、不要開分支。**

## 共同要求
- 照片級擬真：像旅遊攝影師用全片幅相機實拍，自然光、真實景深、真實材質與雜訊。
  禁止插畫感、CG 感、過度飽和、HDR 光暈、塑膠皮膚、怪手指、亂碼招牌文字。
- 橫式 16:9，盡量高解析（至少 1536×864）。
- 畫面**左半部要留相對單純的區域**（之後要壓大字），主體偏右。
- 季節是日本十月下旬到十一月初（秋天）。
- 不要出現可辨識的人臉正面；人物用背影、側影、遠景。
- 畫面中不要有任何文字、浮水印、logo。

## 清單
| 檔名 | 畫面 |
|---|---|
| 03-onsen.png | 佐賀武雄溫泉：朱紅色木造樓門（武雄溫泉樓門，龍宮城風格、無釘建築）在傍晚，前景有溫泉蒸氣 |
| 04-arita.png | 有田燒：陶藝師雙手在拉坯機上塑形的特寫，背景架上白底青花瓷器 |
| 05-coast.png | 從觀光列車車窗看出去的有明海沿岸：低潮灘塗、遠方海平線、午後斜陽，車窗木框入鏡 |
| 07-gunkanjima.png | 長崎軍艦島（端島）：從觀光船上看過去的廢棄混凝土建築群與海堤，海面波光，船舷欄杆入鏡 |
| 09-castella.png | 長崎蛋糕（カステラ）切片特寫：金黃蛋糕體、深褐色頂面、底部粗糖粒，放在木盤上，柔光 |
| 10-tulip.png | 豪斯登堡：荷蘭式街景與運河，前景大片秋季花卉（不是鬱金香也可，秋天合理即可），晴天 |
| 12-illumination.png | 豪斯登堡夜間燈飾：整條街與運河被暖白與金色燈海覆蓋，倒影，藍調時刻天空 |
| 15-tenjin.png | 福岡天神夜晚購物街：百貨公司外觀燈光、行人背影、街頭光影，招牌不要有可讀文字 |
| 16-dinner.png | 博多高級餐廳的紀念日晚餐：兩只香檳杯輕碰的特寫、桌上精緻日式料理、暖色燭光，只見手不見臉 |
| 18-maple.png | 日本秋天紅葉：寺院石階或庭園上方的楓葉逆光，紅橙黃層次，地面落葉 |

## 驗收（Claude 會這樣審）
- 10 張都存在、尺寸 16:9。
- 逐張檢查擬真度：放大看文字、手、建築結構有沒有破綻；看起來像 AI 的退回重做。
- 回報每張用了哪個模型與提示詞（寫在本檔最後的「執行紀錄」）。

## 執行紀錄

共同模型：Codex 內建 `image_gen` 圖片生成工具（工具未揭露底層模型名稱；以下每張皆同）。

### 03-onsen.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Saga Takeo Onsen historic vermilion wooden tower gate, inspired by Ryugu-jo architecture and nail-less timber joinery, at dusk, with natural onsen steam drifting in the foreground.
Scene/backdrop: Japan in late October to early November, quiet onsen town evening, subtle autumn atmosphere.
Subject: the vermilion wooden gate placed on the right half of the frame, accurate timber proportions and roof details, no readable signs.
Style/medium: ultra photorealistic full-frame travel photography, natural lens rendering, realistic depth of field, real wood grain, real stone and steam texture, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half intentionally simple and uncluttered for future large title overlay, main architecture biased to the right, eye-level lens, cinematic but natural.
Lighting/mood: blue-hour dusk with warm lantern-like ambient glow, soft steam catching light, restrained contrast.
Color palette: vermilion wood, deep blue twilight, warm vapor highlights, natural autumn tones.
Constraints: no people with identifiable frontal faces; no text, no readable signage, no watermark, no logo; avoid illustration, CG, HDR halos, oversaturation, warped architecture, fake characters or gibberish text.
```

### 04-arita.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Arita porcelain craft scene: close-up of a ceramic artist's hands shaping wet clay on a spinning pottery wheel, with shelves of white porcelain with cobalt-blue patterns softly blurred in the background.
Scene/backdrop: traditional but tidy Japanese pottery studio in late autumn, warm natural window light, no readable labels.
Subject: realistic adult hands and clay centered slightly right, porcelain shelves on the right and rear; hands must be anatomically correct.
Style/medium: ultra photorealistic full-frame travel/editorial photography, macro lens feel, natural depth of field, real clay slip texture, realistic skin texture, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple with soft shadowed studio background for future title overlay, main hands and wheel biased to the right.
Lighting/mood: soft afternoon window light, quiet artisan mood, restrained color and contrast.
Color palette: earthy clay brown, warm wood, white porcelain, cobalt blue accents.
Constraints: no identifiable face, only hands/forearms; no text, no readable marks, no watermark, no logo; avoid illustration, CG, HDR, oversaturation, plastic skin, malformed fingers, extra fingers, fake characters or gibberish text.
```

### 05-coast.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: View of the Ariake Sea coast from a sightseeing train window: low-tide tidal flats, distant flat horizon, soft afternoon slanting sunlight, with a warm wooden train window frame visible.
Scene/backdrop: Kyushu Japan coastal railway in late October to early November, calm afternoon.
Subject: landscape outside the train window on the right half, wooden window frame and a small part of interior edge, no people required.
Style/medium: ultra photorealistic full-frame travel photography, natural lens rendering, real glass reflections, realistic tidal mud texture, slight motion calmness, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple with muted train interior shadow and soft sky/water tones for future title overlay, main coastal view biased to the right.
Lighting/mood: golden late-afternoon side light, peaceful and spacious, restrained contrast.
Color palette: silvery blue sea, brown tidal flats, honey wood, pale autumn sky.
Constraints: no readable signs, no text, no watermark, no logo, no identifiable faces; avoid illustration, CG, HDR halos, oversaturation, warped window frame, fake characters or gibberish text.
```

### 07-gunkanjima.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Nagasaki Gunkanjima / Hashima Island seen from a sightseeing boat: abandoned concrete apartment blocks and sea wall, shimmering ocean surface, a boat railing visible in the foreground.
Scene/backdrop: late October to early November off the Nagasaki coast, clear but slightly hazy sea air.
Subject: ruined concrete island and seawall placed on the right half of the frame, boat railing low in foreground, no readable boat markings.
Style/medium: ultra photorealistic full-frame travel photography, documentary realism, natural telephoto compression, realistic concrete decay, real sea sparkle, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple open sea and sky for future title overlay, main island biased to the right, railing subtle at bottom edge.
Lighting/mood: afternoon sunlight with realistic haze, sober historical mood, restrained color.
Color palette: weathered gray concrete, blue-gray ocean, pale autumn sky, muted metal railing.
Constraints: no identifiable frontal faces; no text, no readable signs, no watermark, no logo; avoid illustration, CG, HDR halos, oversaturation, warped buildings, fake characters or gibberish text.
```

### 09-castella.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Nagasaki castella cake slice close-up: golden sponge, deep brown top crust, coarse sugar crystals visible along the bottom, placed on a simple wooden plate under soft light.
Scene/backdrop: quiet cafe or ryokan table setting in Japan, late autumn warmth, no packaging and no labels.
Subject: one or two castella slices placed slightly right of center, detailed crumb texture and sugar crystals, wooden plate and table.
Style/medium: ultra photorealistic full-frame food photography, macro realism, natural shallow depth of field, real cake crumb texture, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple warm blurred tabletop for future title overlay, main cake biased to the right.
Lighting/mood: soft diffused window light, warm and appetizing, restrained contrast.
Color palette: golden yellow cake, dark caramel brown crust, honey wood, soft cream highlights.
Constraints: no text, no readable labels, no packaging, no watermark, no logo, no people; avoid illustration, CG, HDR shine, oversaturation, waxy food, impossible crumb structure, fake characters or gibberish text.
```

### 10-tulip.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Huis Ten Bosch in Sasebo: Dutch-style street and canal on a sunny day, with broad foreground beds of realistic autumn flowers such as cosmos, marigolds, and chrysanthemums, not spring tulips.
Scene/backdrop: late October to early November theme park canal district in Japan, crisp clear weather.
Subject: Dutch-style buildings, canal, and flower beds placed mostly to the right half; calm water reflections; no readable signs.
Style/medium: ultra photorealistic full-frame travel photography, natural architecture and landscaping, real flower textures, realistic water reflections, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple sky/canal/soft flowers for future title overlay, main buildings and flower detail biased to the right.
Lighting/mood: sunny autumn daylight, clean but natural, not HDR.
Color palette: blue sky, brick and plaster buildings, green canal edges, autumn flower reds/yellows/pinks.
Constraints: no identifiable frontal faces, people only as tiny distant silhouettes if present; no text, no readable signs, no watermark, no logo; avoid illustration, CG, HDR halos, oversaturation, fake theme-park signage, fake characters or gibberish text.
```

### 12-illumination.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Huis Ten Bosch night illumination: an entire Dutch-style street and canal covered in warm white and golden lights, water reflections, blue-hour twilight sky.
Scene/backdrop: late October to early November evening theme park canal district in Sasebo, Japan.
Subject: illuminated street, bridge, canal, and building facades placed mainly on the right half; water reflection visible; no readable signs.
Style/medium: ultra photorealistic full-frame night travel photography, realistic long-exposure feel without surreal HDR, natural bokeh, real reflections, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple darker blue sky/canal reflection for future title overlay, main illuminated street biased to the right.
Lighting/mood: blue-hour sky, warm white and gold lights, romantic but realistic exposure.
Color palette: deep twilight blue, warm gold, soft white, dark water reflections.
Constraints: no identifiable frontal faces; distant back-view silhouettes only if any; no text, no readable signs, no watermark, no logo; avoid illustration, CG, HDR halos, oversaturation, blown-out light blobs, fake characters or gibberish text.
```

### 15-tenjin.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Fukuoka Tenjin nighttime shopping street after rain: elegant department store facades with warm exterior lighting, pedestrians seen only from behind as small figures, wet pavement and street light reflections. No advertisements, no posters, no readable signage.
Scene/backdrop: central Tenjin in late October to early November evening, realistic Japanese urban shopping district, but storefront signs are either blank architectural panels, cropped out, or too blurred to read.
Subject: warm department store facade and back-view pedestrians placed to the right half; left half has darker open wet pavement, road reflections, and soft city bokeh for title overlay.
Style/medium: ultra photorealistic full-frame street photography, natural low-light noise, realistic lens bokeh, real pavement reflections, documentary travel feel.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half uncluttered dark pavement and bokeh negative space, main facade and pedestrians biased to the right, no close faces.
Lighting/mood: nighttime city glow, warm storefront lights, subtle cool ambient shadows, not neon-saturated.
Color palette: warm architectural light, charcoal pavement, muted city colors, restrained red/green bokeh only in distance.
Constraints: no identifiable faces, no faces on posters or screens, no advertising displays, no readable text, no legible shop names, no signs, no watermark, no logo; avoid illustration, CG, HDR halos, oversaturation, fake characters, gibberish text, close-up people.
```

### 16-dinner.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Anniversary dinner in an upscale Hakata restaurant: close-up of two champagne glasses gently clinking, refined Japanese dishes on the table, warm candlelight, only hands visible and no faces.
Scene/backdrop: elegant private restaurant table in Fukuoka, late autumn evening, intimate celebration, no menus or labels.
Subject: champagne glasses and hands placed slightly right of center, delicate Japanese cuisine on ceramic plates in background, table setting tasteful and realistic.
Style/medium: ultra photorealistic full-frame fine dining photography, natural shallow depth of field, realistic glass refraction, real candle glow, skin texture, ceramic and food textures, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple warm blurred table/candle bokeh for future title overlay, main glasses and hands biased to the right.
Lighting/mood: warm candlelight and soft restaurant ambient light, romantic but realistic, restrained highlights.
Color palette: amber candlelight, clear glass, champagne gold, dark wood, muted ceramic tones.
Constraints: hands must be anatomically correct; no identifiable faces, no faces reflected in glass, no text, no menu, no bottle label, no watermark, no logo; avoid illustration, CG, HDR halos, oversaturation, plastic skin, malformed fingers, extra fingers, fake characters or gibberish text.
```

### 18-maple.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Japanese autumn maple leaves backlit above temple stone steps or a traditional garden path, rich layers of red, orange, and yellow, fallen leaves on the ground.
Scene/backdrop: late October to early November in Japan, quiet temple garden or stone stairway, no signs or text.
Subject: glowing maple canopy and stone steps/garden path placed mostly on the right half, with detailed leaves and realistic moss/stone texture.
Style/medium: ultra photorealistic full-frame travel/nature photography, natural depth of field, real leaf translucency, realistic stone and moss, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple soft bokeh foliage and shadow for future title overlay, main maple branches and stone steps biased to the right.
Lighting/mood: low autumn sun backlighting through maple leaves, serene and natural, restrained contrast.
Color palette: layered red, orange, yellow maple leaves, muted gray stone, green moss, warm sunlight.
Constraints: no people required; if any, only tiny distant back silhouettes; no text, no signs, no watermark, no logo; avoid illustration, CG, HDR halos, oversaturation, fake leaves, warped architecture, fake characters or gibberish text.
```

## 第二輪（2026-10-04，Claude 審查後）
使用者裁示：**旅行季節（10 月下旬、九州）還沒有紅葉**。18-maple 刪除不做。
以下 5 張重做，覆寫原檔，其餘不要動：
- 共同新增要求：**畫面中不得出現紅葉、黃葉或任何秋色樹葉**，樹木一律是仍然翠綠的狀態；
  色彩自然、不要過度飽和、不要 HDR 夕陽光暈。
| 檔名 | 重做重點 |
|---|---|
| 03-onsen.png | 照真實的武雄溫泉樓門畫：朱紅色兩層木造門，**上層有白色灰泥牆**，下層朱紅柱，屋頂為深色瓦；門前是石板廣場，不要露天水池；傍晚，旁邊建築窗口飄出少量蒸氣 |
| 09-castella.png | 背景不要楓葉，改成素雅的和室木質背景 |
| 10-tulip.png | 樹木改成綠色；前景花卉保留 |
| 15-tenjin.png | 行道樹改成綠色 |
| 16-dinner.png | 拿掉楓葉裝飾，改成素雅的花器或無裝飾 |
執行紀錄請接在本段後面。

### 第二輪執行紀錄（Codex，2026-10-04）

- 模型：Codex 內建 `image_gen` 圖片生成工具（工具未揭露底層模型名稱；以下每張皆同）。
- 覆寫檔案：`2026fukuoka/film2-ai/03-onsen.png`、`09-castella.png`、`10-tulip.png`、`15-tenjin.png`、`16-dinner.png`。
- 尺寸檢查：5 張皆為 `1672x941`，比例約 `1.7768`，符合 16:9。
- 其他檔案：未重做 `18-maple.png`，未碰其餘 5 張。

#### 03-onsen.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Saga Takeo Onsen historic Romon gate rendered close to the real Takeo Onsen tower gate: a vermilion two-story wooden gate, white plaster walls on the upper level, vermilion columns on the lower level, dark tiled roof, stone-paved plaza in front, no outdoor bath or water pool. Early evening; a small amount of onsen steam drifts from windows of a nearby building, not from a pool.
Scene/backdrop: Kyushu Japan in late October, before autumn foliage season; trees and shrubs are fresh natural green only.
Subject: the gate placed on the right half of the frame, accurate timber proportions, white plaster upper walls, dark roof tiles, no readable signs.
Style/medium: ultra photorealistic full-frame travel photography, natural lens rendering, realistic depth of field, real wood grain, stone texture, subtle steam texture, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half intentionally simple and uncluttered for future large title overlay, main architecture biased to the right, eye-level lens, cinematic but natural.
Lighting/mood: blue-hour dusk with restrained warm ambient window glow, natural contrast, no HDR glow.
Color palette: vermilion wood, white plaster, dark roof tiles, cool dusk blue, green foliage, warm vapor highlights.
Constraints: no red maple leaves, no yellow leaves, no autumn-colored foliage; all trees must remain green. No people with identifiable frontal faces; no text, no readable signage, no watermark, no logo; avoid outdoor pools, illustration, CG, HDR halos, oversaturation, warped architecture, fake characters or gibberish text.
```

#### 09-castella.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Nagasaki castella cake slice close-up: golden sponge, deep brown top crust, coarse sugar crystals visible along the bottom, placed on a simple wooden plate under soft light. Background must be a plain, elegant Japanese washitsu wood interior, not seasonal decoration.
Scene/backdrop: quiet Japanese room table setting, simple wood grain, shoji-like soft light, no packaging, no labels, no maple leaves, no autumn decorations.
Subject: one or two castella slices placed slightly right of center, detailed crumb texture and sugar crystals, wooden plate and table.
Style/medium: ultra photorealistic full-frame food photography, macro realism, natural shallow depth of field, real cake crumb texture, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple warm blurred wooden tabletop / washitsu background for future title overlay, main cake biased to the right.
Lighting/mood: soft diffused window light, warm and appetizing, restrained contrast, no HDR shine.
Color palette: golden yellow cake, dark caramel brown crust, honey wood, soft cream highlights.
Constraints: no red maple leaves, no yellow leaves, no autumn-colored foliage, no seasonal leaves of any kind; no text, no readable labels, no packaging, no watermark, no logo, no people; avoid illustration, CG, HDR shine, oversaturation, waxy food, impossible crumb structure, fake characters or gibberish text.
```

#### 10-tulip.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Huis Ten Bosch in Sasebo: Dutch-style street and canal on a sunny day, with broad foreground flower beds of realistic autumn-compatible flowers such as cosmos, marigolds, and chrysanthemums. Trees must be natural green, not autumn colored.
Scene/backdrop: late October in Kyushu Japan, before autumn foliage season, crisp clear weather in the theme park canal district.
Subject: Dutch-style buildings, canal, green trees, and flower beds placed mostly to the right half; calm water reflections; no readable signs.
Style/medium: ultra photorealistic full-frame travel photography, natural architecture and landscaping, real flower textures, realistic water reflections, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple sky/canal/soft flowers for future title overlay, main buildings and flower detail biased to the right.
Lighting/mood: sunny natural daylight, clean but restrained, no HDR, no sunset glow.
Color palette: blue sky, brick and plaster buildings, green trees and canal edges, natural flower reds/yellows/pinks without oversaturation.
Constraints: no red maple leaves, no yellow leaves, no autumn-colored tree foliage; all trees must be green. No identifiable frontal faces, people only as tiny distant silhouettes if present; no text, no readable signs, no watermark, no logo; avoid spring tulip-only beds, illustration, CG, HDR halos, oversaturation, fake theme-park signage, fake characters or gibberish text.
```

#### 15-tenjin.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Fukuoka Tenjin nighttime shopping street after rain: elegant department store facades with warm exterior lighting, green street trees, pedestrians seen only from behind as small figures, wet pavement and street light reflections. No advertisements, no posters, no readable signage.
Scene/backdrop: central Tenjin in late October evening, before autumn foliage season; realistic Japanese urban shopping district, storefront signs are blank architectural panels, cropped out, or too blurred to read.
Subject: warm department store facade, green roadside trees, and back-view pedestrians placed to the right half; left half has darker open wet pavement, road reflections, and soft city bokeh for title overlay.
Style/medium: ultra photorealistic full-frame street photography, natural low-light noise, realistic lens bokeh, real pavement reflections, documentary travel feel.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half uncluttered dark pavement and bokeh negative space, main facade and pedestrians biased to the right, no close faces.
Lighting/mood: nighttime city glow, warm storefront lights, subtle cool ambient shadows, not neon-saturated, no HDR halos.
Color palette: warm architectural light, charcoal pavement, natural green trees, muted city colors, restrained red/green bokeh only in distance.
Constraints: no red maple leaves, no yellow leaves, no autumn-colored foliage; all street trees must be green. No identifiable faces, no faces on posters or screens, no advertising displays, no readable text, no legible shop names, no signs, no watermark, no logo; avoid illustration, CG, HDR halos, oversaturation, fake characters, gibberish text, close-up people.
```

#### 16-dinner.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Anniversary dinner in an upscale Hakata restaurant: close-up of two champagne glasses gently clinking, refined Japanese dishes on the table, warm candlelight, only hands visible and no faces. Remove any maple leaf or autumn leaf decoration; use a simple elegant small flower vase or no decoration.
Scene/backdrop: elegant private restaurant table in Fukuoka, late October evening, intimate celebration, no menus or labels.
Subject: champagne glasses and hands placed slightly right of center, delicate Japanese cuisine on ceramic plates in background, tasteful table setting, optional small minimalist flower vase, no seasonal leaves.
Style/medium: ultra photorealistic full-frame fine dining photography, natural shallow depth of field, realistic glass refraction, real candle glow, skin texture, ceramic and food textures, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple warm blurred table/candle bokeh for future title overlay, main glasses and hands biased to the right.
Lighting/mood: warm candlelight and soft restaurant ambient light, romantic but realistic, restrained highlights, no HDR glow.
Color palette: amber candlelight, clear glass, champagne gold, dark wood, muted ceramic tones, understated floral accent if present.
Constraints: no red maple leaves, no yellow leaves, no autumn-colored foliage, no leaf-shaped table decoration; hands must be anatomically correct; no identifiable faces, no faces reflected in glass, no text, no menu, no bottle label, no watermark, no logo; avoid illustration, CG, HDR halos, oversaturation, plastic skin, malformed fingers, extra fingers, fake characters or gibberish text.
```

## 第三輪（2026-10-04）
只重做 16-dinner.png，覆寫原檔：使用者指出手型偏西方人。
改為**東亞（台灣）中年夫妻的手**：膚色、手指比例符合東亞人；女方手腕細、可戴簡單婚戒；仍然只拍手、不露臉；
不得出現紅葉；其餘構圖（夜景窗邊、和食、香檳乾杯、素雅白花）保留，色彩自然不過飽和。
執行紀錄接在本段後面。

### 第三輪執行紀錄（Codex，2026-10-04）

- 模型：Codex 內建 `image_gen` 圖片生成工具（工具未揭露底層模型名稱）。
- 覆寫檔案：`2026fukuoka/film2-ai/16-dinner.png`。
- 尺寸檢查：`1672x941`，比例約 `1.7768`，符合 16:9。
- 其他檔案：未重做、未覆寫其餘 9 張。

#### 16-dinner.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Anniversary dinner in an upscale Hakata restaurant by a night-view window: close-up of two champagne glasses gently clinking, refined Japanese dishes on the table, warm candlelight, simple elegant white flowers, only hands visible and no faces. The hands must clearly be a middle-aged East Asian Taiwanese couple's hands, with East Asian skin tone and finger proportions; the woman's wrist is slender and she may wear a simple wedding ring.
Scene/backdrop: elegant private restaurant table in Fukuoka at night, city lights softly blurred through the window, intimate celebration, no menus or labels.
Subject: champagne glasses and the couple's hands placed slightly right of center, delicate Japanese cuisine on ceramic plates in background, tasteful table setting, simple white flowers, no seasonal leaves.
Style/medium: ultra photorealistic full-frame fine dining photography, natural shallow depth of field, realistic glass refraction, real candle glow, realistic East Asian skin texture, ceramic and food textures, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple warm blurred table/candle bokeh and night-window bokeh for future title overlay, main glasses and hands biased to the right.
Lighting/mood: warm candlelight and soft restaurant ambient light, romantic but realistic, restrained highlights, no HDR glow.
Color palette: amber candlelight, clear glass, champagne gold, dark wood, muted ceramic tones, understated white floral accent, natural color not oversaturated.
Constraints: no red maple leaves, no yellow leaves, no autumn-colored foliage, no leaf-shaped table decoration; hands must be anatomically correct and look like middle-aged East Asian Taiwanese hands; no identifiable faces, no faces reflected in glass, no text, no menu, no bottle label, no watermark, no logo; avoid Western-looking hand proportions, illustration, CG, HDR halos, oversaturation, plastic skin, malformed fingers, extra fingers, fake characters or gibberish text.
```

## 第四輪（2026-10-04）
只重做 16-dinner.png，覆寫原檔。使用者：**手要年輕一些**。
改為東亞（台灣）**30 歲左右**夫妻的手：皮膚平滑緊緻、沒有明顯皺紋或青筋，指節不粗；女方可戴細婚戒。
其餘同第三輪：只拍手不露臉、不得有紅葉、色彩自然。窗外夜景**不要出現晴空塔或任何可辨識的地標塔**，只要海灣與城市燈光。
執行紀錄接在本段後面。

### 第四輪執行紀錄（Codex，2026-10-04）

- 模型：Codex 內建 `image_gen` 圖片生成工具（工具未揭露底層模型名稱）。
- 覆寫檔案：`2026fukuoka/film2-ai/16-dinner.png`。
- 尺寸檢查：`1672x941`，比例約 `1.7768`，符合 16:9。
- 目視檢查：只見手不見臉；手部較年輕，未見明顯皺紋、青筋或粗指節；未見紅葉、可讀文字、浮水印、logo；窗外為海灣與城市燈光，未見晴空塔、福岡塔或其他可辨識地標塔。
- 其他檔案：未重做、未覆寫其餘 9 張。

#### 16-dinner.png
- 模型：Codex 內建 `image_gen`
- 提示詞：
```text
Use case: photorealistic-natural
Asset type: 16:9 cinematic travel cover image, save for website/video asset
Primary request: Anniversary dinner in an upscale Hakata restaurant by a night-view window: close-up of two champagne glasses gently clinking, refined Japanese dishes on the table, warm candlelight, simple elegant white flowers, only hands visible and no faces. The hands must clearly be a roughly 30-year-old East Asian Taiwanese couple's hands: smooth firm skin, youthful adult skin, no obvious wrinkles, no prominent veins, not bulky knuckles; the woman's wrist is slender and she may wear a thin simple wedding ring.
Scene/backdrop: elegant private restaurant table in Fukuoka at night, intimate celebration, no menus or labels. Through the window, show only low bay water, pier lights, and distant low-rise city-light bokeh, with the skyline kept low and very blurred. Absolutely no towers, no landmark silhouettes, no spires, no observation towers, no tall vertical illuminated buildings.
Subject: champagne glasses and the couple's hands placed slightly right of center, delicate Japanese cuisine on ceramic plates in background, tasteful table setting, simple white flowers, no seasonal leaves.
Style/medium: ultra photorealistic full-frame fine dining photography, natural shallow depth of field, realistic glass refraction, real candle glow, realistic smooth East Asian skin texture, ceramic and food textures, slight sensor noise.
Composition/framing: horizontal 16:9, at least 1536x864 feel, left half relatively simple warm blurred table/candle bokeh and dark window bokeh for future title overlay, main glasses and hands biased to the right. Frame the window so the horizon is water and low city lights only; crop out any tall vertical structures.
Lighting/mood: warm candlelight and soft restaurant ambient light, romantic but realistic, restrained highlights, no HDR glow.
Color palette: amber candlelight, clear glass, champagne gold, dark wood, muted ceramic tones, understated white floral accent, natural color not oversaturated.
Constraints: no red maple leaves, no yellow leaves, no autumn-colored foliage, no leaf-shaped table decoration; hands must be anatomically correct and look like roughly 30-year-old East Asian Taiwanese hands; no elderly hands, no visible wrinkles, no prominent veins, no thick knuckles; no identifiable faces, no faces reflected in glass, no text, no menu, no bottle label, no watermark, no logo; absolutely avoid any skyline landmark tower, Tokyo Skytree, Fukuoka Tower, observation tower, radio mast, tall lit tower, tall spire, or distinct tall vertical landmark; avoid Western-looking hand proportions, illustration, CG, HDR halos, oversaturation, plastic skin, malformed fingers, extra fingers, fake characters or gibberish text.
```
