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
import tempfile
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
    parser.add_argument("--segment-performance", action="store_true", help="Append each segment's pace, emotion, and emphasis to the VoxCPM2 control text")
    parser.add_argument("--pace-tempo", action="store_true", help="Post-process each segment with a light tempo multiplier based on pace")
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


def segment_control(base_control: str, segment: dict, enabled: bool) -> str:
    if not enabled:
        return base_control

    pace = str(segment.get("pace") or "").strip()
    emotion = str(segment.get("emotion") or "").strip()
    emphasis = segment.get("emphasis") if isinstance(segment.get("emphasis"), list) else []

    pace_notes = {
        "slow": "本段慢起，留足停顿，像压住包袱。",
        "medium_slow": "本段中慢，句尾收住，重点处停一下。",
        "medium": "本段中速，清楚利落，不拖腔。",
        "quick": "本段稍快，像抖包袱，转折处要脆。",
    }
    emotion_notes = {
        "sharp_hook": "开头要抓人，有一点挑眉的劲儿。",
        "dry_trigger": "语气干脆，像把事儿摊开给听众看。",
        "rising_conflict": "冲突逐步抬高，别一开始就喊满。",
        "surprised_turn": "转折处先压一下，再突然亮出来。",
        "payoff": "包袱落点要清楚，带一点笑。",
        "aftertaste": "收尾稳一点，有回味。",
        "suspense": "稍微压低，留悬念。",
        "aside": "像跟听众耳语打趣。",
    }

    notes = []
    if pace in pace_notes:
        notes.append(pace_notes[pace])
    notes.append(emotion_notes.get(emotion, f"情绪：{emotion}。" if emotion else ""))
    if emphasis:
        notes.append("重音放在：" + "、".join(str(item) for item in emphasis[:3]) + "。")

    joined_notes = "".join(note for note in notes if note)
    if not joined_notes:
        return base_control
    return f"{base_control} {joined_notes}".strip()


def pace_tempo(segment: dict, enabled: bool) -> float:
    if not enabled:
        return 1.0
    if isinstance(segment.get("tempo"), (int, float)):
        return float(segment["tempo"])
    return {
        "slow": 0.94,
        "medium_slow": 0.97,
        "medium": 1.0,
        "quick": 1.08,
    }.get(str(segment.get("pace") or ""), 1.0)


def apply_tempo(audio: np.ndarray, sample_rate: int, tempo: float, work_dir: Path, stem: str) -> np.ndarray:
    if abs(tempo - 1.0) < 0.001:
        return audio
    if not shutil.which("ffmpeg"):
        print("Warning: ffmpeg not found; skipping pace tempo post-process", file=sys.stderr)
        return audio

    tempo = max(0.5, min(2.0, tempo))
    input_path = work_dir / f"{stem}-tempo-in.wav"
    output_path = work_dir / f"{stem}-tempo-out.wav"
    sf.write(input_path, audio, sample_rate, subtype="PCM_16")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(input_path),
            "-filter:a",
            f"atempo={tempo:.5f}",
            str(output_path),
        ],
        check=True,
    )
    processed, processed_sr = sf.read(output_path, dtype="float32")
    if processed_sr != sample_rate:
        raise ValueError(f"Tempo output sample rate {processed_sr} does not match {sample_rate}")
    return np.asarray(processed, dtype=np.float32).reshape(-1)


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

    with tempfile.TemporaryDirectory(prefix="voxcpm2-render-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        for index, segment in enumerate(segments, start=1):
            segment_id = segment.get("id") or f"seg-{index:03d}"
            text = str(segment.get("text") or "").strip()
            if not text:
                raise ValueError(f"Segment {segment_id} has empty text")

            safe_id = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in segment_id)
            segment_path = segment_dir / f"{index:03d}-{safe_id}.wav"
            segment_tempo = pace_tempo(segment, args.pace_tempo)
            control_text = segment_control(args.control, segment, args.segment_performance)

            if args.skip_existing and segment_path.exists():
                audio, sr = sf.read(segment_path, dtype="float32")
                if sr != sample_rate:
                    raise ValueError(f"{segment_path} sample rate {sr} does not match model {sample_rate}")
                audio = np.asarray(audio, dtype=np.float32).reshape(-1)
                print(f"Reused {segment_path}", file=sys.stderr)
            else:
                final_text = with_control(text, control_text)
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
                audio = apply_tempo(audio, sample_rate, segment_tempo, temp_dir, f"{index:03d}-{safe_id}")
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
                    "pace": segment.get("pace"),
                    "emotion": segment.get("emotion"),
                    "tempo": round(segment_tempo, 3),
                    "control": control_text if args.segment_performance else args.control,
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
