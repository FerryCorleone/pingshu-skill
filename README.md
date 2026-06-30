# Pingshu Storyteller

`pingshu-storyteller` is an Agent Skill for turning sourced stories, episodes, scenes, interviews, or user-provided material into respectful Chinese pingshu-style scripts and TTS performance plans.

It is designed as a creative workflow, not a one-shot prompt. The skill first builds a sourced `story_pack`, then adapts scenes into pingshu dramaturgy, then emits a provider-neutral `performance_plan` that can be rendered by API TTS or local open-source TTS.

## Why This Exists

Modern TTS can already sound strong. The harder problem is making an agent:

- gather enough true story detail,
- understand which moments carry conflict, rhythm, humor, and visual action,
- adapt them into pingshu form without flattening the tradition into catchphrases,
- hand TTS a clean performance plan instead of overloading the voice model with vague style prompts.

## Main Artifacts

- [docs/pingshu-research.md](./docs/pingshu-research.md): compact research on pingshu as a traditional form and what this project must respect.
- [docs/technical-implementation.md](./docs/technical-implementation.md): architecture, data contracts, TTS provider strategy, and cross-platform implementation plan.
- [docs/product-plan.md](./docs/product-plan.md): MVP path and content/product positioning.
- [pingshu-storyteller/SKILL.md](./pingshu-storyteller/SKILL.md): the actual portable Skill entrypoint.

## Quick Validation

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" pingshu-storyteller
node pingshu-storyteller/scripts/validate_skill_outputs.mjs examples
```

On Windows, run the same validator from your local `skill-creator` installation path, then run the Node validator unchanged.

## Open Source Readiness

This repo is prepared for later open sourcing, but before publishing:

- choose a license,
- remove private examples or copyrighted source text,
- decide which TTS providers are documented as optional integrations,
- add provider-specific examples only when their terms allow it.
