#!/usr/bin/env node

/**
 * fetch.mjs — 通过 NapCat OneBot v11 API 拉取 QQ 群聊历史消息
 *
 * 用法:
 *   node fetch.mjs --napcat <ws地址> --group <群号> [--count <数量>] [--token <access_token>]
 *
 * 示例:
 *   node fetch.mjs --napcat ws://127.0.0.1:3001 --group 123456789 --count 100
 *
 * 输出: JSON 格式的消息列表到 stdout
 */

import WebSocket from 'ws';

// ─── 参数解析 ────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    napcat: process.env.NAPCAT_WS || 'ws://127.0.0.1:3001',
    group: process.env.NAPCAT_GROUP || '',
    count: 100,
    token: process.env.NAPCAT_TOKEN || '',
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--napcat':  args.napcat = argv[++i]; break;
      case '--group':   args.group  = argv[++i]; break;
      case '--count':   args.count  = parseInt(argv[++i], 10) || 100; break;
      case '--token':   args.token  = argv[++i]; break;
      case '--help':
        console.log(`用法: node fetch.mjs --napcat <ws地址> --group <群号> [--count <数量>] [--token <token>]

参数:
  --napcat   NapCat WebSocket 地址 (默认: ws://127.0.0.1:3001, 也可通过环境变量 NAPCAT_WS 设置)
  --group    QQ 群号 (必填, 也可通过环境变量 NAPCAT_GROUP 设置)
  --count    拉取消息数量 (默认: 100)
  --token    OneBot access_token (可选, 也可通过环境变量 NAPCAT_TOKEN 设置)

示例:
  node fetch.mjs --napcat ws://127.0.0.1:3001 --group 123456789 --count 50`);
        process.exit(0);
    }
  }

  if (!args.group) {
    console.error(JSON.stringify({
      success: false,
      error: '缺少必需参数 --group (QQ群号)。使用 --help 查看帮助。'
    }));
    process.exit(1);
  }

  return args;
}

// ─── OneBot API 请求 ─────────────────────────────────────────

let requestId = 0;

function sendRequest(ws, action, params = {}) {
  return new Promise((resolve, reject) => {
    const echo = `req_${++requestId}_${Date.now()}`;
    const timeout = setTimeout(() => {
      reject(new Error(`请求超时: ${action}`));
    }, 15000);

    const handler = (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.echo === echo) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          if (data.retcode === 0) {
            resolve(data.data);
          } else {
            reject(new Error(`API 错误 [${action}]: retcode=${data.retcode}, msg=${data.msg || data.message || '未知'}`));
          }
        }
      } catch (_) {
        // 忽略非 JSON 消息
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify({ action, params, echo }));
  });
}

// ─── 提取纯文本 ─────────────────────────────────────────────

function extractText(message) {
  if (!message || !Array.isArray(message)) return '';
  return message
    .filter(seg => seg.type === 'text')
    .map(seg => seg.data?.text || '')
    .join('')
    .trim();
}

// ─── 格式化消息 ─────────────────────────────────────────────

function formatMessage(msg) {
  const text = extractText(msg.message);
  if (!text) return null; // 跳过非文本消息（图片/表情等）

  return {
    sender: msg.sender?.nickname || msg.sender?.card || `用户${msg.sender?.user_id || '未知'}`,
    user_id: msg.sender?.user_id || null,
    time: msg.time ? new Date(msg.time * 1000).toISOString() : null,
    timestamp: msg.time || null,
    content: text,
  };
}

// ─── 主逻辑 ─────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  const wsUrl = args.token
    ? `${args.napcat}?access_token=${args.token}`
    : args.napcat;

  const ws = new WebSocket(wsUrl);

  const connectPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`连接 NapCat 超时: ${args.napcat}`));
    }, 10000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`连接 NapCat 失败: ${err.message}。请确认 NapCat 已启动并配置了 OneBot v11 WebSocket 服务。`));
    });
  });

  try {
    await connectPromise;

    // 拉取群消息历史
    const historyData = await sendRequest(ws, 'get_group_msg_history', {
      group_id: parseInt(args.group, 10),
      count: args.count,
    });

    // historyData.messages 是消息数组
    const rawMessages = historyData?.messages || historyData || [];
    const messages = (Array.isArray(rawMessages) ? rawMessages : [])
      .map(formatMessage)
      .filter(Boolean);

    // 输出结果
    const result = {
      success: true,
      group_id: args.group,
      fetched_count: messages.length,
      requested_count: args.count,
      fetch_time: new Date().toISOString(),
      messages,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(JSON.stringify({
      success: false,
      error: err.message,
    }));
    process.exit(1);
  } finally {
    ws.close();
  }
}

main();
