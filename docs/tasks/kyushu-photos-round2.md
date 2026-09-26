# 九州行程頁：照片第二輪（手機不再特寫、換更漂亮的園區與祭典照）

- status: 交審
- assignee: Claude（主導兼實作；選圖要逐張目視）
- 分支: feat/kyushu-photos-round2
- 來源：使用者 2026-09-27
  - 「手機版的影片視角都抓太近了……中洲可用祭典的漂亮圖片，豪斯登堡要有米菲兔房、夜間燈光秀、飯店正面……九州俯瞰不要在雲層上，要能看見陸地」
  - 「11/1 挑天神商圈銀杏盛開季節的美照」

## 改了什麼
- 手機直式片頭影片：照片改成寬度貼齊、整張放進畫面（位置 58%），上下用同一張照片的模糊版補滿，不再裁成特寫（`journal.css`、`ukiyo.js` 加 `--img`）。
- 片頭第一句改成「從空中看見，九州」。
- 每日卡：10.29 燈光秀、10.30 米菲兔房、10.31 中洲祭、11.01 舞鶴公園銀杏；旅宿卡換成阿姆斯特丹飯店正面官方照。
- 刪除已不再使用的 `nakasu-yatai.jpg`。

## 照片來源
| 檔名 | 內容 | 來源／授權 |
|---|---|---|
| aerial-kyushu.jpg | 機窗俯瞰福岡人工島 | Commons「Aerial view of Fukuoka Island City.jpg」ブルーノ・プラス，CC BY-SA 4.0 |
| htbnight.jpg | 夜間塔樓與運河 | Commons「New year illumination in Japan - panoramio.jpg」Masoud Akbari，CC BY-SA 3.0 |
| htbillum.jpg | 燈光秀運河 | Commons「Sasebo - New year illumination - panoramio (4).jpg」Masoud Akbari，CC BY-SA 3.0 |
| amsterdamhotel.jpg | 飯店正面 | 豪斯登堡官方網站 |
| miffyroom.jpg | 米菲兔房 | 豪斯登堡官方網站（Miffy © Mercis bv） |
| nakasu-matsuri.jpg | 中洲祭遊行 | Fukuoka Now |
| tenjin.jpg | 舞鶴公園銀杏（離天神步行約 15 分） | Fukuoka Now 秋葉指南 |

官方與 Fukuoka Now 的照片不是自由授權：依使用者判斷（私人行程頁）使用，頁尾已標出處。

## 驗收（Claude 自驗）
- 手機寬 390 用 iframe 截圖（第 2／9／11 格）：照片完整、地圖與直書標題可讀。
- 桌機長截圖：旅宿卡、時間軸正常；以 `--dump-dom #day-6~9` 確認四天各自顯示對應新圖。
- `grep`：沒有未被引用或缺檔的圖片。
- 未測：實機手機（只做了瀏覽器模擬）。
