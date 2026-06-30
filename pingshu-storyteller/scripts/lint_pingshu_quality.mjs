#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [storyArg, scriptArg] = process.argv.slice(2);
if (!storyArg || !scriptArg) {
  console.error("Usage: node lint_pingshu_quality.mjs <story_pack.json> <pingshu_script.json>");
  process.exit(2);
}

const story = JSON.parse(readFileSync(resolve(storyArg), "utf8"));
const script = JSON.parse(readFileSync(resolve(scriptArg), "utf8"));
const warnings = [];
const failures = [];

const brief = story.narrative_brief || {};
if (!brief.hook || brief.hook.length < 25) failures.push("narrative_brief.hook is too thin");
if (!Array.isArray(brief.causal_chain) || brief.causal_chain.length < 4) {
  failures.push("narrative_brief.causal_chain should include at least four links for current events");
}
if (!Array.isArray(brief.must_include_details) || brief.must_include_details.length < 4) {
  failures.push("narrative_brief.must_include_details should include at least four concrete details");
}

const segments = Array.isArray(script.segments) ? script.segments : [];
if (!segments.length) failures.push("pingshu_script.segments is empty");

const text = segments.map((segment) => segment.text || "").join("\n");
const markerCount = (text.match(/列位|好么|您猜|单表|话说回来/g) || []).length;
if (segments.length && markerCount > Math.ceil(segments.length / 2) + 1) {
  warnings.push("too many pingshu markers; reduce dialect/catchphrase seasoning");
}

const bannedBoilerplate = [
  "三英战吕布",
  "武松打猛虎",
  "武松打虎",
  "刀枪剑戟"
];
for (const phrase of bannedBoilerplate) {
  if (text.includes(phrase)) warnings.push(`boilerplate opening detected: ${phrase}`);
}

const weakPhrases = [
  "双方网友吵起来",
  "网线两头",
  "绿茵热闹",
  "评论区很热闹"
];
for (const phrase of weakPhrases) {
  if (text.includes(phrase)) warnings.push(`generic current-event phrase detected: ${phrase}`);
}

for (const segment of segments) {
  const segmentText = segment.text || "";
  if (segmentText.length > 180) {
    warnings.push(`${segment.id} is long for TTS; consider splitting`);
  }
  if (!segment.source_scene_ids || !segment.source_scene_ids.length) {
    failures.push(`${segment.id} has no source_scene_ids`);
  }
}

if (failures.length || warnings.length) {
  console.log(JSON.stringify({ ok: failures.length === 0, failures, warnings }, null, 2));
} else {
  console.log(JSON.stringify({ ok: true, failures: [], warnings: [] }, null, 2));
}

process.exit(failures.length ? 1 : 0);

