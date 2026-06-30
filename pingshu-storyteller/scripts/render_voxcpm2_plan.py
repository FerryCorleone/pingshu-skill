#!/usr/bin/env python3
"""Render a pingshu performance_plan.json with local VoxCPM2.

This script is intentionally optional: the core skill stays provider-neutral,
while hosts that install VoxCPM2 can turn the plan into real audio.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from voxcpm import VoxCPM


DEFAULT_CONTROL = (
    "浑厚清晰的中文男声，普通话为主，轻微北方说书口吻，"
    "语速中等，带一点笑意，但不要夸张"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render pingshu-storyteller performance_plan.json with VoxCPM2."
    )
    parser.add_argument("performance_plan", help="Path to performance_plan.json")
    parser.add_argument("output_dir", help="Directory for segments and final audio")
    parser.add_argument("--model", default="openbmb/VoxCPM2", help="HF model id or local model directory")
    parser.add_argument("--cache-dir", default=".cache/huggingface", help="Hugging Face cache directory")
    parser.add_argument("--device", default="auto", help="Runtime device: auto, cpu, mps, cuda, cuda:0")
    parser.add_argument("--control", default=DEFAULT_CONTROL, help="Short VoxCPM2 voice-control instruction")
    parser.add_argument("--cfg-value", type=float, default=2.0, help="CFG guidance scale, recommended 1.0-3.0")
    parser.add_argument("--inference-timesteps", type=int, default=10, help="Inference steps, recommended 4-30")
    parser.add_argument("--normalize", action="store_true", help="Enable VoxCPM text normalization")
    parser.add_argument("--local-files-only", action="store_true", help="Use only cached model files")
    parser.add_argument("--load-denoiser", action="store_true", help="Load ZipEnhancer denoiser")
    parser.add_argument("--reference-wav", help="Optional consented VoxCPM2 reference audio")
    parser.add_argument("--prompt-wav", help="Optional prompt audio for continuation mode")
    parser.add_argument("--prompt-text", help="Text corresponding to --prompt-wav")
    parser.add_argument("--skip-existing", action="store_true", help="Reuse existing per-segment WAV files")
    parser.add_argument("--max-segments", type=int, default=0, help="Render only the first N segments")
    parser.add_argument("--final-name", default="final_voxcpm2", help="Base name for final audio files")
    parser.add_argument("--no-m4a", action="store_true", help="Do not create AAC .m4a with ffmpeg")
    return parser.parse_args()


def load_plan(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        plan = json.load(handle)
    segments = plan.get("segments")
    if not isinstance(segments, list) or not segments:
        raise ValueError("performance_plan.json must include a non-empty segments array")
    return plan


def validate_prompt_args(args: argparse.Namespace) -> None:
    if bool(args.prompt_wav) != bool(args.prompt_text):
        raise ValueError("--prompt-wav and --prompt-text must be provided together")
    for label, value in [("reference", args.reference_wav), ("prompt", args.prompt_wav)]:
        if value and not Path(value).exists():
            raise FileNotFoundError(f"{label} wav does not exist: {value}")


def with_control(text: str, control: str) -> str:
    text = " ".join(text.split())
    control = control.strip()
    return f"({control}){text}" if control else text


def audio_stats(audio: np.ndarray, sample_rate: int) -> dict:
    audio = np.asarray(audio, dtype=np.float32)
    return {
        "duration_sec": round(float(len(audio) / sample_rate), 3),
        "rms": round(float(np.sqrt(np.mean(np.square(audio)))), 6) if len(audio) else 0.0,
        "peak": round(float(np.max(np.abs(audio))), 6) if len(audio) else 0.0,
    }


def encode_m4a(wav_path: Path, m4a_path: Path) -> bool:
    if not shutil.which("ffmpeg"):
        return False
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(wav_path),
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            str(m4a_path),
        ],
        check=True,
    )
    return True


def main() -> int:
    args = parse_args()
    validate_prompt_args(args)

    plan_path = Path(args.performance_plan).resolve()
    output_dir = Path(args.output_dir).resolve()
    segment_dir = output_dir / "segments"
    output_dir.mkdir(parents=True, exist_ok=True)
    segment_dir.mkdir(parents=True, exist_ok=True)

    plan = load_plan(plan_path)
    segments = plan["segments"]
    if args.max_segments > 0:
        segments = segments[: args.max_segments]

    print("Loading VoxCPM2...", file=sys.stderr)
    model = VoxCPM.from_pretrained(
        hf_model_id=args.model,
        load_denoiser=args.load_denoiser,
        cache_dir=str(Path(args.cache_dir).resolve()),
        local_files_only=args.local_files_only,
        optimize=False,
        device=args.device,
    )
    sample_rate = model.tts_model.sample_rate

    chunks: list[np.ndarray] = []
    manifest_segments = []

    for index, segment in enumerate(segments, start=1):
        segment_id = segment.get("id") or f"seg-{index:03d}"
        text = str(segment.get("text") or "").strip()
        if not text:
            raise ValueError(f"Segment {segment_id} has empty text")

        safe_id = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in segment_id)
        segment_path = segment_dir / f"{index:03d}-{safe_id}.wav"

        if args.skip_existing and segment_path.exists():
            audio, sr = sf.read(segment_path, dtype="float32")
            if sr != sample_rate:
                raise ValueError(f"{segment_path} sample rate {sr} does not match model {sample_rate}")
            audio = np.asarray(audio, dtype=np.float32).reshape(-1)
            print(f"Reused {segment_path}", file=sys.stderr)
        else:
            final_text = with_control(text, args.control)
            print(f"Rendering {index}/{len(segments)} {segment_id}: {text[:38]}", file=sys.stderr)
            audio = model.generate(
                text=final_text,
                prompt_wav_path=args.prompt_wav,
                prompt_text=args.prompt_text,
                reference_wav_path=args.reference_wav,
                cfg_value=args.cfg_value,
                inference_timesteps=args.inference_timesteps,
                normalize=args.normalize,
                denoise=args.load_denoiser and bool(args.reference_wav or args.prompt_wav),
            )
            audio = np.asarray(audio, dtype=np.float32).reshape(-1)
            sf.write(segment_path, audio, sample_rate, subtype="PCM_16")

        stats = audio_stats(audio, sample_rate)
        pause_ms = int(segment.get("pause_after_ms") or 0)
        inserted_pause_ms = pause_ms if index < len(segments) else 0

        chunks.append(audio)
        if inserted_pause_ms > 0:
            chunks.append(np.zeros(int(sample_rate * inserted_pause_ms / 1000), dtype=np.float32))

        manifest_segments.append(
            {
                "id": segment_id,
                "text": text,
                "output_file": str(segment_path),
                "pause_after_ms": inserted_pause_ms,
                **stats,
            }
        )

    final_audio = np.concatenate(chunks) if chunks else np.array([], dtype=np.float32)
    final_wav = output_dir / f"{args.final_name}.wav"
    final_m4a = output_dir / f"{args.final_name}.m4a"
    sf.write(final_wav, final_audio, sample_rate, subtype="PCM_16")

    m4a_created = False
    if not args.no_m4a:
        m4a_created = encode_m4a(final_wav, final_m4a)

    manifest = {
        "schema_version": "1.0",
        "provider": "local-voxcpm2",
        "model": args.model,
        "plan_path": str(plan_path),
        "title": plan.get("title"),
        "sample_rate": sample_rate,
        "device": args.device,
        "control": args.control,
        "final_wav": str(final_wav),
        "final_m4a": str(final_m4a) if m4a_created else None,
        "final_stats": audio_stats(final_audio, sample_rate),
        "segments": manifest_segments,
        "notes": [
            "Generated with an original voice-control prompt, not a real performer clone.",
            "SFX/music bed from performance_plan.json is not mixed by this script.",
        ],
    }
    manifest_path = output_dir / "voxcpm2_render_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
