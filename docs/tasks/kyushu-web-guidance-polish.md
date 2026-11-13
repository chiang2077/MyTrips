# 九州頁：依 modern-web-guidance 準則的小幅調整

- status: 進行中
- lead: Claude（主導、審查、驗收、git／PR／合併）
- assignee: Claude Opus 5.5 子代理（使用者 2026-11-13 指定）
- branch: feat/kyushu-web-guidance-polish
- 使用者指示（2026-11-13）：「依照你的建議一路做完，派工給 opus5.5 執行，做好之後網頁直接上線並且合併」——合併授權只限這一件 PR。
- 緣由：用 GoogleChrome/modern-web-guidance 外掛檢視 `2026fukuoka/`，挑出下列可調整處。

## 範圍（只動 `2026fukuoka/`）

### 1. 壓縮兩個 512 圖示
- 現況：`icons/icon-512.png`、`icons/icon-maskable-512.png` 各 399,749 bytes（512×512、RGB）；新加坡頁同類圖示約 17 KB。離線快取第一次會把它們全抓下來。
- 做法：維持檔名、PNG 格式、512×512，重新壓縮（例如 Pillow 調色盤量化＋optimize）。
- 目標：每個 ≤ 120 KB，肉眼看不出色帶或邊緣鋸齒。達不到就取「看不出差別」的最小值並在交件說明。
- 其他圖示（192、apple-touch、favicon）不動。

### 2. 封面影片的預覽圖與影片網址寫進 HTML
- 現況：`film.html` 以 JS `v.poster=…;v.src=…` 設定，瀏覽器的預先掃描器看不到，網路慢時封面先黑。
- 做法：把 `poster="film/poster-wide.jpg"`、`src="film/kyushu-wide.mp4"` 直接寫在 `<video>` 標籤上，並依預覽圖實際尺寸加 `width`／`height`；刪掉 JS 那一行。
- 不得改變的行為：靜音自動播放、「減少動態效果」時不自動播放只顯示預覽圖、捲出畫面暫停、`?embed=1` 的連結改寫、鍵盤與進度條操作。

### 3. 影片進度條補上無障礙數值
- 現況：`#track` 是 `role="slider"`，但沒有 `aria-valuemin/max/now`，朗讀軟體不知道進度。
- 做法：HTML 加 `aria-valuemin="0"`、`aria-valuemax="100"`、`aria-valuenow="0"`；`tick()` 內同步更新 `aria-valuenow`（整數百分比）與 `aria-valuetext`（例如「0:12，共 0:30」）。不改外觀、不改成原生 input。

### 4. 標題與內文的換行品質
- 做法：在 `journal.css` 加 `text-wrap:balance`（h1–h4）與 `text-wrap:pretty`（p、li）。不支援的瀏覽器會自動忽略，不必寫備援。
- 注意：`journal.css` 是壓縮過的單行樣式，照既有寫法加；不要重新排版整份檔案（diff 要小）。
- 若某個有邊框／底色的標題因 balance 變得難看，針對它寫回 `text-wrap:wrap` 並在交件說明。

### 5. 彈窗背景不要帶動底下頁面捲動
- 做法：`.htb-dialog::backdrop` 與 `.driver-dialog::backdrop` 各加 `overflow:hidden;overscroll-behavior:contain`。彈窗本體已有 `overscroll-behavior:contain`，不動。

### 6. 切換日期時不要朗讀整天內容
- 現況：`index.html` 的 `#day-stage` 有 `aria-live="polite"`，換一天會把整天行程念一遍。
- 做法：拿掉 `#day-stage` 的 `aria-live`；在桌面版的 `#day-position` 加 `aria-live="polite"`（手機版 `#mobile-day-position` 已有）。

### 7. 重建離線快取清單
- 改完跑 `py -3 tools/build_sw.py 2026fukuoka`（圖示同檔名換內容，一定要跑），`sw.js` 的版本號要有變。

## 不做
- 字級 px → rem 與 `<meta name="text-scale">`（留給下一個行程頁）。
- 照片轉 WebP／AVIF、多尺寸圖。
- 把彈窗「點背景關閉」改成 `closedby="any"`（Safari 不支援，現有寫法保留）。
- 任何行程內容、文案、配色、版面；其他行程資料夾；`onetake.html`、`autumn.css`。
- **git 一律不碰**（不 add、不 commit、不切分支、不 push）；不改 `docs/COLLAB_STATUS.md` 與本任務書的 status。

## 驗收（實作者自跑，主導者覆審重跑）
1. `git diff --stat` 只出現：`2026fukuoka/icons/icon-512.png`、`icon-maskable-512.png`、`film.html`、`index.html`、`journal.css`、`sw.js`。
2. 兩個圖示仍是 512×512 PNG，大小符合目標。
3. 本機起靜態伺服器（**不要用 8765 埠**），用無頭瀏覽器開 `2026fukuoka/` 與 `2026fukuoka/film.html`：
   - 主控台沒有錯誤；
   - 393px 與 1280px 寬各截一張圖，與改動前相比版面沒有跑掉（改前先截圖留底）；
   - `film.html` 的 `<video>` 有 `poster` 屬性且圖片載入成功；播放後 `aria-valuenow` 會變；
   - 開一個豪斯登堡攻略彈窗、一張司機卡，能開能關。
4. `node --check`（或等效方式）確認改過的 JS 沒有語法錯誤。
5. 截圖與暫存腳本放在 repo 以外的暫存資料夾，不要留在工作區。

## 交件
回報：每一項改了哪幾行、驗收每一條的實際結果（做了／沒做到／做不到的原因）、圖示壓縮前後大小、有沒有任何偏離本任務書之處。「已實測」與「推斷」分開講。

## 審查重點（主導者）
- diff 是否只有上列檔案、`journal.css` 沒被整份重排。
- 影片在「減少動態效果」下是否仍不自動播放。
- 圖示放大看有沒有色帶。
- `sw.js` 版本號是否更新、清單沒有多或少檔案。
