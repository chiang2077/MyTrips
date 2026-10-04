# 封面影片 v2：中洲祭「花魁道中」AI 擬真圖（Codex 執行）

- status: 完成
- assignee: Codex（實作）；主導與驗收：Claude
- 來源：使用者 2026-10-04「中州祭用google查詢有許多類似花魁的遊行畫面，以此為基準由codex重繪後放入影片」
- 取代上一張 14-nakasu.png（女神轎）。只參考實際中洲まつり花魁道中的場景特徵，不得複製任何照片。

## 範圍
產出 1 張，**覆寫** `2026fukuoka/film2-ai/14-nakasu.png`。不要改其他檔案、不要 git commit、不要開分支。

## 畫面
福岡中洲まつり的「花魁道中」：夜晚中洲的街上，一位花魁穿著華麗多層的錦緞和服，
頭上插滿金色髮簪和梳子，腳踩高黑塗木屐（三枚齒），緩緩踏出外八字步。
身旁有隨行的女性（禿、新造）和撐大紅和傘的男衆。兩側擠滿圍觀人潮，燈籠和霓虹打出暖色光，
晚秋十月下旬的夜晚，熱鬧又華麗。主角是女性。

## 共同要求
- 照片級擬真，像攝影記者用全片幅相機實拍。不要插畫感、CG 感、過度飽和或 HDR 光暈。
- 花魁是主體，偏右；臉可以是側面或白妝的遠中景，但不要變形；手指要正常。
- 橫式 16:9，至少 1536×864。左半部稍微單純一些（之後要壓字）。
- 不要文字、招牌字、浮水印、logo；燈籠上不要有可讀的字。不要紅葉。

## 驗收
16:9；擬真；一眼看得出是花魁遊行。在本檔「執行紀錄」寫下模型與提示詞。

## 執行紀錄
- 執行日期：2026-10-04；Codex 實作，交由 Claude 最終驗收。
- 模型／工具：內建 `image_gen.imagegen`（工具未揭露底層模型識別碼，不臆測型號）；原創生成一張，局部修正木屐一次。
- 場景參考：https://omatsurijapan.com/blog/nakasu-fes-breakingnews-2023/ （只參考場景敘述，不輸入或複製照片）。
- 初次完整提示詞：

```text
Use case: photorealistic-natural. Create one original photo-real editorial photograph for a travel film, landscape exact 16:9, 2048x1152 pixels. Scene: the oiran procession of Nakasu Matsuri in modern Nakasu, Fukuoka, on a lively late-October night. Reference only general real festival characteristics, do not reproduce any existing photograph. Main subject: one adult Japanese female oiran positioned in the right half, shown full length in a natural three-quarter side view, graceful white makeup and anatomically natural face. Elaborate traditional coiffure with numerous golden kanzashi hairpins and combs; luxurious layered gold and deep-red brocade uchikake kimono with a large obi tied at the front. Her visible feet wear very tall black lacquered three-tooth geta; she is slowly taking an outward sweeping figure-eight step, balanced with a male attendant offering support. Female kamuro and shinzo attendants accompany her and another male attendant holds a large plain red Japanese wagasa above and behind her. Modern spectators densely line both sides of the street, warm plain lanterns and soft abstract neon light, festive elegant mood. Left half simpler, darker, softly defocused street and spectators with useful space for later text overlay. Full-frame press photographer look, natural available-light exposure, realistic fabric weave and skin, believable human proportions and normal hands and fingers. Keep the entire main figure and geta within the frame. No text anywhere, no readable sign or lantern lettering, no logos, no watermark, no autumn maple leaves. No illustration, CGI, HDR halos, excessive saturation or glamour studio retouching.
```

- 木屐修正提示詞：

```text
Edit this generated image, preserve the photorealistic festival scene, composition, people, faces, clothing, umbrella, lighting, and empty left half. Correct only the main oiran's footwear and foot pose: replace the cylindrical-looking black stilts with anatomically credible traditional black lacquered sanmaiba geta, each shoe has one flat horizontal wooden top platform and exactly three distinct flat vertical rectangular wooden teeth underneath, with visible open air gaps between the teeth. Show the shoes in a three-quarter side view so their three-tooth construction is evident. Her tabi-covered feet sit naturally on the platforms secured with red hanao straps; one foot turns slightly outward in a slow sweeping procession step. Do not add lettering, logos or maple leaves. Preserve exact landscape 16:9 at 2048x1152 or higher.
```

- 輸出：`2026fukuoka/film2-ai/14-nakasu.png`。生成原圖 1672×941，僅裁去邊緣共 8 像素寬、5 像素高，輸出 1664×936，精確 16:9；未放大。
- 已實測：PNG 可開啟，1664×936，寬×9＝高×16。目視為照片擬真花魁遊行；主角偏右、金色髮簪、多層錦緞、黑塗三齒木屐、隨行女性、男性紅和傘、兩側人潮與夜景可辨識；左側留壓字空間。未見可讀文字、浮水印、logo、紅葉或明顯臉部／手部變形。
- 限制：靜態影像只能呈現外八字步的姿態，無法驗證連續步法；尚未驗收影片內壓字效果，留給 Claude。
- 未 commit／push／切分支／開 PR；除指定圖片與本任務書執行紀錄，未修改其他檔案。
