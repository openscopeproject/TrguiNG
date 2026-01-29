# TrguiNG 國際化術語表 / Internationalization Glossary

本文檔定義了 TrguiNG 專案中使用的標準化術語翻譯，確保翻譯的一致性。

This document defines standardized terminology translations used in the TrguiNG project to ensure translation consistency.

---

## BitTorrent 核心術語 / Core BitTorrent Terms

| English     | 繁體中文 | Notes / 備註              |
| ----------- | -------- | ------------------------- |
| torrent     | 種子     | BitTorrent 檔案或任務     |
| magnet link | 磁力連結 | 以 `magnet:` 開頭的連結 |
| seeder      | 做種者   | 擁有完整檔案並上傳的用戶  |
| leecher     | 下載者   | 正在下載的用戶            |
| peer        | 節點     | 參與傳輸的任意用戶        |
| tracker     | Tracker  | 協調節點發現的伺服器      |
| piece       | 分片     | 種子檔案的資料塊          |
| hash        | 雜湊值   | 檔案或分片的唯一識別      |
| ratio       | 分享率   | 上傳量 / 下載量           |
| swarm       | 群組     | 參與同一種子的所有節點    |

## 傳輸狀態 / Transfer States

| English     | 繁體中文       | Notes / 備註               |
| ----------- | -------------- | -------------------------- |
| downloading | 下載中         | 正在接收資料               |
| seeding     | 做種中         | 正在上傳資料（已完成下載） |
| paused      | 已暫停         | 使用者主動暫停             |
| stopped     | 已停止         | 任務已停止                 |
| checking    | 校驗中         | 正在驗證資料完整性         |
| verifying   | 驗證中         | 同 checking                |
| queued      | 排隊中         | 等待開始                   |
| magnetizing | 解析磁力連結中 | 正在取得種子原始資料       |

## 節點狀態 / Peer Status

| English             | 繁體中文       | Notes / 備註                           |
| ------------------- | -------------- | -------------------------------------- |
| optimistic          | 樂觀解阻       | 樂觀解阻塞，嘗試與節點建立連線         |
| downloading         | 下載中         | 正在從該節點下載資料                   |
| can download from   | 可下載         | 該節點有我們需要的資料                 |
| uploading           | 上傳中         | 正在向該節點上傳資料                   |
| can upload to       | 可上傳         | 該節點需要我們擁有的資料               |
| not interested      | 不感興趣       | 我們對該節點的資料不感興趣             |
| peer not interested | 對方不感興趣   | 該節點對我們的資料不感興趣             |
| incoming            | 傳入           | 連線方向：對方主動連接我們             |
| outgoing            | 傳出           | 連線方向：我們主動連接對方             |
| encrypted           | 加密           | 連線是否加密                           |
| PEX                 | PEX            | Peer Exchange，節點交換協定發現        |
| DHT                 | DHT            | Distributed Hash Table，分散式雜湊表發現 |

## 速度與資料量 / Speed & Data

| English        | 繁體中文 | Notes / 備註              |
| -------------- | -------- | ------------------------- |
| download speed | 下載速度 |                           |
| upload speed   | 上傳速度 |                           |
| ETA            | 剩餘時間 | Estimated Time of Arrival |
| free space     | 可用空間 | 磁碟剩餘空間              |

## 介面元素 / UI Elements

| English    | 繁體中文 | Notes / 備註    |
| ---------- | -------- | --------------- |
| settings   | 設定     |                 |
| toolbar    | 工具列   |                 |
| status bar | 狀態列   |                 |
| filter     | 篩選     | 作為名詞/功能時 |
| label      | 標籤     | 使用者自訂分類  |
| queue      | 佇列     |                 |
| priority   | 優先順序 |                 |

## 操作動作 / Actions

| English    | 繁體中文 | Notes / 備註        |
| ---------- | -------- | ------------------- |
| start      | 開始     | 開始下載/做種       |
| stop       | 停止     | 完全停止任務        |
| pause      | 暫停     | 臨時暫停            |
| resume     | 繼續     | 恢復暫停的任務      |
| remove     | 移除     | 從清單中移除        |
| verify     | 校驗     | 驗證資料完整性      |
| reannounce | 重新宣告 | 向 Tracker 重新報告 |

## 伺服器相關 / Server Related

| English        | 繁體中文 | Notes / 備註          |
| -------------- | -------- | --------------------- |
| server         | 伺服器   | Transmission 守護程式 |
| connection     | 連線     |                       |
| authentication | 認證     |                       |
| session        | 工作階段 |                       |

## 檔案系統 / File System

| English            | 繁體中文 | Notes / 備註 |
| ------------------ | -------- | ------------ |
| download directory | 下載目錄 |              |
| location           | 位置     | 檔案存放位置 |
| file               | 檔案     |              |
| folder             | 資料夾   |              |

---

## 翻譯原則 / Translation Principles

1. **一致性 / Consistency**: 同一術語在整個專案中使用相同的翻譯
2. **準確性 / Accuracy**: 翻譯應準確反映原文含義
3. **簡潔性 / Conciseness**: 在保持準確的前提下儘量簡潔
4. **在地化 / Localization**: 使用目標語言使用者熟悉的表達方式

## 特殊說明 / Special Notes

- **torrent** 統一翻譯為「種子」，不使用「Torrent」或「BT 種子」
- **peer** 翻譯為「節點」，區別於 seeder（做種者）與 leecher（下載者）
- **tracker** 翻譯為「索引伺服器」
- 單位符號（B, KB, MB, GB, TB）保持英文不翻譯
- 技術性專有名詞（如 URL, ETA）可保持英文
