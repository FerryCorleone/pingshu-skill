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
  "local-cosyvoice": {
    mode: "local",
    required_env: [],
    command_hint: "python -m cosyvoice.cli --input <segments.json> --output <out_dir>",
    notes: [
      "Install and verify the local CosyVoice environment separately.",
      "GPU and model paths vary by machine."
    ]
  },
  "local-voxcpm2": {
    mode: "local",
    required_env: [],
    command_hint: "python pingshu-storyteller/scripts/render_voxcpm2_plan.py <performance_plan.json> <out_dir> --segment-performance --pace-tempo",
    notes: [
      "Install VoxCPM2 in a Python 3.10-3.12 environment with torch and torchaudio.",
      "Use an original voice-control prompt or consented reference audio; do not clone a real performer without permission.",
      "The bundled renderer splits by performance_plan segments, can pass segment pace/emotion/emphasis into voice control, and can add light tempo variation by pace."
    ]
  },
  "gpt-sovits": {
    mode: "local",
    required_env: [],
    command_hint: "python inference_cli.py --input <segments.json> --output <out_dir>",
    notes: [
      "Install GPT-SoVITS separately and provide licensed reference audio.",
      "Command names vary by release; treat this as a scaffold."
    ]
  },
  "f5-tts": {
    mode: "local",
    required_env: [],
    command_hint: "python -m f5_tts.infer --input <segments.json> --output <out_dir>",
    notes: [
      "Install F5-TTS separately and verify model/license choices.",
      "Use clean reference audio only when the user has rights."
    ]
  },
  indextts: {
    mode: "local",
    required_env: [],
    command_hint: "python -m indextts.infer --input <segments.json> --output <out_dir>",
    notes: [
      "Install IndexTTS separately and verify Chinese voice quality.",
      "Command names vary by release; treat this as a scaffold."
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
  command_hint: provider.command_hint || null,
  voice: plan.voice || {},
  segments: plan.segments.map((segment, index) => ({
    id: segment.id || `seg-${String(index + 1).padStart(3, "0")}`,
    text: segment.text,
    pace: segment.pace || "medium_slow",
    emotion: segment.emotion || "warm_mischief",
    pause_after_ms: segment.pause_after_ms ?? 300,
    emphasis: Array.isArray(segment.emphasis) ? segment.emphasis : [],
    sfx_after: Array.isArray(segment.sfx_after) ? segment.sfx_after : [],
    output_file: `${String(index + 1).padStart(3, "0")}-${segment.id || "segment"}.wav`
  })),
  post_process: {
    insert_pauses: true,
    add_sfx_after_segments: true,
    keep_music_below_speech: true
  },
  notes: [
    ...provider.notes,
    "This job scaffold does not call the provider. The host agent should render using the user's chosen credentials or local installation.",
    "Keep source and voice rights evidence with the rendered output."
  ]
};

writeFileSync(outputPath, `${JSON.stringify(job, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
