# Dramaturgy And Style Guide

## Scene Conversion Pipeline

For each scene:

1. Identify the status relation: who is high, low, exposed, surprised, or pretending.
2. Identify the conflict engine: revenge, face, misunderstanding, challenge, test, temptation, reversal, or absurd bureaucracy.
3. Find the sensory detail: hand movement, eye line, object, distance, sound, pause, crowd reaction.
4. Choose the pingshu move: grand elevation, comic demotion, suspense delay, narrator aside, sound cue, or cliffhanger.
5. Write short segments that TTS can render cleanly.

## Flat Action Expansion

Use this pattern when source material says only "A did X to B":

```text
1. Freeze the room.
2. Raise the action as if it matters.
3. Delay the impact.
4. Add a sensory cue.
5. Externalize the victim's inner reaction.
6. Let the narrator comment.
7. Hook the next move.
```

Example skeleton:

```text
Raw: A slapped B. B stared back.
Adapted beat:
列位，这一巴掌在纸上写着轻巧，真到了当场，可就不是一只手的事。
[pause]
只见 A 肩头不动，腕子一翻，半空里像递来一封加急文书。
[sfx: waking_block_light]
啪！
B 先没说话，眼神往上一抬，那意思分明是：好小子，你拿我这张脸试鼓点来了？
```

## Humor Mechanisms

Prefer one clear mechanism per beat:

- **反差**: noble setup, mundane payoff.
- **吃瘪**: a powerful character loses face.
- **错位**: ancient diction meets modern object, used sparingly.
- **拆台**: narrator punctures over-serious action.
- **递进**: three escalating descriptions, third turns.
- **误会**: audience knows what character misses.

## Segment Template

```json
{
  "id": "seg-001",
  "purpose": "opening | setup | action | aside | release | hook",
  "source_scene_ids": ["scene-001"],
  "text": "列位，今儿咱们单表一桩热闹事。",
  "performance": {
    "emotion": "warm_mischief",
    "pace": "medium_slow",
    "pause_after_ms": 350,
    "emphasis": ["单表", "热闹事"],
    "sfx_after": []
  }
}
```

## Style Guardrails

- Do not overuse "列位看官"; one or two times per short piece is enough.
- Do not turn every sentence into a joke; pingshu needs straight lines to make the comic turns land.
- Do not use obscure dialect if it hurts comprehension.
- Do not make the narrator smarter by making the source characters stupid unless that is faithful to the scene.

