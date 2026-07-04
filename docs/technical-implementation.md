# 技术实现

## 架构

```text
用户需求
-> 素材获取
-> story_pack.json
-> 场景分析
-> pingshu_script.json
-> performance_plan.json
-> TTS adapter
-> 音频/字幕/视频包装
-> delivery_plan.json
-> 本地交付 / 用户确认后的网易云音乐云盘上传
```

这个 Skill 是协议优先的设计，不绑定某个模型、某个 TTS 服务商、某个操作系统或某个 Agent 宿主。

当前对外仍保留一个总入口 Skill。是否拆成 Skill 集合的决策见 `docs/skill-architecture.md`。

## 数据契约

### story_pack.json

包含有来源依据的事实和场景细节，必须区分事实、推断和不确定。

必需顶层字段：

- `schema_version`
- `request`
- `sources`
- `characters`
- `scenes`
- `rights_notes`
- `open_questions`

### pingshu_script.json

包含结构化的评书化正文。

必需顶层字段：

- `schema_version`
- `title`
- `story_pack_id`
- `storyteller_persona`
- `segments`
- `style_notes`
- `fidelity_notes`

### performance_plan.json

包含不绑定厂商的 TTS 和音频表演方向。

必需顶层字段：

- `schema_version`
- `title`
- `voice`
- `segments`
- `audio_bed`
- `rendering_notes`

`voice` 还必须包含评书场景的单人表演契约：

- `performance_mode: "single_performer"`
- `timbre_lock: true`
- `role_voice_policy`
- `reference_voice`

### delivery_plan.json

正式音频生成并完成 ASR 回检后，创建交付计划。

必需顶层字段：

- `schema_version`
- `title`
- `source_audio`
- `user_prompt`
- `default_delivery`
- `targets`
- `publish_manifest_path`
- `notes`

默认目标是 `local-file`，也就是直接交付本地音频文件。`netease-cloud` 是用户确认后的可选目标，不能作为音频生成前置条件。

网易云音乐云盘上传使用官方 `@music163/ncm-cli`。首次使用由 Agent 主动引导，不把用户甩回终端：

1. Agent 安装或检查 `@music163/ncm-cli`；
2. Agent 打开 [网易云音乐开放平台](https://developer.music.163.com/st/developer/apply/account?type=INDIVIDUAL)，用户在网页里取得 API 凭证；
3. Agent 运行 `setup_netease_cloud.mjs`，用本机输入框收 App ID / Private Key，并写入 `ncm-cli` 配置；
4. Agent 打开用户可见的网易云 App 扫码登录窗口；
5. 登录完成后，Agent 执行上传脚本。

所有交付产物禁止写入 app key、private key、cookie、token 或授权头。

## 跨 Agent 兼容

Agent 只需要能读 Markdown 指令和 JSON 文件即可。可选脚本尽量只使用 Node.js 内置模块。

不要假设：

- 只能在 Codex 里运行；
- 只有 macOS 路径；
- 必须有 Bash；
- 必须有浏览器登录态；
- 必须使用某个 TTS 厂商。

## 跨平台策略

| 层级 | 要求 | 原因 |
| --- | --- | --- |
| 核心 Skill | Markdown + JSON | 可在 Codex、Claude Code、OpenCode、本地 Agent 和托管 Agent 中复用 |
| 脚本 | Node.js 内置模块优先 | macOS、Windows、Linux 都能跑 |
| 路径 | 接收文件/目录参数 | 避免写死工作区路径 |
| TTS 适配器 | 可选 | 用户选择 API 或本地模型 |
| 音频交付 | 可选平台集成 | 默认本地文件，第三方上传必须用户确认 |
| 浏览器/视频抽取 | 高级可选能力 | 不让核心工作流变重 |

## TTS 服务商策略

Skill 先输出通用 `performance_plan`，再由 Agent 映射到具体服务商。

API 候选：

- [OpenAI Speech API](https://developers.openai.com/api/docs/guides/text-to-speech)：适合简单托管 TTS 和流式工作流。
- [阿里云百炼 / CosyVoice](https://www.alibabacloud.com/help/en/model-studio/realtime-tts-user-guide)：适合中文 TTS、声音设计、克隆和更细控制实验。
- [MiniMax Speech Voice Clone](https://platform.minimax.io/docs/guides/speech-voice-clone)：适合托管声音克隆工作流。
- [ElevenLabs](https://elevenlabs.io/docs/overview/intro)：适合高质量托管 TTS 和声音克隆，但必须确认授权和中文效果。

本地候选：

- [VoxCPM2 / OpenBMB VoxCPM](https://github.com/OpenBMB/VoxCPM)：本地高质量默认档，适合中文评书主声线。
- [Qwen3-TTS 0.6B Base](https://github.com/QwenLM/Qwen3-TTS)：本地低配兜底档，适合配置不够跑 VoxCPM2 但仍想离线试用的用户。

本地路线不做模型大全。用户选择本地 TTS 时，Agent 先运行 `pingshu-storyteller/scripts/check_local_tts_device.mjs` 检测机器配置：

- 满足 VoxCPM2 最低配置：推荐 `local-voxcpm2`。
- 不满足 VoxCPM2 但满足 Qwen3-TTS 0.6B：推荐 `local-qwen3-tts`。
- 两个都不满足：建议走云端 API。
- 检测不到 GPU/显存时：让用户补充电脑型号、内存、GPU 型号和显存，不要猜。

最低配置建议：

| 模型 | macOS | Windows / Linux |
| --- | --- | --- |
| VoxCPM2 | Apple Silicon + 32GB 统一内存；推荐 48GB 以上 | NVIDIA 12GB VRAM + 32GB RAM；推荐 16GB VRAM / 64GB RAM 以上 |
| Qwen3-TTS 0.6B | Apple Silicon + 16GB 统一内存；推荐 24-32GB | NVIDIA 8GB VRAM + 16GB RAM；推荐 32GB RAM |

服务商专用适配器应该放在核心契约之外，或作为小型可选脚本存在。不要把服务商 key 变成必需条件。

第一层适配器是 `pingshu-storyteller/scripts/create_tts_job.mjs`，它把通用 `performance_plan.json` 转成服务商专用任务骨架。它不会直接调用付费 API 或本地模型，只记录用户的服务商选择、所需环境变量、分段输入和下一步命令提示。

正式渲染前，Agent 必须运行 `pingshu-storyteller/scripts/check_tts_readiness.mjs <provider>`。如果 API key、本地 Python 环境或模型运行时缺失，就停下来让用户配置。系统语音只能做临时连通性测试，不能冒充最终音频。

### 道具音效层

醒木等传统道具音效不属于 TTS 文本，而是后期音频层。Skill 内置一个固定资产在 `pingshu-storyteller/assets/sfx/`：

- `waking_block.wav`：醒木，用于开书定场、关键转折留扣或结尾收束。

`performance_plan` 通过 `sfx_after` 标记要插入的音效。渲染器先生成干净人声，再从 `assets/sfx` 解析并插入时间线。短节目默认 1 次、最多 2 次，不把“啪”或音效说明写进 TTS 正文。醒木后默认留约 420ms，并把自动留白控制在 320-650ms，避免太急或空太久。

### 本地 VoxCPM2 渲染

`pingshu-storyteller/scripts/render_voxcpm2_plan.py` 是给选择 VoxCPM2 的用户准备的可选本地渲染器。

使用约束：

- 默认开启音色锁定。脚本会给每次生成注入单人说书人音色锚点。
- 短脚本如果分段渲染导致音色漂移，使用 `--single-pass`。
- 较长脚本要在所有分段中使用同一个有授权的 `--reference-wav` 或 `--prompt-wav --prompt-text`。
- `--segment-performance` 只添加语气提示，不能用来制造不同角色音色。
- `--pace-tempo` 可以轻微后处理语速，但不能替代真实停顿和 beat 写作。
- 做成品评书节奏时，使用 `performance_plan.segments[].events`：`say` 事件交给 TTS，`pause` 事件渲染成真实静音。

## 素材获取策略

使用来源阶梯：

1. 公版或已授权原文。
2. 官方简介、剧集页面、百科页面、影评等基础事实。
3. 用户提供的转录、字幕、链接或文件。
4. 多个独立二次解说作为线索，而不是拿来洗稿。
5. 只有关键视觉细节缺失时，才做选择性多模态检查。

不要把单个解说创作者的二次解说当成原始素材直接改写成评书。只能提取事实线索、做引用记录，并尽量交叉验证。

## 不做全视频理解，也获取视觉细节

长视频不要默认整段丢给多模态模型。用便宜的分阶段方案：

1. 获取字幕或 ASR。
2. 从字幕线索、沉默、音乐、音效、评论或用户提供时间戳中找高信息片段。
3. 只抽样关键窗口。
4. 提取少量关键帧。
5. 只让多模态模型描述这些关键帧。
6. 把视觉观察合并进 `scene.visual_details`。

这样能控制成本和上下文用量，同时保留有用细节。

### 本地 ASR 复用

需要本地 ASR 时，先检查现有项目 runner 和 Hugging Face 缓存，再考虑安装或下载。比如用户机器上已经装过 `mlx-whisper` 或缓存过 `mlx-community/whisper-large-v3-mlx`，Agent 就应该优先复用，而不是重复下载模型。

可参考命令：

```bash
uvx --from mlx-whisper mlx_whisper <audio> \
  --model mlx-community/whisper-large-v3-mlx \
  --language zh \
  --word-timestamps False \
  --condition-on-previous-text False \
  --output-format json
```

本 Skill 包含 `scripts/check_asr_cache.mjs`，Agent 转录前可以先检查缓存。Hugging Face 显示很快的 `Fetching ... 100%` 通常只是缓存校验，不一定是重新下载权重。

## 开发里程碑

1. 建立 Skill 指令和参考文档。
2. 增加 JSON 校验和格式化脚本。
3. 增加示例产物。
4. 增加服务商适配器骨架。
5. 增加本地 CLI 包装。
6. 用户选择服务商后，再接真实 TTS 集成。
