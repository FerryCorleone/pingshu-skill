#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [storyArg, scriptArg] = process.argv.slice(2);
if (!storyArg || !scriptArg) {
  console.error("Usage: node lint_pingshu_quality.mjs <story_pack.json> <pingshu_script.json>");
  process.exit(2);
}

const story = JSON.parse(readFileSync(resolve(storyArg), "utf8"));
const script = JSON.parse(readFileSync(resolve(scriptArg), "utf8"));
const warnings = [];
const failures = [];

const brief = story.narrative_brief || {};
if (!brief.hook || brief.hook.length < 25) failures.push("narrative_brief.hook is too thin");
if (!Array.isArray(brief.causal_chain) || brief.causal_chain.length < 4) {
  failures.push("narrative_brief.causal_chain should include at least four links for current events");
}
if (!Array.isArray(brief.must_include_details) || brief.must_include_details.length < 4) {
  failures.push("narrative_brief.must_include_details should include at least four concrete details");
}
const signatureMoments = Array.isArray(brief.signature_moments) ? brief.signature_moments : [];
const sceneTrace = Array.isArray(brief.scene_trace) ? brief.scene_trace : [];
const requestText = [story.request?.user_goal, story.request?.target_work_or_event]
  .map((value) => String(value || ""))
  .join(" ");
const asksForSignatureScene = /名场面|经典片段|经典场面|名片段|综艺片段|采访片段|剧集片段|clip|Say My Name|Breaking Bad|绝命毒师/i.test(requestText);
const asksForLongEpisode = /整集|全集|完整(?:一)?[期集季]|完整.*(?:评书|音频|讲|复述|复盘)|最后一[期集季]|总决赛|冠军.*[期集]|第[一二三四五六七八九十百\d]+[期集季]|full episode|whole episode|entire episode|finale/i.test(requestText);
if (asksForSignatureScene && signatureMoments.length === 0) {
  failures.push("narrative_brief.signature_moments is required for named famous scenes or specific clips");
}
if (asksForSignatureScene && sceneTrace.length < 6) {
  failures.push("narrative_brief.scene_trace should include at least six chronological micro-beats for named scenes or clips");
}
if (asksForLongEpisode) {
  const sourceHunt = story.source_hunt && typeof story.source_hunt === "object" ? story.source_hunt : null;
  if (!sourceHunt) {
    failures.push("story_pack.source_hunt is required for whole-episode or long-form requests");
  } else {
    const searchedPlatforms = Array.isArray(sourceHunt.searched_platforms) ? sourceHunt.searched_platforms : [];
    const searchQueries = Array.isArray(sourceHunt.search_queries) ? sourceHunt.search_queries : [];
    const usableMaterials = Array.isArray(sourceHunt.usable_materials) ? sourceHunt.usable_materials : [];
    const coverageLevel = String(sourceHunt.coverage_level || "").trim();
    const decision = String(sourceHunt.decision || "").trim();
    const sceneLevelCoverage = new Set([
      "scene_level",
      "multi_clip_scene_level",
      "full_episode_transcript",
      "full_episode_video_asr",
      "user_supplied_episode"
    ]);
    if (searchedPlatforms.length < 3) {
      failures.push("story_pack.source_hunt.searched_platforms should cover at least three platform/channel families for long-form requests");
    }
    if (searchQueries.length < 3) {
      warnings.push("story_pack.source_hunt.search_queries is thin; record multiple Chinese/English/platform-specific searches");
    }
    if (usableMaterials.length < 2) {
      failures.push("story_pack.source_hunt.usable_materials should include at least two usable materials or explain why the user must provide a source");
    }
    if (!sceneLevelCoverage.has(coverageLevel)) {
      failures.push(`story_pack.source_hunt.coverage_level is not enough for complete audio: ${coverageLevel || "missing"}`);
    }
    if (["gather_more", "ask_user_for_source", "downgrade_to_recap"].includes(decision)) {
      failures.push(`story_pack.source_hunt.decision says not ready for complete scripting: ${decision}`);
    }
  }
  if (sceneTrace.length < 12) {
    failures.push("narrative_brief.scene_trace should include at least twelve chronological beats for whole-episode or long-form requests");
  }
  if (!Array.isArray(story.scenes) || story.scenes.length < 6) {
    failures.push("story_pack.scenes should include at least six sourced scenes for whole-episode or long-form requests");
  }
}
for (const [index, step] of sceneTrace.entries()) {
  if (!step || typeof step !== "object") {
    failures.push(`narrative_brief.scene_trace[${index}] must be an object`);
    continue;
  }
  for (const key of ["id", "order", "source_ids", "setting_or_frame", "visible_action", "spoken_or_paraphrased_line", "reaction", "dramatic_change"]) {
    if (!(key in step)) {
      failures.push(`narrative_brief.scene_trace[${index}] is missing ${key}`);
    }
  }
  if (!Array.isArray(step.source_ids) || step.source_ids.length === 0) {
    failures.push(`narrative_brief.scene_trace[${index}].source_ids should cite at least one source`);
  }
}
for (const [index, moment] of signatureMoments.entries()) {
  if (!moment || typeof moment !== "object") {
    failures.push(`narrative_brief.signature_moments[${index}] must be an object`);
    continue;
  }
  for (const key of ["type", "content", "source_ids", "include_policy", "transform_note"]) {
    if (!(key in moment)) {
      failures.push(`narrative_brief.signature_moments[${index}] is missing ${key}`);
    }
  }
  if (!String(moment.content || "").trim()) {
    failures.push(`narrative_brief.signature_moments[${index}].content is empty`);
  }
  if (!Array.isArray(moment.source_ids) || moment.source_ids.length === 0) {
    failures.push(`narrative_brief.signature_moments[${index}].source_ids should cite at least one source`);
  }
}

const segments = Array.isArray(script.segments) ? script.segments : [];
if (!segments.length) failures.push("pingshu_script.segments is empty");

const design = script.story_design || {};
const requiredDesignFields = [
  "logline",
  "audience_entry",
  "entertainment_promise",
  "humor_engine",
  "title_design",
  "technique_arrangement",
  "central_question",
  "protagonist_arc",
  "stakes",
  "beat_order",
  "opening_contract",
  "ending_contract"
];
for (const key of requiredDesignFields) {
  if (!(key in design)) failures.push(`pingshu_script.story_design is missing ${key}`);
}
for (const key of ["logline", "audience_entry", "entertainment_promise", "humor_engine", "central_question", "protagonist_arc", "stakes", "opening_contract", "ending_contract"]) {
  if (key in design && String(design[key] || "").trim().length < 18) {
    failures.push(`pingshu_script.story_design.${key} is too thin`);
  }
}
const titleDesign = design.title_design || {};
if (!titleDesign || typeof titleDesign !== "object") {
  failures.push("pingshu_script.story_design.title_design must be an object");
} else {
  for (const key of ["episode_title", "style_reference", "title_formula", "comic_hook", "opening_line"]) {
    if (!(key in titleDesign)) {
      failures.push(`pingshu_script.story_design.title_design is missing ${key}`);
    } else if (String(titleDesign[key] || "").trim().length < 8) {
      failures.push(`pingshu_script.story_design.title_design.${key} is too thin`);
    }
  }
}
const arrangement = design.technique_arrangement || {};
if (arrangement && typeof arrangement === "object") {
  for (const key of ["overall_strategy", "restraint_notes"]) {
    if (key in arrangement && String(arrangement[key] || "").trim().length < 18) {
      failures.push(`pingshu_script.story_design.technique_arrangement.${key} is too thin`);
    }
  }
  for (const key of ["first_person_inner_monologue_slots", "traditional_flavor_slots", "leave_plain_slots"]) {
    if (!(key in arrangement)) {
      failures.push(`pingshu_script.story_design.technique_arrangement is missing ${key}`);
    } else if (!Array.isArray(arrangement[key])) {
      failures.push(`pingshu_script.story_design.technique_arrangement.${key} must be an array`);
    }
  }
  if (!arrangement.technique_budget || typeof arrangement.technique_budget !== "object") {
    failures.push("pingshu_script.story_design.technique_arrangement.technique_budget must be an object");
  }
} else {
  failures.push("pingshu_script.story_design.technique_arrangement must be an object");
}
if (Array.isArray(arrangement.first_person_inner_monologue_slots)) {
  for (const [index, slot] of arrangement.first_person_inner_monologue_slots.entries()) {
    for (const key of ["segment_id", "character", "trigger", "plot_relevance", "decision_pressure", "bad_idea_logic", "action_payoff", "voice_shape", "boundary_note"]) {
      if (!(key in slot)) {
        failures.push(`first_person_inner_monologue_slots[${index}] is missing ${key}`);
      } else if (String(slot[key] || "").trim().length === 0) {
        failures.push(`first_person_inner_monologue_slots[${index}].${key} is empty`);
      } else if (!["segment_id", "character"].includes(key) && String(slot[key] || "").trim().length < 8) {
        failures.push(`first_person_inner_monologue_slots[${index}].${key} is too thin`);
      }
    }
  }
}
if (!Array.isArray(design.beat_order) || design.beat_order.length < 5) {
  failures.push("pingshu_script.story_design.beat_order should include at least five beats");
} else {
  for (const beat of ["context", "trigger", "resolution"]) {
    if (!design.beat_order.includes(beat)) {
      failures.push(`pingshu_script.story_design.beat_order should include ${beat}`);
    }
  }
}
if (asksForSignatureScene && !design.scene_replay_strategy) {
  failures.push("pingshu_script.story_design.scene_replay_strategy is required for named scenes or clips");
} else if (design.scene_replay_strategy && String(design.scene_replay_strategy || "").trim().length < 24) {
  failures.push("pingshu_script.story_design.scene_replay_strategy is too thin");
}

const persona = script.storyteller_persona || {};
if (persona.performance_mode !== "single_performer") {
  failures.push("storyteller_persona.performance_mode must be single_performer");
}
if (/多音色|多人配音|广播剧|分角色配音|voice cast/i.test(String(persona.description || ""))) {
  failures.push("storyteller_persona must not describe a multi-voice/audio-drama performance");
}

const text = segments.map((segment) => segment.text || "").join("\n");
const openingText = segments.slice(0, 2).map((segment) => segment.text || "").join("\n");
const firstSegmentText = segments[0]?.text || "";
const scriptTitle = String(script.title || "").trim();
if (!scriptTitle) {
  failures.push("pingshu_script.title is missing");
} else {
  const hasChapterTitleShape = /[，,；;]/.test(scriptTitle) && scriptTitle.length >= 10 && scriptTitle.length <= 34;
  if (!hasChapterTitleShape) {
    warnings.push("pingshu_script.title should usually be an original double-clause chapter-style title, with a comma or semicolon between the two clauses");
  }
  if (segments.length && !firstSegmentText.includes(scriptTitle)) {
    warnings.push("opening should usually introduce the chapter-style title in the first segment");
  }
}
if (segments.length && !/闲言少叙|书归正传|有话则长|无话则短|单表|今儿.*讲|今天.*讲|列位|看官/.test(firstSegmentText)) {
  warnings.push("opening can use one short traditional storytelling formula before entering concrete context");
}
for (const [index, moment] of signatureMoments.entries()) {
  if (String(moment.include_policy || "") !== "must_quote_short") continue;
  const content = String(moment.content || "").trim();
  if (content && !text.toLowerCase().includes(content.toLowerCase())) {
    failures.push(`must_quote_short signature moment is missing from script text: signature_moments[${index}].content`);
  }
}
if (segments.length >= 3 && openingText.trim().length < 100) {
  warnings.push("opening is short; first one or two segments should orient listeners before heavy jokes");
}
if (segments.length && !/cold_hook|opening|context/.test(String(segments[0].purpose || ""))) {
  warnings.push("first segment should usually be cold_hook, opening, or context");
}
const characterNames = Array.isArray(story.characters)
  ? story.characters.map((character) => String(character.name || "").trim()).filter((name) => name.length >= 2)
  : [];
const targetName = String(story.request?.target_work_or_event || "").trim();
const openingAnchors = [...characterNames, targetName].filter(Boolean);
const matchingOpeningAnchors = openingAnchors.filter((anchor) => openingText.includes(anchor));
if (openingAnchors.length >= 2 && matchingOpeningAnchors.length < 2) {
  failures.push("opening should name enough core people/work/event context for listeners who do not know the source");
} else if (openingAnchors.length === 1 && matchingOpeningAnchors.length < 1) {
  warnings.push("opening does not mention the target work/event or main character by name");
}
const openingRevealSetup = /回来一瞧|回来发现|一回来|上完厕所|去趟洗手间/.test(firstSegmentText);
const openingRevealsCoreLoss = /箱子没了|金条没了|车也没了|车没了|人没了|哥没了|跑了|拎走/.test(firstSegmentText);
const designDeclaresFlashback = /倒叙|flashback|先抛结果|先讲结果/.test([
  design.opening_contract,
  arrangement.overall_strategy,
  design.beat_order?.join(" ")
].map((value) => String(value || "")).join(" "));
if (openingRevealSetup && openingRevealsCoreLoss && !designDeclaresFlashback) {
  warnings.push("opening appears to reveal the central reversal before setup; either rewrite as a teaser or declare a deliberate flashback structure");
}

const markerCount = (text.match(/列位|好么|您猜|单表|话说回来/g) || []).length;
if (segments.length && markerCount > Math.ceil(segments.length / 2) + 1) {
  warnings.push("too many pingshu markers; reduce dialect/catchphrase seasoning");
}

const comedyDesignedSegments = segments.filter((segment) => segment.comedy_design && typeof segment.comedy_design === "object");
const likelyComedySegments = segments.filter((segment) => /aside|release|hook|action/.test(String(segment.purpose || "")));
if (likelyComedySegments.length >= 2 && comedyDesignedSegments.length === 0) {
  warnings.push("no comedy_design metadata found; important jokes should declare fact_anchor, setup_expectation, and punch_or_turn");
}

const unsafeMindReading = [
  "他心里就是",
  "她心里就是",
  "真实目的就是",
  "早就设计好了",
  "故意炒作"
];
for (const phrase of unsafeMindReading) {
  if (text.includes(phrase)) {
    failures.push(`unsafe mind-reading phrase detected: ${phrase}`);
  }
}

const bannedBoilerplate = [
  "三英战吕布",
  "武松打猛虎",
  "武松打虎",
  "刀枪剑戟"
];
for (const phrase of bannedBoilerplate) {
  if (text.includes(phrase)) warnings.push(`boilerplate opening detected: ${phrase}`);
}

const weakPhrases = [
  "双方网友吵起来",
  "网线两头",
  "绿茵热闹",
  "评论区很热闹"
];
for (const phrase of weakPhrases) {
  if (text.includes(phrase)) warnings.push(`generic current-event phrase detected: ${phrase}`);
}

const moralizingPhrases = [
  "这件事告诉我们",
  "人生",
  "成长",
  "人性",
  "原则",
  "意义",
  "本质",
  "照明白",
  "信任欠",
  "信任账",
  "价值",
  "教育",
  "教会",
  "上了一课",
  "真正的"
];
const moralizingHits = moralizingPhrases.flatMap((phrase) => {
  const count = (text.match(new RegExp(phrase, "g")) || []).length;
  return Array(count).fill(phrase);
});
if (moralizingHits.length >= Math.max(4, Math.ceil(segments.length / 3))) {
  warnings.push(`preachy/moralizing density is high; entertainment scripts should reduce heavy takeaway words: ${[...new Set(moralizingHits)].join(", ")}`);
}
const endingText = segments.slice(-2).map((segment) => segment.text || "").join("\n");
if (/所以|这就是|告诉我们|不是因为.*而是因为|它.*在于|真正/.test(endingText) && !/笑|乐|逗|包袱|回扣|好家伙|我操|损/.test(endingText)) {
  warnings.push("ending may read like an essay takeaway; consider ending on a concrete callback, joke, or light aftertaste");
}
if (design.entertainment_promise && /意义|价值|教育|教会|本质|人性/.test(String(design.entertainment_promise))) {
  warnings.push("story_design.entertainment_promise should describe what is fun, not what is meaningful");
}

const firstPersonSlots = Array.isArray(arrangement.first_person_inner_monologue_slots)
  ? arrangement.first_person_inner_monologue_slots
  : [];
const traditionalSlots = Array.isArray(arrangement.traditional_flavor_slots)
  ? arrangement.traditional_flavor_slots
  : [];
const plainSlots = Array.isArray(arrangement.leave_plain_slots)
  ? arrangement.leave_plain_slots
  : [];
if (segments.length >= 6 && firstPersonSlots.length === 0) {
  warnings.push("no first-person inner monologue slot planned; modern entertainment scripts often need one vivid character-thought beat");
}
if (firstPersonSlots.length > Math.max(3, Math.ceil(segments.length / 3))) {
  warnings.push("too many first-person inner monologue slots; use them as highlights, not default narration");
}
if (traditionalSlots.length > 2 && segments.length <= 12) {
  warnings.push("too many traditional flavor slots for a short script; keep guankou/opening flavor sparse");
}
if (segments.length >= 6 && plainSlots.length === 0) {
  warnings.push("no leave_plain_slots planned; reserve some beats for clean story movement");
}
const firstPersonMarkers = (text.match(/一寻思|一琢磨|心说|我这|咱这|这不对啊|指定是|合着/g) || []).length;
const maxFirstPerson = Number(arrangement.technique_budget?.first_person_inner_monologue_max ?? 3);
if (Number.isFinite(maxFirstPerson) && firstPersonMarkers > maxFirstPerson + 1) {
  warnings.push("first-person inner monologue markers exceed planned budget; reduce character-thought beats");
}
for (const slot of firstPersonSlots) {
  const slotText = [slot.plot_relevance, slot.decision_pressure, slot.bad_idea_logic, slot.action_payoff].map((value) => String(value || "")).join(" ");
  if (!/动作|拿|拎|走|抢|还|接|说|发|做|决定|选择|下一步|后果|payoff|执行/.test(slotText)) {
    warnings.push(`first-person inner monologue slot ${slot.segment_id || ""} may be ornamental; state how it drives a concrete action or consequence`);
  }
}
const traditionalMarkers = (text.match(/闲言少叙|书归正传|有话则长|无话则短|单表|话说|列位|看官|醒木/g) || []).length;
const maxTraditional = Number(arrangement.technique_budget?.traditional_flavor_max ?? 2);
if (Number.isFinite(maxTraditional) && traditionalMarkers > maxTraditional + 2) {
  warnings.push("traditional pingshu markers exceed planned budget; reduce guankou/catchphrase seasoning");
}
const propSfxEntries = segments.flatMap((segment, index) => {
  const sfx = Array.isArray(segment.performance?.sfx_after) ? segment.performance.sfx_after : [];
  return sfx.map((id) => ({ id: String(id), index, segment }));
});
const propSfxHits = propSfxEntries.map((entry) => entry.id);
if (segments.length <= 12 && propSfxHits.length > 2) {
  warnings.push("waking block SFX is overused for a short script; keep prop sounds to opening, rare turn, or closing only");
}
const unknownPropSfx = propSfxHits.filter((id) => !["waking_block", "waking_block_soft", "waking_block_firm", "waking_block_light", "waking_block_medium", "waking_block_close"].includes(String(id)));
if (unknownPropSfx.length) {
  failures.push(`unsupported prop SFX ids: ${[...new Set(unknownPropSfx)].join(", ")}`);
}
const firstWakingEntry = propSfxEntries.find((entry) => entry.id.startsWith("waking_block"));
if (firstWakingEntry) {
  if (firstWakingEntry.index !== 0) {
    failures.push("first waking_block should follow the opening chapter title in seg-001; do not wait until the story body has started");
  } else {
    const titleMarker = scriptTitle ? `《${scriptTitle}》` : "";
    const firstText = String(firstWakingEntry.segment.text || "");
    if (titleMarker && firstText.includes(titleMarker)) {
      const afterTitle = firstText
        .slice(firstText.indexOf(titleMarker) + titleMarker.length)
        .replace(/^[。.!！?？；;，,、\s]+/, "");
      if (afterTitle.length > 6) {
        failures.push("opening segment with waking_block should stop after the chapter title; move background and conflict setup to seg-002 or event-level text after the SFX");
      }
    } else if (firstText.length > 90) {
      failures.push("opening segment with waking_block is too long; the first prop sound should land right after the title, not after a full setup paragraph");
    }
  }
} else if (segments.length >= 4 && /今儿.*讲|今天.*讲|列位/.test(firstSegmentText)) {
  warnings.push("formal pingshu audio should usually place one waking_block right after the opening chapter title");
}

for (const segment of segments) {
  const segmentText = segment.text || "";
  if (segmentText.length > 180) {
    warnings.push(`${segment.id} is long for TTS; consider splitting`);
  }
  if (!segment.story_function || String(segment.story_function).trim().length < 8) {
    warnings.push(`${segment.id} has no useful story_function; state how the segment advances the story`);
  }
  if (!segment.source_scene_ids || !segment.source_scene_ids.length) {
    failures.push(`${segment.id} has no source_scene_ids`);
  }
  if (sceneTrace.length && (!Array.isArray(segment.scene_trace_ids) || segment.scene_trace_ids.length === 0)) {
    failures.push(`${segment.id} should bind to at least one scene_trace_id`);
  }
}

if (sceneTrace.length) {
  const usedTraceIds = new Set(segments.flatMap((segment) => Array.isArray(segment.scene_trace_ids) ? segment.scene_trace_ids : []));
  const missingTraceIds = sceneTrace.map((step) => step.id).filter((id) => id && !usedTraceIds.has(id));
  if (missingTraceIds.length) {
    warnings.push(`scene_trace steps are not covered by script segments: ${missingTraceIds.join(", ")}`);
  }
}

const summaryTerms = text.match(/提出|强调|接受|承认|意识到|表面|实际|局面|权力关系|身份反转|完成|解读为/g) || [];
const sensoryTerms = text.match(/走|站|停|看|问|回|皱|沉默|车|枪|手|眼|风|沙|桌|门|箱|拎|拿|递|点头|摇头|笑|盯/g) || [];
if (asksForSignatureScene && summaryTerms.length > sensoryTerms.length) {
  warnings.push("summary-like wording exceeds visible scene detail; rewrite toward scene-by-scene narration");
}

if (failures.length || warnings.length) {
  console.log(JSON.stringify({ ok: failures.length === 0, failures, warnings }, null, 2));
} else {
  console.log(JSON.stringify({ ok: true, failures: [], warnings: [] }, null, 2));
}

process.exit(failures.length ? 1 : 0);
