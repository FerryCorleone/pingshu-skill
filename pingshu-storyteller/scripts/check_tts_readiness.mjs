#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter } from "node:path";

const providers = {
  openai: {
    mode: "api",
    required_env: ["OPENAI_API_KEY"],
    setup: "Set OPENAI_API_KEY and choose a voice supported by the Speech API."
  },
  qwen: {
    mode: "api",
    required_env: ["QWEN_TTS_API_KEY"],
    alternative_env: ["DASHSCOPE_API_KEY"],
    setup: "Set QWEN_TTS_API_KEY or DASHSCOPE_API_KEY, then use qwen3-tts-instruct-flash with a supported system voice."
  },
  "qwen-voiceclone": {
    mode: "api",
    required_env: ["QWEN_TTS_API_KEY"],
    alternative_env: ["DASHSCOPE_API_KEY"],
    setup: "Set QWEN_TTS_API_KEY or DASHSCOPE_API_KEY and provide an original/licensed reference wav. Reuse QWEN_TTS_VOICE_ID after creating a Qwen voice clone."
  },
  "xiaomi-mimo": {
    mode: "api",
    required_env: ["XIAOMI_MIMO_API_KEY"],
    alternative_env: ["MIMO_API_KEY"],
    setup: "Set XIAOMI_MIMO_API_KEY or MIMO_API_KEY, then use MiMo V2.5 TTS / voice design through the official chat completions endpoint."
  },
  "xiaomi-mimo-voiceclone": {
    mode: "api",
    required_env: ["XIAOMI_MIMO_API_KEY"],
    alternative_env: ["MIMO_API_KEY"],
    setup: "Set XIAOMI_MIMO_API_KEY or MIMO_API_KEY and provide an original/licensed reference wav. Use conservative request pacing for long scripts."
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
  "local-voxcpm2": {
    mode: "local",
    required_env: [],
    python_env: "PINGSHU_VOXCPM2_PYTHON",
    default_python: ".venv-voxcpm2/bin/python",
    module_check: "voxcpm",
    setup: "Set PINGSHU_VOXCPM2_PYTHON to a Python executable with voxcpm installed, or create .venv-voxcpm2 and install torch, torchaudio, and voxcpm."
  },
  "local-qwen3-tts": {
    mode: "local",
    required_env: [],
    python_env: "PINGSHU_QWEN3_TTS_PYTHON",
    default_python: ".venv-qwen3-tts/bin/python",
    module_check: "qwen_tts",
    optional_path_env: "PINGSHU_QWEN3_TTS_MODEL_DIR",
    setup: "Set PINGSHU_QWEN3_TTS_PYTHON to a Python executable with qwen-tts installed, or create .venv-qwen3-tts and install qwen-tts. The renderer can download Qwen3-TTS Base into the Hugging Face cache."
  },
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
const alternativeSatisfied = Array.isArray(provider.alternative_env) &&
  provider.alternative_env.some((name) => process.env[name]);
const effectiveMissing = alternativeSatisfied ? [] : missing;
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
      {
        encoding: "utf8",
        env: {
          ...process.env,
          ...(Array.isArray(provider.python_paths)
            ? {
                PYTHONPATH: [
                  ...provider.python_paths,
                  process.env.PYTHONPATH || ""
                ].filter(Boolean).join(delimiter)
              }
            : {})
        }
      }
    );
    if (check.error || check.status !== 0) {
      runtimeImportError = (check.stderr || check.error?.message || "module check failed").trim();
    }
  }
}

const ready = effectiveMissing.length === 0 && !pathMissing && !runtimeMissing && !runtimeImportError;

const result = {
  provider: providerId,
  mode: provider.mode,
  ready,
  missing_env: effectiveMissing,
  alternative_env: provider.alternative_env || [],
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
