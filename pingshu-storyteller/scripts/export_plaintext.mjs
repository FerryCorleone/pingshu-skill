#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  console.error("Usage: node export_plaintext.mjs <pingshu_script.json> <output.txt>");
  process.exit(1);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const script = JSON.parse(readFileSync(inputPath, "utf8"));

if (!Array.isArray(script.segments)) {
  throw new Error("pingshu_script.json must include segments");
}

const lines = [
  script.title ? `# ${script.title}` : "# Untitled pingshu",
  "",
  ...script.segments.map((segment) => segment.text.trim()).filter(Boolean)
];

writeFileSync(outputPath, `${lines.join("\n\n")}\n`, "utf8");
console.log(`Wrote ${outputPath}`);

