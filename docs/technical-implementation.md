# Technical Implementation

## Architecture

```text
User request
-> source acquisition
-> story_pack.json
-> scene analysis
-> pingshu_script.json
-> performance_plan.json
-> TTS adapter
-> audio/subtitle/video packaging
```

The Skill is protocol-first. It does not require one model provider, one TTS provider, one OS, or one host agent.

## Data Contracts

### story_pack.json

Contains sourced facts and scene detail. It must separate fact, inference, and uncertainty.

Required top-level fields:

- `schema_version`
- `request`
- `sources`
- `characters`
- `scenes`
- `rights_notes`
- `open_questions`

### pingshu_script.json

Contains adapted pingshu prose as structured beats.

Required top-level fields:

- `schema_version`
- `title`
- `story_pack_id`
- `storyteller_persona`
- `segments`
- `style_notes`
- `fidelity_notes`

### performance_plan.json

Contains provider-neutral TTS and audio direction.

Required top-level fields:

- `schema_version`
- `title`
- `voice`
- `segments`
- `audio_bed`
- `rendering_notes`

## Cross-Agent Compatibility

Agents only need to understand Markdown instructions and JSON files. Optional scripts use Node.js with built-in modules only.

Do not assume:

- Codex-only tools,
- macOS paths,
- Bash-only shell features,
- a browser session,
- a specific TTS vendor.

## Cross-Platform Strategy

| Layer | Requirement | Rationale |
| --- | --- | --- |
| Core Skill | Markdown + JSON | Works in Codex, Claude Code, OpenCode, local agents, and hosted agents |
| Scripts | Node.js built-ins only | Works on macOS, Windows, Linux |
| Paths | Accept file/folder args | Avoid hardcoded workspace paths |
| TTS adapters | Optional | Users choose API or local models |
| Browser/video extraction | Optional advanced mode | Avoid making the core workflow heavy |

## TTS Provider Strategy

The Skill emits a neutral `performance_plan` first, then an agent maps it to a provider.

API candidates:

- [OpenAI Speech API](https://developers.openai.com/api/docs/guides/text-to-speech) for simple hosted TTS and streaming workflows. OpenAI documents GPT-4o mini TTS, built-in voices, multilingual spoken output, and streaming.
- [Alibaba Cloud Model Studio / CosyVoice](https://www.alibabacloud.com/help/en/model-studio/realtime-tts-user-guide) for Chinese voice design, cloning, streaming, and fine-grained control; the [voice cloning/design API](https://www.alibabacloud.com/help/en/model-studio/cosyvoice-clone-design-api) currently describes 10-20 second sample voice cloning.
- [MiniMax Speech Voice Clone](https://platform.minimax.io/docs/guides/speech-voice-clone) for hosted voice clone workflows.
- [ElevenLabs](https://elevenlabs.io/docs/overview/intro) for high-quality hosted TTS and voice cloning when licensing and consent are clear.

Local candidates:

- [CosyVoice / FunAudioLLM](https://github.com/FunAudioLLM/CosyVoice) for local Chinese-capable speech synthesis and voice cloning experiments.
- [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) for local zero/few-shot voice workflows.
- [F5-TTS](https://github.com/SWivid/F5-TTS) for local voice-cloning style experiments.
- [IndexTTS](https://github.com/index-tts/index-tts) for Chinese-focused local TTS experiments.

Provider-specific adapters should live outside the core contract or behind small optional scripts. Do not make provider credentials mandatory.

The first adapter layer is `pingshu-storyteller/scripts/create_tts_job.mjs`, which converts a neutral `performance_plan.json` into a provider-specific job scaffold. It deliberately does not call paid APIs or local models; it records the user's provider choice, required environment variables, segment inputs, and next command hints.

Before final rendering, agents must run `pingshu-storyteller/scripts/check_tts_readiness.mjs <provider>`. If the selected API key or local command is missing, stop and ask the user to configure the provider. System voices are only smoke tests and must not be presented as the final audio product.

## Story Acquisition Strategy

Use a source ladder:

1. Public-domain or licensed text.
2. Official summaries, episode pages, encyclopedic pages, and reviews for broad facts.
3. User-provided transcripts, subtitles, or links.
4. Multiple independent recaps as leads, not as text to launder.
5. Selective multimodal inspection of key clips only when scene detail is missing.

Never convert a single creator's recap into pingshu as if it were raw source material. Extract facts, cite it, and corroborate when possible.

## Video Detail Without Full Video Understanding

For long videos, avoid sending everything to a multimodal model. Use a cheaper staged approach:

1. Get transcript/subtitles where available.
2. Detect candidate high-detail moments from transcript cues, silence, music, sound effects, comments, or user-specified timestamps.
3. Sample short windows around candidates.
4. Extract a small number of keyframes.
5. Ask a multimodal model to describe only those keyframes.
6. Merge visual notes into `scene.visual_details`.

This keeps cost and token use bounded while preserving useful detail.

## Development Milestones

1. Build Skill instructions and references.
2. Add JSON validators and formatter scripts.
3. Add example artifacts.
4. Add provider adapter stubs.
5. Add a local CLI wrapper.
6. Add real TTS integrations after provider choice.
