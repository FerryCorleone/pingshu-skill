#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const provider = process.argv[2] || "netease-cloud";

function usage() {
  console.error("Usage: node check_delivery_readiness.mjs netease-cloud");
  process.exit(1);
}

function run(command, args, timeout = 15000) {
  return spawnSync(command, args, {
    encoding: "utf8",
    input: "",
    timeout
  });
}

function commandExists(command) {
  const result = run(command, ["--version"], 15000);
  if (result.error?.code === "ENOENT") {
    return { installed: false, version: null, error: "command not found" };
  }

  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  return {
    installed: true,
    version: output.split(/\r?\n/).find(Boolean) || null,
    exit_code: result.status,
    note: result.status === 0 ? "version command succeeded" : "command exists, but version command did not exit cleanly"
  };
}

if (!["netease-cloud", "netease"].includes(provider)) usage();

const cli = commandExists("ncm-cli");
const report = {
  schema_version: "1.0",
  provider: "netease-cloud",
  checked_at: new Date().toISOString(),
  ok: false,
  status: "missing-cli",
  cli,
  install_command: "npm install -g @music163/ncm-cli",
  setup_steps: [
    "Agent 安装网易云音乐官方 CLI：npm install -g @music163/ncm-cli。",
    "Agent 打开网易云音乐开放平台：https://developer.music.163.com/st/developer/apply/account?type=INDIVIDUAL。",
    "Agent 运行 setup_netease_cloud.mjs，弹出本机输入框收 App ID / Private Key 并写入 ncm-cli 配置。",
    "Agent 打开用户可见的 ncm-cli login 二维码窗口，用户用网易云音乐 App 扫码。",
    "登录完成后，Agent 运行 publish_netease_cloud.mjs。"
  ],
  upload_command_hint: "ncm-cli cloudupload upload <audio_path>",
  fallback_upload_command_hint: "ncm-cli cloudupload file --file <audio_path> OR ncm-cli cloudupload uploadFile --file <audio_path>",
  credential_policy: "Do not store app key, private key, cookie, token, or authorization headers in artifacts."
};

if (cli.installed) {
  report.ok = true;
  report.status = "cli-installed-configuration-not-verified";
  report.notes = [
    "ncm-cli 已安装或可执行，但本脚本不会读取本地配置文件，以免误暴露凭证。",
    "如果尚未 configure/login，真实上传会在 publish 脚本里失败并给出脱敏错误。",
    "首次使用通常仍需要 Agent 运行 setup_netease_cloud.mjs 打开网页、收凭证并启动扫码登录。"
  ];
} else {
  report.notes = [
    "未找到 ncm-cli。Agent 应先安装官方 CLI，再运行 setup_netease_cloud.mjs 引导开放平台配置和扫码登录。"
  ];
}

console.log(JSON.stringify(report, null, 2));
process.exit(cli.installed ? 0 : 2);
