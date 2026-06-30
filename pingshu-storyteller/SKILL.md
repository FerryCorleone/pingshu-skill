---
name: pingshu-storyteller
description: Create respectful Chinese pingshu-style adaptations from sourced story material. Use when a user asks to turn a public-domain chapter, episode, interview, scene, drama/anime/variety recap, personal story, or current event into a pingshu script, commute-listening audio plan, TTS-ready performance script, or reusable story-to-pingshu workflow. Also use when building or evaluating agents that gather source details before generating pingshu-style narration.
---

# Pingshu Storyteller

## Core Rules

Never start by writing the pingshu prose. Build a sourced `story_pack` first, then adapt it into `pingshu_script`, then create a provider-neutral `performance_plan`.

Do not treat pingshu as a pile of old-fashioned filler. The final script must be modern, information-dense, and driven by conflict. Pingshu is the delivery form; the content still needs a strong hook, clear cause-and-effect, and details the audience actually wants.

Do not render final audio until the user has chosen and configured a TTS path. API and local model paths are first-class. System voices such as macOS `say` or Windows Narrator are allowed only as explicit smoke tests, never as the final voice product.

## Workflow

1. **Run the first-use TTS gate**
   If the user asks for final audio and no provider is configured, ask them to choose API or local TTS before rendering. Use `scripts/check_tts_readiness.mjs <provider>` when a provider is named. Do not silently fall back to a system voice.

2. **Clarify the target only if necessary**
   Use reasonable assumptions for style and length. Ask when the requested source is inaccessible, legally risky, too ambiguous, or missing the core dramatic facts.

3. **Build `story_pack` and narrative brief**
   Gather or extract story facts, scene details, characters, conflicts, visual actions, and uncertainties. If the user requests an existing work or event, do not fabricate missing facts.

   The story pack must include a `narrative_brief` with trigger, escalation, key conflict, outcome, aftermath, audience-interest points, and missing facts. If the brief is thin, keep sourcing instead of writing pingshu prose.

   Read `references/story-sourcing.md` when source material is not already provided.

4. **Check rights and respect**
   Avoid cloning living artists, laundering recap creators, or presenting uncertain claims as fact.

   Read `references/safety-and-rights.md` for copyrighted works, real people, voice cloning, or platform publishing.

5. **Create pingshu adaptation**
   Convert scenes into beats with opening, setup, action expansion, narrator aside, release, and hook. Use pingshu rhythm, timing, and performance, but keep copy concise. Every segment must add a new fact, causal link, turn, joke, or image.

   Read `references/pingshu-tradition.md` and `references/dramaturgy-and-style.md` before writing high-stakes or public-facing scripts.

6. **Create TTS performance plan**
   Split prose into short renderable segments with pauses, emphasis, effects, voice direction, and optional music bed. Keep TTS instructions clean and minimal.

   Read `references/tts-provider-matrix.md` when choosing API or local TTS.

7. **Self-critique**
   Check factual fidelity, causal clarity, audience-interest density, pingshu craft, dialect restraint, humor mechanism, source sufficiency, and TTS readiness.

## Output Contract

Use the schemas in `references/output-contracts.md`.

Produce at least:

- `story_pack.json`
- `pingshu_script.json`
- `performance_plan.json`

When the user only wants a quick answer, summarize these artifacts in chat but keep the same internal sequence.

## Helpful Scripts

- `scripts/validate_skill_outputs.mjs <folder>` validates example or generated JSON artifacts.
- `scripts/lint_pingshu_quality.mjs <story_pack.json> <pingshu_script.json>` catches weak narrative briefs, overused markers, and empty pingshu boilerplate.
- `scripts/render_tts_plan.mjs <pingshu_script.json> <performance_plan.json>` creates a starter performance plan.
- `scripts/check_tts_readiness.mjs <provider>` checks whether an API/local provider is ready and prints setup blockers.
- `scripts/create_tts_job.mjs <performance_plan.json> <provider> <tts_job.json>` creates a provider-specific render job scaffold for API or local TTS.
- `scripts/export_plaintext.mjs <pingshu_script.json> <output.txt>` exports readable prose.

Supported provider ids for `create_tts_job.mjs`: `openai`, `aliyun-cosyvoice`, `minimax`, `elevenlabs`, `local-cosyvoice`, `gpt-sovits`, `f5-tts`, `indextts`.

The scripts use only Node.js built-in modules and should work on macOS, Windows, and Linux.

## Quality Bar

The result is acceptable only if:

- source facts and uncertainty are visible,
- the narrative brief captures the real trigger, escalation, conflict, outcome, and audience-interest details,
- each script segment carries new information or a clear performance turn,
- flat actions are expanded through scene craft rather than catchphrase stuffing,
- pingshu markers are restrained; no empty "车轱辘话",
- the storyteller persona is original and not a real artist imitation,
- TTS instructions are segmented, renderable, and tied to a user-selected provider,
- the adaptation respects pingshu as a performance tradition.

Run the quality lint before presenting public-facing copy.
