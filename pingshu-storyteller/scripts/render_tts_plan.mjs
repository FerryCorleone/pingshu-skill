#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REFERENCE_VOICE = {
  id: "pingshu_default_storyteller_c06",
  path_or_id: "pingshu-storyteller/assets/voice/default_storyteller_c06.wav",
  manifest: "pingshu-storyteller/assets/voice/manifest.json",
  consent_status: "project_generated_original",
  rights_note: "Bundled generated original storyteller reference voice; not a real-person clone.",
  reference_text:
    "列位，闲言少叙，书归正传。今儿咱讲一段新鲜故事，有人物，有包袱，也有那么一点北方说书的劲儿。您把耳朵支棱起来，咱慢慢往下说。"
};

function usage() {
  const script = fileURLToPath(import.meta.url);
  console.error(`Usage: node ${script} <pingshu_script.json> <performance_plan.json>`);
  process.exit(1);
}

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) usage();

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const inputDisplayPath = relative(process.cwd(), inputPath) || ".";
const outputDisplayPath = relative(process.cwd(), outputPath) || ".";
const script = JSON.parse(readFileSync(inputPath, "utf8"));

if (!Array.isArray(script.segments) || !script.segments.length) {
  throw new Error("pingshu_script.json must include non-empty segments");
}

const voice = script.storyteller_persona || {};
const plan = {
  schema_version: "1.0",
  title: script.title || "Untitled pingshu",
  voice: {
    persona_id: voice.id || "warm_northern_storyteller",
    provider_preference: "undecided",
    consent_required: false,
    performance_mode: voice.performance_mode || "single_performer",
    timbre_lock: true,
    role_voice_policy: "Same storyteller voice for narration and all characters; shift role through wording, pace, pressure, and pauses instead of separate timbres.",
    reference_voice: {
      id: DEFAULT_REFERENCE_VOICE.id,
      required_for_split_render: "recommended",
      path_or_id: DEFAULT_REFERENCE_VOICE.path_or_id,
      manifest: DEFAULT_REFERENCE_VOICE.manifest,
      reference_text: DEFAULT_REFERENCE_VOICE.reference_text,
      consent_status: DEFAULT_REFERENCE_VOICE.consent_status,
      rights_note: DEFAULT_REFERENCE_VOICE.rights_note
    },
    notes: voice.description || "Original storyteller persona; do not imitate a real performer."
  },
  segments: script.segments.map((segment) => {
    const performance = segment.performance || {};
    return {
      id: segment.id,
      text: segment.text,
      pace: performance.pace || "medium_slow",
      emotion: performance.emotion || "warm_mischief",
      pause_after_ms: Number.isFinite(performance.pause_after_ms)
        ? performance.pause_after_ms
        : 300,
      emphasis: Array.isArray(performance.emphasis) ? performance.emphasis : [],
      sfx_after: Array.isArray(performance.sfx_after) ? performance.sfx_after : []
    };
  }),
  audio_bed: {
    music_style: "optional light percussion or plucked bed; keep below narration",
    sfx_palette: [...new Set(script.segments.flatMap((segment) => {
      const sfx = segment.performance?.sfx_after;
      return Array.isArray(sfx) ? sfx : [];
    }))],
    prop_sfx_policy: {
      allowed_ids: ["waking_block"],
      insert_mode: "post_tts_timeline",
      short_episode_max_hits: 2,
      minimum_gap_sec: 45,
      default_gain_db: -6,
      post_sfx_pause_ms: 420,
      post_sfx_pause_min_ms: 320,
      post_sfx_pause_max_ms: 650,
      notes: "Use waking block cues sparingly after the spoken line; never put SFX directions in TTS text."
    },
    loudness_note: "Speech stays primary. Insert silence or effects after TTS render if provider lacks pause control."
  },
  rendering_notes: [
    "Keep one stable storyteller timbre across all segments; do not assign separate character voices.",
    "Use single-pass only for audition. Final pingshu audio should preserve event-level pauses and pass ASR audit.",
    "Render split segments only with the same provider voice id or the same local reference/prompt voice.",
    "For final pingshu timing, expand important segments into events: say for spoken text and pause for real inserted silence.",
    "Insert waking block SFX only as post-processed audio blocks from assets/sfx; do not ask TTS to say SFX labels.",
    "Prefer clean voice settings; do not stack heavy dialect, emotion, rate, and negative quality prompts.",
    `Generated from ${inputDisplayPath} to ${outputDisplayPath}.`
  ]
};

writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
