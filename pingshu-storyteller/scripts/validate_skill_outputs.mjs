#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const target = resolve(process.argv[2] || ".");

const contracts = {
  "story_pack.json": [
    "schema_version",
    "request",
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
  const missing = contracts[fileName].filter((key) => !(key in object));
  if (missing.length) {
    throw new Error(`${fileName} missing required keys: ${missing.join(", ")}`);
  }
}

function validateStoryPack(object) {
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
  }
}

function validatePerformancePlan(object) {
  assertArray(object.segments, "performance_plan.segments");
  if (!object.voice || typeof object.voice !== "object") {
    throw new Error("performance_plan.voice must be an object");
  }
  for (const segment of object.segments) {
    for (const key of ["id", "text", "pause_after_ms"]) {
      if (!(key in segment)) {
        throw new Error(`performance_plan segment is missing ${key}`);
      }
    }
  }
}

const files = Object.keys(contracts);
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

console.log(`OK: validated ${checked} pingshu-storyteller artifact(s) in ${base}`);

