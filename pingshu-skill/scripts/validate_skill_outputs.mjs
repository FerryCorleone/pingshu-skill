#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const target = resolve(process.argv[2] || ".");

const contracts = {
  "story_pack.json": [
    "schema_version",
    "id",
    "request",
    "narrative_brief",
    "sources",
    "characters",
    "scenes",
    "rights_notes",
    "open_questions"
  ],
  "pingshu_script.json": [
    "schema_version",
    "title",
    "story_pack_id",
    "storyteller_persona",
    "story_design",
    "segments",
    "style_notes",
    "fidelity_notes"
  ],
  "performance_plan.json": [
    "schema_version",
    "title",
    "voice",
    "segments",
    "audio_bed",
    "rendering_notes"
  ]
};

const optionalContracts = {
  "delivery_plan.json": [
    "schema_version",
    "title",
    "source_audio",
    "user_prompt",
    "default_delivery",
    "targets",
    "publish_manifest_path",
    "notes"
  ]
};

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: ${error.message}`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
}

function validateRequired(object, fileName) {
  const contract = contracts[fileName] || optionalContracts[fileName];
  const missing = contract.filter((key) => !(key in object));
  if (missing.length) {
    throw new Error(`${fileName} missing required keys: ${missing.join(", ")}`);
  }
}

function validateStoryPack(object) {
  const brief = object.narrative_brief;
  if (!brief || typeof brief !== "object") {
    throw new Error("story_pack.narrative_brief must be an object");
  }
  for (const key of ["hook", "trigger", "causal_chain", "core_conflict", "must_include_details", "outcome", "aftermath", "missing_or_weak_facts"]) {
    if (!(key in brief)) {
      throw new Error(`story_pack.narrative_brief is missing ${key}`);
    }
  }
  assertArray(brief.causal_chain, "story_pack.narrative_brief.causal_chain");
  assertArray(brief.must_include_details, "story_pack.narrative_brief.must_include_details");
  assertArray(brief.missing_or_weak_facts, "story_pack.narrative_brief.missing_or_weak_facts");
  if (brief.causal_chain.length < 3) {
    throw new Error("story_pack.narrative_brief.causal_chain must include at least three links");
  }
  if (brief.must_include_details.length < 3) {
    throw new Error("story_pack.narrative_brief.must_include_details must include at least three details");
  }
  assertArray(object.sources, "story_pack.sources");
  assertArray(object.characters, "story_pack.characters");
  assertArray(object.scenes, "story_pack.scenes");
  assertArray(object.rights_notes, "story_pack.rights_notes");
  assertArray(object.open_questions, "story_pack.open_questions");
  if (!object.scenes.length) {
    throw new Error("story_pack.scenes must include at least one scene");
  }
  for (const scene of object.scenes) {
    for (const key of ["id", "summary", "actions", "visual_details"]) {
      if (!(key in scene)) {
        throw new Error(`story_pack scene is missing ${key}`);
      }
    }
  }
}

function validatePingshuScript(object) {
  if (!object.storyteller_persona || typeof object.storyteller_persona !== "object") {
    throw new Error("pingshu_script.storyteller_persona must be an object");
  }
  if (object.storyteller_persona.performance_mode !== "single_performer") {
    throw new Error("pingshu_script.storyteller_persona.performance_mode must be single_performer");
  }
  if (!object.story_design || typeof object.story_design !== "object") {
    throw new Error("pingshu_script.story_design must be an object");
  }
  for (const key of [
    "logline",
    "audience_entry",
    "entertainment_promise",
    "humor_engine",
    "title_design",
    "technique_arrangement",
    "central_question",
    "protagonist_arc",
    "stakes",
    "beat_order",
    "opening_contract",
    "ending_contract"
  ]) {
    if (!(key in object.story_design)) {
      throw new Error(`pingshu_script.story_design is missing ${key}`);
    }
  }
  const titleDesign = object.story_design.title_design;
  if (!titleDesign || typeof titleDesign !== "object") {
    throw new Error("pingshu_script.story_design.title_design must be an object");
  }
  for (const key of ["episode_title", "style_reference", "title_formula", "comic_hook", "opening_line"]) {
    if (!(key in titleDesign)) {
      throw new Error(`pingshu_script.story_design.title_design is missing ${key}`);
    }
  }
  const arrangement = object.story_design.technique_arrangement;
  if (!arrangement || typeof arrangement !== "object") {
    throw new Error("pingshu_script.story_design.technique_arrangement must be an object");
  }
  for (const key of ["overall_strategy", "technique_budget", "first_person_inner_monologue_slots", "traditional_flavor_slots", "leave_plain_slots", "restraint_notes"]) {
    if (!(key in arrangement)) {
      throw new Error(`pingshu_script.story_design.technique_arrangement is missing ${key}`);
    }
  }
  assertArray(arrangement.first_person_inner_monologue_slots, "pingshu_script.story_design.technique_arrangement.first_person_inner_monologue_slots");
  assertArray(arrangement.traditional_flavor_slots, "pingshu_script.story_design.technique_arrangement.traditional_flavor_slots");
  assertArray(arrangement.leave_plain_slots, "pingshu_script.story_design.technique_arrangement.leave_plain_slots");
  if (!arrangement.technique_budget || typeof arrangement.technique_budget !== "object") {
    throw new Error("pingshu_script.story_design.technique_arrangement.technique_budget must be an object");
  }
  for (const [index, slot] of arrangement.first_person_inner_monologue_slots.entries()) {
    if (!slot || typeof slot !== "object") {
      throw new Error(`pingshu_script.story_design.technique_arrangement.first_person_inner_monologue_slots[${index}] must be an object`);
    }
    for (const key of ["segment_id", "character", "trigger", "plot_relevance", "decision_pressure", "bad_idea_logic", "action_payoff", "voice_shape", "boundary_note"]) {
      if (!(key in slot)) {
        throw new Error(`pingshu_script.story_design.technique_arrangement.first_person_inner_monologue_slots[${index}] is missing ${key}`);
      }
    }
  }
  assertArray(object.story_design.beat_order, "pingshu_script.story_design.beat_order");
  if (object.story_design.beat_order.length < 5) {
    throw new Error("pingshu_script.story_design.beat_order must include at least five beats");
  }
  assertArray(object.segments, "pingshu_script.segments");
  if (!object.segments.length) {
    throw new Error("pingshu_script.segments must include at least one segment");
  }
  for (const segment of object.segments) {
    for (const key of ["id", "purpose", "text", "performance"]) {
      if (!(key in segment)) {
        throw new Error(`pingshu_script segment is missing ${key}`);
      }
    }
    if (!segment.text.trim()) {
      throw new Error(`pingshu_script segment ${segment.id} has empty text`);
    }
    validateSfxArray(segment.performance?.sfx_after, `pingshu_script segment ${segment.id}.performance.sfx_after`);
  }
}

const hiddenDirectionPattern = /[（(][^）)]*(停顿|吸气|呼气|意味深长|语速|音色|控制|不要新闻|不要切换)[^）)]*[）)]/;
const allowedSfxIds = new Set([
  "waking_block",
  "waking_block_soft",
  "waking_block_firm",
  "waking_block_light",
  "waking_block_medium",
  "waking_block_close"
]);

function validateSfxArray(value, label) {
  if (value === undefined) return;
  assertArray(value, label);
  for (const sfxId of value) {
    if (!allowedSfxIds.has(String(sfxId))) {
      throw new Error(`${label} contains unsupported SFX id: ${sfxId}`);
    }
  }
}

function validatePerformanceEvents(segment) {
  if (!("events" in segment)) return;
  assertArray(segment.events, `performance_plan segment ${segment.id}.events`);
  if (!segment.events.length) {
    throw new Error(`performance_plan segment ${segment.id}.events must not be empty`);
  }
  let hasSay = false;
  for (const [index, event] of segment.events.entries()) {
    if (!event || typeof event !== "object") {
      throw new Error(`performance_plan segment ${segment.id}.events[${index}] must be an object`);
    }
    const type = String(event.type || "say");
    if (type === "say" || type === "utterance") {
      hasSay = true;
      if (!String(event.text || "").trim()) {
        throw new Error(`performance_plan segment ${segment.id}.events[${index}] say event must include text`);
      }
      if (hiddenDirectionPattern.test(String(event.text))) {
        throw new Error(`performance_plan segment ${segment.id}.events[${index}] puts hidden stage directions in spoken text`);
      }
      if ("tempo" in event && (!Number.isFinite(event.tempo) || event.tempo < 0.5 || event.tempo > 1.5)) {
        throw new Error(`performance_plan segment ${segment.id}.events[${index}] tempo must be between 0.5 and 1.5`);
      }
      validateSfxArray(event.sfx_after, `performance_plan segment ${segment.id}.events[${index}].sfx_after`);
    } else if (type === "pause" || type === "silence") {
      const duration = event.ms ?? event.duration_ms;
      if (!Number.isFinite(duration) || duration <= 0 || duration > 5000) {
        throw new Error(`performance_plan segment ${segment.id}.events[${index}] pause must include ms or duration_ms between 1 and 5000`);
      }
      validateSfxArray(event.sfx_after, `performance_plan segment ${segment.id}.events[${index}].sfx_after`);
    } else {
      throw new Error(`performance_plan segment ${segment.id}.events[${index}] has unsupported type: ${type}`);
    }
  }
  if (!hasSay) {
    throw new Error(`performance_plan segment ${segment.id}.events must include at least one say event`);
  }
}

function validatePerformancePlan(object) {
  assertArray(object.segments, "performance_plan.segments");
  if (!object.voice || typeof object.voice !== "object") {
    throw new Error("performance_plan.voice must be an object");
  }
  for (const key of ["performance_mode", "timbre_lock", "role_voice_policy", "reference_voice"]) {
    if (!(key in object.voice)) {
      throw new Error(`performance_plan.voice is missing ${key}`);
    }
  }
  if (object.voice.performance_mode !== "single_performer") {
    throw new Error("performance_plan.voice.performance_mode must be single_performer");
  }
  if (object.voice.timbre_lock !== true) {
    throw new Error("performance_plan.voice.timbre_lock must be true");
  }
  for (const segment of object.segments) {
    for (const key of ["id", "text", "pause_after_ms"]) {
      if (!(key in segment)) {
        throw new Error(`performance_plan segment is missing ${key}`);
      }
    }
    validateSfxArray(segment.sfx_after, `performance_plan segment ${segment.id}.sfx_after`);
    validatePerformanceEvents(segment);
  }
  if (object.audio_bed && Array.isArray(object.audio_bed.sfx_palette)) {
    validateSfxArray(object.audio_bed.sfx_palette, "performance_plan.audio_bed.sfx_palette");
  }
}

function validateDeliveryPlan(object) {
  if (!object.source_audio || typeof object.source_audio !== "object") {
    throw new Error("delivery_plan.source_audio must be an object");
  }
  for (const key of ["path", "format", "qa_status", "rights_status"]) {
    if (!(key in object.source_audio)) {
      throw new Error(`delivery_plan.source_audio is missing ${key}`);
    }
  }
  if (!["m4a", "mp3", "wav", "flac", "aac"].includes(object.source_audio.format)) {
    throw new Error("delivery_plan.source_audio.format must be m4a, mp3, wav, flac, or aac");
  }
  if (!["passed", "warning", "not_run"].includes(object.source_audio.qa_status)) {
    throw new Error("delivery_plan.source_audio.qa_status must be passed, warning, or not_run");
  }
  if (!["personal_generated", "user_authorized", "uncertain"].includes(object.source_audio.rights_status)) {
    throw new Error("delivery_plan.source_audio.rights_status must be personal_generated, user_authorized, or uncertain");
  }
  if (!object.default_delivery || typeof object.default_delivery !== "object") {
    throw new Error("delivery_plan.default_delivery must be an object");
  }
  if (object.default_delivery.target !== "local-file") {
    throw new Error("delivery_plan.default_delivery.target must be local-file");
  }
  assertArray(object.targets, "delivery_plan.targets");
  if (!object.targets.some((target) => target.id === "local-file" && target.enabled === true)) {
    throw new Error("delivery_plan.targets must include enabled local-file target");
  }
  if (!object.targets.some((target) => target.id === "netease-cloud")) {
    throw new Error("delivery_plan.targets must include netease-cloud target");
  }
  assertArray(object.notes, "delivery_plan.notes");
  for (const forbiddenKey of ["credentials", "credential", "api_key", "apiKey", "private_key", "privateKey", "cookie", "token", "authorization"]) {
    if (Object.prototype.hasOwnProperty.call(object, forbiddenKey)) {
      throw new Error(`delivery_plan must not contain credential field: ${forbiddenKey}`);
    }
  }
}

const files = Object.keys(contracts);
const optionalFiles = Object.keys(optionalContracts);
const base = statSync(target).isDirectory() ? target : resolve(".");

let checked = 0;
for (const fileName of files) {
  const path = join(base, fileName);
  if (!existsSync(path)) {
    throw new Error(`Expected ${path}`);
  }
  const object = readJson(path);
  validateRequired(object, fileName);
  if (fileName === "story_pack.json") validateStoryPack(object);
  if (fileName === "pingshu_script.json") validatePingshuScript(object);
  if (fileName === "performance_plan.json") validatePerformancePlan(object);
  checked += 1;
}

for (const fileName of optionalFiles) {
  const path = join(base, fileName);
  if (!existsSync(path)) continue;
  const object = readJson(path);
  validateRequired(object, fileName);
  if (fileName === "delivery_plan.json") validateDeliveryPlan(object);
  checked += 1;
}

console.log(`OK: validated ${checked} pingshu-skill artifact(s) in ${base}`);
