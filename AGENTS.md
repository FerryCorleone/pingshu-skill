# AGENTS.md

## Project Intent

This repository builds `pingshu-skill`, a portable Agent Skill that turns sourced story material into respectful Chinese pingshu-style scripts and provider-neutral TTS performance plans.

The goal is not to parody or replace traditional pingshu artists. Treat pingshu as a living performance tradition: preserve respect for its craft, cite sources, avoid voice impersonation, and make modern adaptations clearly transformative.

## Working Rules

- Keep the skill usable by different agents and operating systems. Prefer plain Markdown, JSON, and Node.js scripts without native dependencies.
- Do not require macOS-only tools, shell-specific behavior, or browser automation for the core workflow.
- Keep `pingshu-skill/SKILL.md` concise. Put detailed knowledge in `pingshu-skill/references/`.
- Use structured intermediate artifacts:
  - `story_pack.json`
  - `pingshu_script.json`
  - `performance_plan.json`
- Do not let the skill fabricate source facts when the user asks for an existing work, episode, event, or scene. If sources are weak, mark uncertainty and ask for or gather better material.
- Do not clone, imitate, or suggest imitating a real living artist's voice without explicit permission. Use original character voices or properly licensed voices.
- Do not directly rewrite another creator's recap as if it were raw story fact. Use recaps as leads only, then corroborate or cite them.

## Development Checks

Run these before claiming the skill is ready:

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" pingshu-skill
node pingshu-skill/scripts/validate_skill_outputs.mjs examples
git status --short
```

If Node is unavailable, the Markdown skill remains usable, but the bundled scripts have not been verified.
