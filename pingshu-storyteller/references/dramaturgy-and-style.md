# Dramaturgy And Style Guide

## Style Target

Use "modern high-density pingshu": sharp current-event storytelling with pingshu timing, pauses, turns, and narrator attitude. Do not write antique filler unless the source itself calls for it.

The desired effect is:

```text
clear viral hook + compact causal chain + one or two pingshu performance turns
```

not:

```text
old-fashioned opening + repeated catchphrases + vague summary
```

## Scene Conversion Pipeline

For each scene:

1. Identify the status relation: who is high, low, exposed, surprised, or pretending.
2. Identify the conflict engine: revenge, face, misunderstanding, challenge, test, temptation, reversal, or absurd bureaucracy.
3. Find the sensory detail: hand movement, eye line, object, distance, sound, pause, crowd reaction.
4. Choose the pingshu move: grand elevation, comic demotion, suspense delay, narrator aside, sound cue, or cliffhanger.
5. Write short segments that TTS can render cleanly.

## Segment Density Rule

Each segment must contain at least one of:

- a new verified fact,
- a causal link,
- a concrete quote/claim paraphrase,
- a visual or social detail,
- a reversal,
- a punchline that depends on the facts.

Delete or rewrite any segment whose only job is "sounds like pingshu."

## Modern Pingshu Controls

- Use at most one opening marker such as `列位` in the first segment and one closing callback near the end.
- Keep most sentences plain, fast, and specific.
- Use performance direction for old-school flavor: pause, speed, emphasis, waking block, narrator eyebrow.
- Use dialect markers as seasoning, not the meal.
- Prefer "这事儿坏就坏在..." over generic ancient allusions.

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
- Do not default to `三英战吕布`, `武松打虎`, or similar boilerplate openings for modern internet stories.
- Do not hide missing story details behind "网线两头很热闹" language.

## Current-Event Beat Template

```text
1. Cold open: the exact viral contradiction.
2. Trigger: who said/did what.
3. Interpretation: why side A felt provoked.
4. Counterpunch: why side B fired back.
5. Escalation: the funniest or sharpest online back-and-forth.
6. Result: what happened in the real match/event.
7. Aftermath: what became the meme or final irony.
```
