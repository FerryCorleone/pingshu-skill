# Output Contracts

## story_pack.json

```json
{
  "schema_version": "1.0",
  "id": "story-pack-example",
  "request": {
    "user_goal": "string",
    "target_work_or_event": "string",
    "desired_length": "short | medium | long"
  },
  "narrative_brief": {
    "hook": "string",
    "trigger": "string",
    "causal_chain": ["string"],
    "core_conflict": "string",
    "must_include_details": ["string"],
    "outcome": "string",
    "aftermath": "string",
    "missing_or_weak_facts": ["string"]
  },
  "sources": [
    {
      "id": "src-001",
      "type": "primary | official | user_provided | recap | inferred",
      "title": "string",
      "url_or_path": "string",
      "notes": "string"
    }
  ],
  "characters": [
    {
      "id": "char-001",
      "name": "string",
      "role": "string",
      "traits": ["string"]
    }
  ],
  "scenes": [
    {
      "id": "scene-001",
      "source_ids": ["src-001"],
      "status": "confirmed | inferred | uncertain | user_claim",
      "summary": "string",
      "setting": "string",
      "conflict": "string",
      "actions": ["string"],
      "visual_details": ["string"],
      "comic_or_dramatic_handles": ["string"]
    }
  ],
  "rights_notes": ["string"],
  "open_questions": ["string"]
}
```

## pingshu_script.json

```json
{
  "schema_version": "1.0",
  "title": "string",
  "story_pack_id": "story-pack-example",
  "storyteller_persona": {
    "id": "warm_northern_storyteller",
    "description": "Original warm northern storyteller, not modeled after a real person.",
    "dialect_level": "light | medium | strong"
  },
  "segments": [
    {
      "id": "seg-001",
      "purpose": "opening | setup | action | aside | release | hook",
      "source_scene_ids": ["scene-001"],
      "text": "string",
      "performance": {
        "emotion": "string",
        "pace": "slow | medium_slow | medium | quick",
        "pause_after_ms": 300,
        "emphasis": ["string"],
        "sfx_after": ["waking_block_light"]
      }
    }
  ],
  "style_notes": ["string"],
  "fidelity_notes": ["string"]
}
```

## performance_plan.json

```json
{
  "schema_version": "1.0",
  "title": "string",
  "voice": {
    "persona_id": "warm_northern_storyteller",
    "provider_preference": "api | local | undecided",
    "consent_required": false,
    "notes": "string"
  },
  "segments": [
    {
      "id": "seg-001",
      "text": "string",
      "pace": "medium_slow",
      "emotion": "warm_mischief",
      "pause_after_ms": 350,
      "emphasis": ["string"],
      "sfx_after": ["waking_block_light"]
    }
  ],
  "audio_bed": {
    "music_style": "light percussive bed, optional",
    "sfx_palette": ["waking_block_light"],
    "loudness_note": "Keep music below speech."
  },
  "rendering_notes": ["string"]
}
```
