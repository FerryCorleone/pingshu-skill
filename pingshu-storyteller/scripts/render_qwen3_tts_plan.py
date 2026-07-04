#!/usr/bin/env python3
"""Render a pingshu performance_plan.json with local Qwen3-TTS."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import torch

from local_tts_rendering import (
    audio_stats,
    audio_to_mono_float32,
    append_sfx_after,
    build_render_items,
    encode_m4a,
    load_plan,
    pause_after_sfx_ms,
    pause_audio,
    safe_id,
    write_wav,
)


DEFAULT_MODEL = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
DEFAULT_REF_TEXT = (
    "列位，今儿咱慢慢说。肯德基门口这只箱子，装的是金条，也是信任。"
    "您把耳朵支棱起来，后头这一下，有意思。"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render pingshu-storyteller performance_plan.json with local Qwen3-TTS."
    )
    parser.add_argument("performance_plan", help="Path to performance_plan.json")
    parser.add_argument("output_dir", help="Directory for segments and final audio")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="HF model id or local model directory")
    parser.add_argument("--cache-dir", default=".cache/huggingface", help="Hugging Face cache directory")
    parser.add_argument("--device", default="auto", help="auto, mps, cpu, cuda, cuda:0")
    parser.add_argument("--dtype", default="float32", choices=["float32", "bfloat16", "float16"])
    parser.add_argument("--reference-wav", required=True, help="Original/licensed reference wav for Base voice clone")
    parser.add_argument("--reference-text", default=DEFAULT_REF_TEXT, help="Transcript of --reference-wav")
    parser.add_argument("--language", default="Auto", help="Qwen3-TTS language label")
    parser.add_argument("--x-vector-only-mode", action="store_true", help="Use speaker embedding only; lower clone fidelity")
    parser.add_argument("--non-streaming-mode", action="store_true", help="Use Qwen3-TTS non_streaming_mode=True")
    parser.add_argument("--temperature", type=float, default=0.85)
    parser.add_argument("--top-p", type=float, default=0.95)
    parser.add_argument("--top-k", type=int, default=50)
    parser.add_argument("--repetition-penalty", type=float, default=1.05)
    parser.add_argument("--max-new-tokens", type=int, default=2048)
    parser.add_argument("--max-segments", type=int, default=0, help="Render only the first N say segments")
    parser.add_argument("--skip-existing", action="store_true", help="Reuse existing per-segment WAV files")
    parser.add_argument("--final-name", default="final_qwen3_tts", help="Base name for final audio")
    parser.add_argument("--sfx-gain-db", type=float, default=-6.0, help="Gain applied to post-processed SFX assets")
    parser.add_argument("--no-m4a", action="store_true")
    return parser.parse_args()


def torch_dtype(name: str) -> torch.dtype:
    return {
        "float32": torch.float32,
        "bfloat16": torch.bfloat16,
        "float16": torch.float16,
    }[name]


def resolve_device(value: str) -> str:
    if value != "auto":
        return value
    if torch.cuda.is_available():
        return "cuda:0"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_qwen_model(model_id: str, device: str, dtype: torch.dtype):
    from qwen_tts import Qwen3TTSModel

    try:
        return Qwen3TTSModel.from_pretrained(model_id, device_map=device, dtype=dtype), device
    except Exception as exc:
        if device == "cpu":
            raise
        print(f"Warning: failed to load Qwen3-TTS on {device}: {type(exc).__name__}: {exc}", file=sys.stderr)
        print("Retrying Qwen3-TTS on cpu.", file=sys.stderr)
        return Qwen3TTSModel.from_pretrained(model_id, device_map="cpu", dtype=torch.float32), "cpu"


def main() -> int:
    args = parse_args()
    plan_path = Path(args.performance_plan).resolve()
    output_dir = Path(args.output_dir).resolve()
    segment_dir = output_dir / "segments"
    output_dir.mkdir(parents=True, exist_ok=True)
    segment_dir.mkdir(parents=True, exist_ok=True)

    ref_wav = Path(args.reference_wav).resolve()
    if not ref_wav.exists():
        raise FileNotFoundError(f"reference wav does not exist: {ref_wav}")

    os.environ.setdefault("HF_HOME", str(Path(args.cache_dir).resolve()))

    plan = load_plan(plan_path)
    render_items = build_render_items(plan["segments"])
    say_item_count = sum(1 for item in render_items if item["kind"] == "say")
    if args.max_segments > 0:
        limited = []
        say_seen = 0
        for item in render_items:
            if item["kind"] == "say":
                say_seen += 1
            if say_seen > args.max_segments:
                break
            limited.append(item)
        render_items = limited
        say_item_count = min(say_item_count, args.max_segments)

    device = resolve_device(args.device)
    print(f"Loading Qwen3-TTS {args.model} on {device}...", file=sys.stderr)
    tts, loaded_device = load_qwen_model(args.model, device, torch_dtype(args.dtype))
    print("Creating Qwen3-TTS voice clone prompt...", file=sys.stderr)
    voice_prompt = tts.create_voice_clone_prompt(
        ref_audio=str(ref_wav),
        ref_text=args.reference_text,
        x_vector_only_mode=args.x_vector_only_mode,
    )

    chunks: list[np.ndarray] = []
    manifest_segments = []
    sample_rate = 0
    say_index = 0
    gen_kwargs = {
        "temperature": args.temperature,
        "top_p": args.top_p,
        "top_k": args.top_k,
        "repetition_penalty": args.repetition_penalty,
        "max_new_tokens": args.max_new_tokens,
    }

    for item_index, item in enumerate(render_items, start=1):
        item_id = item.get("id") or f"item-{item_index:03d}"
        if item["kind"] == "pause":
            if sample_rate <= 0:
                continue
            duration_ms = int(item.get("duration_ms") or 0)
            chunks.append(pause_audio(sample_rate, duration_ms))
            sfx_after = append_sfx_after(chunks, item, sample_rate, gain_db=args.sfx_gain_db)
            manifest_segments.append(
                {
                    "id": item_id,
                    "kind": "pause",
                    "duration_ms": duration_ms,
                    "reason": item.get("reason"),
                    "parent_segment_id": item.get("parent_segment_id"),
                    "sfx_after": sfx_after,
                }
            )
            continue

        say_index += 1
        text = str(item.get("text") or "").strip()
        if not text:
            raise ValueError(f"Segment {item_id} has empty text")

        segment_path = segment_dir / f"{say_index:03d}-{safe_id(item_id)}.wav"
        if args.skip_existing and segment_path.exists():
            import soundfile as sf

            audio, sample_rate = sf.read(segment_path, dtype="float32")
            audio = audio_to_mono_float32(audio)
            print(f"Reused {segment_path}", file=sys.stderr)
        else:
            print(f"Rendering {say_index}/{say_item_count} {item_id}: {text[:38]}", file=sys.stderr)
            wavs, sample_rate = tts.generate_voice_clone(
                text=text,
                language=args.language,
                voice_clone_prompt=voice_prompt,
                non_streaming_mode=args.non_streaming_mode,
                **gen_kwargs,
            )
            audio = audio_to_mono_float32(wavs[0])
            write_wav(segment_path, audio, sample_rate)

        chunks.append(audio)
        sfx_after = append_sfx_after(chunks, item, sample_rate, gain_db=args.sfx_gain_db)
        next_item = render_items[item_index] if item_index < len(render_items) else None
        pause_ms = pause_after_sfx_ms(
            item,
            int(item.get("pause_after_ms") or 0),
            item_index < len(render_items),
            next_item,
        )
        if pause_ms > 0:
            chunks.append(pause_audio(sample_rate, pause_ms))

        manifest_segments.append(
            {
                "id": item_id,
                "kind": "say",
                "text": text,
                "output_file": str(segment_path),
                "pause_after_ms": pause_ms,
                "parent_segment_id": item.get("parent_segment_id"),
                "pace": item.get("pace"),
                "emotion": item.get("emotion"),
                "sfx_after": sfx_after,
                **audio_stats(audio, sample_rate),
            }
        )

    final_audio = np.concatenate(chunks) if chunks else np.array([], dtype=np.float32)
    final_wav = output_dir / f"{args.final_name}.wav"
    final_m4a = output_dir / f"{args.final_name}.m4a"
    write_wav(final_wav, final_audio, sample_rate)
    m4a_created = False if args.no_m4a else encode_m4a(final_wav, final_m4a)

    manifest = {
        "schema_version": "1.0",
        "provider": "local-qwen3-tts",
        "model": args.model,
        "plan_path": str(plan_path),
        "title": plan.get("title"),
        "device": loaded_device,
        "dtype": args.dtype,
        "sample_rate": sample_rate,
        "reference_wav": str(ref_wav),
        "reference_text": args.reference_text,
        "x_vector_only_mode": args.x_vector_only_mode,
        "language": args.language,
        "generation": gen_kwargs,
        "sfx_gain_db": args.sfx_gain_db,
        "final_wav": str(final_wav),
        "final_m4a": str(final_m4a) if m4a_created else None,
        "final_stats": audio_stats(final_audio, sample_rate),
        "segments": manifest_segments,
    }
    manifest_path = output_dir / "qwen3_tts_render_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
