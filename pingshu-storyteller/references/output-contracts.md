# 输出契约

这里定义三个核心 JSON 产物。字段名保持英文，便于不同 Agent、脚本和平台复用；字段含义用中文说明。

## story_pack.json

`story_pack` 用来存放来源、事实、人物、场景和不确定点。它是防止胡编剧情的第一道门。

```json
{
  "schema_version": "1.0",
  "id": "story-pack-example",
  "request": {
    "user_goal": "string",
    "target_work_or_event": "string",
    "desired_length": "short | medium | long"
  },
  "narrative_brief": {
    "hook": "string",
    "trigger": "string",
    "causal_chain": ["string"],
    "core_conflict": "string",
    "must_include_details": ["string"],
    "scene_trace": [
      {
        "id": "trace-001",
        "order": 1,
        "source_ids": ["src-001"],
        "setting_or_frame": "这一微镜头发生在哪里，谁在画面里，站位或物件是什么。",
        "visible_action": "能被看见或听见的动作。",
        "spoken_or_paraphrased_line": "短关键台词原句，或对长对白的功能性转述。",
        "reaction": "对方表情、动作、沉默、反问或局势反应。",
        "dramatic_change": "这一拍让权力、目标、风险或笑点发生了什么变化。"
      }
    ],
    "signature_moments": [
      {
        "type": "iconic_line | visual_action | reaction | object | staging",
        "content": "短关键台词、动作或画面；台词只保留必要短句。",
        "source_ids": ["src-001"],
        "include_policy": "must_quote_short | must_paraphrase | visual_recreate | optional",
        "transform_note": "如何在评书里保留它的记忆点，同时不复刻长对白。"
      }
    ],
    "outcome": "string",
    "aftermath": "string",
    "missing_or_weak_facts": ["string"]
  },
  "sources": [
    {
      "id": "src-001",
      "type": "primary | official | user_provided | recap | inferred",
      "title": "string",
      "url_or_path": "string",
      "notes": "string"
    }
  ],
  "source_hunt": {
    "intent_type": "full_episode | long_episode | scene_clip | event_recap",
    "searched_platforms": ["official_site", "bilibili", "youtube", "douyin", "xiaohongshu", "weibo", "search_engine"],
    "search_queries": ["string"],
    "usable_materials": [
      {
        "source_id": "src-001",
        "platform": "string",
        "material_type": "full_video | official_clip | fan_clip | subtitle | asr | recap | article | timeline_post",
        "coverage": "full | partial | key_scene | outcome_only",
        "time_range": "string",
        "access_status": "accessible | login_required | blocked | unavailable",
        "notes": "string"
      }
    ],
    "coverage_level": "scene_level | multi_clip_scene_level | full_episode_transcript | full_episode_video_asr | user_supplied_episode | outline_only | insufficient",
    "decision": "continue_to_script | gather_more | ask_user_for_source | downgrade_to_recap"
  },
  "characters": [
    {
      "id": "char-001",
      "name": "string",
      "role": "string",
      "traits": ["string"]
    }
  ],
  "scenes": [
    {
      "id": "scene-001",
      "source_ids": ["src-001"],
      "status": "confirmed | inferred | uncertain | user_claim",
      "summary": "string",
      "setting": "string",
      "conflict": "string",
      "actions": ["string"],
      "visual_details": ["string"],
      "comic_or_dramatic_handles": ["string"]
    }
  ],
  "rights_notes": ["string"],
  "open_questions": ["string"]
}
```

当用户要求“名场面”“经典片段”“综艺名片段”“采访片段”或某个具体场景时，`narrative_brief.signature_moments` 是必填字段。它用于锁住观众真正想听的短关键台词、视觉动作、反应和物件。短外语名句如果是标题、梗或片段记忆点，例如 `Say my name`，不要全部意译；正文和 TTS 里应保留原句，再用中文评书语气接住。版权对白只能保留必要短句，不写长段逐字对白。

当用户要求讲已有剧集、动漫、综艺、采访或影视片段时，`narrative_brief.scene_trace` 是必填字段。它不是剧情大纲，而是原场景时间线：每一步都要写出画面、动作、对白功能、反应和局势变化。`pingshu_script.segments[].scene_trace_ids` 应尽量指向对应微镜头，避免正文变成“剧情梗概朗读”。

当用户要求整集、全集、完整一期、最后一期、总决赛或其他长内容时，`source_hunt` 是必填字段。`source_hunt.coverage_level` 必须证明 Agent 找到的是场景级材料，而不只是结局、分数、百科或新闻摘要。只有 `scene_level`、`multi_clip_scene_level`、`full_episode_transcript`、`full_episode_video_asr` 或 `user_supplied_episode` 才能继续生成“完整评书音频”；`outline_only`、`outcome_only` 或 `insufficient` 只能继续找素材、询问用户，或降级为复盘。

## pingshu_script.json

`pingshu_script` 是评书化正文，按 beat 组织。它应该从 `story_pack` 改编而来，不直接从单个 recap 洗稿。

```json
{
  "schema_version": "1.0",
  "title": "string",
  "story_pack_id": "story-pack-example",
  "storyteller_persona": {
    "id": "warm_northern_storyteller",
    "description": "原创的温暖北方说书人，不模仿真实人物。",
    "dialect_level": "light | medium | strong",
    "performance_mode": "single_performer",
    "voice_consistency": "全程同一个说书人音色"
  },
  "story_design": {
    "logline": "一句话故事：谁在什么局里，因为哪个选择，付出或补上什么代价。",
    "audience_entry": "没看过原素材的听众需要先知道的背景、规则和人物关系。",
    "entertainment_promise": "这段主要好玩在哪里，例如荒唐流程、人物吃瘪、误会升级、反差或名场面复盘。",
    "humor_engine": "主要笑点机制，例如日常错位、微动作、内心戏翻译、三段递进、回扣或单人捧逗。",
    "title_design": {
      "episode_title": "原创回目式标题，应与 pingshu_script.title 一致。",
      "style_reference": "章回体喜剧标题：两句并列、轻对仗、人物/物件 + 动作 + 后果/反转；不得直接套用现成标题。",
      "title_formula": "前半句写谁做了什么，后半句写谁遭遇什么后果或反转。",
      "comic_hook": "标题里的喜剧错位、反差或悬念。",
      "opening_line": "第一段如何用短定场和“今儿咱讲一回《标题》”入书。"
    },
    "technique_arrangement": {
      "overall_strategy": "这一版怎么编排技巧：哪里讲直，哪里抖包袱，哪里上第一视角内心戏，哪里给一点传统评书味。",
      "technique_budget": {
        "first_person_inner_monologue_max": 2,
        "traditional_flavor_max": 2,
        "catchphrase_max": 3
      },
      "first_person_inner_monologue_slots": [
        {
          "segment_id": "seg-005",
          "character": "string",
          "trigger": "可见动作或当场压力。",
          "plot_relevance": "这段内心戏为什么必须出现在这个剧情节点，不能只是闲扯。",
          "decision_pressure": "人物此刻面临的诱因、风险、面子、规则或坏主意压力。",
          "bad_idea_logic": "人物如何把歪心思、吐槽或自我辩解想通，最好能形成喜剧化逻辑链。",
          "action_payoff": "这段内心戏马上导向哪个外部动作或后果。",
          "voice_shape": "夸张、短促、口语化，像人物一瞬间脑内冒出来的念头。",
          "boundary_note": "说明如何避免把喜剧化内心戏写成真人真实动机。"
        }
      ],
      "traditional_flavor_slots": [
        {
          "segment_id": "seg-001",
          "type": "short_opening | mini_guankou | rhythmic_couplet | waking_block_callback",
          "purpose": "定调、转场、压住包袱或收口。",
          "restraint": "短，不复古堆词，不盖住现代故事。"
        }
      ],
      "leave_plain_slots": ["seg-002"],
      "restraint_notes": "说明哪些地方故意不用技巧，让故事自己走。"
    },
    "central_question": "听众会一路追问的问题，优先写成娱乐悬念，例如人怎么跑了、箱子怎么追回、场面怎么更乱。",
    "protagonist_arc": "主讲人物或关系从哪里开始，到哪里结束。",
    "stakes": "这件事为什么值得继续听：输赢、面子、尴尬、误会、反转或情绪代价，不必强行上价值。",
    "beat_order": [
      "cold_hook",
      "context",
      "trigger",
      "complication",
      "low_point",
      "turn",
      "resolution",
      "aftertaste"
    ],
    "opening_contract": "前 1-2 段承诺给听众的看点：背景、爆点和继续听的理由。",
    "ending_contract": "结尾要兑现的最后一个笑点、回扣、荒唐感或轻微余味；不要强行教育观众。"
  },
  "segments": [
    {
      "id": "seg-001",
      "purpose": "cold_hook | context | setup | trigger | complication | action | low_point | turn | release | resolution | hook | aftertaste",
      "source_scene_ids": ["scene-001"],
      "scene_trace_ids": ["trace-001"],
      "story_function": "这一段在完整故事里承担的功能，例如交代规则、建立关系、制造悬念、推高代价或完成回扣。",
      "text": "string",
      "comedy_design": {
        "mechanism": "identity_account | daily_mismatch | micro_action | inner_monologue | first_person_inner_monologue | traditional_flavor | rule_of_three | misdirection | callback | none",
        "fact_anchor": "这个包袱依赖的来源事实或可见动作。",
        "setup_expectation": "听众先被建立的正常预期。",
        "punch_or_turn": "最后抖响或转向的点。",
        "boundary_note": "涉及真人或不确定心理时，说明如何避免编造动机。"
      },
      "performance": {
        "emotion": "string",
        "pace": "slow | medium_slow | medium | quick",
        "pause_after_ms": 300,
        "emphasis": ["string"],
        "sfx_after": ["waking_block"]
      }
    }
  ],
  "style_notes": ["string"],
  "fidelity_notes": ["string"]
}
```

`story_design` 是强制字段。它相当于导演/编剧层，先保证故事完整，再决定哪里用评书、相声或脱口秀技巧。导演层不是说教层，必须先说明娱乐承诺、笑点引擎和技巧编排。

`title_design` 是强制字段。它负责让标题先定调：标题要像章回体喜剧的“回目”，两句并列、轻微对仗，能提示人物、动作、物件、后果或反转。可以参考《武林外传》片名的结构气质，但必须原创，不直接套用或改写现成标题。

开头可以用短传统定场引出标题，例如“闲言少叙，书归正传。列位，今儿咱讲一回《标题》。”这个报回目段要短，醒木应紧跟标题之后落下；背景、人物关系和核心冲突从下一段开始。如果把标题、背景和冲突都塞进 `seg-001`，再把 `sfx_after` 挂在 `seg-001` 后面，醒木就会落得太晚。

`technique_arrangement` 是强制字段。它负责把“武器库”编排成节目：第一视角内心戏、传统定场、贯口、回扣和留白都要先有预算和位置。没有编排，宁可少用技巧。

第一视角内心戏 slot 必须服务剧情决策：写清触发、剧情相关性、当场压力、坏点子/吐槽逻辑和外部动作 payoff。只提供一句“好笑脑补”不合格。

`story_function` 是推荐字段。公开发布脚本、长音频和复杂素材建议每段都填写，防止段落只负责“有味儿”但不推进故事。

`comedy_design` 是推荐字段，不强制每段都有。重要笑点、内心戏、争议真人热点和公开发布脚本建议填写它，方便检查笑点是否依赖具体素材，而不是靠套话、粗口或无依据心理描写。

## performance_plan.json

`performance_plan` 是给 TTS 和后期的表演计划。它不绑定某个 provider。

默认情况下，`reference_voice.path_or_id` 使用内置人声 `pingshu-storyteller/assets/voice/default_storyteller_c06.wav`，并把 `assets/voice/manifest.json` 里的 `reference_text` 一并写入计划。用户如果指定自己的原创或已授权参考音频，可以覆盖这些字段，但必须记录授权状态。

```json
{
  "schema_version": "1.0",
  "title": "string",
  "voice": {
    "persona_id": "warm_northern_storyteller",
    "provider_preference": "api | local | undecided",
    "consent_required": false,
    "performance_mode": "single_performer",
    "timbre_lock": true,
    "role_voice_policy": "same voice; character shifts use pacing, pressure, wording, and pauses instead of separate timbres",
    "reference_voice": {
      "required_for_split_render": "recommended | required | not_required",
      "path_or_id": "pingshu-storyteller/assets/voice/default_storyteller_c06.wav",
      "manifest": "pingshu-storyteller/assets/voice/manifest.json",
      "reference_text": "列位，闲言少叙，书归正传。今儿咱讲一段新鲜故事，有人物，有包袱，也有那么一点北方说书的劲儿。您把耳朵支棱起来，咱慢慢往下说。",
      "consent_status": "project_generated_original | original | licensed | user_owned | unknown",
      "rights_note": "Bundled generated original storyteller reference voice; not a real-person clone."
    },
    "notes": "string"
  },
  "segments": [
    {
      "id": "seg-001",
      "text": "string",
      "pace": "medium_slow",
      "emotion": "warm_mischief",
      "pause_after_ms": 350,
      "events": [
        {
          "type": "say",
          "text": "string",
          "tempo": 0.82
        },
        {
          "type": "pause",
          "ms": 750,
          "reason": "hold before reveal"
        },
        {
          "type": "say",
          "text": "string"
        }
      ],
      "emphasis": ["string"],
      "sfx_after": ["waking_block"]
    }
  ],
  "audio_bed": {
    "music_style": "轻微节奏垫，可选",
    "sfx_palette": ["waking_block"],
    "prop_sfx_policy": {
      "allowed_ids": ["waking_block"],
      "insert_mode": "post_tts_timeline",
      "short_episode_max_hits": 2,
      "minimum_gap_sec": 45,
      "default_gain_db": -6,
      "post_sfx_pause_ms": 420,
      "post_sfx_pause_min_ms": 320,
      "post_sfx_pause_max_ms": 650,
      "notes": "醒木只用于开场定场、重大转折留扣或结尾收束；不要写进朗读文本。"
    },
    "loudness_note": "音乐和音效必须低于人声。"
  },
  "rendering_notes": ["string"]
}
```

### 表演事件

当作品需要真正的评书节奏，而不是一排段落级语速标签时，使用 `events`。

- `say` 事件是唯一送给 TTS 的文本。
- `pause` 或 `silence` 事件必须渲染成真实静音，通常 350-1200 ms。
- 不要把 `(停顿)`、`(吸气)`、`(意味深长)` 这类隐藏导演指令写进 `say.text`；很多 TTS 会直接念出来。
- 如果 `欸`、`嚯`、克制的 `我操` 需要被听见，必须写成明确的 `say` 事件。
- 所有事件保持同一个说书人音色。评书里的角色变化靠措辞、压力、tempo 和停顿，不靠换声音。

### 道具音效

`sfx_after` 只表示后期音效，不能送给 TTS。当前内置音效只推荐 `waking_block`；历史产物里的 `waking_block_soft`、`waking_block_firm`、`waking_block_light`、`waking_block_medium` 和 `waking_block_close` 可当作 `waking_block` 兼容处理。

醒木是标点，不是鼓点：短节目默认 1 次，最多 2 次；两次之间至少留 45 秒左右。`audio_bed.prop_sfx_policy` 是推荐字段，用来说明本条音频是否允许道具音效、允许哪些资产、频率预算、默认增益和醒木后的停顿范围。具体规则见 `references/prop-sfx.md`。

## delivery_plan.json

`delivery_plan` 是正式音频完成后的交付计划。它不参与评书创作本身，只负责说明音频在哪里、默认怎么交付、用户确认后能否上传到第三方平台。

```json
{
  "schema_version": "1.0",
  "title": "string",
  "created_at": "2026-07-04T00:00:00.000Z",
  "source_audio": {
    "path": "string",
    "format": "m4a | mp3 | wav | flac | aac",
    "duration_sec": 0,
    "bytes": 0,
    "qa_status": "passed | warning | not_run",
    "rights_status": "personal_generated | user_authorized | uncertain"
  },
  "user_prompt": "音频已生成。要不要上传到网易云音乐云盘？不需要的话我直接交付本地音频文件。",
  "default_delivery": {
    "target": "local-file",
    "status": "ready",
    "instructions": ["string"]
  },
  "targets": [
    {
      "id": "local-file",
      "enabled": true,
      "requires_user_confirmation": false,
      "status": "ready",
      "instructions": ["string"]
    },
    {
      "id": "netease-cloud",
      "enabled": false,
      "requires_user_confirmation": true,
      "status": "needs-readiness-check",
      "readiness_command": "node pingshu-storyteller/scripts/check_delivery_readiness.mjs netease-cloud",
      "publish_command_hint": "node pingshu-storyteller/scripts/publish_netease_cloud.mjs <audio_path> <manifest.json>",
      "setup_notes": [
        "首次使用需要安装网易云音乐官方 ncm-cli。",
        "首次使用需要 Agent 打开网易云音乐开放平台，让用户在网页里取得 API 凭证。",
        "Agent 运行 setup_netease_cloud.mjs，用本机输入框收 App ID / Private Key，并写入 ncm-cli 配置。",
        "上传前 Agent 打开用户可见的 ncm-cli login 二维码窗口，用户用网易云音乐 App 扫码登录。"
      ]
    }
  ],
  "publish_manifest_path": null,
  "notes": ["string"]
}
```

生成正式音频后，Agent 应先创建这个文件，再询问用户是否进入网易云上传。用户选择“不上传”时，`local-file` 就是完成态。

`netease-cloud` 的 `enabled` 默认是 `false`，表示“需要用户确认后才启用”，不是说这个能力不可用。确认上传后，Agent 应先运行 `readiness_command`；如果 CLI、开放平台 API 凭证或扫码登录缺失，就停在配置步骤，不能假装上传成功。

`delivery_plan.json` 和上传 manifest 禁止保存任何 API key、private key、cookie、token、授权头或用户登录凭据。只能记录“是否已配置”“下一步命令”“上传结果摘要”和脱敏后的错误信息。
