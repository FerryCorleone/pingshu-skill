# Skill 架构决策

## 结论

当前保留一个用户可见的 `pingshu-skill` Skill，内部拆成三段子工作流：

```text
素材获取 -> 评书化改编 -> TTS 渲染
```

暂时不要把它拆成三个独立公开 Skill。

## 为什么现在一个 Skill 更好

用户真正要的不是单独“跑 ASR”或“生成 TTS 文件”。用户要的是：

```text
我想把这个故事听成一段好玩的现代评书。
```

这个目标有严格顺序：

1. 获取或核验来源事实；
2. 建立有细节的 `story_pack`；
3. 改成评书化文本；
4. 设计表演节奏；
5. 用用户选择的 TTS 服务商渲染。

如果把这三段都做成用户可见 Skill，用户就必须知道什么时候该调用哪个、怎么切换、怎么传递中间文件。体验会像工具箱，而不是 Agent。

## 怎么保持模块化

对外一个入口，对内分层：

| 内部模块 | 文件 | 契约 |
| --- | --- | --- |
| 素材获取 | `references/story-sourcing.md`、`scripts/check_asr_cache.mjs` | 输出 `story_pack.json` |
| 评书化改编 | `references/dramaturgy-and-style.md`、`references/modern-pingshu-method-cards.md`、`references/pingshu-tradition.md` | 输出 `pingshu_script.json` |
| 表演与 TTS | `references/tts-provider-matrix.md`、`scripts/create_tts_job.mjs`、`scripts/render_voxcpm2_plan.py`、`assets/voice/default_storyteller_c06.wav` | 输出 `performance_plan.json` 和音频 |
| 校验 | `scripts/validate_skill_outputs.mjs`、`scripts/lint_pingshu_quality.mjs` | 拦截薄剧情和弱风格 |

这样 Agent 内部有清楚路由，但不会把太多选择暴露给普通用户。

## 以后什么时候再拆

当某个子流程可以脱离评书项目，单独服务其他场景时，再拆成 Skill 集合：

1. `story-source-packager`：通用素材获取、ASR 复用、场景细节提取。
2. `modern-pingshu-adapter`：从已经整理好的 story pack 做纯文本评书化改编。
3. `tts-performance-renderer`：通用口播、评书、有声书、讲解类内容的表演渲染。

到那时，`pingshu-skill` 仍然作为总编排 Skill；高级 Agent 可以直接调用子 Skill，普通用户还是只调用一个总入口。

## 用户体验规则

默认体验：

```text
用户要一段评书音频 -> 调一个 Skill -> Agent 内部跑完整链路
```

高级体验：

```text
用户明确只要素材、只要脚本、只要 TTS -> 执行对应内部模块
```

## 当前项目形态

当前仓库保持：

```text
pingshu-skill/SKILL.md        # 用户可见入口
pingshu-skill/references/     # 子工作流说明
pingshu-skill/scripts/        # 可复用检查/渲染脚本
docs/                               # 产品、研究、架构文档
runs/                               # 本地实验和输出，默认不入库
```

这样开源结构简单，同时保留以后发展成 Skill 集合的空间。
