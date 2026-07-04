#!/usr/bin/env python3
"""Shared helpers for local pingshu TTS renderers."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf


SFX_ALIASES = {
    "waking_block_soft": "waking_block",
    "waking_block_firm": "waking_block",
    "waking_block_light": "waking_block",
    "waking_block_medium": "waking_block",
    "waking_block_close": "waking_block",
}


def load_plan(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        plan = json.load(handle)
    segments = plan.get("segments")
    if not isinstance(segments, list) or not segments:
        raise ValueError("performance_plan.json must include a non-empty segments array")
    return plan


def build_render_items(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
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

        event_items: list[dict[str, Any]] = []
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
                if milliseconds > 0:
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


def safe_id(value: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in value)


def audio_to_mono_float32(audio: Any) -> np.ndarray:
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()
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
    peak = float(np.max(np.abs(arr))) if arr.size else 0.0
    if peak > 0.98:
        arr = arr / peak * 0.98
    return np.clip(arr, -1.0, 1.0).astype(np.float32)


def normalize_sfx_ids(value: Any) -> list[str]:
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


def load_sfx_audio(sfx_id: str, sample_rate: int, gain_db: float = -6.0, sfx_dir: Path | None = None) -> tuple[np.ndarray, dict[str, Any]]:
    resolved_id = SFX_ALIASES.get(sfx_id, sfx_id)
    asset_dir = sfx_dir or default_sfx_dir()
    asset_path = asset_dir / f"{resolved_id}.wav"
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


def append_sfx_after(
    chunks: list[np.ndarray],
    item: dict[str, Any],
    sample_rate: int,
    gain_db: float = -6.0,
    sfx_dir: Path | None = None,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for sfx_id in normalize_sfx_ids(item.get("sfx_after")):
        audio, record = load_sfx_audio(sfx_id, sample_rate, gain_db=gain_db, sfx_dir=sfx_dir)
        chunks.append(audio)
        records.append(record)
    return records


def pause_after_sfx_ms(
    item: dict[str, Any],
    planned_ms: int,
    has_later_item: bool,
    next_item: dict[str, Any] | None = None,
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


def audio_stats(audio: np.ndarray, sample_rate: int) -> dict[str, float]:
    audio = np.asarray(audio, dtype=np.float32)
    return {
        "duration_sec": round(float(len(audio) / sample_rate), 3),
        "rms": round(float(np.sqrt(np.mean(np.square(audio)))), 6) if len(audio) else 0.0,
        "peak": round(float(np.max(np.abs(audio))), 6) if len(audio) else 0.0,
    }


def pause_audio(sample_rate: int, milliseconds: int) -> np.ndarray:
    return np.zeros(int(sample_rate * max(milliseconds, 0) / 1000), dtype=np.float32)


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


def write_wav(path: Path, audio: np.ndarray, sample_rate: int) -> None:
    sf.write(path, audio_to_mono_float32(audio), sample_rate, subtype="PCM_16")
