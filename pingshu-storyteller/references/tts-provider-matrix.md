# TTS Provider Matrix

## Provider-Neutral Principle

Always create `performance_plan.json` before selecting a TTS provider. The plan should contain text, pause, emphasis, emotion, sound effects, and voice persona in generic terms.

For final audio, require an explicit user choice:

- API TTS: user provides/authorizes credentials for a provider.
- Local TTS: user installs or points to a local model/runtime.

Do not silently use macOS `say`, Windows Narrator, browser speech synthesis, or other system voices as the final output. They are only acceptable for a clearly labeled smoke test after the user agrees.

Use `scripts/check_tts_readiness.mjs <provider>` before claiming audio rendering is ready.

## API Providers

| Provider | Good for | Cautions |
| --- | --- | --- |
| [OpenAI Speech API](https://developers.openai.com/api/docs/guides/text-to-speech) | Hosted TTS, simple API use, streaming workflows | Voice choices are provider-defined; do not assume custom voice cloning |
| [Alibaba Cloud Model Studio / CosyVoice](https://www.alibabacloud.com/help/en/model-studio/realtime-tts-user-guide) | Chinese TTS, voice design/clone workflows, fine control experiments | Account, region, model availability, and terms can change |
| [MiniMax Speech](https://platform.minimax.io/docs/guides/speech-voice-clone) | Hosted speech, voice clone API, multilingual workflows | Check cloning consent and current API limits |
| [ElevenLabs](https://elevenlabs.io/docs/overview/intro) | High quality hosted voices and cloning workflows | Strong consent and licensing requirements; Chinese style should be tested |

## Local / Open-Source Candidates

| Project | Good for | Cautions |
| --- | --- | --- |
| [VoxCPM2 / OpenBMB VoxCPM](https://github.com/OpenBMB/VoxCPM) | Local Chinese TTS with voice design, 48kHz output, and Apple Silicon MPS support | Requires Python 3.10-3.12 and several GB of model weights; use original voice prompts or consented reference audio |
| [CosyVoice / FunAudioLLM](https://github.com/FunAudioLLM/CosyVoice) | Local Chinese-capable TTS and voice clone experiments | GPU/driver/setup requirements vary |
| [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) | Local few-shot voice workflows | Quality depends on samples and setup |
| [F5-TTS](https://github.com/SWivid/F5-TTS) | Local voice-cloning style experimentation | Check model/license and Chinese quality for each version |
| [IndexTTS](https://github.com/index-tts/index-tts) | Chinese-focused local TTS experiments | Verify model availability, license, and platform support |

## Adapter Mapping

Map neutral fields conservatively:

| Neutral field | API mapping | Local mapping |
| --- | --- | --- |
| `voice.persona` | provider voice id or short instruction | selected checkpoint/reference audio |
| `segment.text` | text input | text input |
| `pause_after_ms` | SSML break if supported, otherwise split audio | silence insertion in post-processing |
| `emphasis` | SSML/emphasis if supported, otherwise punctuation | punctuation or manual prosody prompt |
| `emotion` | short style instruction | style prompt if supported |
| `sfx_after` | post-process, not TTS | post-process |

Use `scripts/create_tts_job.mjs` to turn a `performance_plan.json` into a provider-specific job scaffold. This lets the user choose API or local TTS without changing the pingshu writing workflow.

## Clean TTS Rule

Do not stack long style prompts, negative quality prompts, SSML, rate changes, and dialect demands all at once. If audio becomes muddy, return to neutral voice settings and improve the script first.

## First-Use Prompt

When no provider is configured, ask:

```text
这次要生成正式音频，你想走哪条 TTS？
1. API：OpenAI / 阿里 CosyVoice / MiniMax / ElevenLabs，提供对应 key 或确认环境变量已配置。
2. 本地模型：CosyVoice / GPT-SoVITS / F5-TTS / IndexTTS，告诉我安装路径或启动命令。
3. 只做临时试听：可以用系统语音 smoke test，但它不代表最终效果。
```
