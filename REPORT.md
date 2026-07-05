# pingshu.Skill 开源说明

## 这是什么

`pingshu.Skill` 是一个通用 Agent Skill，用来把有来源的故事、综艺名场面、剧集片段、动漫剧情、热点事件或个人故事，改成一段更像“现代评书”的中文音频内容。

它的重点不是做传统评书复刻，也不是模仿某个具体艺人，而是让 Agent 用说书的方式，把现代内容讲得更有画面、更有节奏、更好笑，也更适合通勤路上听。

## 项目特点

- **现代内容评书化**：适合综艺、剧集、动漫、采访、热点和用户自己的故事。
- **先有素材，再写故事**：要求 Agent 先确认来源和剧情细节，不鼓励凭空编。
- **更重视好听好笑**：保留评书的节奏、开场、停顿、醒木和单人表演感，但不把文本写成老派套话。
- **自带 TTS 选择建议**：支持本地模型，也支持 API TTS；用户可以按电脑配置和成本选择。
- **可生成完整音频**：脚本、表演计划、TTS 合成、醒木音效和音频交付都放在同一个 Skill 里。

## 适合谁

- 想把喜欢的名场面做成通勤音频的人；
- 想用 Agent 做内容改编和音频创作的人；
- 想研究“传统说书形式 + 现代内容 + AI TTS”的开发者和创作者。

## 怎么安装

这个项目是一个通用 Skill，不绑定某一个 Agent 产品。推荐用 `skills` 管理工具安装，不需要手动 clone 仓库。

安装到当前/默认 Agent：

```bash
npx skills add FerryCorleone/pingshu-skill -g --skill pingshu-skill
```

如果你想一次同步到 `skills` 支持的所有 Agent：

```bash
npx skills add FerryCorleone/pingshu-skill -g --skill pingshu-skill --agent '*' --yes
```

更新到最新版本：

```bash
npx skills update pingshu-skill -g
```

不安装、只临时把 Skill 提示词拿出来用：

```bash
npx skills use FerryCorleone/pingshu-skill@pingshu-skill
```

安装后重新启动或刷新 Agent，让它重新加载本地 Skills。然后在对话里这样使用：

```text
使用 pingshu.Skill，把这个片段改成一段 3 分钟左右的现代评书音频。
```

如果你的 Agent 暂时不支持 `skills` 管理工具，也可以让它直接读取仓库里的 `pingshu-skill/SKILL.md`，再按里面的工作流执行。

## 需要准备什么

### 基础环境

- Node.js 18 或更高版本，能运行 `npx`；
- 一个支持读取本地 Skill 的 Agent；
- 如果要生成音频，还需要配置本地 TTS 模型或 API TTS。
- 如果想把音频同步到常用播放器，可以额外配置网易云音乐开放平台/API key，用来上传到网易云音乐云盘。

### 本地 TTS 怎么选

如果你希望不走云端 API，在自己电脑上生成音频，推荐只考虑两个档位：

| 方案 | 适合谁 | Mac 建议 | Windows / Linux 建议 |
| --- | --- | --- | --- |
| VoxCPM2 | 效果优先，默认推荐 | Apple Silicon + 32GB 统一内存起步，48GB 以上更稳 | NVIDIA 12GB VRAM + 32GB RAM 起步，16GB VRAM / 64GB RAM 更稳 |
| Qwen3-TTS 0.6B | 机器配置较低，想先跑通 | Apple Silicon + 16GB 统一内存起步，24-32GB 更稳 | NVIDIA 8GB VRAM + 16GB RAM 起步，32GB RAM 更稳 |

推荐先让 Agent 运行：

```bash
node pingshu-skill/scripts/check_local_tts_device.mjs
```

如果检测结果暂时不适合本地跑，也没关系，先走 API TTS 会更省心。等以后换机器、加显卡，或者有云 GPU 环境，再回来折腾本地模型也完全可以。

### API TTS 推荐用什么

当前主要推荐两条 API 路线：

- **小米 MiMo V2.5 TTS**：适合先跑通和快速试效果。它现在官网侧相对友好，适合爱好者低成本尝试。
- **千问/Qwen TTS**：适合作为长期备选。中文效果和稳定性不错，价格也比较适合持续生成内容。

默认情况下，`pingshu.Skill` 会优先使用随 Skill 打包的默认参考人声 `assets/voice/default_storyteller_c06.wav`：中老年男声，清楚、略粗粝，带一点北方说书台口，节奏不赶，包袱前会留一点停顿。这段音源是项目生成的原创参考声，不是真实艺人克隆。普通用户不需要从零开始设计音色，避免一不小心调成很“AI 主播”的声音。

如果你不想用默认音色，可以直接告诉 Agent 想改成什么方向，比如更年轻、更沉稳、更天津口一点，或者更像有声书。Agent 会基于这个方向重新做短样试听。

使用 API 时，只需要准备对应平台的 API key。为了安全，最好把 key 配在本机环境变量或 Agent 的安全凭据里，不要发到公开仓库、Issue 或聊天截图里。

### 网易云音乐云盘

如果你希望生成完音频后，直接在手机里的网易云音乐打开收听，可以配置网易云音乐开放平台/API key。

配置完成后，Agent 可以在用户确认后把生成的音频上传到网易云音乐云盘。这样音频不只停留在本地文件夹里，上下班路上也能直接从网易云音乐里听。

注意：

- 网易云上传是可选功能，不影响本地生成音频；
- 首次使用通常需要配置开放平台凭据，并完成账号登录；
- API key、private key、cookie、token 不能写进公开仓库或聊天记录；
- 建议只上传到自己的音乐云盘，公开发布前仍然需要确认版权和平台规则。

## 使用时怎么说更清楚

可以直接告诉 Agent：

```text
使用 pingshu.Skill，把《绝命毒师》Say my name 这个名场面做成 3 分钟以内的现代评书音频。请保留关键短台词，风格好玩一点，不要说教。TTS 用本地 VoxCPM2。
```

也可以换成 API：

```text
使用 pingshu.Skill，把这个综艺片段做成 2 分钟现代评书音频。TTS 用小米 MiMo。如果音频生成后可以上传网易云云盘，你先引导我配置需要的 API key 和登录。
```

## 注意事项

- 讲已有作品或热点时，尽量提供链接、字幕、时间戳或剧情来源。
- 不要让 Agent 直接改写别人的完整解说稿。
- 不要克隆在世艺人、主播、明星或普通人的声音，除非你有明确授权。
- 生成内容用于公开发布前，请自己确认版权和平台规则。
- 网易云音乐云盘上传适合个人收听；公开发布到电台、播客或平台推荐频道前，要额外确认权利边界。

## 目录里有什么

```text
pingshu-skill/
  SKILL.md                 # Agent 读取的 Skill 入口
  references/              # 写作、TTS、版权、交付规则
  scripts/                 # 校验、设备检测、TTS、上传辅助脚本
  assets/voice/            # 内置默认说书人参考音源
  assets/sfx/              # 内置醒木音效
examples/                  # 示例产物
docs/                      # 项目研究和设计文档
ASSETS.md                  # 音效和第三方资产说明
LICENSE                    # MIT 许可证
```

## 许可证

代码和文档使用 MIT License。内置音效、TTS 模型和云服务各自有独立许可和使用条款，使用前请自行确认。
