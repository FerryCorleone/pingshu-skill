# TTS Provider Matrix

## Provider-Neutral Principle

Always create `performance_plan.json` before selecting a TTS provider. The plan should contain text, pause, emphasis, emotion, sound effects, and voice persona in generic terms.

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
