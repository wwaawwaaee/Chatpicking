#!/usr/bin/env node

/**
 * collect.mjs — 实时监听 QQ 群聊消息，收集一段时间后输出汇总
 *
 * 用法:
 *   node collect.mjs --napcat <ws地址> --group <群号> [--duration <分钟>] [--token <access_token>]
 *
 * 示例:
 *   node collect.mjs --napcat ws://127.0.0.1:3001 --group 123456789 --duration 60
 *
 * 输出: 收集时间结束后，输出 JSON 格式的消息列表到 stdout
 */

import WebSocket from 'ws';

// ─── 参数解析 ────────────────────────────────────────────────

function parseArgs(argv) {
    const args = {
        napcat: process.env.NAPCAT_WS || 'ws://127.0.0.1:3001',
        group: process.env.NAPCAT_GROUP || '',
        duration: 60, // 默认 60 分钟
        token: process.env.NAPCAT_TOKEN || '',
    };

    for (let i = 2; i < argv.length; i++) {
        switch (argv[i]) {
            case '--napcat': args.napcat = argv[++i]; break;
            case '--group': args.group = argv[++i]; break;
            case '--duration': args.duration = parseInt(argv[++i], 10) || 60; break;
            case '--token': args.token = argv[++i]; break;
            case '--help':
                console.log(`用法: node collect.mjs --napcat <ws地址> --group <群号> [--duration <分钟>] [--token <token>]

参数:
  --napcat     NapCat WebSocket 地址 (默认: ws://127.0.0.1:3001, 也可通过环境变量 NAPCAT_WS 设置)
  --group      QQ 群号 (必填, 也可通过环境变量 NAPCAT_GROUP 设置)
  --duration   收集时长，单位分钟 (默认: 60)
  --token      OneBot access_token (可选, 也可通过环境变量 NAPCAT_TOKEN 设置)

示例:
  node collect.mjs --napcat ws://127.0.0.1:3001 --group 123456789 --duration 30`);
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
    if (!text) return null;

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
    const targetGroup = parseInt(args.group, 10);
    const durationMs = args.duration * 60 * 1000;
    const collectedMessages = [];
    const startTime = new Date();

    // 在 stderr 输出进度信息（不影响 JSON stdout 输出）
    process.stderr.write(`[chatpicking] 开始收集群 ${args.group} 的消息，持续 ${args.duration} 分钟...\n`);

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
        process.stderr.write(`[chatpicking] 已连接到 NapCat: ${args.napcat}\n`);

        // 监听群消息
        ws.on('message', (raw) => {
            try {
                const event = JSON.parse(raw.toString());

                // 过滤：只接收目标群的 group message 事件
                if (
                    event.post_type === 'message' &&
                    event.message_type === 'group' &&
                    parseInt(event.group_id, 10) === targetGroup
                ) {
                    const formatted = formatMessage(event);
                    if (formatted) {
                        collectedMessages.push(formatted);
                        process.stderr.write(`[chatpicking] 收集到消息 #${collectedMessages.length}: ${formatted.sender}: ${formatted.content.substring(0, 50)}...\n`);
                    }
                }
            } catch (_) {
                // 忽略非 JSON 或其他事件
            }
        });

        // 监听断线
        ws.on('close', () => {
            process.stderr.write(`[chatpicking] WebSocket 连接已断开\n`);
        });

        // 等待收集时间结束
        await new Promise((resolve) => setTimeout(resolve, durationMs));

        const endTime = new Date();

        // 输出结果
        const result = {
            success: true,
            group_id: args.group,
            collected_count: collectedMessages.length,
            duration_minutes: args.duration,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            messages: collectedMessages,
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
