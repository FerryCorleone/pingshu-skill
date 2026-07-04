#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultSfxDir = resolve(scriptDir, "..", "assets", "sfx");
const SFX_ALIASES = new Map([
  ["waking_block_soft", "waking_block"],
  ["waking_block_firm", "waking_block"],
  ["waking_block_light", "waking_block"],
  ["waking_block_medium", "waking_block"],
  ["waking_block_close", "waking_block"]
]);

const PROVIDERS = {
  qwen: {
    keyNames: ["QWEN_TTS_API_KEY", "DASHSCOPE_API_KEY"],
    model: "qwen3-tts-instruct-flash",
    voice: "Arthur",
    endpoint:
      process.env.QWEN_TTS_ENDPOINT ||
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
  },
  "qwen-voiceclone": {
    keyNames: ["QWEN_TTS_API_KEY", "DASHSCOPE_API_KEY"],
    enrollmentModel: "qwen-voice-enrollment",
    model: "qwen3-tts-vc-2026-01-22",
    voice: "reference-clone:default",
    customizationEndpoint:
      process.env.QWEN_CUSTOMIZATION_ENDPOINT ||
      "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization",
    endpoint:
      process.env.QWEN_TTS_ENDPOINT ||
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
  },
  "xiaomi-mimo": {
    keyNames: ["XIAOMI_MIMO_API_KEY", "MIMO_API_KEY"],
    model: "mimo-v2.5-tts-voicedesign",
    voice: "voice-design:原创中年北方说书人",
    endpoint: process.env.XIAOMI_MIMO_TTS_ENDPOINT || "https://api.xiaomimimo.com/v1/chat/completions"
  },
  "xiaomi-mimo-voiceclone": {
    keyNames: ["XIAOMI_MIMO_API_KEY", "MIMO_API_KEY"],
    model: "mimo-v2.5-tts-voiceclone",
    voice: "reference-clone:default",
    endpoint: process.env.XIAOMI_MIMO_TTS_ENDPOINT || "https://api.xiaomimimo.com/v1/chat/completions"
  }
};

function usage() {
  console.error(
    "Usage: node render_api_tts_plan.mjs <pingshu_script.json> <performance_plan.json> <output_dir> [--provider qwen|qwen-voiceclone|xiaomi-mimo|xiaomi-mimo-voiceclone|all] [--keys-stdin] [--reference-wav <path>] [--qwen-voice-id <id>] [--segment-ids id1,id2] [--max-segments n] [--phrase-chunks]"
  );
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length < 3) usage();

const scriptPath = resolve(args[0]);
const planPath = resolve(args[1]);
const outputRoot = resolve(args[2]);
let providerArg = "all";
let keysStdin = false;
let referenceWav = null;
let segmentIds = null;
let maxSegments = 0;
let phraseChunks = false;
let requestDelayMs = Number(process.env.PINGSHU_TTS_REQUEST_DELAY_MS || 0);
let qwenVoiceId = process.env.QWEN_TTS_VOICE_ID || null;

for (let i = 3; i < args.length; i += 1) {
  if (args[i] === "--provider") {
    providerArg = args[i + 1];
    i += 1;
  } else if (args[i] === "--keys-stdin") {
    keysStdin = true;
  } else if (args[i] === "--reference-wav") {
    referenceWav = resolve(args[i + 1]);
    i += 1;
  } else if (args[i] === "--segment-ids") {
    segmentIds = new Set(String(args[i + 1]).split(",").map((id) => id.trim()).filter(Boolean));
    i += 1;
  } else if (args[i] === "--max-segments") {
    maxSegments = Number(args[i + 1] || 0);
    i += 1;
  } else if (args[i] === "--phrase-chunks") {
    phraseChunks = true;
  } else if (args[i] === "--request-delay-ms") {
    requestDelayMs = Number(args[i + 1] || 0);
    i += 1;
  } else if (args[i] === "--qwen-voice-id") {
    qwenVoiceId = args[i + 1];
    i += 1;
  } else {
    usage();
  }
}

const selectedProviders =
  providerArg === "all" ? Object.keys(PROVIDERS) : [providerArg];
for (const provider of selectedProviders) {
  if (!PROVIDERS[provider]) usage();
}

const pingshuScript = JSON.parse(readFileSync(scriptPath, "utf8"));
const plan = JSON.parse(readFileSync(planPath, "utf8"));

if (!Array.isArray(plan.segments) || !plan.segments.length) {
  throw new Error("performance_plan.json must include non-empty segments");
}

let renderSegments = plan.segments;
if (segmentIds) renderSegments = renderSegments.filter((segment) => segmentIds.has(segment.id));
if (maxSegments > 0) renderSegments = renderSegments.slice(0, maxSegments);
if (!renderSegments.length) throw new Error("No segments selected for rendering");

const keysFromStdin = keysStdin ? readSecretsFromStdin() : {};

function readSecretsFromStdin() {
  const stdin = readFileSync(0, "utf8").trim();
  if (!stdin) return {};
  try {
    return JSON.parse(stdin);
  } catch (error) {
    throw new Error(`Failed to parse JSON keys from stdin: ${error.message}`);
  }
}

function getApiKey(provider) {
  const config = PROVIDERS[provider];
  for (const name of config.keyNames) {
    if (process.env[name]) return process.env[name];
  }
  if (keysFromStdin[provider]) return keysFromStdin[provider];
  const shortName = provider.startsWith("xiaomi-mimo") ? "xiaomi" :
    provider.startsWith("qwen") ? "qwen" : provider;
  if (keysFromStdin[shortName]) return keysFromStdin[shortName];
  throw new Error(`Missing API key for ${provider}. Set ${config.keyNames.join(" or ")}.`);
}

function slugifyAscii(value, fallback) {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return slug || fallback;
}

function outputStorySlug() {
  return slugifyAscii(
    process.env.PINGSHU_TTS_OUTPUT_SLUG ||
      pingshuScript.slug ||
      pingshuScript.id ||
      plan.slug ||
      plan.id ||
      basename(dirname(outputRoot)),
    "pingshu-story"
  );
}

function outputVersionSlug() {
  const versionText = [
    pingshuScript.title,
    plan.title,
    basename(outputRoot),
    basename(dirname(scriptPath))
  ].filter(Boolean).join(" ");
  const match = versionText.match(/\bv\s*([0-9]+)\b/i) || versionText.match(/(?:^|[_-])v([0-9]+)(?:[_-]|$)/i);
  return match ? `v${match[1]}` : "run";
}

function finalOutputPath(outDir, providerSuffix, extension) {
  return join(outDir, `${outputStorySlug()}-${outputVersionSlug()}-${providerSuffix}.${extension}`);
}

function ensureFfmpeg() {
  for (const command of ["ffmpeg", "ffprobe"]) {
    const check = spawnSync("which", [command], { encoding: "utf8" });
    if (check.status !== 0) throw new Error(`${command} is required for post-processing`);
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function fetchWithRetry(url, options, label) {
  const maxAttempts = 4;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (requestDelayMs > 0) await sleep(requestDelayMs);
    try {
      const response = await fetch(url, options);
      if (response.status !== 429 && response.status < 500) return response;
      const text = await response.text();
      lastError = new Error(`${label} returned ${response.status}: ${text.slice(0, 500)}`);
      const backoff = Math.min(60000, 4000 * 2 ** (attempt - 1));
      console.warn(`[${label}] retry ${attempt}/${maxAttempts} after ${response.status}; waiting ${backoff}ms`);
      await sleep(backoff);
    } catch (error) {
      lastError = error;
      const backoff = Math.min(60000, 4000 * 2 ** (attempt - 1));
      console.warn(`[${label}] retry ${attempt}/${maxAttempts} after network error; waiting ${backoff}ms`);
      await sleep(backoff);
    }
  }
  throw lastError || new Error(`${label} failed`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function convertToWav(inputPath, outputPath) {
  run("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-ar",
    "48000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    outputPath
  ]);
}

function applyTempo(inputPath, outputPath, tempo) {
  const value = Number(tempo);
  if (!Number.isFinite(value) || Math.abs(value - 1) < 0.015) {
    run("ffmpeg", ["-y", "-i", inputPath, "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "1", outputPath]);
    return;
  }
  run("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-filter:a",
    `atempo=${value.toFixed(3)}`,
    "-ar",
    "48000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    outputPath
  ]);
}

function makeSilence(ms, outputPath) {
  const seconds = Math.max(0.05, Number(ms || 0) / 1000).toFixed(3);
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=48000:cl=mono",
    "-t",
    seconds,
    "-c:a",
    "pcm_s16le",
    outputPath
  ]);
}

function concatWavs(inputPaths, outputPath) {
  const listPath = join(dirname(outputPath), `${basename(outputPath, ".wav")}.concat.txt`);
  writeFileSync(
    listPath,
    inputPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n") + "\n",
    "utf8"
  );
  run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath]);
}

function wavToM4a(inputPath, outputPath) {
  run("ffmpeg", ["-y", "-i", inputPath, "-c:a", "aac", "-b:a", "160k", outputPath]);
}

function audioDuration(path) {
  const out = run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path
  ]);
  return Number(out.trim());
}

function normalizeSfxIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => String(raw || "").trim())
    .filter(Boolean)
    .map((id) => SFX_ALIASES.get(id) || id);
}

function makeSfxClip(sfxId, tempDir, prefix, gainDb = -6) {
  const resolvedId = SFX_ALIASES.get(sfxId) || sfxId;
  const assetPath = join(defaultSfxDir, `${resolvedId}.wav`);
  if (!existsSync(assetPath)) {
    throw new Error(`SFX asset not found for ${sfxId}: ${assetPath}`);
  }
  const outputPath = join(tempDir, `${prefix}-${resolvedId}.wav`);
  run("ffmpeg", [
    "-y",
    "-i",
    assetPath,
    "-filter:a",
    `volume=${Number(gainDb).toFixed(2)}dB`,
    "-ar",
    "48000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    outputPath
  ]);
  return {
    id: resolvedId,
    source_id: sfxId,
    asset_file: assetPath,
    output_file: outputPath,
    gain_db: gainDb,
    duration_seconds: audioDuration(outputPath)
  };
}

function appendSfxAfter(concatInputs, segment, tempDir, prefix) {
  const gainDb = Number(plan?.audio_bed?.prop_sfx_policy?.default_gain_db ?? -6);
  const records = [];
  for (const sfxId of normalizeSfxIds(segment.sfx_after)) {
    const record = makeSfxClip(sfxId, tempDir, prefix, gainDb);
    concatInputs.push(record.output_file);
    records.push(record);
  }
  return records;
}

function pauseAfterSfxMs(segment, plannedMs, hasLaterSegment, sfxAfter) {
  if (!hasLaterSegment) return 0;
  if (!Array.isArray(sfxAfter) || !sfxAfter.length) return Math.max(0, Number(plannedMs || 0));
  const policy = plan?.audio_bed?.prop_sfx_policy || {};
  const defaultMs = Number(policy.post_sfx_pause_ms ?? 420);
  const minMs = Number(policy.post_sfx_pause_min_ms ?? 320);
  const maxMs = Number(policy.post_sfx_pause_max_ms ?? 650);
  const planned = Number(plannedMs || 0);
  if (!Number.isFinite(planned) || planned <= 0) return defaultMs;
  return Math.min(Math.max(planned, minMs), maxMs);
}

function extractAudioPayload(json) {
  const url = json?.output?.audio?.url;
  const data = json?.output?.audio?.data;
  if (url) return { type: "url", value: url };
  if (data) return { type: "base64", value: data };
  throw new Error(`No audio payload in response: ${JSON.stringify(json).slice(0, 800)}`);
}

async function downloadToFile(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Audio download failed ${response.status}: ${text.slice(0, 300)}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, bytes);
}

function writeBase64ToFile(data, outputPath) {
  writeFileSync(outputPath, Buffer.from(data, "base64"));
}

function readReferenceVoiceDataUrl(pathArg = referenceWav) {
  const path = pathArg || plan?.voice?.reference_voice?.path_or_id;
  if (!path) throw new Error("A reference voice wav is required for voiceclone providers");
  const resolved = resolve(path);
  if (!existsSync(resolved)) throw new Error(`Reference voice file does not exist: ${resolved}`);
  const bytes = readFileSync(resolved);
  if (bytes.length > 10 * 1024 * 1024) {
    throw new Error("Reference voice must be <= 10 MB for current API voice clone paths");
  }
  return {
    path: resolved,
    dataUrl: `data:audio/wav;base64,${bytes.toString("base64")}`
  };
}

function referenceVoiceDescription() {
  return [
    "以提供的原创参考声音为准：苍劲中老年男声，略粗粝但清楚，北方评书台口。",
    "不要年轻主播感，不要新闻播音腔，不要换角色音色。",
    "整体中慢速，包袱前停一下，短句处可以利落发力。"
  ].join("");
}

function xiaomiVoiceDesignDescription() {
  return [
    "An elderly Mandarin male storyteller, around 60 years old, deep and slightly gravelly, weathered but clear.",
    "A subtle Beijing/Tianjin northern accent, like a traditional Chinese pingshu narrator sitting behind a table.",
    "Slow and deliberate rhythm, careful pauses before jokes, wry smile in the voice, not a young streamer, not a news announcer."
  ].join(" ");
}

function segmentInstruction(segment) {
  const emphasis = Array.isArray(segment.emphasis) && segment.emphasis.length
    ? `重点词：${segment.emphasis.join("、")}。`
    : "";
  const map = {
    sharp_hook: "开场要稳，像醒木落下后把观众叫住。",
    setup_rules: "铺规则，别快，带一点调侃。",
    scene_painting: "慢一点，有画面。",
    temptation_joke: "压低一点，像坏点子刚冒头。",
    action_release: "短句利落，别拖。",
    comic_shock: "先愣一下，再放出好笑。",
    fallout: "轻松吐槽，别端着。",
    reunion_tension: "放慢，留一点尴尬和悬念。",
    ensemble_wrap: "热闹但别吵。",
    closing_snap: "收束稳，最后一句有落点。"
  };
  return [map[segment.emotion] || "自然说书。", emphasis].filter(Boolean).join("");
}

function segmentTempo(segment) {
  if (segment.pace === "slow") return 0.9;
  if (segment.pace === "medium_slow") return 0.93;
  if (segment.pace === "fast") return 1.04;
  return 0.97;
}

function splitIntoPhraseUnits(text) {
  const normalized = String(text).replace(/\s+/g, "");
  if (!phraseChunks) return [{ text: normalized, pause_ms: 0 }];
  const chunks = [];
  let buffer = "";
  for (const char of normalized) {
    buffer += char;
    if ("。！？；".includes(char) || (char === "：" && buffer.length >= 38)) {
      chunks.push({ text: buffer, pause_ms: pauseForPunctuation(char) });
      buffer = "";
    }
  }
  if (buffer) chunks.push({ text: buffer, pause_ms: 0 });
  return chunks.filter((chunk) => chunk.text.trim());
}

function pauseForPunctuation(char) {
  if (char === "。") return 260;
  if (char === "！" || char === "？") return 330;
  if (char === "；" || char === "：") return 230;
  if (char === "，") return 120;
  return 0;
}

function qwenInstruction(segment) {
  const emphasis = Array.isArray(segment.emphasis) && segment.emphasis.length
    ? `重点词稍微压一下：${segment.emphasis.join("、")}。`
    : "";
  return [
    "单人中文评书说书人口吻，原创中老年男声质感，略带北方口音，嗓音稳、稍微沙一点。",
    "整体中慢速，不要像播音腔；有包袱的地方稍停顿，内心戏压低一点，转折处轻微上扬。",
    "保持同一个说书人音色，不要切换角色音色。",
    emphasis
  ].filter(Boolean).join("");
}

async function callQwenTts(apiKey, text, segment) {
  const config = PROVIDERS.qwen;
  const response = await fetchWithRetry(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      input: {
        text,
        voice: config.voice,
        language_type: "Chinese",
        instructions: qwenInstruction(segment),
        optimize_instructions: true
      }
    })
  }, "qwen");
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(`Qwen returned non-JSON ${response.status}: ${bodyText.slice(0, 500)}`);
  }
  if (!response.ok || Number(body.status_code || response.status) >= 400 || body.code) {
    throw new Error(`Qwen TTS failed ${response.status}: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  return body;
}

async function createQwenVoiceClone(apiKey) {
  const config = PROVIDERS["qwen-voiceclone"];
  const reference = readReferenceVoiceDataUrl();
  const response = await fetchWithRetry(config.customizationEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.enrollmentModel,
      input: {
        action: "create",
        target_model: config.model,
        preferred_name: `pingshu_${Date.now().toString(36).slice(-8)}`,
        audio: { data: reference.dataUrl },
        text: "列位，今儿咱慢慢说。肯德基门口这只箱子，装的是金条，也是信任。您把耳朵支棱起来，后头这一下，有意思。"
      }
    })
  }, "qwen-voiceclone-create");
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(`Qwen voice clone returned non-JSON ${response.status}: ${bodyText.slice(0, 500)}`);
  }
  if (!response.ok || body.code || body?.output?.base_resp?.status_code > 0) {
    throw new Error(`Qwen voice clone failed ${response.status}: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  const voice = body?.output?.voice || body?.output?.voice_id;
  if (!voice) throw new Error(`Qwen voice clone did not return a voice id: ${JSON.stringify(body).slice(0, 800)}`);
  return { voice, reference_path: reference.path, request_id: body.request_id };
}

async function callQwenCustomTts(apiKey, text, voice) {
  const config = PROVIDERS["qwen-voiceclone"];
  const response = await fetchWithRetry(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      input: {
        text,
        voice,
        language_type: "Chinese"
      }
    })
  }, "qwen-voiceclone-tts");
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(`Qwen custom TTS returned non-JSON ${response.status}: ${bodyText.slice(0, 500)}`);
  }
  if (!response.ok || Number(body.status_code || response.status) >= 400 || body.code) {
    throw new Error(`Qwen custom TTS failed ${response.status}: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  return body;
}

function xiaomiVoicePrompt() {
  return xiaomiVoiceDesignDescription();
}

async function callXiaomiMimoTts(apiKey, text, options = {}) {
  const config = PROVIDERS[options.provider || "xiaomi-mimo"];
  const messages = [
    {
      role: "user",
      content: options.instruction || xiaomiVoicePrompt()
    },
    {
      role: "assistant",
      content: text
    }
  ];
  const audio = {
    format: "wav"
  };
  if (options.voice) audio.voice = options.voice;
  if (config.model === "mimo-v2.5-tts-voicedesign") audio.optimize_text_preview = false;

  const response = await fetchWithRetry(config.endpoint, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      audio
    })
  }, config.model);
  const bodyText = await response.text();
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error(`Xiaomi MiMo returned non-JSON ${response.status}: ${bodyText.slice(0, 500)}`);
  }
  if (!response.ok || body.error) {
    throw new Error(`Xiaomi MiMo TTS failed ${response.status}: ${JSON.stringify(body).slice(0, 1000)}`);
  }
  return body;
}

function extractMimoAudio(json) {
  const audio = json?.choices?.[0]?.message?.audio;
  const data = audio?.data || audio?.base64 || audio?.audio_data;
  if (!data) throw new Error(`No MiMo audio data in response: ${JSON.stringify(json).slice(0, 800)}`);
  return data;
}

async function renderQwen(apiKey) {
  const provider = "qwen";
  const config = PROVIDERS[provider];
  const outDir = join(outputRoot, "qwen3-tts-instruct-flash-arthur");
  mkdirSync(outDir, { recursive: true });
  const tempDir = mkdtempSync(join(tmpdir(), "pingshu-qwen-"));
  const concatInputs = [];
  const segmentManifest = [];

  try {
    for (const [index, segment] of renderSegments.entries()) {
      const indexLabel = String(index + 1).padStart(3, "0");
      const rawPath = join(outDir, `${indexLabel}-${segment.id}.raw`);
      const wavPath = join(outDir, `${indexLabel}-${segment.id}.wav`);
      const response = await callQwenTts(apiKey, segment.text, segment);
      const payload = extractAudioPayload(response);
      if (payload.type === "url") await downloadToFile(payload.value, rawPath);
      else writeBase64ToFile(payload.value, rawPath);
      const tempWavPath = join(tempDir, `${indexLabel}-${segment.id}.pretempo.wav`);
      convertToWav(rawPath, tempWavPath);
      applyTempo(tempWavPath, wavPath, segmentTempo(segment));
      concatInputs.push(wavPath);
      const sfxAfter = appendSfxAfter(concatInputs, segment, tempDir, `${indexLabel}-${segment.id}-sfx`);

      const pauseMs = pauseAfterSfxMs(segment, segment.pause_after_ms, index !== renderSegments.length - 1, sfxAfter);
      if (pauseMs > 0) {
        const silencePath = join(tempDir, `${indexLabel}-pause.wav`);
        makeSilence(pauseMs, silencePath);
        concatInputs.push(silencePath);
      }

      segmentManifest.push({
        id: segment.id,
        output_file: wavPath,
        pause_after_ms: pauseMs,
        request_id: response.request_id,
        audio_id: response?.output?.audio?.id,
        expires_at: response?.output?.audio?.expires_at,
        sfx_after: sfxAfter,
        duration_seconds: audioDuration(wavPath)
      });
      console.log(`[qwen] rendered ${segment.id}`);
    }

    const finalWav = finalOutputPath(outDir, "qwen3-arthur", "wav");
    const finalM4a = finalOutputPath(outDir, "qwen3-arthur", "m4a");
    concatWavs(concatInputs, finalWav);
    wavToM4a(finalWav, finalM4a);
    writeManifest(outDir, provider, config, finalWav, finalM4a, segmentManifest);
    return { provider, outDir, finalWav, finalM4a };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function renderQwenVoiceClone(apiKey) {
  const provider = "qwen-voiceclone";
  const config = PROVIDERS[provider];
  const voiceClone = qwenVoiceId
    ? { voice: qwenVoiceId, reference_path: referenceWav || plan?.voice?.reference_voice?.path_or_id || null, request_id: null }
    : await createQwenVoiceClone(apiKey);
  const outDir = join(outputRoot, "qwen3-tts-vc-c06-reference");
  mkdirSync(outDir, { recursive: true });
  const tempDir = mkdtempSync(join(tmpdir(), "pingshu-qwen-vc-"));
  const concatInputs = [];
  const segmentManifest = [];

  try {
    for (const [index, segment] of renderSegments.entries()) {
      const indexLabel = String(index + 1).padStart(3, "0");
      const phraseInputs = [];
      for (const [phraseIndex, phrase] of splitIntoPhraseUnits(segment.text).entries()) {
        const phraseLabel = String(phraseIndex + 1).padStart(2, "0");
        const rawPath = join(outDir, `${indexLabel}-${segment.id}-${phraseLabel}.raw`);
        const tempWavPath = join(tempDir, `${indexLabel}-${segment.id}-${phraseLabel}.pretempo.wav`);
        const wavPath = join(outDir, `${indexLabel}-${segment.id}-${phraseLabel}.wav`);
        const response = await callQwenCustomTts(apiKey, phrase.text, voiceClone.voice);
        const payload = extractAudioPayload(response);
        if (payload.type === "url") await downloadToFile(payload.value, rawPath);
        else writeBase64ToFile(payload.value, rawPath);
        convertToWav(rawPath, tempWavPath);
        applyTempo(tempWavPath, wavPath, segmentTempo(segment));
        phraseInputs.push(wavPath);
        if (phrase.pause_ms > 0) {
          const phrasePause = join(tempDir, `${indexLabel}-${segment.id}-${phraseLabel}-pause.wav`);
          makeSilence(phrase.pause_ms, phrasePause);
          phraseInputs.push(phrasePause);
        }
      }

      const segmentWavPath = join(outDir, `${indexLabel}-${segment.id}.wav`);
      concatWavs(phraseInputs, segmentWavPath);
      concatInputs.push(segmentWavPath);
      const sfxAfter = appendSfxAfter(concatInputs, segment, tempDir, `${indexLabel}-${segment.id}-sfx`);

      const pauseMs = pauseAfterSfxMs(segment, segment.pause_after_ms, index !== renderSegments.length - 1, sfxAfter);
      if (pauseMs > 0) {
        const silencePath = join(tempDir, `${indexLabel}-pause.wav`);
        makeSilence(pauseMs, silencePath);
        concatInputs.push(silencePath);
      }

      segmentManifest.push({
        id: segment.id,
        output_file: segmentWavPath,
        pause_after_ms: pauseMs,
        phrase_chunks: phraseChunks,
        sfx_after: sfxAfter,
        duration_seconds: audioDuration(segmentWavPath)
      });
      console.log(`[qwen-voiceclone] rendered ${segment.id}`);
    }

    const finalWav = finalOutputPath(outDir, "qwen-vc-c06", "wav");
    const finalM4a = finalOutputPath(outDir, "qwen-vc-c06", "m4a");
    concatWavs(concatInputs, finalWav);
    wavToM4a(finalWav, finalM4a);
    writeManifest(outDir, provider, config, finalWav, finalM4a, segmentManifest, {
      reference_voice_path: voiceClone.reference_path,
      clone_request_id: voiceClone.request_id,
      cloned_voice: voiceClone.voice,
      phrase_chunks: phraseChunks
    });
    return { provider, outDir, finalWav, finalM4a };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function renderXiaomi(apiKey) {
  const provider = "xiaomi-mimo";
  const config = PROVIDERS[provider];
  const outDir = join(outputRoot, "xiaomi-mimo-v25-voicedesign-segmented");
  mkdirSync(outDir, { recursive: true });
  const tempDir = mkdtempSync(join(tmpdir(), "pingshu-xiaomi-mimo-"));
  const concatInputs = [];
  const segmentManifest = [];
  const finalWav = finalOutputPath(outDir, "xiaomi-mimo", "wav");
  const finalM4a = finalOutputPath(outDir, "xiaomi-mimo", "m4a");

  try {
    for (const [index, segment] of renderSegments.entries()) {
      const indexLabel = String(index + 1).padStart(3, "0");
      const rawPath = join(outDir, `${indexLabel}-${segment.id}.raw`);
      const wavPath = join(outDir, `${indexLabel}-${segment.id}.wav`);
      const response = await callXiaomiMimoTts(apiKey, segment.text, {
        provider,
        instruction: `${xiaomiVoicePrompt()} ${segmentInstruction(segment)}`
      });
      const audioBase64 = extractMimoAudio(response);
      writeBase64ToFile(audioBase64, rawPath);
      const tempWavPath = join(tempDir, `${indexLabel}-${segment.id}.pretempo.wav`);
      convertToWav(rawPath, tempWavPath);
      applyTempo(tempWavPath, wavPath, segmentTempo(segment));
      concatInputs.push(wavPath);
      const sfxAfter = appendSfxAfter(concatInputs, segment, tempDir, `${indexLabel}-${segment.id}-sfx`);

      const pauseMs = pauseAfterSfxMs(segment, segment.pause_after_ms, index !== renderSegments.length - 1, sfxAfter);
      if (pauseMs > 0) {
        const silencePath = join(tempDir, `${indexLabel}-pause.wav`);
        makeSilence(pauseMs, silencePath);
        concatInputs.push(silencePath);
      }

      segmentManifest.push({
        id: segment.id,
        output_file: wavPath,
        pause_after_ms: pauseMs,
        request_id: response.id,
        usage: response.usage || null,
        sfx_after: sfxAfter,
        duration_seconds: audioDuration(wavPath)
      });
      console.log(`[xiaomi-mimo] rendered ${segment.id}`);
    }

    concatWavs(concatInputs, finalWav);
    wavToM4a(finalWav, finalM4a);
    writeManifest(outDir, provider, config, finalWav, finalM4a, segmentManifest, {
      tag_control: true,
      single_pass: false,
      voice_design_note: "The same original voice design prompt is repeated for every segment; evaluate for timbre drift."
    });
    return { provider, outDir, finalWav, finalM4a };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function renderXiaomiVoiceClone(apiKey) {
  const provider = "xiaomi-mimo-voiceclone";
  const config = PROVIDERS[provider];
  const reference = readReferenceVoiceDataUrl();
  const outDir = join(outputRoot, "xiaomi-mimo-v25-voiceclone-c06");
  mkdirSync(outDir, { recursive: true });
  const tempDir = mkdtempSync(join(tmpdir(), "pingshu-xiaomi-mimo-vc-"));
  const concatInputs = [];
  const segmentManifest = [];
  const finalWav = finalOutputPath(outDir, "xiaomi-mimo-vc-c06", "wav");
  const finalM4a = finalOutputPath(outDir, "xiaomi-mimo-vc-c06", "m4a");

  try {
    for (const [index, segment] of renderSegments.entries()) {
      const indexLabel = String(index + 1).padStart(3, "0");
      const phraseInputs = [];
      for (const [phraseIndex, phrase] of splitIntoPhraseUnits(segment.text).entries()) {
        const phraseLabel = String(phraseIndex + 1).padStart(2, "0");
        const rawPath = join(outDir, `${indexLabel}-${segment.id}-${phraseLabel}.raw`);
        const tempWavPath = join(tempDir, `${indexLabel}-${segment.id}-${phraseLabel}.pretempo.wav`);
        const wavPath = join(outDir, `${indexLabel}-${segment.id}-${phraseLabel}.wav`);
        const response = await callXiaomiMimoTts(apiKey, phrase.text, {
          provider,
          voice: reference.dataUrl,
          instruction: `${referenceVoiceDescription()} ${segmentInstruction(segment)}`
        });
        const audioBase64 = extractMimoAudio(response);
        writeBase64ToFile(audioBase64, rawPath);
        convertToWav(rawPath, tempWavPath);
        applyTempo(tempWavPath, wavPath, segmentTempo(segment));
        phraseInputs.push(wavPath);
        if (phrase.pause_ms > 0) {
          const phrasePause = join(tempDir, `${indexLabel}-${segment.id}-${phraseLabel}-pause.wav`);
          makeSilence(phrase.pause_ms, phrasePause);
          phraseInputs.push(phrasePause);
        }
      }

      const segmentWavPath = join(outDir, `${indexLabel}-${segment.id}.wav`);
      concatWavs(phraseInputs, segmentWavPath);
      concatInputs.push(segmentWavPath);
      const sfxAfter = appendSfxAfter(concatInputs, segment, tempDir, `${indexLabel}-${segment.id}-sfx`);

      const pauseMs = pauseAfterSfxMs(segment, segment.pause_after_ms, index !== renderSegments.length - 1, sfxAfter);
      if (pauseMs > 0) {
        const silencePath = join(tempDir, `${indexLabel}-pause.wav`);
        makeSilence(pauseMs, silencePath);
        concatInputs.push(silencePath);
      }

      segmentManifest.push({
        id: segment.id,
        output_file: segmentWavPath,
        pause_after_ms: pauseMs,
        phrase_chunks: phraseChunks,
        sfx_after: sfxAfter,
        duration_seconds: audioDuration(segmentWavPath)
      });
      console.log(`[xiaomi-mimo-voiceclone] rendered ${segment.id}`);
    }

    concatWavs(concatInputs, finalWav);
    wavToM4a(finalWav, finalM4a);
    writeManifest(outDir, provider, config, finalWav, finalM4a, segmentManifest, {
      reference_voice_path: reference.path,
      phrase_chunks: phraseChunks
    });
    return { provider, outDir, finalWav, finalM4a };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeManifest(outDir, provider, config, finalWav, finalM4a, renders, extra = {}) {
  const manifest = {
    schema_version: "1.0",
    created_at: new Date().toISOString(),
    provider,
    model: config.model,
    voice: config.voice,
    title: pingshuScript.title || plan.title || "肯德基事变",
    source_script: scriptPath,
    source_plan: planPath,
    final_wav: finalWav,
    final_m4a: finalM4a,
    duration_seconds: audioDuration(finalWav),
    api_key_stored: false,
    voice_policy: "single original storyteller voice; no living artist voice clone",
    sfx_policy: plan.audio_bed?.prop_sfx_policy || {
      allowed_ids: ["waking_block"],
      insert_mode: "post_tts_timeline",
      default_gain_db: -6,
      post_sfx_pause_ms: 420,
      post_sfx_pause_min_ms: 320,
      post_sfx_pause_max_ms: 650
    },
    renders,
    ...extra
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

ensureFfmpeg();
mkdirSync(outputRoot, { recursive: true });

const results = [];
for (const provider of selectedProviders) {
  const apiKey = getApiKey(provider);
  if (provider === "qwen") results.push(await renderQwen(apiKey));
  if (provider === "qwen-voiceclone") results.push(await renderQwenVoiceClone(apiKey));
  if (provider === "xiaomi-mimo") results.push(await renderXiaomi(apiKey));
  if (provider === "xiaomi-mimo-voiceclone") results.push(await renderXiaomiVoiceClone(apiKey));
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
