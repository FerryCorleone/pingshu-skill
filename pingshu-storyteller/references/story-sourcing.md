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
- what physically happens,
- what changes after the scene,
- at least two concrete details for important scenes,
- source links or source notes,
- explicit uncertainty.

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

