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

VOICE_LOCK_CONTROL = (
    "全程保持同一个单人说书者音色；不要给不同角色切换成不同声音、年龄或性别；"
    "角色区别只用语气、轻重音、停顿和节奏表现。"
)

SFX_ALIASES = {
    "waking_block_soft": "waking_block",
    "waking_block_firm": "waking_block",
    "waking_block_light": "waking_block",
    "waking_block_medium": "waking_block",
    "waking_block_close": "waking_block",
}

DEFAULT_VOICE_ID = "pingshu_default_storyteller_c06"
DEFAULT_REFERENCE_TEXT = (
    "列位，闲言少叙，书归正传。今儿咱讲一段新鲜故事，有人物，有包袱，"
    "也有那么一点北方说书的劲儿。您把耳朵支棱起来，咱慢慢往下说。"
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
    parser.add_argument("--segment-performance", action="store_true", help="Append stable prosody notes for each segment without changing voice identity")
    parser.add_argument("--pace-tempo", action="store_true", help="Post-process each segment with a light tempo multiplier based on pace")
    parser.add_argument("--single-pass", action="store_true", help="Render all segments in one generation call to maximize timbre consistency for short scripts")
    parser.add_argument("--no-voice-lock", dest="voice_lock", action="store_false", help="Disable the default single-performer timbre lock")
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
    parser.add_argument("--sfx-gain-db", type=float, default=-6.0, help="Gain applied to post-processed SFX assets")
    parser.add_argument("--no-m4a", action="store_true", help="Do not create AAC .m4a with ffmpeg")
    parser.set_defaults(voice_lock=True)
    return parser.parse_args()


def load_plan(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        plan = json.load(handle)
    segments = plan.get("segments")
    if not isinstance(segments, list) or not segments:
        raise ValueError("performance_plan.json must include a non-empty segments array")
    return plan


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
            "reference_text": DEFAULT_REFERENCE_TEXT,
            "source": "built_in_default",
        }
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = manifest.get("assets") if isinstance(manifest.get("assets"), list) else []
    default_id = manifest.get("default_voice_id") or DEFAULT_VOICE_ID
    asset = next((item for item in assets if item.get("id") == default_id), assets[0] if assets else {})
    return {
        "id": asset.get("id") or default_id,
        "path": (manifest_path.parent / str(asset.get("file") or "default_storyteller_c06.wav")).resolve(),
        "reference_text": asset.get("reference_text") or DEFAULT_REFERENCE_TEXT,
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
            "reference_text": ref.get("reference_text") or DEFAULT_REFERENCE_TEXT,
            "manifest": ref.get("manifest"),
            "source": "performance_plan",
        }
    return default_voice_asset()


def apply_default_voice_args(args: argparse.Namespace, plan: dict) -> dict | None:
    default_ref = plan_reference_voice(plan)

    used_default = False
    if not args.reference_wav and default_ref["path"].exists():
        args.reference_wav = str(default_ref["path"])
        used_default = True
    if not args.prompt_wav and not args.prompt_text and default_ref["path"].exists():
        args.prompt_wav = str(default_ref["path"])
        args.prompt_text = str(default_ref.get("reference_text") or DEFAULT_REFERENCE_TEXT)
        used_default = True
    elif args.prompt_wav and not args.prompt_text:
        prompt_path = resolve_local_path(args.prompt_wav)
        if prompt_path and prompt_path.resolve() == default_ref["path"].resolve():
            args.prompt_text = str(default_ref.get("reference_text") or DEFAULT_REFERENCE_TEXT)
            used_default = True

    if used_default:
        print(
            f"Info: using default storyteller reference voice: {default_ref['path']}",
            file=sys.stderr,
        )
        return default_ref
    return None


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


def should_prepend_control(args: argparse.Namespace, control: str) -> bool:
    """VoxCPM2 prompt continuation treats prompt_text as real text context.

    When prompt_text/prompt_wav are used, prepending parenthesized control text can
    be synthesized aloud as part of the target utterance. Keep those controls in
    the manifest, but do not add them to the spoken text.
    """
    return bool(control.strip()) and not bool(args.prompt_text)


def voice_locked_control(base_control: str, enabled: bool) -> str:
    base_control = " ".join(base_control.split())
    if not enabled:
        return base_control
    if VOICE_LOCK_CONTROL in base_control:
        return base_control
    return f"{base_control} {VOICE_LOCK_CONTROL}".strip()


def segment_control(base_control: str, segment: dict, enabled: bool) -> str:
    if not enabled:
        return base_control

    pace = str(segment.get("pace") or "").strip()
    emotion = str(segment.get("emotion") or "").strip()
    emphasis = segment.get("emphasis") if isinstance(segment.get("emphasis"), list) else []

    pace_notes = {
        "slow": "本段慢起，留足停顿，压住包袱。",
        "medium_slow": "本段中慢，句尾收住，重点处停一下。",
        "medium": "本段中速，清楚利落，不拖腔。",
        "quick": "本段稍快，短句连起来，转折处要脆。",
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


def pause_marker(milliseconds: int) -> str:
    """Best-effort separator for single-pass audition text.

    Final pingshu renders should prefer event-level pause items, which become real
    silence. Do not encode long pauses as ellipses here: VoxCPM2 may synthesize
    them as filler syllables such as "啊", and doubled punctuation can flatten the
    planned rhythm.
    """
    if milliseconds >= 750:
        return "\n\n"
    if milliseconds > 0:
        return "\n"
    return "\n"


def build_single_pass_segment(segments: list[dict]) -> dict:
    parts = []
    source_ids = []
    for segment in segments:
        if isinstance(segment.get("events"), list):
            event_parts = []
            for event in segment["events"]:
                if str(event.get("type") or "say") == "pause":
                    event_parts.append(pause_marker(int(event.get("ms") or event.get("duration_ms") or 0)))
                else:
                    event_parts.append(str(event.get("text") or "").strip())
            text = "".join(event_parts).strip()
        else:
            text = str(segment.get("text") or "").strip()
        if not text:
            continue
        source_ids.append(segment.get("id"))
        pause_ms = int(segment.get("pause_after_ms") or 0)
        parts.append(text + pause_marker(pause_ms))
    combined_text = "".join(parts).strip()
    return {
        "id": "single-pass",
        "text": combined_text,
        "pace": "mixed",
        "emotion": "single_performer_storytelling",
        "pause_after_ms": 0,
        "source_segment_ids": source_ids,
    }


def build_render_items(segments: list[dict]) -> list[dict]:
    items: list[dict] = []
    for segment_index, segment in enumerate(segments, start=1):
        segment_id = segment.get("id") or f"seg-{segment_index:03d}"
        base = {
            "parent_segment_id": segment_id,
            "pace": segment.get("pace"),
            "emotion": segment.get("emotion"),
            "tempo": segment.get("tempo"),
            "emphasis": segment.get("emphasis"),
            "sfx_after": segment.get("sfx_after"),
            "source_segment_ids": segment.get("source_segment_ids"),
        }
        events = segment.get("events")
        if not isinstance(events, list):
            items.append(
                {
                    **base,
                    "kind": "say",
                    "id": segment_id,
                    "text": str(segment.get("text") or "").strip(),
                    "pause_after_ms": int(segment.get("pause_after_ms") or 0),
                }
            )
            continue

        event_items: list[dict] = []
        for event_index, event in enumerate(events, start=1):
            event_type = str(event.get("type") or "say").strip()
            event_id = event.get("id") or f"{segment_id}-ev-{event_index:02d}"
            if event_type in ("say", "utterance"):
                text = str(event.get("text") or "").strip()
                if not text:
                    continue
                event_items.append(
                    {
                        **base,
                        "kind": "say",
                        "id": event_id,
                        "text": text,
                        "pace": event.get("pace", base["pace"]),
                        "emotion": event.get("emotion", base["emotion"]),
                        "tempo": event.get("tempo", base["tempo"]),
                        "emphasis": event.get("emphasis", base["emphasis"]),
                        "sfx_after": event.get("sfx_after"),
                        "pause_after_ms": int(event.get("pause_after_ms") or 0),
                    }
                )
            elif event_type in ("pause", "silence"):
                milliseconds = int(event.get("ms") or event.get("duration_ms") or 0)
                if milliseconds <= 0:
                    continue
                event_items.append(
                    {
                        **base,
                        "kind": "pause",
                        "id": event_id,
                        "duration_ms": milliseconds,
                        "reason": event.get("reason"),
                        "sfx_after": event.get("sfx_after"),
                    }
                )
            else:
                raise ValueError(f"Unsupported performance event type in {segment_id}: {event_type}")

        segment_sfx_after = normalize_sfx_ids(base.get("sfx_after"))
        if segment_sfx_after:
            for item in reversed(event_items):
                if item.get("kind") == "say":
                    item["sfx_after"] = normalize_sfx_ids(item.get("sfx_after")) + segment_sfx_after
                    break
        items.extend(event_items)

        trailing_pause = int(segment.get("pause_after_ms") or 0)
        if trailing_pause > 0:
            items.append(
                {
                    **base,
                    "kind": "pause",
                    "id": f"{segment_id}-trailing-pause",
                    "duration_ms": trailing_pause,
                    "reason": "segment_pause_after_ms",
                    "sfx_after": None,
                }
            )
    return items


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


def normalize_sfx_ids(value) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    for raw in value:
        sfx_id = str(raw or "").strip()
        if not sfx_id:
            continue
        normalized.append(SFX_ALIASES.get(sfx_id, sfx_id))
    return normalized


def default_sfx_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "assets" / "sfx"


def resample_linear(audio: np.ndarray, source_rate: int, target_rate: int) -> np.ndarray:
    if source_rate == target_rate:
        return audio
    if audio.size == 0:
        return audio
    duration = audio.size / float(source_rate)
    target_size = max(1, int(round(duration * target_rate)))
    source_x = np.linspace(0.0, duration, num=audio.size, endpoint=False)
    target_x = np.linspace(0.0, duration, num=target_size, endpoint=False)
    return np.interp(target_x, source_x, audio).astype(np.float32)


def audio_to_mono_float32(audio) -> np.ndarray:
    arr = np.asarray(audio, dtype=np.float32)
    if arr.ndim == 2:
        if arr.shape[0] == 1:
            arr = arr[0]
        elif arr.shape[1] == 1:
            arr = arr[:, 0]
        else:
            arr = np.mean(arr, axis=-1)
    if arr.ndim != 1:
        arr = arr.reshape(-1)
    return np.clip(arr, -1.0, 1.0).astype(np.float32)


def load_sfx_audio(sfx_id: str, sample_rate: int, gain_db: float = -6.0) -> tuple[np.ndarray, dict]:
    resolved_id = SFX_ALIASES.get(sfx_id, sfx_id)
    asset_path = default_sfx_dir() / f"{resolved_id}.wav"
    if not asset_path.exists():
        raise FileNotFoundError(f"SFX asset not found for {sfx_id}: {asset_path}")
    audio, asset_rate = sf.read(asset_path, dtype="float32")
    audio = audio_to_mono_float32(audio)
    audio = resample_linear(audio, asset_rate, sample_rate)
    audio = np.clip(audio * (10 ** (gain_db / 20.0)), -1.0, 1.0).astype(np.float32)
    return audio, {
        "id": resolved_id,
        "source_id": sfx_id,
        "asset_file": str(asset_path),
        "gain_db": gain_db,
        **audio_stats(audio, sample_rate),
    }


def append_sfx_after(chunks: list[np.ndarray], item: dict, sample_rate: int, gain_db: float) -> list[dict]:
    records: list[dict] = []
    for sfx_id in normalize_sfx_ids(item.get("sfx_after")):
        audio, record = load_sfx_audio(sfx_id, sample_rate, gain_db=gain_db)
        chunks.append(audio)
        records.append(record)
    return records


def pause_after_sfx_ms(
    item: dict,
    planned_ms: int,
    has_later_item: bool,
    next_item: dict | None = None,
    default_ms: int = 420,
    minimum_ms: int = 320,
    maximum_ms: int = 650,
) -> int:
    if not has_later_item:
        return 0
    if not normalize_sfx_ids(item.get("sfx_after")):
        return max(planned_ms, 0)
    if next_item and next_item.get("kind") == "pause":
        return 0
    if planned_ms <= 0:
        return default_ms
    return min(max(planned_ms, minimum_ms), maximum_ms)


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

    plan_path = Path(args.performance_plan).resolve()
    output_dir = Path(args.output_dir).resolve()
    segment_dir = output_dir / "segments"
    output_dir.mkdir(parents=True, exist_ok=True)
    segment_dir.mkdir(parents=True, exist_ok=True)

    plan = load_plan(plan_path)
    default_ref = apply_default_voice_args(args, plan)
    validate_prompt_args(args)
    segments = plan["segments"]
    if args.max_segments > 0:
        segments = segments[: args.max_segments]

    plan_voice = plan.get("voice") if isinstance(plan.get("voice"), dict) else {}
    voice_lock = args.voice_lock and plan_voice.get("timbre_lock", True) is not False
    if plan_voice.get("performance_mode") not in (None, "single_performer"):
        print(
            "Warning: performance_plan.voice.performance_mode is not single_performer; "
            "pingshu-storyteller expects one narrator voice.",
            file=sys.stderr,
        )
    if voice_lock and not args.single_pass and not (args.reference_wav or args.prompt_wav):
        print(
            "Warning: split rendering without reference/prompt audio can still drift; "
            "use --single-pass for short scripts or provide --reference-wav/--prompt-wav for stronger voice lock.",
            file=sys.stderr,
        )
    if args.single_pass:
        if any(isinstance(segment.get("events"), list) for segment in segments):
            print(
                "Warning: --single-pass flattens event-level pauses into text separators. "
                "Use event-level rendering for final pingshu audio and ASR-audit the result.",
                file=sys.stderr,
            )
        combined = build_single_pass_segment(segments)
        text_len = len(combined["text"])
        if text_len > 1800:
            print(
                f"Warning: single-pass text is {text_len} characters; "
                "if VoxCPM2 struggles, split with a stable reference voice.",
                file=sys.stderr,
        )
        segments = [combined]
    render_items = build_render_items(segments)
    say_item_count = sum(1 for item in render_items if item["kind"] == "say")

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
    base_control = voice_locked_control(args.control, voice_lock)
    prepend_control = should_prepend_control(args, base_control)
    if base_control and not prepend_control:
        print(
            "Info: prompt_text is set; control text will be recorded in the manifest "
            "but not prepended to the spoken text.",
            file=sys.stderr,
        )

    with tempfile.TemporaryDirectory(prefix="voxcpm2-render-") as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        say_index = 0
        for item_index, segment in enumerate(render_items, start=1):
            segment_id = segment.get("id") or f"item-{item_index:03d}"
            if segment.get("kind") == "pause":
                pause_ms = int(segment.get("duration_ms") or 0)
                if pause_ms > 0:
                    chunks.append(np.zeros(int(sample_rate * pause_ms / 1000), dtype=np.float32))
                sfx_after = append_sfx_after(chunks, segment, sample_rate, args.sfx_gain_db)
                manifest_segments.append(
                    {
                        "id": segment_id,
                        "kind": "pause",
                        "duration_ms": pause_ms,
                        "reason": segment.get("reason"),
                        "parent_segment_id": segment.get("parent_segment_id"),
                        "sfx_after": sfx_after,
                    }
                )
                continue

            say_index += 1
            text = str(segment.get("text") or "").strip()
            if not text:
                raise ValueError(f"Segment {segment_id} has empty text")

            safe_id = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in segment_id)
            segment_path = segment_dir / f"{say_index:03d}-{safe_id}.wav"
            segment_tempo = pace_tempo(segment, args.pace_tempo)
            control_text = segment_control(base_control, segment, args.segment_performance)

            if args.skip_existing and segment_path.exists():
                audio, sr = sf.read(segment_path, dtype="float32")
                if sr != sample_rate:
                    raise ValueError(f"{segment_path} sample rate {sr} does not match model {sample_rate}")
                audio = np.asarray(audio, dtype=np.float32).reshape(-1)
                print(f"Reused {segment_path}", file=sys.stderr)
            else:
                final_text = with_control(text, control_text) if prepend_control else " ".join(text.split())
                print(f"Rendering {say_index}/{say_item_count} {segment_id}: {text[:38]}", file=sys.stderr)
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
                audio = apply_tempo(audio, sample_rate, segment_tempo, temp_dir, f"{say_index:03d}-{safe_id}")
                sf.write(segment_path, audio, sample_rate, subtype="PCM_16")

            stats = audio_stats(audio, sample_rate)
            has_later_item = item_index < len(render_items)

            chunks.append(audio)
            sfx_after = append_sfx_after(chunks, segment, sample_rate, args.sfx_gain_db)
            next_item = render_items[item_index] if has_later_item else None
            inserted_pause_ms = pause_after_sfx_ms(
                segment,
                int(segment.get("pause_after_ms") or 0),
                has_later_item,
                next_item,
            )
            if inserted_pause_ms > 0:
                chunks.append(np.zeros(int(sample_rate * inserted_pause_ms / 1000), dtype=np.float32))

            manifest_segments.append(
                {
                    "id": segment_id,
                    "text": text,
                    "output_file": str(segment_path),
                    "pause_after_ms": inserted_pause_ms,
                    "kind": "say",
                    "parent_segment_id": segment.get("parent_segment_id"),
                    "pace": segment.get("pace"),
                    "emotion": segment.get("emotion"),
                    "tempo": round(segment_tempo, 3),
                    "control": control_text,
                    "source_segment_ids": segment.get("source_segment_ids"),
                    "sfx_after": sfx_after,
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
        "control": base_control,
        "control_prepended_to_text": prepend_control,
        "voice_lock": voice_lock,
        "single_pass": args.single_pass,
        "default_reference_voice": {
            "id": default_ref.get("id"),
            "path": str(default_ref.get("path")),
            "manifest": default_ref.get("manifest"),
            "source": default_ref.get("source"),
        } if default_ref else None,
        "reference_wav": str(Path(args.reference_wav).resolve()) if args.reference_wav else None,
        "prompt_wav": str(Path(args.prompt_wav).resolve()) if args.prompt_wav else None,
        "sfx_gain_db": args.sfx_gain_db,
        "final_wav": str(final_wav),
        "final_m4a": str(final_m4a) if m4a_created else None,
        "final_stats": audio_stats(final_audio, sample_rate),
        "segments": manifest_segments,
        "notes": [
            "Generated with an original voice-control prompt, not a real performer clone.",
            "Voice lock keeps one solo storyteller timbre; character contrast should come from prosody and wording.",
            "Sparse waking block SFX from performance_plan.json is inserted as post-processed audio, never sent to TTS text.",
            "Music bed from performance_plan.json is not mixed by this script.",
        ],
    }
    manifest_path = output_dir / "voxcpm2_render_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
