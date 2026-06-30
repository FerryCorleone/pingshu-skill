#!/usr/bin/env node
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

const result = {
  provider: providerId,
  mode: provider.mode,
  ready: missing.length === 0 && !pathMissing,
  missing_env: missing,
  missing_path: pathMissing ? { env: provider.optional_path_env, value: pathValue } : null,
  setup: provider.setup,
  final_audio_allowed: missing.length === 0 && !pathMissing,
  system_voice_fallback_allowed: false
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ready ? 0 : 1);

