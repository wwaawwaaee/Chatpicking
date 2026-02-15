# Chatpicking — QQ 群聊消息扫描与总结

一个 OpenClaw Skill，通过 NapCat (OneBot v11 协议) 连接 QQ，扫描指定群的聊天记录，由 OpenClaw 的 LLM 自动生成摘要总结。

## 功能

- **拉取历史消息** — 获取群聊最近 N 条消息
- **实时监听收集** — 监听群消息指定时间后输出汇总
- **定时自动总结** — 配合 OpenClaw cron 实现每日/每周自动摘要
- **结构化输出** — JSON 格式输出，由 gateway LLM 解读总结

## 前置要求

1. **Node.js** ≥ 18
2. **NapCat** — QQ 协议适配层，需自行安装
   - 官方文档：https://napneko.github.io/
   - 安装后需配置 OneBot v11 WebSocket 服务端口

## 快速开始

### 1. 安装依赖

```bash
cd <skill目录>
npm install
```

### 2. 启动 NapCat

按照 NapCat 官方文档安装并启动，确保 WebSocket 服务运行在默认端口 `3001`（或自定义端口）。

### 3. 使用

```bash
# 拉取群聊最近 100 条消息
node scripts/fetch.mjs --napcat ws://127.0.0.1:3001 --group <群号>

# 实时监听群消息 30 分钟
node scripts/collect.mjs --napcat ws://127.0.0.1:3001 --group <群号> --duration 30
```

## NapCat 配置要点

1. 下载安装 NapCat：https://github.com/NapNeko/NapCatQQ/releases
2. 使用 WebUI 扫码登录 QQ
3. 在设置中开启 **OneBot v11 WebSocket 服务**，记录端口号
4. 确保 Bot QQ 账号已加入目标群

## 项目结构

```
Chatpicking/
├── SKILL.md           # OpenClaw Skill 定义
├── package.json       # Node.js 项目配置
├── scripts/
│   ├── fetch.mjs      # 拉取群聊历史消息
│   └── collect.mjs    # 实时监听群消息
└── README.md          # 本文件
```

## 许可证

MIT License
