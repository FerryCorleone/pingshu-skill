# Pingshu Research Notes

## Scope Lock

- Domain: Chinese pingshu and adjacent spoken narrative arts.
- Geography: China, with emphasis on Beijing/Tianjin/North China flavor because the product idea depends on a northern pingshu-like register.
- Lens: tradition-aware creative technology, not academic completeness.
- User goal: create an Agent Skill that adapts modern stories into respectful, funny, listenable pingshu-style audio.

## One-Sentence Essence

Pingshu is not just "old-timey narration"; it is a solo narrative performance craft that turns sparse plot into vivid scenes through structure, suspense, rhythm, gesture, voice, commentary, and audience-oriented timing.

## What Must Be Respected

1. **Solo performance craft**
   Pingshu is traditionally performed by one speaker who uses language, voice, expression, gesture, and simple props such as a fan or gavel-like block to create an entire story world.

2. **Structure over catchphrases**
   The form depends on openings, episode structure, suspense, scene entry, character introduction, action expansion, "guan zi" cliffhangers, and callbacks. Catchphrases alone create a cheap imitation.

3. **Moral and aesthetic posture**
   Traditional pingshu often carries judgment: loyalty, cunning, face, honor, absurdity, consequences. Modern adaptation can be comic, but should not become contempt for the source or the tradition.

4. **Respect for artists**
   Do not clone or imitate a living artist's recognizable voice, cadence, verbal trademarks, or persona without permission. Build original storyteller personas.

5. **Dialect with restraint**
   Northern flavor should come from rhythm, sentence shape, and a few idiomatic particles. Overstuffed dialect spelling becomes caricature and harms intelligibility.

## Core Techniques To Model

| Technique | What it does | Skill implication |
| --- | --- | --- |
| Kai shu opening | Establishes storyteller authority and audience relationship | Begin with a concise opening, not an info dump |
| Liang zi / story skeleton | Keeps the long arc coherent | Build a story pack before writing prose |
| Guan zi | Suspense hook at a turn or ending | Every segment needs a hook or turn |
| Bo kou | Smooth transition between scenes | Insert bridge lines when changing time/place/character |
| Fu / zan | Elevated descriptive passage or praise | Use sparingly for action, character entrance, or comic grandeur |
| Xue / Kouji | Mimicry and sound effects | Mark in performance plan instead of forcing TTS to infer |
| Banter / aside | Lets narrator comment on action | Use for humor, but preserve facts |
| Rhythmic delay | Makes small actions feel consequential | Expand important beats with setup, pause, and release |

## Adapting Modern Material

Modern content that works well:

- public-domain fiction chapters,
- user-owned stories,
- public events summarized from reliable sources,
- interviews or talk-show moments with clear conflict,
- animated or drama scenes when used as critique, commentary, parody, or summary with care.

Weak material:

- pure plot summary with no scene detail,
- gossip without reliable sourcing,
- scenes that depend entirely on visual choreography but have no available description,
- copyrighted recaps copied from a single creator.

## How To Make A Flat Event Vivid

Do not just add "lie wei kan guan" to the beginning. Use this expansion pattern:

1. Identify the status relation: who has face, who loses face, who surprises whom.
2. Delay the action: show stillness before motion.
3. Enlarge sensory detail: sound, distance, posture, eye line, object movement.
4. Add narrator judgment: serious praise followed by comic demotion.
5. Release with a crisp line, pause, or sound effect.

Example pattern:

```text
Raw fact: A slapped B, and B stared back.
Pingshu move: raise stakes -> suspend the hand -> sound cue -> face reaction -> narrator aside -> next hook.
```

## Ethical Boundaries

- Avoid framing traditional pingshu as a novelty filter.
- Avoid using dialect markers to mock class, region, age, or education.
- Avoid turning real people's distress into entertainment unless the work is clearly commentary and handled proportionately.
- Avoid making unverified claims sound like historical narration.

## High-Signal Sources

- [北京评书 - 中国非物质文化遗产网](https://www.ihchina.cn/project_details/13683.html): project no. `Ⅴ-57`, category `曲艺`, second national list, with notes on solo performance, folding fan, waking block, oral effects, "豪/紧/动/热", and structure terms such as `书梁子`, `回目`, `关子`, `拨口`, `赋`, `赞`.
- [扬州评话 - 中国非物质文化遗产网](https://www.ihchina.cn/project_details/13585.html): useful adjacent reference for one-person spoken storytelling, dialect-specific performance, detailed description, strict structure, vivid characterization, and rich local color.
- [中华人民共和国著作权法 - 国家版权局](https://www.ncac.gov.cn/xxfb/flfg/flfg_532/202103/t20210309_50530.html): use for rights review before adapting modern copyrighted works.
- Primary texts in the public domain for early test material.
- Licensed or user-provided transcripts for modern scenes.

Current external fact checks should be refreshed before publication because provider capabilities, platform rules, and URLs change.
