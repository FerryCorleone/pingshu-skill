#!/usr/bin/env node
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const modelId = process.argv[2] || "mlx-community/whisper-large-v3-mlx";

function hfModelDir(id) {
  return `models--${id.replaceAll("/", "--")}`;
}

function candidateRoots() {
  const roots = [];
  const add = (value) => {
    if (value && !roots.includes(value)) roots.push(value);
  };

  if (process.env.HF_HOME) add(path.join(process.env.HF_HOME, "hub"));
  if (process.env.HUGGINGFACE_HUB_CACHE) add(process.env.HUGGINGFACE_HUB_CACHE);
  add(path.join(homedir(), ".cache", "huggingface", "hub"));

  return roots;
}

const modelDir = hfModelDir(modelId);
const candidates = candidateRoots().map((root) => ({
  root,
  path: path.join(root, modelDir),
  exists: existsSync(path.join(root, modelDir))
}));

const found = candidates.find((candidate) => candidate.exists) || null;

console.log(JSON.stringify({
  model: modelId,
  cached: Boolean(found),
  found_path: found ? found.path : null,
  candidates,
  reuse_hint: found
    ? `Reuse cached ASR model with: uvx --from mlx-whisper mlx_whisper <audio> --model ${modelId} --language zh --word-timestamps False --condition-on-previous-text False --output-format json`
    : "No local cache found for this model. Ask before downloading or choose another cached model."
}, null, 2));

if (!found) process.exitCode = 1;
