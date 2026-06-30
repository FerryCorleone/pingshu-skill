---
name: pingshu-storyteller
description: Create respectful Chinese pingshu-style adaptations from sourced story material. Use when a user asks to turn a public-domain chapter, episode, interview, scene, drama/anime/variety recap, personal story, or current event into a pingshu script, commute-listening audio plan, TTS-ready performance script, or reusable story-to-pingshu workflow. Also use when building or evaluating agents that gather source details before generating pingshu-style narration.
---

# Pingshu Storyteller

## Core Rule

Never start by writing the pingshu prose. Build a sourced `story_pack` first, then adapt it into `pingshu_script`, then create a provider-neutral `performance_plan`.

## Workflow

1. **Clarify the target only if necessary**
   Use reasonable assumptions for style, length, and provider. Ask only when the requested source is inaccessible, legally risky, or too ambiguous.

2. **Build `story_pack`**
   Gather or extract story facts, scene details, characters, conflicts, visual actions, and uncertainties. If the user requests an existing work or event, do not fabricate missing facts.

   Read `references/story-sourcing.md` when source material is not already provided.

3. **Check rights and respect**
   Avoid cloning living artists, laundering recap creators, or presenting uncertain claims as fact.

   Read `references/safety-and-rights.md` for copyrighted works, real people, voice cloning, or platform publishing.

4. **Create pingshu adaptation**
   Convert scenes into beats with opening, setup, action expansion, narrator aside, release, and hook. Use northern flavor through rhythm and sentence shape, not excessive dialect spelling.

   Read `references/pingshu-tradition.md` and `references/dramaturgy-and-style.md` before writing high-stakes or public-facing scripts.

5. **Create TTS performance plan**
   Split prose into short renderable segments with pauses, emphasis, effects, voice direction, and optional music bed. Keep TTS instructions clean and minimal.

   Read `references/tts-provider-matrix.md` when choosing API or local TTS.

6. **Self-critique**
   Check factual fidelity, pingshu craft, dialect restraint, humor mechanism, source sufficiency, and TTS renderability.

## Output Contract

Use the schemas in `references/output-contracts.md`.

Produce at least:

- `story_pack.json`
- `pingshu_script.json`
- `performance_plan.json`

When the user only wants a quick answer, summarize these artifacts in chat but keep the same internal sequence.

## Helpful Scripts

- `scripts/validate_skill_outputs.mjs <folder>` validates example or generated JSON artifacts.
- `scripts/render_tts_plan.mjs <pingshu_script.json> <performance_plan.json>` creates a starter performance plan.
- `scripts/create_tts_job.mjs <performance_plan.json> <provider> <tts_job.json>` creates a provider-specific render job scaffold for API or local TTS.
- `scripts/export_plaintext.mjs <pingshu_script.json> <output.txt>` exports readable prose.

Supported provider ids for `create_tts_job.mjs`: `openai`, `aliyun-cosyvoice`, `minimax`, `elevenlabs`, `local-cosyvoice`, `gpt-sovits`, `f5-tts`, `indextts`.

The scripts use only Node.js built-in modules and should work on macOS, Windows, and Linux.

## Quality Bar

The result is acceptable only if:

- source facts and uncertainty are visible,
- flat actions are expanded through scene craft rather than catchphrase stuffing,
- the storyteller persona is original and not a real artist imitation,
- TTS instructions are segmented and renderable,
- the adaptation respects pingshu as a performance tradition.
