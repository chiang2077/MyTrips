# 封面影片 v2：中洲祭「女みこし」AI 擬真圖（Codex 執行）

- status: 完成
- assignee: Codex（實作）；主導與驗收：Claude
- 來源：使用者 2026-10-04「中州祭要呈現出女性參與的這個特色」「如果沒有素材可用，由你在有版權資料中挑選最合適的由codex仿繪一次」
- 參考（只看構圖與服裝特徵，不得複製任何照片）：西日本新聞「中洲まつり・國廣女みこし 写真特集」
  https://www.nishinippon.co.jp/gallery/nakasu_festival/
  Commons 上找不到可用的開放授權影片或照片，所以改用 AI 生成。

## 範圍
用你內建的圖片生成工具產出 **1 張**：`2026fukuoka/film2-ai/14-nakasu.png`。
不要改其他檔案、不要 git commit、不要開分支。

## 畫面
福岡中洲まつり「國廣女みこし」：一大群**女性**扛著金色、裝飾華麗的神轎，
走在夜晚中洲的街上。她們穿白色法被（半纏）、綁頭巾或鉢巻，全場熱烈、充滿動感；
背景是那珂川沿岸的霓虹燈與街燈，暖色燈光，晚秋十月下旬的夜晚。
是祭典的高峰時刻：神轎被高高舉起，有人在呼喊。

## 共同要求
- 照片級擬真，像攝影記者用全片幅相機實拍。可以有動態模糊，但不要插畫感、CG 感、過度飽和或 HDR 光暈。
- 臉不要清楚可辨（側面、背影，或用動態模糊帶過即可），不要怪手指。
- 橫式 16:9，至少 1536×864。左半部稍微單純一些（之後要壓大字）。
- 不要文字、招牌字、浮水印、logo；燈籠上不要有可讀的字。
- 不要紅葉。

## 驗收
檔案存在且是 16:9；確認擬真度，並確認一眼看得出是女性扛神轎。
完成後在本檔最後的「執行紀錄」寫下用了哪個模型與提示詞。

## 執行紀錄

- 2026-10-04：Codex 產出 `2026fukuoka/film2-ai/14-nakasu.png`，待 Claude 審查。未 commit、未切分支。
- 模型：內建 `image_gen` 圖片生成工具；工具未回傳底層模型名稱，無法確認具體型號。
- 尺寸驗收：原圖 1672×941；上下共裁切 0.5 像素後等比縮放為 1536×864 PNG，重新讀取檔案確認精確 16:9 且符合最低尺寸。
- 參考網站因 robots.txt 無法讀取，依任務書描述建立原創構圖，未輸入或複製新聞照片。
- 視覺檢查：照片擬真；女性以背影、柔焦側面扛起金色神轎，白色祭典服與頭巾清楚可見；左側河面與夜空較單純。未見可讀文字、logo、浮水印、紅葉或明顯畸形手指。此為 AI 示意畫面，非真實祭典紀錄。
- 提示詞（原文）：

```text
Use case: photorealistic-natural. Create ONE original photo-realistic editorial photograph for a travel film, landscape EXACT 16:9, 1536x864 or larger (prefer 2048x1152). Scene: Fukuoka Nakasu festival, Kunihiro onna-mikoshi, late October night. A large crowd of adult Japanese WOMEN carrying and enthusiastically lifting an ornate gold Japanese mikoshi shrine high on wooden carrying beams, at the peak of the festival. Women wear white happi festival coats and white tied hachimaki headbands, visible feminine silhouettes and tied-back hair. Camera from behind and slightly to the side, women predominantly back views and soft profiles, faces unrecognizable through realistic motion blur and depth of field. Convincing weight-bearing shoulder posture and natural hands gripping the beams. Shrine and dense female carriers concentrated center-right, left half visually quieter and darker for later large title overlay, but still part of same natural scene. Background: Nakasu street near Naka River with soft defocused neon and warm streetlamps, indistinct riverside city lights. Warm lively atmosphere, women shouting and moving, natural photographic grain, full-frame documentary press photography, believable gold and fabric textures, restrained colors, realistic exposure. Original composition, do not reproduce any existing photograph. NO text anywhere, NO readable sign lettering, NO writing on lanterns or coats, NO logos, NO watermark, NO autumn leaves or red maple foliage. No illustration, CGI, plastic skin, HDR halos, over-saturation, malformed fingers. Opaque background.
```
