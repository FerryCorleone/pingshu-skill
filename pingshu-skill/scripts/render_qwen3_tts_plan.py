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
DEFAULT_VOICE_ID = "pingshu_default_storyteller_c06"
DEFAULT_REF_TEXT = (
    "列位，闲言少叙，书归正传。今儿咱讲一段新鲜故事，有人物，有包袱，"
    "也有那么一点北方说书的劲儿。您把耳朵支棱起来，咱慢慢往下说。"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render pingshu-skill performance_plan.json with local Qwen3-TTS."
    )
    parser.add_argument("performance_plan", help="Path to performance_plan.json")
    parser.add_argument("output_dir", help="Directory for segments and final audio")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="HF model id or local model directory")
    parser.add_argument("--cache-dir", default=".cache/huggingface", help="Hugging Face cache directory")
    parser.add_argument("--device", default="auto", help="auto, mps, cpu, cuda, cuda:0")
    parser.add_argument("--dtype", default="float32", choices=["float32", "bfloat16", "float16"])
    parser.add_argument("--reference-wav", help="Original/licensed reference wav for Base voice clone")
    parser.add_argument("--reference-text", help="Transcript of --reference-wav")
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


def skill_root() -> Path:
    return Path(__file__).resolve().parents[1]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_voice_manifest_path() -> Path:
    return skill_root() / "assets" / "voice" / "manifest.json"


def resolve_local_path(value: str | None) -> Path | None:
    if not value:
        return None
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    candidates = [
        Path.cwd() / path,
        skill_root() / path,
        repo_root() / path,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    return (Path.cwd() / path).resolve()


def default_voice_asset() -> dict:
    manifest_path = default_voice_manifest_path()
    if not manifest_path.exists():
        return {
            "id": DEFAULT_VOICE_ID,
            "path": skill_root() / "assets" / "voice" / "default_storyteller_c06.wav",
            "reference_text": DEFAULT_REF_TEXT,
            "source": "built_in_default",
        }
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = manifest.get("assets") if isinstance(manifest.get("assets"), list) else []
    default_id = manifest.get("default_voice_id") or DEFAULT_VOICE_ID
    asset = next((item for item in assets if item.get("id") == default_id), assets[0] if assets else {})
    return {
        "id": asset.get("id") or default_id,
        "path": (manifest_path.parent / str(asset.get("file") or "default_storyteller_c06.wav")).resolve(),
        "reference_text": asset.get("reference_text") or DEFAULT_REF_TEXT,
        "manifest": str(manifest_path),
        "source": "built_in_manifest",
    }


def plan_reference_voice(plan: dict) -> dict:
    plan_voice = plan.get("voice") if isinstance(plan.get("voice"), dict) else {}
    ref = plan_voice.get("reference_voice") if isinstance(plan_voice.get("reference_voice"), dict) else {}
    raw_path = ref.get("path_or_id")
    resolved = resolve_local_path(raw_path)
    if resolved and resolved.exists():
        return {
            "id": ref.get("id") or DEFAULT_VOICE_ID,
            "path": resolved,
            "reference_text": ref.get("reference_text") or DEFAULT_REF_TEXT,
            "manifest": ref.get("manifest"),
            "source": "performance_plan",
        }
    return default_voice_asset()


def resolve_reference_voice(args: argparse.Namespace, plan: dict) -> dict:
    if args.reference_wav:
        resolved = resolve_local_path(args.reference_wav)
        if not resolved or not resolved.exists():
            raise FileNotFoundError(f"reference wav does not exist: {args.reference_wav}")
        if not args.reference_text:
            raise ValueError(
                "--reference-text is required when --reference-wav points to a custom voice. "
                "Omit --reference-wav to use the bundled default storyteller voice."
            )
        return {
            "id": "user_reference_voice",
            "path": resolved,
            "reference_text": args.reference_text,
            "source": "cli",
        }

    default_ref = plan_reference_voice(plan)
    if not default_ref["path"].exists():
        raise FileNotFoundError(f"default reference wav does not exist: {default_ref['path']}")
    print(
        f"Info: using default storyteller reference voice: {default_ref['path']}",
        file=sys.stderr,
    )
    return default_ref


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

    os.environ.setdefault("HF_HOME", str(Path(args.cache_dir).resolve()))

    plan = load_plan(plan_path)
    reference = resolve_reference_voice(args, plan)
    ref_wav = reference["path"]
    reference_text = args.reference_text or reference.get("reference_text") or DEFAULT_REF_TEXT
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
        ref_text=reference_text,
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
        "default_reference_voice": {
            "id": reference.get("id"),
            "path": str(reference.get("path")),
            "manifest": reference.get("manifest"),
            "source": reference.get("source"),
        } if reference.get("source") != "cli" else None,
        "reference_wav": str(ref_wav),
        "reference_text": reference_text,
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
