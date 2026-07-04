# 资产与第三方说明

## 内置默认人声

仓库内置一段默认说书人参考音频：

```text
pingshu-storyteller/assets/voice/default_storyteller_c06.wav
```

它是一段本项目用本地 VoxCPM2 工作流生成的原创参考声，用来帮助本地 TTS 和支持 voice clone 的 API 更接近默认说书人口吻。它不是对真实艺人、主播或普通人的声音克隆。

参考文本和资产信息记录在：

```text
pingshu-storyteller/assets/voice/manifest.json
```

本地 VoxCPM2 / Qwen3-TTS 可以默认使用这段音频。API voice clone 路线会把参考音频上传到第三方服务商，必须先由用户确认所选服务商条款、数据政策和上传范围；如果用户不接受上传，就使用 voice design 或服务商系统音色试听。

用户可以指定自己的原创或已授权参考音频覆盖默认音色，但需要在生成产物里记录来源和授权状态。

## 内置音效

仓库内置一个醒木音效：

```text
pingshu-storyteller/assets/sfx/waking_block.wav
```

它用于评书开场、关键转折或结尾收束。Skill 的规则是少量使用：短节目通常一次，最多两次，且只作为后期音频层插入，不写进 TTS 朗读文本。

该音效由本地 Stable Audio 工作流生成并裁剪。公开使用、商用或再分发时，请自行核对 Stability AI 当前模型和服务条款，以及你所处地区的法律要求：

- Stability AI License: https://stability.ai/license
- Stability AI Acceptable Use Policy: https://stability.ai/use-policy

## TTS 模型和云服务

本项目可以对接不同 TTS provider，但仓库本身不重新分发这些模型权重或云服务 SDK。

你需要分别遵守对应模型和服务的许可证、API 条款、商用规则和数据政策。尤其要注意：

- 是否允许商用；
- 是否允许声音克隆；
- 是否允许上传第三方版权文本或音频；
- 是否保留你的输入数据；
- 是否允许把生成音频公开发布。

## 声音克隆边界

不要克隆在世艺人、主播、普通人或明星的可识别声音，除非你有明确授权。这个项目推荐使用原创说书人 persona，或者使用你自己拥有权利的参考音频。
