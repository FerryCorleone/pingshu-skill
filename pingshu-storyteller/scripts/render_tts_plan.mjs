#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  const script = fileURLToPath(import.meta.url);
  console.error(`Usage: node ${script} <pingshu_script.json> <performance_plan.json>`);
  process.exit(1);
}

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) usage();

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
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
    loudness_note: "Speech stays primary. Insert silence or effects after TTS render if provider lacks pause control."
  },
  rendering_notes: [
    "Render short segments separately when the provider has weak long-form prosody.",
    "Prefer clean voice settings; do not stack heavy dialect, emotion, rate, and negative quality prompts.",
    `Generated from ${inputPath} in ${dirname(outputPath)}.`
  ]
};

writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);

