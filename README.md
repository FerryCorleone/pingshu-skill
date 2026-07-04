# pingshu-storyteller

把有来源的故事、综艺名场面、剧集片段、动漫剧情或热点事件，改成一段好听、好笑、能让人通勤路上听的中文评书音频。

它不是一个“评书风提示词”，而是一个 Agent Skill：先帮你整理真实素材和场景细节，再写成现代评书脚本，最后生成可交给 TTS 的表演计划。用户可以选择本地开源 TTS，也可以选择云端 API。

## 这个项目有什么特色

- **先讲故事，再讲风格**：不靠“列位看官”凑味儿，而是先把背景、人物、冲突、动作、反应讲清楚。
- **保留名场面记忆点**：经典短台词、关键物件、动作和反应不能漏，比如外语短名句会保留原句，再用中文评书口吻接住。
- **导演式写作**：每次写正文前先做 `story_design`，明确钩子、主问题、笑点引擎、节奏和结尾。
- **娱乐优先**：传统评书味是形式，不把综艺或热点写成说教稿。
- **TTS 中立**：脚本和表演计划不绑定某一家模型。可以走本地 VoxCPM2 / Qwen3-TTS，也可以走云端 API。
- **单人说书**：全程同一个原创说书人音色，人物区别靠话术、节奏和停顿，不靠乱换音色。
- **可选音效层**：内置一个醒木音效，作为后期层少量插入，不喧宾夺主。
- **交付闭环**：生成音频后，默认交付本地文件；用户确认后可尝试上传到网易云音乐云盘。

## 适合谁

适合：

- 想把喜欢的剧集、综艺、动漫或热点讲成有趣音频的人；
- 想研究“Agent 如何先找素材、再创作、再合成音频”的开发者；
- 想把传统评书表达和现代内容结合起来的创作者。

不适合：

- 直接洗稿其他解说博主；
- 克隆某位在世艺人的声音；
- 在没有版权或授权的情况下公开发布完整影视/综艺复刻内容；
- 只给一句“随便讲讲”，却要求事实完全准确。

## 安装

### 1. 克隆仓库

```bash
git clone https://github.com/FerryCorleone/pingshu-storyteller.git
cd pingshu-storyteller
```

### 2. 安装到 Codex Skills

如果你使用 Codex，可以把 Skill 目录链接到本机 Skills 目录：

```bash
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
ln -sfn "$(pwd)/pingshu-storyteller" "${CODEX_HOME:-$HOME/.codex}/skills/pingshu-storyteller"
```

重启或刷新 Codex 后，就可以在对话里说：

```text
使用 pingshu-storyteller，把这个片段改成一段 3 分钟左右的现代评书音频。
```

其他 Agent 平台也可以用同样思路：把 `pingshu-storyteller/` 复制或链接到该平台的 Skill 目录即可。

### 3. 运行校验

需要 Node.js 18 或更高版本。

```bash
node pingshu-storyteller/scripts/validate_skill_outputs.mjs examples
```

如果你本机也安装了 Codex 的 `skill-creator`，还可以运行：

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" pingshu-storyteller
```

## 一次完整流程是什么样

1. **确认目标**：用户告诉 Agent 想听什么内容，例如某个综艺名场面、剧集片段或热点事件。
2. **找素材**：Agent 先整理来源，必要时搜索、读取用户给的链接、用 ASR 转录，生成 `story_pack.json`。
3. **做导演方案**：Agent 先设计完整故事结构、标题、笑点、节奏和关键场面，生成 `pingshu_script.json`。
4. **写评书正文**：正文按场景时间线推进，加入少量北方口吻、内心戏、捧逗、醒木式转折等技巧。
5. **生成表演计划**：Agent 把正文拆成 `say` 和 `pause` 事件，生成 `performance_plan.json`。
6. **选择 TTS**：用户选择本地模型或云端 API。没有配置前，Agent 不应该静默用系统语音糊弄。
7. **渲染音频**：TTS 只念正文，停顿和醒木音效由后期插入。
8. **回检与交付**：正式音频完成后做 ASR 回检，再交付本地文件；用户确认后才上传网易云。

## 本地 TTS 怎么选

本项目默认推荐两档：

| 方案 | 定位 | Mac 建议 | Windows/Linux 建议 |
| --- | --- | --- | --- |
| VoxCPM2 | 高质量默认档 | Apple Silicon + 32GB 统一内存起步，48GB 以上更稳 | NVIDIA 12GB VRAM + 32GB RAM 起步，16GB VRAM / 64GB RAM 更稳 |
| Qwen3-TTS 0.6B | 低配兜底档 | Apple Silicon + 16GB 统一内存起步，24-32GB 更稳 | NVIDIA 8GB VRAM + 16GB RAM 起步，32GB RAM 更稳 |

设备更低时，建议直接走云端 API。

先运行：

```bash
node pingshu-storyteller/scripts/check_local_tts_device.mjs
```

## 目录结构

```text
pingshu-storyteller/
  SKILL.md                 # Skill 入口，给 Agent 读
  references/              # 详细方法、TTS、版权、交付规则
  scripts/                 # 校验、TTS、网易云上传等辅助脚本
  assets/sfx/              # 内置醒木音效
docs/                      # 面向开发者和小白用户的说明
examples/                  # 示例 story/script/performance/delivery 产物
REPORT.md                  # 开源说明报告
ASSETS.md                  # 音效和第三方资产说明
LICENSE                    # 开源许可证
```

## 注意事项

- 这个项目会帮助你“转述、评论、戏仿、解读”内容，但不替你解决所有版权问题。
- 不要把其他创作者的解说稿拿来直接改写发布。
- 不要用它克隆在世艺人或普通人的声音，除非你有明确授权。
- API key、private key、cookie、token 不要写进任何 JSON、日志或聊天记录。
- 网易云上传只建议用于用户自己的音乐云盘或私有收听场景；公开发布前请确认权利边界和平台规则。

## 开发者校验

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" pingshu-storyteller
node pingshu-storyteller/scripts/validate_skill_outputs.mjs examples
node pingshu-storyteller/scripts/lint_pingshu_quality.mjs examples/story_pack.json examples/pingshu_script.json
```

## 许可证

代码和文档使用 MIT License。内置音效和第三方模型/服务有各自的许可和使用边界，见 [ASSETS.md](./ASSETS.md)。
