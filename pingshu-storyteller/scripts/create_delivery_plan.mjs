#!/usr/bin/env node
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const allowedFormats = new Set(["m4a", "mp3", "wav", "flac", "aac"]);

function usage() {
  console.error("Usage: node create_delivery_plan.mjs <audio_path> <delivery_plan.json> [--title <title>] [--qa passed|warning|not_run] [--rights personal_generated|user_authorized|uncertain]");
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {
    title: "评书音频",
    qa: "not_run",
    rights: "uncertain"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--title") {
      flags.title = argv[index + 1];
      index += 1;
    } else if (item === "--qa") {
      flags.qa = argv[index + 1];
      index += 1;
    } else if (item === "--rights") {
      flags.rights = argv[index + 1];
      index += 1;
    } else if (item.startsWith("--")) {
      throw new Error(`Unknown flag: ${item}`);
    } else {
      positional.push(item);
    }
  }

  return { positional, flags };
}

function probeDurationSec(audioPath) {
  const result = spawnSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath
  ], {
    encoding: "utf8",
    input: "",
    timeout: 15000
  });

  if (result.error || result.status !== 0) return null;
  const duration = Number.parseFloat(String(result.stdout || "").trim());
  return Number.isFinite(duration) ? Math.round(duration * 1000) / 1000 : null;
}

try {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  if (positional.length < 2) usage();

  const audioPath = resolve(positional[0]);
  const outputPath = resolve(positional[1]);

  if (!existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const format = extname(audioPath).replace(".", "").toLowerCase();
  if (!allowedFormats.has(format)) {
    throw new Error(`Unsupported audio format: ${format || "(none)"}. Expected one of: ${Array.from(allowedFormats).join(", ")}`);
  }

  if (!["passed", "warning", "not_run"].includes(flags.qa)) {
    throw new Error("--qa must be passed, warning, or not_run");
  }

  if (!["personal_generated", "user_authorized", "uncertain"].includes(flags.rights)) {
    throw new Error("--rights must be personal_generated, user_authorized, or uncertain");
  }

  const audioStat = statSync(audioPath);
  const plan = {
    schema_version: "1.0",
    title: flags.title || "评书音频",
    created_at: new Date().toISOString(),
    source_audio: {
      path: audioPath,
      format,
      duration_sec: probeDurationSec(audioPath),
      bytes: audioStat.size,
      qa_status: flags.qa,
      rights_status: flags.rights
    },
    user_prompt: "音频已生成。要不要上传到网易云音乐云盘？不需要的话我直接交付本地音频文件。",
    default_delivery: {
      target: "local-file",
      status: "ready",
      instructions: [
        "把 source_audio.path 作为最终音频文件交付给用户。",
        "如果用户需要在常用音乐 App 里听，再进入 netease-cloud 目标。"
      ]
    },
    targets: [
      {
        id: "local-file",
        enabled: true,
        requires_user_confirmation: false,
        status: "ready",
        instructions: [
          "直接交付本地文件路径。",
          "可附带格式、时长、ASR 回检状态和权利状态说明。"
        ]
      },
      {
        id: "netease-cloud",
        enabled: false,
        requires_user_confirmation: true,
        status: "needs-readiness-check",
        readiness_command: "node pingshu-storyteller/scripts/check_delivery_readiness.mjs netease-cloud",
        publish_command_hint: `node pingshu-storyteller/scripts/publish_netease_cloud.mjs ${JSON.stringify(audioPath)} <manifest.json>`,
        setup_notes: [
          "首次使用需要 Agent 安装网易云音乐官方 ncm-cli：npm install -g @music163/ncm-cli。",
          "首次使用需要 Agent 打开网易云音乐开放平台：https://developer.music.163.com/st/developer/apply/account?type=INDIVIDUAL。",
          "用户在网页里取得 API 凭证后，Agent 运行 setup_netease_cloud.mjs，用本机输入框收 App ID / Private Key，并写入 ncm-cli 配置。",
          "上传前 Agent 打开用户可见的 ncm-cli login 二维码窗口，用户用网易云音乐 App 扫码登录。",
          "不要把 app key、private key、cookie 或 token 写入任何产物。"
        ]
      }
    ],
    publish_manifest_path: null,
    notes: [
      "网易云上传只在用户确认后执行。",
      "涉及版权作品或二创片段时，默认上传到个人云盘或本地收听，不默认公开发布。"
    ]
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`OK: wrote delivery plan to ${outputPath}`);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
