# 九州行程頁：所有 AI 圖換成真實照片

- status: 進行中
- assignee: Claude（主導兼實作；選圖需要逐張目視判斷）
- 分支: feat/kyushu-real-photos
- 來源：使用者 2026-09-27「請把所有圖片使用真實圖片替代，精挑細選過」

## 現況
`2026fukuoka/img/` 24 張圖中，只有 4 張是真實照片：`toyokan.jpg`、`toyokan-bath.jpg`（東洋館官方）、
`newotani.jpg`（新大谷官方）、`nakasu-yatai.jpg`（福岡縣觀光聯盟）。其餘都是 AI 生成。

頁面有用到、要換的 13 張：
aerial-kyushu、takeoff（影片片頭片尾）、toyokan 之外的每日圖（nagasaki、gunkanjima、htbdusk、
huistenbosch、amsterdamhotel、tenjin、yanagibashi）、旅宿卡（forestvilla、amsterdamhotel、nagasaki）、
買什麼／豪斯登堡段落（depachika、porcelain、htbnight、huistenbosch）。

沒被引用的 7 張 AI 圖（airport、dazaifu、hero、momochi、nagasakislope、nakasunight、roses）直接刪除。

## 做法與限制
- 網站是公開的 GitHub Pages，任何人都看得到 ⇒ 只用**允許轉載**的真實照片：
  Wikimedia Commons（CC BY／CC BY-SA／CC0／公有領域）或官方觀光照片庫，頁尾逐張標註作者與授權。
- 縮到長邊 1600px 左右、每張 < 500 KB，檔名沿用，程式只改 alt 與頁尾。
- 圖說不得再寫「AI 示意圖」。

## 驗收（Claude 自驗）
- 每張新圖有來源頁、作者、授權紀錄（見下表）。
- 桌機與手機寬度截圖，每日卡、旅宿卡、影片、買什麼段落都顯示真實照片。
- `grep` 找不到未被引用的圖、找不到「AI 示意」字樣。

## 選圖紀錄
（進行中）
