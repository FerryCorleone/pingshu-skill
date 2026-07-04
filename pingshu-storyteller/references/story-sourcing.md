# 素材获取指南

## 来源阶梯

优先使用更可靠的来源：

1. 公版或已授权原文。
2. 官方简介、剧集指南、新闻稿、公开转录或创作者提供素材。
3. 用户提供的文件、链接、截图、字幕或笔记。
4. 多个独立 recap 只作为线索。
5. 缺少视觉细节时，再选择性检查视频或关键帧。

## 长内容和整集硬流程

用户要听“整集”“全集”“完整一期”“最后一期”“总决赛”“某一集完整评书音频”时，不能把简介、赛果、百科或新闻通稿当成整集内容。那只能支撑“复盘”，不能支撑“还原节目/剧情”。

先在 `story_pack.source_hunt` 里记录素材搜索过程：

```json
{
  "intent_type": "full_episode | long_episode | scene_clip | event_recap",
  "searched_platforms": ["official_site", "bilibili", "youtube", "douyin", "xiaohongshu", "weibo", "search_engine"],
  "search_queries": ["节目名 第12期 完整版", "节目名 总决赛 纯享", "show name finale full episode"],
  "usable_materials": [
    {
      "source_id": "src-001",
      "platform": "string",
      "material_type": "full_video | official_clip | fan_clip | subtitle | asr | recap | article | timeline_post",
      "coverage": "full | partial | key_scene | outcome_only",
      "time_range": "00:00-12:30 或 unknown",
      "access_status": "accessible | login_required | blocked | unavailable",
      "notes": "能提供哪些剧情、动作、台词、舞台或反应细节。"
    }
  ],
  "coverage_level": "scene_level | multi_clip_scene_level | full_episode_transcript | full_episode_video_asr | user_supplied_episode | outline_only | insufficient",
  "decision": "continue_to_script | gather_more | ask_user_for_source | downgrade_to_recap"
}
```

搜索顺序建议：

1. 官方平台：节目官网、正片页、官方 YouTube 频道、官方短视频号、纯享舞台、花絮和新闻稿。
2. 长视频和社区：B 站、YouTube、腾讯视频、优酷、爱奇艺、芒果、微博视频、抖音、小红书，优先带字幕、分 P、时间戳或合集的材料。
3. 搜索引擎：同时用中文、英文、节目别名、嘉宾名、集数、舞台名、`完整版`、`完整`、`cut`、`纯享`、`reaction`、`recap`、`transcript`、`subtitle`、`timestamp` 等关键词。
4. 二手线索：影视解说、论坛、微博长文、豆瓣小组、Reddit、评论区时间线只做定位线索，不能直接洗成正文。
5. ASR/OCR：有可访问音视频时，先复用本机已有 ASR 缓存；只有关键画面缺失时，再抽关键帧或截图做视觉观察。

最低门槛：

- `scene_trace` 必须覆盖主要流程，而不是只覆盖结果；
- 每个关键场景至少有来源、可见动作/听见的台词功能、人物反应和局势变化；
- 对综艺整期，要覆盖开场规则、主要表演/任务、关键分数或投票、人物反应、转折和结局；
- 对电视剧/动漫整集，要覆盖开端、触发、几次升级、高潮和收束；
- 如果 `coverage_level` 只能到 `outline_only` 或 `outcome_only`，必须继续找素材或明确询问用户，不能生成“完整评书音频”。

用户个人娱乐收听时，Agent 可以用公开网页、用户已登录页面、视频平台片段、字幕和 ASR 来帮助理解内容；但不要把原始视频/音频重新分发。默认交付的是评书化转述音频，上传也默认限个人云盘或本地收听。

## 最小可用 story pack

一个可用的 `story_pack` 至少需要：

- 谁在场；
- 场景发生在哪里、什么时候；
- 每个人想要什么；
- 冲突由什么具体动作触发；
- 冲突如何升级；
- 身体或物件上实际发生了什么；
- 场景之后发生了什么变化；
- 观众会转述给朋友的点是什么；
- 重要场景至少两个具体细节；
- 来源链接或来源说明；
- 明确不确定点。

## 必需剧情简报

写评书正文之前，在 `story_pack` 里创建紧凑的 `narrative_brief`：

```json
{
  "hook": "前 5 秒为什么值得听？",
  "trigger": "故事最初被点燃的具体动作。",
  "causal_chain": ["A 发生了", "所以 B 反应", "导致 C"],
  "core_conflict": "情绪或社会关系上的冲突，不只是话题名。",
  "must_include_details": ["具体采访瞬间", "具体回击", "具体反转"],
  "outcome": "事情如何落地或发生变化。",
  "aftermath": "后续大家争论、调侃或记住了什么。",
  "missing_or_weak_facts": ["仍未核实的事实"]
}
```

如果 `trigger`、`causal_chain` 或 `must_include_details` 很泛，就继续找素材。不要用评书套话补洞。

## 名场面保真

用户点名“名场面”“经典片段”“综艺名片段”“采访片段”或某个具体场景时，不能只抽剧情梗概，还要单独抽 `signature_moments`。名场面的价值通常不在“发生了什么”四个字里，而在观众已经记住的那一句话、那个表情、那个动作、那个物件和镜头里的权力关系。

`signature_moments` 至少记录：

- 短关键台词或外语原句，尤其是标题、梗、名句本身；
- 可见动作、站位、手势、物件、反应和场面调度；
- 这些点分别来自哪些来源；
- 哪些必须短句保留，哪些只做转述，哪些用视觉重建；
- 如何在评书里保留记忆点，同时避免复刻长对白。

示例：

```json
{
  "type": "iconic_line",
  "content": "Say my name",
  "source_ids": ["src-001"],
  "include_policy": "must_quote_short",
  "transform_note": "这句短英文是片段标题和记忆点，正文必须听见原句，再用中文评书语气解释反差。"
}
```

版权作品里，短关键台词可以作为评论和转述的必要锚点；不要因此把整段对白照搬。综艺和采访也一样：观众记住的原话要尽量短、准、清楚，其他部分用自己的话讲。

## 热点事件标准

讲互联网热点时，最小可用链条是：

```text
触发点 -> 网友如何解读 -> 对方如何反击 -> 如何升级 -> 现实结果 -> 结果后的梗
```

脚本应该先把这条链讲清楚，再使用表演风格。

## 处理解说/recap 创作者

解说视频和帖子可以帮助判断哪些场景重要，但不能复制他们的文字或结构。把它们当二手来源。

使用 recap 时：

- 记录为来源；
- 提取事实主张和时间戳线索；
- 重要细节尽量交叉验证；
- 从 `story_pack` 重写，不从 recap 文案重写。

## 处理长视频

不要默认整段做多模态理解。分阶段抽取：

1. 先拿字幕或 ASR。
2. 如果用户知道时间戳，先让用户给。
3. 搜索场景简介或剧集指南。
4. 只抽样关键窗口找视觉细节。
5. 把视觉观察写进 `scene.visual_details`，并标注不确定。

## 本地 ASR 复用规则

转录平台视频或音频前，检查用户是否已有 ASR 工作流或 Hugging Face 模型缓存。

推荐顺序：

1. 找现有项目脚本，看是否已经解决同类 ASR 问题。
2. 运行 `scripts/check_asr_cache.mjs mlx-community/whisper-large-v3-mlx` 或等价缓存检查。
3. 如果有合适缓存，用 `uvx --from mlx-whisper mlx_whisper` 或现有项目 runner。
4. 对 recap 或表演样本，使用 `--condition-on-previous-text False`，减少长上下文带来的重复幻觉。
5. 下载新 ASR 模型或切换 ASR 家族前先问用户。

做风格研究时，ASR 文本是分析节奏和结构的证据，不是可复制的来源文本。明显的人名识别错误可以在笔记中修正，然后只提取可迁移手法。

## 不确定性标记

使用清楚标签：

- `confirmed`：来源直接支持。
- `inferred`：从来源合理推断。
- `uncertain`：证据不足。
- `user_claim`：用户提供但未独立核实。

如果无法找到用户要求内容的来源，直接说明，并可提供同主题的原创故事作为替代。

## 要避免的失败

坏输出：

- 只写“双方网友吵起来了”，没有采访、原话、帖子或具体导火索。
- 真实钩子很具体，却写成泛泛的“足球王国大战动漫梦想”。
- 评书词占篇幅，却不增加故事信息。

好输出：

- 说清楚导火索；
- 解释双方为什么觉得被冒犯；
- 包含最好笑或最锋利的反转；
- 用评书节奏强化事实，不是遮住缺失事实。
