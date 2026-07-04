---
name: pingshu-storyteller
description: 把有来源依据的故事、剧集、采访、片段、综艺名场面、动漫剧情、个人经历或热点事件，改编成尊重传统的中文评书化脚本、通勤听书音频计划、TTS 表演脚本或可复用的故事转评书工作流。也适用于设计或评估“先收集素材细节，再生成评书化讲述”的 Agent。
---

# 评书说书 Skill

## 先记住这件事

这个 Skill 不是“给一段文字套上列位看官”。它要做的是：

1. 先拿到有依据、够具体的故事材料；
2. 再用导演视角把故事讲完整、讲好玩；
3. 最后把脚本拆成可执行的 TTS 表演计划和音频交付流程。

娱乐性优先。传统评书味是表现形式，不是目的；不要把综艺、剧集或热点写成说教稿。所有观点都只能做轻微余味，不能压住好玩、好笑、好听。

不要克隆或暗示模仿在世艺人的可识别声音。默认使用 Skill 内置的原创说书人参考音源：`assets/voice/default_storyteller_c06.wav`，元数据见 `assets/voice/manifest.json`。这条默认声线是中老年男声方向，清楚、略粗粝、带一点北方台口，单人表演，停顿讲究，笑里带刺。

## 标准工作流

### 1. 素材与来源

不要一上来写正文。先整理 `story_pack.json`：

- 事实来源、引用和不确定点；
- 人物、关系、场景、物件、冲突和结果；
- `narrative_brief`：触发点、升级过程、核心冲突、结果、后续影响、观众兴趣点；
- 如果是名场面，必须补 `signature_moments`：短关键台词、画面、动作、物件、反应；
- 如果是影视/动漫/综艺片段，必须补 `scene_trace`：按原素材顺序拆出微镜头，写清人物站位、可见动作、台词含义、对方反应和局势变化。

素材不够时，先按 `references/story-sourcing.md` 找来源。不要把单个解说博主的文案当原始素材洗稿；二次解说只能做线索，尽量交叉验证。

本地跑 ASR 前，先用 `scripts/check_asr_cache.mjs` 检查用户机器上是否已有合适缓存或 runner，不要重复下载大模型。

### 2. 权利与边界

涉及版权作品、真人、声音克隆或平台发布时，先读 `references/safety-and-rights.md`。

底线：

- 不把不确定事实写成定论；
- 不直接改写他人解说文案；
- 不克隆在世艺人声音；
- 不把用户的 API key、private key、cookie、token 写进任何产物；
- 上传到网易云或其他平台前，必须让用户确认权利和发布范围。

### 3. 导演方案与评书化改编

写正文前，先在 `pingshu_script.json` 里写 `story_design`：

- 一句话故事；
- 听众入场信息；
- 娱乐承诺和笑点引擎；
- 主问题、冲突升级和人物/关系弧线；
- beat 顺序、技巧编排和结尾落点；
- 标题设计。

标题使用原创回目式标题：两句并列，略有对仗，带人物/物件/动作/后果/反转，有一点章回体喜剧味。开头可短定场，例如“闲言少叙，书归正传。列位，今儿咱讲一回《标题》。”随后立刻交代背景和冲突。

正文必须按场景讲，不要写剧情梗概。把听众当成没看过原素材的人：谁先出现、谁先开口、谁动了什么东西、谁停住、谁误会、哪句话让关系变了，都要按时间线讲清楚。

技巧使用顺序：

1. 先保证故事完整、因果清楚；
2. 再补动作、神情、物件和空间细节；
3. 再用内心戏、捧逗、三段递进、callback、方言调料和传统定场；
4. 最后删掉不推动剧情的套话。

第一视角内心戏只在人物有明显可见反应、临场压力、坏点子生成或荒唐自我辩解时用。它必须来自场景，必须推动当前剧情。无关脑内废话宁可删掉。

写稿时按需阅读：

- `references/dramaturgy-and-style.md`
- `references/comedy-method-synthesis.md`
- `references/modern-pingshu-method-cards.md`
- `references/pingshu-tradition.md`

公开展示前跑：

```bash
node pingshu-storyteller/scripts/lint_pingshu_quality.mjs story_pack.json pingshu_script.json
```

### 4. TTS 表演计划

生成 `performance_plan.json`，不要把隐藏提示写进朗读文本。

规则：

- 评书是单人表演，全程同一个原创说书人音色；
- 角色区别靠措辞、速度、停顿、压力和轻微口吻，不靠换音色；
- `say` 事件只放真正要念出来的字；
- `pause` 事件由渲染器插入真实静音；
- `(停顿)`、`(吸气)`、音色描述和导演提示不能混进正文；
- 醒木音效是后期音频层，不送进 TTS 文本。

生成 `performance_plan.json` 时，默认把 `voice.reference_voice.path_or_id` 设为 `pingshu-storyteller/assets/voice/default_storyteller_c06.wav`，并填入 manifest 里的 `reference_text`。除非用户明确指定自己的原创或已授权参考音频，否则不要重新设计默认音色，也不要覆盖内置音源。

选择 TTS 前必须问用户：走 API 还是本地部署。用户没有明确选择并配置前，不要静默降级到 macOS `say`、Windows Narrator 或其他系统语音。

本地部署先运行：

```bash
node pingshu-storyteller/scripts/check_local_tts_device.mjs
node pingshu-storyteller/scripts/check_tts_readiness.mjs local-voxcpm2
```

本地 TTS 只保留两个推荐档：

- `local-voxcpm2`：高质量默认档。Mac 建议 Apple Silicon + 32GB 统一内存起步，推荐 48GB 以上；Windows/Linux 建议 NVIDIA 12GB VRAM + 32GB RAM 起步，推荐 16GB VRAM / 64GB RAM。
- `local-qwen3-tts`：低配兜底档。Mac 建议 Apple Silicon + 16GB 统一内存起步，推荐 24-32GB；Windows/Linux 建议 NVIDIA 8GB VRAM + 16GB RAM 起步，推荐 32GB RAM。

本地渲染器会默认读取内置人声作为 reference/prompt，不需要用户额外准备音源。如果设备暂时不适合本地跑，优先建议走云端 API，等以后有更合适的机器或云 GPU 环境再回来折腾本地模型。

API TTS 要把风格/音色/导演提示放在服务商明确不会被朗读的位置。不要把自定义标签、括号提示或音色描述拼进正文。若服务商支持 voice clone / voice enrollment，只有在用户选择该服务商、确认服务条款并接受上传内置生成音源后，才可把默认人声作为参考音频；否则用 voice design 或服务商系统音色试听。具体策略见 `references/tts-provider-matrix.md`。

道具音效规则见 `references/prop-sfx.md`。短节目一般只在开场或关键转折用一次醒木，最多两次。

正式音频生成后，必须做 ASR 回检。若出现正文没有的独立“啊/呃/嗯”、关键短台词丢失、节奏被压成一条直线，先重渲染或返工表演计划。

### 5. 交付与上传

正式音频完成后生成 `delivery_plan.json`。默认交付本地音频文件，然后询问：

```text
音频已生成。要不要上传到网易云音乐云盘？不需要的话我直接交付本地音频文件。
```

用户确认上传后，Agent 才运行网易云链路：

```bash
node pingshu-storyteller/scripts/check_delivery_readiness.mjs netease-cloud
node pingshu-storyteller/scripts/setup_netease_cloud.mjs setup_manifest.json
node pingshu-storyteller/scripts/publish_netease_cloud.mjs audio.wav upload_manifest.json
```

首次配置和扫码登录应由 Agent 主动打开网页或二维码窗口，引导用户操作；不要让用户自己抄终端命令。细节见 `references/delivery-and-publishing.md`。

## 输出契约

至少产出：

- `story_pack.json`
- `pingshu_script.json`
- `performance_plan.json`

如果生成了正式音频，还应产出：

- `delivery_plan.json`

所有 schema 见 `references/output-contracts.md`。

## 常用脚本

- `scripts/validate_skill_outputs.mjs <folder>`：校验 JSON 产物。
- `scripts/lint_pingshu_quality.mjs <story_pack.json> <pingshu_script.json>`：检查剧情薄、套话多、故事不完整等问题。
- `scripts/render_tts_plan.mjs <pingshu_script.json> <performance_plan.json>`：生成初版表演计划。
- `scripts/check_asr_cache.mjs [model-id]`：转录前检查 ASR 模型缓存。
- `scripts/check_local_tts_device.mjs`：本地 TTS 设备建议。
- `scripts/check_tts_readiness.mjs <provider>`：检查 TTS 服务商配置。
- `scripts/create_tts_job.mjs <performance_plan.json> <provider> <tts_job.json>`：生成服务商任务骨架。
- `scripts/render_api_tts_plan.mjs <pingshu_script.json> <performance_plan.json> <output_dir> --provider <provider>`：调用 API TTS。
- `scripts/render_voxcpm2_plan.py <performance_plan.json> <output_dir>`：本地 VoxCPM2 渲染并后期插入醒木。
- `scripts/render_qwen3_tts_plan.py <performance_plan.json> <output_dir>`：本地 Qwen3-TTS 渲染并后期插入醒木。
- `scripts/audit_asr_transcript.mjs <asr.json> [pingshu_script.json]`：正式音频 ASR 回检。
- `scripts/create_delivery_plan.mjs <audio_path> <delivery_plan.json>`：生成交付计划。
- `scripts/setup_netease_cloud.mjs <setup_manifest.json>`：引导网易云首次配置和登录。
- `scripts/publish_netease_cloud.mjs <audio_path> <manifest.json>`：上传到网易云音乐云盘。

`create_tts_job.mjs` 支持的服务商 id：`qwen`、`qwen-voiceclone`、`xiaomi-mimo`、`xiaomi-mimo-voiceclone`、`aliyun-cosyvoice`、`minimax`、`elevenlabs`、`local-voxcpm2`、`local-qwen3-tts`。

## 完成标准

- 来源、事实、不确定点清楚；
- 故事完整，背景、人物目标、冲突、结果能让陌生听众听懂；
- 有 `story_design`，不是直接写散文；
- 名场面保留短关键台词、动作、物件和反应；
- 正文按时间线讲场景，不拿梗概冒充故事；
- 包袱依赖具体素材，有铺垫、递进、落点和后果；
- 内心戏来自可见行为，不编造真人动机；
- 传统定场和方言少量使用，不堆车轱辘话；
- TTS 全程同一原创说书人音色；
- 音效只做后期层，频率克制；
- 正式音频通过 ASR 回检；
- 网易云上传只在用户确认后执行；
- 整体尊重评书作为表演传统。
