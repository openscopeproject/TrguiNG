# TrguiNG 国际化术语表 / Internationalization Glossary

本文档定义了 TrguiNG 项目中使用的标准化术语翻译，确保翻译的一致性。

This document defines standardized terminology translations used in the TrguiNG project to ensure translation consistency.

---

## BitTorrent 核心术语 / Core BitTorrent Terms

| English | 中文 | Notes / 备注 |
|---------|------|--------------|
| torrent | 种子 | BitTorrent 文件或任务 |
| magnet link | 磁力链接 | 以 `magnet:` 开头的链接 |
| seeder | 做种者 | 拥有完整文件并上传的用户 |
| leecher | 下载者 | 正在下载的用户 |
| peer | 节点 | 参与传输的任意用户 |
| tracker | 跟踪器 | 协调节点发现的服务器 |
| piece | 分片 | 种子文件的数据块 |
| hash | 哈希值 | 文件或分片的唯一标识 |
| ratio | 分享率 | 上传量/下载量 |
| swarm | 群组 | 参与同一种子的所有节点 |

## 传输状态 / Transfer States

| English | 中文 | Notes / 备注 |
|---------|------|--------------|
| downloading | 下载中 | 正在接收数据 |
| seeding | 做种中 | 正在上传数据（已完成下载） |
| paused | 已暂停 | 用户主动暂停 |
| stopped | 已停止 | 任务已停止 |
| checking | 校验中 | 正在验证数据完整性 |
| verifying | 验证中 | 同 checking |
| queued | 排队中 | 等待开始 |
| magnetizing | 解析磁力链接中 | 正在获取种子元数据 |

## 速度与数据量 / Speed & Data

| English | 中文 | Notes / 备注 |
|---------|------|--------------|
| download speed | 下载速度 | |
| upload speed | 上传速度 | |
| ETA | 剩余时间 | Estimated Time of Arrival |
| free space | 可用空间 | 磁盘剩余空间 |

## 界面元素 / UI Elements

| English | 中文 | Notes / 备注 |
|---------|------|--------------|
| settings | 设置 | |
| toolbar | 工具栏 | |
| status bar | 状态栏 | |
| filter | 筛选 | 作为名词/功能时 |
| label | 标签 | 用户自定义分类 |
| queue | 队列 | |
| priority | 优先级 | |

## 操作动作 / Actions

| English | 中文 | Notes / 备注 |
|---------|------|--------------|
| start | 开始 | 开始下载/做种 |
| stop | 停止 | 完全停止任务 |
| pause | 暂停 | 临时暂停 |
| resume | 继续 | 恢复暂停的任务 |
| remove | 移除 | 从列表中移除 |
| verify | 校验 | 验证数据完整性 |
| reannounce | 重新汇报 | 向跟踪器重新报告 |

## 服务器相关 / Server Related

| English | 中文 | Notes / 备注 |
|---------|------|--------------|
| server | 服务器 | Transmission 守护进程 |
| connection | 连接 | |
| authentication | 认证 | |
| session | 会话 | |

## 文件系统 / File System

| English | 中文 | Notes / 备注 |
|---------|------|--------------|
| download directory | 下载目录 | |
| location | 位置 | 文件存储位置 |
| file | 文件 | |
| folder | 文件夹 | |

---

## 翻译原则 / Translation Principles

1. **一致性 / Consistency**: 同一术语在整个项目中使用相同的翻译
2. **准确性 / Accuracy**: 翻译应准确反映原文含义
3. **简洁性 / Conciseness**: 在保持准确的前提下尽量简洁
4. **本地化 / Localization**: 使用目标语言用户熟悉的表达方式

## 特殊说明 / Special Notes

- **torrent** 统一翻译为「种子」，不使用「Torrent」或「BT种子」
- **peer** 翻译为「节点」，区别于 seeder（做种者）和 leecher（下载者）
- **tracker** 翻译为「跟踪器」，不使用「服务器」以避免与 Transmission 服务器混淆
- 单位符号（B, KB, MB, GB, TB）保持英文不翻译
- 技术性专有名词（如 URL, ETA）可保持英文
