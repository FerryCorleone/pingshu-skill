#!/usr/bin/env node
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const allowedFormats = new Set(["m4a", "mp3", "wav", "flac", "aac"]);

function usage() {
  console.error("Usage: node publish_netease_cloud.mjs <audio_path> <manifest.json> [--dry-run]");
  process.exit(1);
}

function stripAnsi(value) {
  return String(value || "").replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function truncate(value, max = 3000) {
  const text = stripAnsi(value);
  return text.length > max ? `${text.slice(0, max)}\n...[truncated]` : text;
}

function redact(value) {
  return truncate(value)
    .replace(/(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(cookie\s*[:=]\s*)[^\n]+/gi, "$1[REDACTED]")
    .replace(/((?:app|api)[_-]?(?:key|secret|token|id)|private[_-]?key|secret|token)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[REDACTED]");
}

function commandString(command, args) {
  return [command, ...args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg))].join(" ");
}

function run(command, args, timeout = 300000) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input: "",
    timeout
  });

  return {
    command: commandString(command, args),
    exit_code: result.status,
    signal: result.signal,
    error: result.error ? result.error.message : null,
    stdout: redact(result.stdout || ""),
    stderr: redact(result.stderr || "")
  };
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    input: "",
    timeout: 15000
  });
  return result.error?.code !== "ENOENT";
}

function shouldTryFallback(attempt) {
  const text = `${attempt.stdout}\n${attempt.stderr}`.toLowerCase();
  if (attempt.exit_code === 0) return false;
  return /(unknown|not found|unsupported|invalid command|subcommand|usage|找不到|未知|不支持)/i.test(text);
}

try {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((item) => item !== "--dry-run");
  if (positional.length < 2) usage();

  const audioPath = resolve(positional[0]);
  const manifestPath = resolve(positional[1]);

  if (!existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const format = extname(audioPath).replace(".", "").toLowerCase();
  if (!allowedFormats.has(format)) {
    throw new Error(`Unsupported audio format: ${format || "(none)"}. Expected one of: ${Array.from(allowedFormats).join(", ")}`);
  }

  const manifest = {
    schema_version: "1.0",
    provider: "netease-cloud",
    created_at: new Date().toISOString(),
    dry_run: dryRun,
    audio: {
      path: audioPath,
      format,
      bytes: statSync(audioPath).size
    },
    status: "pending",
    attempts: [],
    notes: [
      "This manifest must not contain app key, private key, cookie, token, or authorization headers.",
      "Upload target is NetEase Cloud Music personal cloud storage, not a public publishing channel."
    ]
  };

  const commandCandidates = [
    ["cloudupload", "upload", audioPath],
    ["cloudupload", "file", "--file", audioPath],
    ["cloudupload", "uploadFile", "--file", audioPath]
  ];

  if (dryRun) {
    manifest.status = "dry-run";
    manifest.attempts.push({
      command: commandString("ncm-cli", commandCandidates[0]),
      exit_code: null,
      signal: null,
      error: null,
      stdout: "",
      stderr: ""
    });
    manifest.next_steps = [
      "确认用户需要上传。",
      "确保 ncm-cli 已安装、configure 已完成、login 已扫码。",
      "去掉 --dry-run 重新运行本脚本。"
    ];
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`OK: wrote dry-run NetEase upload manifest to ${manifestPath}`);
    process.exit(0);
  }

  if (!commandExists("ncm-cli")) {
    manifest.status = "missing-cli";
    manifest.next_steps = [
      "Agent 安装官方 CLI：npm install -g @music163/ncm-cli。",
      "Agent 打开网易云音乐开放平台取得 API 凭证：https://developer.music.163.com/st/developer/apply/account?type=INDIVIDUAL。",
      "Agent 运行 setup_netease_cloud.mjs，弹出本机输入框完成配置。",
      "Agent 打开 ncm-cli login 二维码窗口让用户扫码。"
    ];
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.error(`ERROR: ncm-cli not found. Wrote manifest to ${manifestPath}`);
    process.exit(2);
  }

  manifest.status = "failed";
  for (const [index, candidate] of commandCandidates.entries()) {
    const attempt = run("ncm-cli", candidate);
    manifest.attempts.push(attempt);
    if (attempt.exit_code === 0) {
      manifest.status = "uploaded";
      break;
    }
    if (index === 0 || shouldTryFallback(attempt)) {
      continue;
    }
    break;
  }

  if (manifest.status !== "uploaded") {
    manifest.next_steps = [
      "Agent 打开网易云音乐开放平台取得 API 凭证：https://developer.music.163.com/st/developer/apply/account?type=INDIVIDUAL。",
      "Agent 运行 setup_netease_cloud.mjs，弹出本机输入框完成开放平台 API 凭证配置。",
      "Agent 打开 ncm-cli login 二维码窗口让用户扫码。",
      "如果命令名不兼容，升级 @music163/ncm-cli 后重试。"
    ];
  }

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  if (manifest.status === "uploaded") {
    console.log(`OK: uploaded to NetEase cloud. Manifest: ${manifestPath}`);
  } else {
    console.error(`ERROR: NetEase upload failed. Manifest: ${manifestPath}`);
    process.exit(3);
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
}
