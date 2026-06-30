# Story Sourcing Guide

## Source Ladder

Use the highest reliable rung available:

1. Public-domain or licensed primary text.
2. Official synopsis, episode guide, press kit, public transcript, or creator-provided material.
3. User-provided files, links, screenshots, subtitles, or notes.
4. Multiple independent recaps as leads.
5. Selective video/keyframe inspection for missing visual detail.

## Minimum Viable Story Pack

A useful `story_pack` needs:

- who is present,
- where and when the scene happens,
- what each person wants,
- what sparked the conflict,
- what made it escalate,
- what physically happens,
- what changes after the scene,
- what the audience would repeat to a friend,
- at least two concrete details for important scenes,
- source links or source notes,
- explicit uncertainty.

## Required Narrative Brief

Before writing pingshu prose, create a compact `narrative_brief` in `story_pack`:

```json
{
  "hook": "Why should a listener care in the first 5 seconds?",
  "trigger": "The first concrete thing that started the story.",
  "causal_chain": ["A happened", "so B reacted", "which caused C"],
  "core_conflict": "The emotional/social contest, not just the topic.",
  "must_include_details": ["specific interview moment", "specific comeback", "specific reversal"],
  "outcome": "What settled or changed the situation.",
  "aftermath": "What people joked about or argued after the outcome.",
  "missing_or_weak_facts": ["facts not yet verified"]
}
```

If `trigger`, `causal_chain`, or `must_include_details` are generic, keep sourcing. Do not fill the gap with pingshu filler.

## Current-Event Standard

For trending internet stories, the minimum useful chain is:

```text
trigger -> online interpretation -> counter-reaction -> escalation -> real-world result -> post-result memes
```

The script should explain this chain clearly before leaning on performance style.

## Handling Recap Creators

Recap videos and posts can help identify which scenes matter, but do not copy their wording or structure. Treat them as secondary sources.

When using recap material:

- cite it as a source,
- extract factual claims and timestamp hints,
- corroborate important details where possible,
- rewrite from the `story_pack`, not from the recap prose.

## Handling Long Video

Do not default to full-video multimodal understanding. Use staged extraction:

1. Get transcript/subtitles if available.
2. Ask the user for timestamps if they know the moment.
3. Search for scene summaries or episode guides.
4. Sample only key windows for visual details.
5. Add visual observations to `scene.visual_details` with uncertainty.

## Uncertainty Language

Use clear tags:

- `confirmed`: directly supported by source.
- `inferred`: reasonable inference from source.
- `uncertain`: insufficient support.
- `user_claim`: provided by user but not independently verified.

If a requested work cannot be sourced, say so and offer a generic original story in the same theme instead.

## Failure To Avoid

Bad output:

- "双方网友吵起来了" without the interview, quote, post, or concrete spark.
- generic "football kingdom versus anime dream" when the actual viral hook was more specific.
- pingshu phrases that take space but do not add story information.

Good output:

- names the spark,
- shows why each side felt provoked,
- includes the best reversal or payoff,
- uses pingshu rhythm to sharpen the facts, not hide missing facts.
