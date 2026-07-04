# TTS 服务商矩阵

## 服务商中立原则

选择 TTS 服务商之前，永远先生成 `performance_plan.json`。计划里应该用通用语言描述文本、停顿、重音、情绪、音效和说书人 persona。

生成正式音频前，必须让用户明确选择：

- API TTS：用户提供或授权对应 provider 的凭据。
- 本地 TTS：用户安装或指定本地模型/运行时。

不要静默使用 macOS `say`、Windows Narrator、浏览器 speech synthesis 或其他系统语音作为最终输出。它们只能在用户同意后做明确标注的临时连通性测试。

声称可以渲染音频前，先运行 `scripts/check_tts_readiness.mjs <provider>`。

## API 服务商

| 服务商 | 适合 | 注意 |
| --- | --- | --- |
| [OpenAI Speech API](https://developers.openai.com/api/docs/guides/text-to-speech) | 托管 TTS、简单 API、流式工作流 | 音色由服务商定义，不要默认能自定义克隆 |
| [千问 Qwen-TTS / 阿里云百炼](https://help.aliyun.com/zh/model-studio/qwen-tts-api) | 中文 TTS、指令控制、系统音色、分段拼接 | `qwen3-tts-instruct-flash` 只适合系统音色 audition；若要贴近默认评书音色，优先用 Qwen 声音复刻 `qwen3-tts-vc-2026-01-22` |
| [小米 MiMo V2.5 TTS](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/speech-synthesis-v2.5) | 中文/多语种 TTS、声音设计、声音复刻、音频标签控制 | 有参考音频时优先 `mimo-v2.5-tts-voiceclone`；`voicedesign` 可 audition，但分段音色稳定性和提示词泄漏要重点回听 |
| [阿里云百炼 / CosyVoice](https://www.alibabacloud.com/help/en/model-studio/realtime-tts-user-guide) | 中文 TTS、声音设计/克隆、精细控制实验 | 账号、地域、模型可用性和条款会变化 |
| [MiniMax Speech](https://platform.minimax.io/docs/guides/speech-voice-clone) | 托管语音和声音克隆 API | 检查克隆授权和当前 API 限制 |
| [ElevenLabs](https://elevenlabs.io/docs/overview/intro) | 高质量托管声音和克隆工作流 | 授权要求强，中文评书效果要单独测试 |

## 本地 / 开源候选

| 项目 | 适合 | 注意 |
| --- | --- | --- |
| [VoxCPM2 / OpenBMB VoxCPM](https://github.com/OpenBMB/VoxCPM) | 本地高质量默认档、中文评书主声线、48kHz 输出、Apple Silicon MPS / NVIDIA CUDA | 配置要求最高；使用原创提示或已授权参考音频 |
| [Qwen3-TTS 0.6B Base](https://github.com/QwenLM/Qwen3-TTS) | 本地低配兜底档、参考音频克隆、短中稿试用 | 比 VoxCPM2 轻，但仍需要 Apple Silicon 或 NVIDIA GPU；长稿要分段回听 |

不要把本地路线扩成模型大全。当前 Skill 对普通用户只暴露这两个档位：VoxCPM2 负责“效果优先”，Qwen3-TTS 0.6B 负责“配置较低也能试”。如果这两个都不满足，建议走云端 API。

本地安装前先运行：

```bash
node pingshu-storyteller/scripts/check_local_tts_device.mjs
```

如果脚本输出 `needs-user-config`，让用户补充电脑型号、内存、GPU 型号和显存；如果输出 `cloud-api`，不要继续安装本地模型。

最低配置建议：

| 档位 | macOS | Windows / Linux |
| --- | --- | --- |
| VoxCPM2 | Apple Silicon + 32GB 统一内存；推荐 48GB 以上 | NVIDIA 12GB VRAM + 32GB RAM；推荐 16GB VRAM / 64GB RAM 以上 |
| Qwen3-TTS 0.6B | Apple Silicon + 16GB 统一内存；推荐 24-32GB | NVIDIA 8GB VRAM + 16GB RAM；推荐 32GB RAM |

## 适配器映射

保守映射通用字段：

| 通用字段 | API 映射 | 本地映射 |
| --- | --- | --- |
| `voice.persona` | 服务商 voice id 或短提示 | 选择 checkpoint/reference audio |
| `voice.timbre_lock` | 全片同一个服务商 voice id | 全片同一个 checkpoint/reference/prompt，不按角色换声 |
| `voice.performance_mode` | 单人说书人风格提示 | 单人说书人风格提示 |
| `segment.text` | 文本输入 | 文本输入 |
| `pause_after_ms` | 支持则映射 SSML break，否则拆音频 | 后处理中插入静音 |
| `segment.events[].type = say` | 文本输入块 | 文本输入块 |
| `segment.events[].type = pause` | 支持则映射 SSML break，否则拆音频 | 插入静音，不送入 TTS |
| `segment.events[].tempo` | 服务商支持则映射 rate | 支持时做轻量语速后处理 |
| `emphasis` | 支持则映射 SSML/emphasis，否则用标点 | 标点或手动语气提示 |
| `emotion` | 短风格提示 | 支持时映射 style prompt |
| `sfx_after` | 后处理，不属于 TTS；目标朗读文本里不出现音效说明 | 后处理；从 `assets/sfx` 解析并插入时间线 |

使用 `scripts/create_tts_job.mjs` 把 `performance_plan.json` 转成服务商专用任务骨架。这样用户可以换 API 或本地 TTS，而不改变评书写作工作流。

## 道具音效后处理

醒木、音乐垫和其他音效不属于 TTS。渲染器必须先生成干净人声，再按 `performance_plan.segments[].sfx_after` 或事件级 `events[].sfx_after` 插入短音效。

当前 Skill 只内置一个醒木资产：

- `waking_block`：醒木，用于开书定场、关键转折留扣或结尾收束。

旧产物里的 `waking_block_soft`、`waking_block_firm`、`waking_block_light`、`waking_block_medium` 和 `waking_block_close` 可按 `waking_block` 兼容。音效默认低于人声，短节目最多 1-2 次；醒木后默认留约 420ms，避免贴太紧或空太久。详细规则见 `references/prop-sfx.md`。

## 默认音色策略

默认声线不是“AI 老人声”，而是一个原创的中老年北方单人说书人：

- 苍劲、略粗粝，但口齿清楚；
- 普通话为主，带一点北京/天津一带的北方口吻；
- 中慢速，包袱前有停顿，短句能突然发力；
- 有醒木感和一点笑里带刺的贫劲；
- 不像新闻播音，不像年轻主播，不模仿任何真实艺人。

本地路径先做设备检测：满足 VoxCPM2 最低配置就优先 VoxCPM2；不满足 VoxCPM2 但满足 Qwen3-TTS 0.6B，就使用 Qwen3-TTS；两个都不满足就建议 API。API 路径优先级：

1. **voice clone / voice enrollment**：用户有原创或已授权参考音频时优先。小米用 `mimo-v2.5-tts-voiceclone`；阿里 Qwen 用声音复刻创建 voice，再用 `qwen3-tts-vc-2026-01-22` 合成。
2. **voice design**：没有参考音频时，描述默认声线创建原创声音。必须先 audition，不通过就换服务商。
3. **系统音色**：只作快速 audition 或 fallback。即使 Qwen `Arthur / 徐大爷` 描述接近，也不能保证贴近项目默认音色。

## 干净 TTS 规则

不要同时堆长风格提示、负面质量提示、SSML、rate 控制和方言要求。如果音频变糊，先回到干净声音设置，把脚本写好。

对 VoxCPM2 这类本地模型，括号导演指令不是可靠 SSML。如果使用 prompt audio/text，隐藏控制词可能被合成为语音。`say` 事件里只放要念出来的语言，`pause` 事件交给渲染器插入静音。

VoxCPM2 正式成品优先事件级渲染。`single-pass` 只适合短稿 audition 或排查音色，不适合需要明显停顿和快慢变化的最终评书音频；把停顿折成省略号、换行或重复标点塞进长文本，容易触发模型补“啊/呃”等填充音，并把节奏抹平。

API 也一样。只有服务商明确说明不会朗读的位置才放提示词，例如：

- Qwen `instructions`；
- MiMo `user` message；
- voice clone 的 `audio.voice` / `voice` 字段。

目标朗读文本中只放正文。不要把“叔音、北方口音、慢速说书、停顿片刻”等自定义标签塞进正文；MiMo 虽然支持标签控制，但自定义中文标签可能被直接读出来，除非已经用该服务商官方标签验证过。

长稿 API 渲染要加请求间隔、429 重试和可恢复 manifest。节奏控制优先用句末粗粒度拆分、真实静音、轻微 `atempo` 后处理；不要按每个逗号拆分，太慢且容易触发限流。

## 音色锁定规则

评书是单人形式。渲染器必须全程保持稳定的说书人音色质感。

- API TTS：全片使用同一个 voice id。
- 本地 TTS：全片使用同一个 checkpoint/reference/prompt voice。
- Qwen：有参考音频时，优先创建并复用同一个 Qwen voice clone id；没有参考音频时，再 audition `qwen3-tts-vd` 或 `Arthur / 徐大爷` 这类系统声。
- 小米 MiMo：有参考音频时，优先 `voiceclone`。`voicedesign` 只适合快速探索；长稿分段时要特别检查音色漂移和提示词泄漏。
- 段落级 `emotion`、`pace` 和 `emphasis` 可以改变表达，但不能制造不同角色音色。
- 如果服务商分段渲染会漂移，先用稳定且有授权的参考声音减少漂移；`single-pass` 只能作为 audition，不应绕过事件级停顿和 ASR 回检直接交付。
- 未经明确权利和同意，不使用在世表演者提取声音。

## 成品回检

正式交付前做 ASR 回检：

- 关键短台词必须仍然听得见；
- 正文没有的独立“啊/呃/嗯”填充音一律返工；
- 如果转录显示全篇没有明显停顿，或说话密度过高，回到 `performance_plan.events` 调整 pause 和 tempo；
- 回检通过后再做响度规范化和交付。

## 首次使用提示

没有配置 TTS 服务商时，问：

```text
这次要生成正式音频，你想走哪条 TTS？
1. API：OpenAI / 千问 Qwen-TTS / 小米 MiMo / 阿里 CosyVoice / MiniMax / ElevenLabs，提供对应 key 或确认环境变量已配置。有原创或授权参考音频时，优先走 voice clone。
2. 本地模型：我先检测电脑配置，再在 VoxCPM2（效果优先）和 Qwen3-TTS 0.6B（低配兜底）之间推荐；如果机器不满足最低配置，就建议改走 API。
3. 只做临时试听：可以用系统语音 smoke test，但它不代表最终效果。
```
