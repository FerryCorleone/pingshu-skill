#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [asrArg, scriptArg] = process.argv.slice(2);
if (!asrArg) {
  console.error("Usage: node audit_asr_transcript.mjs <asr.json> [pingshu_script.json]");
  process.exit(2);
}

const asr = JSON.parse(readFileSync(resolve(asrArg), "utf8"));
const script = scriptArg ? JSON.parse(readFileSync(resolve(scriptArg), "utf8")) : null;
const segments = Array.isArray(asr.segments) ? asr.segments : [];
const transcriptText = [asr.text, ...segments.map((segment) => segment.text)]
  .map((value) => String(value || ""))
  .join("\n");
const scriptText = script
  ? [
      script.title,
      ...(Array.isArray(script.segments) ? script.segments.map((segment) => segment.text) : []),
    ].map((value) => String(value || "")).join("\n")
  : "";

const failures = [];
const warnings = [];

const standaloneFillers = segments.filter((segment) => {
  const text = String(segment.text || "").replace(/\s+/g, "").replace(/[。,.，!！?？:：；;、]/g, "");
  return /^(啊|呃|嗯|额|唔)+$/.test(text);
});
if (standaloneFillers.length) {
  failures.push(
    `standalone filler syllables detected: ${standaloneFillers
      .slice(0, 8)
      .map((segment) => `${Number(segment.start || 0).toFixed(2)}-${Number(segment.end || 0).toFixed(2)} ${String(segment.text || "").trim()}`)
      .join("; ")}`
  );
}

if (scriptText && !/啊/.test(scriptText) && /啊/.test(transcriptText)) {
  warnings.push("transcript contains 啊 but script text does not; inspect whether this is unintended filler or ASR confusion");
}
if (scriptText && /Say my name/i.test(scriptText) && !/Say\s+my\s+name/i.test(transcriptText)) {
  failures.push("required short iconic line is missing from ASR transcript: Say my name");
}
if (scriptText && /Heisenberg/i.test(scriptText) && !/(Heisenberg|海森堡|海森伯)/i.test(transcriptText)) {
  failures.push("required short iconic name is missing from ASR transcript: Heisenberg/海森堡");
}

const finiteStarts = segments.map((segment) => Number(segment.start)).filter(Number.isFinite);
const finiteEnds = segments.map((segment) => Number(segment.end)).filter(Number.isFinite);
const start = finiteStarts.length ? Math.min(...finiteStarts) : 0;
const end = finiteEnds.length ? Math.max(...finiteEnds) : 0;
const durationSec = Math.max(0, end - start);
const spokenChars = transcriptText.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "").length;
const charsPerSecond = durationSec > 0 ? spokenChars / durationSec : 0;
if (charsPerSecond > 5.5) {
  warnings.push(`speech density is high for pingshu narration: ${charsPerSecond.toFixed(2)} chars/sec`);
}

console.log(JSON.stringify({
  ok: failures.length === 0,
  failures,
  warnings,
  metrics: {
    segments: segments.length,
    duration_sec: Number(durationSec.toFixed(3)),
    spoken_chars: spokenChars,
    chars_per_second: Number(charsPerSecond.toFixed(3)),
    standalone_filler_count: standaloneFillers.length,
  },
}, null, 2));

process.exit(failures.length ? 1 : 0);
