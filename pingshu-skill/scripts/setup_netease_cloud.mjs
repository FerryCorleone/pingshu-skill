#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const platformUrl = "https://developer.music.163.com/st/developer/apply/account?type=INDIVIDUAL";

function usage() {
  console.error("Usage: node setup_netease_cloud.mjs <setup_manifest.json> [--skip-open-platform] [--skip-login]");
  process.exit(1);
}

function redact(value) {
  return String(value || "")
    .replace(/(authorization\s*[:=]\s*)(bearer\s+)?[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/(cookie\s*[:=]\s*)[^\n]+/gi, "$1[REDACTED]")
    .replace(/((?:app|api)[_-]?(?:key|secret|token|id)|private[_-]?key|secret|token)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[REDACTED]");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input: options.input || "",
    timeout: options.timeout || 30000
  });

  return {
    command: [command, ...args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg))].join(" "),
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

function runAppleScript(script) {
  const result = spawnSync("osascript", ["-e", script], {
    encoding: "utf8",
    input: "",
    timeout: 600000
  });
  if (result.status !== 0) {
    throw new Error(redact(result.stderr || result.stdout || "AppleScript cancelled"));
  }
  return String(result.stdout || "").trim();
}

function openPlatformPage() {
  if (process.platform === "darwin") {
    return run("open", ["-na", "Google Chrome", "--args", "--new-window", platformUrl]);
  }
  if (process.platform === "win32") {
    return run("cmd", ["/c", "start", "", platformUrl]);
  }
  return run("xdg-open", [platformUrl]);
}

function promptMacCredentials() {
  const appId = runAppleScript([
    'display dialog "请粘贴网易云音乐开放平台 App ID。\\n\\nAgent 会写入 ncm-cli 配置，不会把它写进产物。" default answer "" buttons {"取消", "继续"} default button "继续"',
    "text returned of result"
  ].join("\n"));

  const method = runAppleScript([
    'display dialog "Private Key 建议优先选择开放平台下载的密钥文件。\\n\\n如果你只有文本，也可以选择粘贴文本；不要把 Private Key 发到聊天里。" buttons {"取消", "粘贴文本", "选择文件"} default button "选择文件"',
    "button returned of result"
  ].join("\n"));

  if (method === "选择文件") {
    const keyPath = runAppleScript([
      'set keyFile to choose file with prompt "请选择网易云音乐开放平台 Private Key 文件"',
      "POSIX path of keyFile"
    ].join("\n"));
    return { appId, privateKeyPath: keyPath, privateKeyTempDir: null };
  }

  const privateKeyText = runAppleScript([
    'display dialog "请粘贴 Private Key。输入会隐藏显示。\\n\\n如果是多行 PEM，建议取消后改用选择文件方式。" default answer "" with hidden answer buttons {"取消", "继续"} default button "继续"',
    "text returned of result"
  ].join("\n"));

  const tempDir = mkdtempSync(join(tmpdir(), "pingshu-ncm-key-"));
  const keyPath = join(tempDir, "private_key.txt");
  writeFileSync(keyPath, privateKeyText, { mode: 0o600 });
  return { appId, privateKeyPath: keyPath, privateKeyTempDir: tempDir };
}

function startMacLoginWindow() {
  const tempDir = mkdtempSync(join(tmpdir(), "pingshu-ncm-login-"));
  const scriptPath = join(tempDir, "login.sh");
  writeFileSync(scriptPath, [
    "#!/bin/zsh",
    "echo '网易云音乐登录二维码窗口'",
    "echo '请用网易云音乐 App 扫描下面的二维码完成登录。'",
    "echo ''",
    "ncm-cli login",
    "echo ''",
    "echo '登录流程已结束。你可以回到 Codex 继续上传。'",
    "read -k 1 '?按任意键关闭窗口...'"
  ].join("\n"), { mode: 0o700 });

  const appleScript = [
    'tell application "Terminal"',
    "  activate",
    `  do script ${JSON.stringify(scriptPath)}`,
    "end tell"
  ].join("\n");
  return run("osascript", ["-e", appleScript], { timeout: 15000 });
}

const args = process.argv.slice(2);
const skipOpenPlatform = args.includes("--skip-open-platform");
const skipLogin = args.includes("--skip-login");
const positional = args.filter((arg) => !arg.startsWith("--"));
if (positional.length < 1) usage();

const manifestPath = resolve(positional[0]);
const manifest = {
  schema_version: "1.0",
  provider: "netease-cloud",
  created_at: new Date().toISOString(),
  status: "pending",
  platform_url: platformUrl,
  steps: [],
  notes: [
    "Agent-guided setup: user should not need to run terminal commands manually.",
    "This manifest must not contain app key, private key, cookie, token, or authorization headers."
  ]
};

try {
  if (!commandExists("ncm-cli")) {
    manifest.status = "missing-cli";
    manifest.next_steps = ["Agent should install @music163/ncm-cli, then rerun setup."];
    throw new Error("ncm-cli not found");
  }

  if (!skipOpenPlatform) {
    const openAttempt = openPlatformPage();
    manifest.steps.push({ name: "open-platform-page", ...openAttempt });
  }

  if (process.platform !== "darwin") {
    manifest.status = "needs-manual-gui-implementation";
    manifest.next_steps = [
      "当前脚本只实现了 macOS GUI 凭证输入。",
      "其他系统的 Agent 应打开开放平台页面，并用宿主能力收集凭证后调用 ncm-cli config set。"
    ];
  } else {
    const credentials = promptMacCredentials();
    const setAppId = run("ncm-cli", ["config", "set", "appId", credentials.appId], { timeout: 30000 });
    manifest.steps.push({
      name: "set-app-id",
      exit_code: setAppId.exit_code,
      signal: setAppId.signal,
      error: setAppId.error,
      stdout: redact(setAppId.stdout),
      stderr: redact(setAppId.stderr)
    });

    const setPrivateKey = run("ncm-cli", ["config", "set", "privateKey", credentials.privateKeyPath], { timeout: 30000 });
    manifest.steps.push({
      name: "set-private-key",
      exit_code: setPrivateKey.exit_code,
      signal: setPrivateKey.signal,
      error: setPrivateKey.error,
      stdout: redact(setPrivateKey.stdout),
      stderr: redact(setPrivateKey.stderr)
    });

    if (credentials.privateKeyTempDir && existsSync(credentials.privateKeyTempDir)) {
      rmSync(credentials.privateKeyTempDir, { recursive: true, force: true });
    }

    if (setAppId.exit_code !== 0 || setPrivateKey.exit_code !== 0) {
      manifest.status = "failed-configure";
      manifest.next_steps = ["检查 App ID 和 Private Key 是否来自网易云音乐开放平台，然后重新运行 setup 脚本。"];
    } else if (!skipLogin) {
      const loginAttempt = startMacLoginWindow();
      manifest.steps.push({ name: "open-login-window", ...loginAttempt });
      manifest.status = loginAttempt.exit_code === 0 ? "login-window-opened" : "failed-open-login-window";
      manifest.next_steps = [
        "用户在打开的 Terminal 二维码窗口里用网易云音乐 App 扫码登录。",
        "扫码成功后，Agent 继续运行 publish_netease_cloud.mjs。"
      ];
    } else {
      manifest.status = "configured";
      manifest.next_steps = ["Agent should run ncm-cli login or open the login QR window before upload."];
    }
  }
} catch (error) {
  if (manifest.status === "pending") {
    manifest.status = "cancelled-or-failed";
  }
  manifest.error = redact(error.message);
} finally {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

if (["configured", "login-window-opened"].includes(manifest.status)) {
  console.log(`OK: NetEase setup status ${manifest.status}. Manifest: ${manifestPath}`);
} else {
  console.error(`ERROR: NetEase setup status ${manifest.status}. Manifest: ${manifestPath}`);
  process.exit(2);
}
