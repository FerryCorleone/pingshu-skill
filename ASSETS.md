# 资产与第三方说明

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
