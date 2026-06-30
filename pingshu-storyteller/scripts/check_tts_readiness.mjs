#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const providers = {
  openai: {
    mode: "api",
    required_env: ["OPENAI_API_KEY"],
    setup: "Set OPENAI_API_KEY and choose a voice supported by the Speech API."
  },
  "aliyun-cosyvoice": {
    mode: "api",
    required_env: ["DASHSCOPE_API_KEY"],
    setup: "Set DASHSCOPE_API_KEY and choose a CosyVoice voice you own or are licensed to use."
  },
  minimax: {
    mode: "api",
    required_env: ["MINIMAX_API_KEY", "MINIMAX_GROUP_ID"],
    setup: "Set MINIMAX_API_KEY and MINIMAX_GROUP_ID, then choose a consented voice id."
  },
  elevenlabs: {
    mode: "api",
    required_env: ["ELEVENLABS_API_KEY"],
    setup: "Set ELEVENLABS_API_KEY and choose a licensed voice id."
  },
  "local-cosyvoice": {
    mode: "local",
    required_env: ["PINGSHU_LOCAL_TTS_COMMAND"],
    optional_path_env: "PINGSHU_LOCAL_TTS_PATH",
    setup: "Set PINGSHU_LOCAL_TTS_COMMAND to the local CosyVoice render command. Optionally set PINGSHU_LOCAL_TTS_PATH."
  },
  "local-voxcpm2": {
    mode: "local",
    required_env: [],
    python_env: "PINGSHU_VOXCPM2_PYTHON",
    default_python: ".venv-voxcpm2/bin/python",
    module_check: "voxcpm",
    setup: "Set PINGSHU_VOXCPM2_PYTHON to a Python executable with voxcpm installed, or create .venv-voxcpm2 and install torch, torchaudio, and voxcpm."
  },
  "gpt-sovits": {
    mode: "local",
    required_env: ["PINGSHU_LOCAL_TTS_COMMAND"],
    optional_path_env: "PINGSHU_LOCAL_TTS_PATH",
    setup: "Set PINGSHU_LOCAL_TTS_COMMAND to the GPT-SoVITS render command and use licensed reference audio."
  },
  "f5-tts": {
    mode: "local",
    required_env: ["PINGSHU_LOCAL_TTS_COMMAND"],
    optional_path_env: "PINGSHU_LOCAL_TTS_PATH",
    setup: "Set PINGSHU_LOCAL_TTS_COMMAND to the F5-TTS render command and verify model/license choices."
  },
  indextts: {
    mode: "local",
    required_env: ["PINGSHU_LOCAL_TTS_COMMAND"],
    optional_path_env: "PINGSHU_LOCAL_TTS_PATH",
    setup: "Set PINGSHU_LOCAL_TTS_COMMAND to the IndexTTS render command and verify Chinese voice quality."
  }
};

function usage() {
  console.error(`Usage: node check_tts_readiness.mjs <provider>`);
  console.error(`Providers: ${Object.keys(providers).join(", ")}`);
  process.exit(2);
}

const providerId = process.argv[2];
if (!providerId || !providers[providerId]) usage();

const provider = providers[providerId];
const missing = provider.required_env.filter((name) => !process.env[name]);
const pathValue = provider.optional_path_env ? process.env[provider.optional_path_env] : null;
const pathMissing = pathValue && !existsSync(pathValue);

let runtimePython = null;
let runtimeMissing = null;
let runtimeImportError = null;
if (provider.python_env) {
  runtimePython = process.env[provider.python_env] ||
    (provider.default_python && existsSync(provider.default_python) ? provider.default_python : null);

  if (!runtimePython) {
    runtimeMissing = {
      env: provider.python_env,
      default_python: provider.default_python
    };
  } else {
    const check = spawnSync(
      runtimePython,
      ["-c", `import ${provider.module_check}`],
      { encoding: "utf8" }
    );
    if (check.error || check.status !== 0) {
      runtimeImportError = (check.stderr || check.error?.message || "module check failed").trim();
    }
  }
}

const ready = missing.length === 0 && !pathMissing && !runtimeMissing && !runtimeImportError;

const result = {
  provider: providerId,
  mode: provider.mode,
  ready,
  missing_env: missing,
  missing_path: pathMissing ? { env: provider.optional_path_env, value: pathValue } : null,
  missing_runtime: runtimeMissing,
  runtime_python: runtimePython,
  runtime_import_error: runtimeImportError,
  setup: provider.setup,
  final_audio_allowed: ready,
  system_voice_fallback_allowed: false
};

console.log(JSON.stringify(result, null, 2));
process.exit(ready ? 0 : 1);
