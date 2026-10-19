# 交接狀態

## 現在
- 2026-10-19 九州頁「颱風應變」專區（長榮 10/24 航班、安達基本型＋尊榮型保障與理賠情境）：Claude 實作並以 Playwright 393/1280px 驗收；feat/kyushu-typhoon-plan，PR #72 待使用者審核合併。航班時刻為 10/19 查詢的表定時刻，颱風期間需再確認。
- 2026-10-14 九州現場手冊（每站地圖鈕、司機卡、旅宿電話、離線＋更新機制、打包清單）：**完成**；主導 Claude、實作 agy（Grok 當時登入過期，改派；之後已補登入）；feat/kyushu-onsite-handbook。Claude 補跑驗收 38 項全過，真實手機與線上環境未實測。改版後記得跑 `py -3 tools/build_sw.py 2026fukuoka`。任務書 tasks/kyushu-onsite-handbook.md。使用者已下令做完即合併（只限這一件 PR）。
- 九州手機每日切換：已實作與驗收，使用者已授權合併 PR #29；Codex；feat/kyushu-mobile-day-picker。範圍與驗收見 tasks/mobile-day-picker.md。合併與部署狀態以 GitHub PR / Pages 為準。
- 九州懶人包影片補圖：Codex 已交圖、Claude 驗收通過；隨 feat/kyushu-film-story PR 交審。

## 使用者偏好
- 2026-09-14：授權 Codex 自動依任務難度選擇子代理模型，主代理負責整合與驗收。
