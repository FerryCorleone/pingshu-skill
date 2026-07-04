#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const providers = {
  openai: {
    mode: "api",
    required_env: ["OPENAI_API_KEY"],
    notes: [
      "Map each segment text to the Speech API.",
      "Use a provider-defined voice; do not assume custom voice cloning."
    ]
  },
  qwen: {
    mode: "api",
    required_env: ["QWEN_TTS_API_KEY"],
    alternative_env: ["DASHSCOPE_API_KEY"],
    command_hint: "node pingshu-storyteller/scripts/render_api_tts_plan.mjs <pingshu_script.json> <performance_plan.json> <out_dir> --provider qwen",
    notes: [
      "Use Qwen3-TTS-Instruct-Flash through Alibaba Cloud Model Studio / DashScope.",
      "Use one supported system voice for the whole program and insert pauses in post-processing."
    ]
  },
  "qwen-voiceclone": {
    mode: "api",
    required_env: ["QWEN_TTS_API_KEY"],
    alternative_env: ["DASHSCOPE_API_KEY"],
    reference_voice_required: true,
    command_hint: "node pingshu-storyteller/scripts/render_api_tts_plan.mjs <pingshu_script.json> <performance_plan.json> <out_dir> --provider qwen-voiceclone --reference-wav <original_or_licensed_voice.wav> --phrase-chunks",
    notes: [
      "Use Alibaba Cloud Model Studio voice enrollment to create or reuse a Qwen voice clone id.",
      "Prefer QWEN_TTS_VOICE_ID or --qwen-voice-id after the first successful enrollment.",
      "Keep target text clean; use phrase-level post-processing for pauses."
    ]
  },
  "xiaomi-mimo": {
    mode: "api",
    required_env: ["XIAOMI_MIMO_API_KEY"],
    alternative_env: ["MIMO_API_KEY"],
    command_hint: "node pingshu-storyteller/scripts/render_api_tts_plan.mjs <pingshu_script.json> <performance_plan.json> <out_dir> --provider xiaomi-mimo",
    notes: [
      "Use MiMo V2.5 TTS / voice design through Xiaomi's official chat completions endpoint.",
      "Prefer segmented rendering for long pingshu scripts, then insert real silence and concatenate.",
      "Evaluate voice design outputs for timbre drift when rendering split segments."
    ]
  },
  "xiaomi-mimo-voiceclone": {
    mode: "api",
    required_env: ["XIAOMI_MIMO_API_KEY"],
    alternative_env: ["MIMO_API_KEY"],
    reference_voice_required: true,
    command_hint: "node pingshu-storyteller/scripts/render_api_tts_plan.mjs <pingshu_script.json> <performance_plan.json> <out_dir> --provider xiaomi-mimo-voiceclone --reference-wav <original_or_licensed_voice.wav> --request-delay-ms 15000",
    notes: [
      "Use MiMo V2.5 TTS voice clone with an original/licensed reference wav.",
      "Put voice/performance instructions in the user message, not in the assistant text.",
      "Use conservative request pacing; this endpoint may return 429 when rendering many chunks quickly."
    ]
  },
  "aliyun-cosyvoice": {
    mode: "api",
    required_env: ["DASHSCOPE_API_KEY"],
    notes: [
      "Use Alibaba Cloud Model Studio / DashScope speech endpoints.",
      "Use only voices the user owns, designed, or is licensed to use."
    ]
  },
  minimax: {
    mode: "api",
    required_env: ["MINIMAX_API_KEY", "MINIMAX_GROUP_ID"],
    notes: [
      "Use MiniMax speech endpoints and a consented voice id.",
      "Check current API limits before batch rendering."
    ]
  },
  elevenlabs: {
    mode: "api",
    required_env: ["ELEVENLABS_API_KEY"],
    notes: [
      "Use a licensed ElevenLabs voice id.",
      "Do not use cloned voices without explicit consent."
    ]
  },
  "local-voxcpm2": {
    mode: "local",
    required_env: [],
    command_hint: "python pingshu-storyteller/scripts/render_voxcpm2_plan.py <performance_plan.json> <out_dir> --segment-performance --pace-tempo --reference-wav <original_or_licensed_voice.wav>",
    notes: [
      "Install VoxCPM2 in a Python 3.10-3.12 environment with torch and torchaudio.",
      "Use an original voice-control prompt or consented reference audio; do not clone a real performer without permission.",
      "The bundled renderer can render event-level say/pause plans, insert real silence for pause events, add light tempo variation by pace, and insert sparse waking block SFX from assets/sfx.",
      "Use the same original or licensed reference/prompt voice for all split renders to reduce timbre drift."
    ]
  },
  "local-qwen3-tts": {
    mode: "local",
    required_env: [],
    reference_voice_required: true,
    command_hint: "python pingshu-storyteller/scripts/render_qwen3_tts_plan.py <performance_plan.json> <out_dir> --reference-wav <original_or_licensed_voice.wav>",
    notes: [
      "Install qwen-tts in .venv-qwen3-tts or set PINGSHU_QWEN3_TTS_PYTHON.",
      "Use Qwen3-TTS Base for local reference-audio voice clone rendering.",
      "Provide the transcript for the reference wav when possible; x-vector-only mode is a lower-fidelity fallback.",
      "The bundled renderer can download the model into the Hugging Face cache, insert real silence between plan segments, and insert sparse waking block SFX from assets/sfx."
    ]
  }
};

function usage() {
  const ids = Object.keys(providers).join(", ");
  console.error(`Usage: node create_tts_job.mjs <performance_plan.json> <provider> <tts_job.json>`);
  console.error(`Providers: ${ids}`);
  process.exit(1);
}

const [planArg, providerArg, outputArg] = process.argv.slice(2);
if (!planArg || !providerArg || !outputArg) usage();

const provider = providers[providerArg];
if (!provider) usage();

const planPath = resolve(planArg);
const outputPath = resolve(outputArg);
const plan = JSON.parse(readFileSync(planPath, "utf8"));

if (!Array.isArray(plan.segments) || !plan.segments.length) {
  throw new Error("performance_plan.json must include non-empty segments");
}

const job = {
  schema_version: "1.0",
  provider: providerArg,
  mode: provider.mode,
  title: plan.title || "Untitled pingshu",
  required_env: provider.required_env,
  alternative_env: provider.alternative_env || [],
  reference_voice_required: provider.reference_voice_required || false,
  command_hint: provider.command_hint || null,
  voice: plan.voice || {},
  segments: plan.segments.map((segment, index) => ({
    id: segment.id || `seg-${String(index + 1).padStart(3, "0")}`,
    text: segment.text,
    pace: segment.pace || "medium_slow",
    emotion: segment.emotion || "warm_mischief",
    pause_after_ms: segment.pause_after_ms ?? 300,
    ...(Array.isArray(segment.events)
      ? {
          events: segment.events.map((event) => ({
            type: event.type || "say",
            text: event.text,
            ms: event.ms ?? event.duration_ms,
            reason: event.reason,
            tempo: event.tempo,
            emphasis: Array.isArray(event.emphasis) ? event.emphasis : undefined
          }))
        }
      : {}),
    emphasis: Array.isArray(segment.emphasis) ? segment.emphasis : [],
    sfx_after: Array.isArray(segment.sfx_after) ? segment.sfx_after : [],
    output_file: `${String(index + 1).padStart(3, "0")}-${segment.id || "segment"}.wav`
  })),
  post_process: {
    insert_pauses: true,
    add_sfx_after_segments: true,
    sfx_assets_dir: "pingshu-storyteller/assets/sfx",
    prop_sfx_policy: plan.audio_bed?.prop_sfx_policy || {
      allowed_ids: ["waking_block"],
      insert_mode: "post_tts_timeline",
      short_episode_max_hits: 2,
      minimum_gap_sec: 45,
      default_gain_db: -6,
      post_sfx_pause_ms: 420,
      post_sfx_pause_min_ms: 320,
      post_sfx_pause_max_ms: 650
    },
    keep_music_below_speech: true
  },
  notes: [
    ...provider.notes,
    "Treat sfx_after as post-processing only. Do not include waking block labels or sound-effect directions in target TTS text.",
    "This job scaffold does not call the provider. The host agent should render using the user's chosen credentials or local installation.",
    "Keep source and voice rights evidence with the rendered output."
  ]
};

writeFileSync(outputPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
