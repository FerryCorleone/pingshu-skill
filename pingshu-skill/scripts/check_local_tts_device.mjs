#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import os from "node:os";

const GB = 1024 ** 3;

const minimums = {
  "local-voxcpm2": {
    label: "VoxCPM2",
    role: "quality-first local renderer",
    mac: "Apple Silicon with at least 32 GB unified memory; 48 GB or more is recommended for long scripts.",
    windows: "NVIDIA GPU with at least 12 GB VRAM and 32 GB RAM; 16 GB VRAM / 64 GB RAM is more comfortable.",
    linux: "NVIDIA GPU with at least 12 GB VRAM and 32 GB RAM; CUDA setup must be verified."
  },
  "local-qwen3-tts": {
    label: "Qwen3-TTS 0.6B Base",
    role: "low-footprint local fallback",
    mac: "Apple Silicon with at least 16 GB unified memory; 24-32 GB is more comfortable.",
    windows: "NVIDIA GPU with at least 8 GB VRAM and 16 GB RAM; 32 GB RAM is more comfortable.",
    linux: "NVIDIA GPU with at least 8 GB VRAM and 16 GB RAM; CUDA setup must be verified."
  }
};

function round1(value) {
  return Math.round(value * 10) / 10;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  return String(result.stdout || "").trim();
}

function firstMatch(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? match[1].trim() : null;
}

function macHardware() {
  if (process.platform !== "darwin") return {};
  const hardware = run("system_profiler", ["SPHardwareDataType"]) || "";
  const displays = run("system_profiler", ["SPDisplaysDataType"]) || "";
  return {
    chip: firstMatch(hardware, /Chip:\s*(.+)/),
    model: firstMatch(hardware, /Model Name:\s*(.+)/),
    gpu: firstMatch(displays, /Chipset Model:\s*(.+)/)
  };
}

function nvidiaSmiGpus() {
  const output = run("nvidia-smi", [
    "--query-gpu=name,memory.total",
    "--format=csv,noheader,nounits"
  ]);
  if (!output) return [];
  return output.split(/\r?\n/)
    .map((line) => {
      const [name, memoryMb] = line.split(",").map((part) => part.trim());
      const vramGb = Number(memoryMb) / 1024;
      return name ? { name, vram_gb: round1(vramGb), source: "nvidia-smi" } : null;
    })
    .filter(Boolean);
}

function windowsGpus() {
  if (process.platform !== "win32") return [];
  const output = run("powershell.exe", [
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress"
  ]);
  if (!output) return [];
  try {
    const parsed = JSON.parse(output);
    return (Array.isArray(parsed) ? parsed : [parsed]).map((gpu) => ({
      name: gpu.Name || "Unknown GPU",
      vram_gb: gpu.AdapterRAM ? round1(Number(gpu.AdapterRAM) / GB) : null,
      source: "Win32_VideoController"
    }));
  } catch {
    return [];
  }
}

function linuxGpus() {
  if (process.platform !== "linux") return [];
  const output = run("lspci", []);
  if (!output) return [];
  return output.split(/\r?\n/)
    .filter((line) => /vga|3d|display/i.test(line))
    .map((line) => ({ name: line.replace(/^[^ ]+\s+/, ""), vram_gb: null, source: "lspci" }));
}

function detectHardware() {
  const ramGb = round1(os.totalmem() / GB);
  const cpus = os.cpus();
  const gpus = [
    ...nvidiaSmiGpus(),
    ...windowsGpus(),
    ...linuxGpus()
  ];
  const mac = macHardware();
  return {
    platform: process.platform,
    arch: process.arch,
    ram_gb: ramGb,
    cpu: cpus[0]?.model || null,
    cpu_cores: cpus.length,
    mac,
    gpus
  };
}

function bestNvidiaGpu(gpus) {
  return gpus
    .filter((gpu) => /nvidia|geforce|rtx|gtx|quadro|tesla/i.test(gpu.name || ""))
    .sort((a, b) => (b.vram_gb || 0) - (a.vram_gb || 0))[0] || null;
}

function evaluate(detected) {
  const ram = detected.ram_gb || 0;
  const isMacAppleSilicon = detected.platform === "darwin" && detected.arch === "arm64";
  const nvidia = bestNvidiaGpu(detected.gpus);
  const nvidiaVram = nvidia?.vram_gb || 0;
  const hasUnknownNvidia = Boolean(nvidia && !nvidia.vram_gb);

  const canRunVox = isMacAppleSilicon
    ? ram >= 32
    : Boolean(nvidia && nvidiaVram >= 12 && ram >= 32);
  const canRunQwen = isMacAppleSilicon
    ? ram >= 16
    : Boolean(nvidia && nvidiaVram >= 8 && ram >= 16);

  const candidates = [
    {
      provider: "local-voxcpm2",
      can_run: canRunVox,
      fit: canRunVox ? "recommended" : "not_recommended",
      minimum: minimums["local-voxcpm2"]
    },
    {
      provider: "local-qwen3-tts",
      can_run: canRunQwen,
      fit: canRunQwen ? (canRunVox ? "fallback" : "recommended") : "not_recommended",
      minimum: minimums["local-qwen3-tts"]
    }
  ];

  if (hasUnknownNvidia) {
    return {
      provider: "needs-user-config",
      reason: "Detected an NVIDIA GPU but could not read VRAM. Ask the user for GPU model/VRAM and RAM before installing local TTS.",
      candidates
    };
  }

  if (canRunVox) {
    return {
      provider: "local-voxcpm2",
      reason: "Machine meets the local quality-first minimum. Use VoxCPM2 by default, with Qwen3-TTS 0.6B available as a lighter fallback.",
      candidates
    };
  }

  if (canRunQwen) {
    return {
      provider: "local-qwen3-tts",
      reason: "Machine does not meet the VoxCPM2 minimum, but can use the low-footprint Qwen3-TTS 0.6B local fallback.",
      candidates
    };
  }

  if (detected.platform === "darwin" && detected.arch !== "arm64") {
    return {
      provider: "cloud-api",
      reason: "Intel Mac is not recommended for the local TTS path. Use a cloud API provider.",
      candidates
    };
  }

  if (!isMacAppleSilicon && !nvidia) {
    return {
      provider: "cloud-api",
      reason: "No supported Apple Silicon or NVIDIA accelerator was detected. Use a cloud API provider.",
      candidates
    };
  }

  return {
    provider: "cloud-api",
    reason: "Detected hardware is below the minimum for both local TTS options. Use a cloud API provider.",
    candidates
  };
}

function renderText(result) {
  const detected = result.detected;
  const gpuText = detected.gpus.length
    ? detected.gpus.map((gpu) => `${gpu.name}${gpu.vram_gb ? ` (${gpu.vram_gb} GB VRAM)` : ""}`).join("; ")
    : "none detected";
  return [
    `Platform: ${detected.platform}/${detected.arch}`,
    `RAM: ${detected.ram_gb} GB`,
    `CPU: ${detected.cpu || "unknown"}`,
    `Mac chip: ${detected.mac?.chip || "n/a"}`,
    `GPU: ${gpuText}`,
    `Recommendation: ${result.recommendation.provider}`,
    `Reason: ${result.recommendation.reason}`
  ].join("\n");
}

const detected = detectHardware();
const recommendation = evaluate(detected);
const result = {
  schema_version: "1.0",
  detected,
  recommendation,
  minimums,
  if_recommendation_is_cloud_api: "Do not install local TTS by default. Ask the user for an API provider/key or use an already configured cloud provider."
};

if (process.argv.includes("--text")) {
  console.log(renderText(result));
} else {
  console.log(JSON.stringify(result, null, 2));
}
