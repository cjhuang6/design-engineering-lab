# Camellia roadmap

This is the project roadmap. It is the only place that states **Current status** and the **next agreed task**. Phase documents describe how a phase works. They do not choose what happens next. If one of them disagrees with this file, this file wins until CJ changes it.

Every entry is labelled:

- **Approved**: CJ decided it.
- **Observed**: verified in the repository or in Figma, with the evidence noted.
- **Proposal**: suggested, not yet approved.
- **Unknown**: not yet determined.

## Purpose

Camellia is CJ Huang's design system, and this repository is the public lab where that system is designed and built. The lab is design-engineering evidence: the decisions, the checks, and the artifacts, so a designer learning to ship in code can see how the work was actually done. One authored token file stays the source of truth, CSS and Figma follow it in one direction, and components start only after that pipeline is in place.

## Current status

| | |
|---|---|
| Token pipeline | **Observed:** Phases 2A and 2B are on `main` ([PR #5](https://github.com/cjhuang6/design-engineering-lab/pull/5), merge commit `6f4058f`). Phase 2C's build is merged ([PR #11](https://github.com/cjhuang6/design-engineering-lab/pull/11), [PR #12](https://github.com/cjhuang6/design-engineering-lab/pull/12), [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14)). **Observed** 2026-10-21, evidence CJ's report from Figma desktop on his real Camellia file: he ran the [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14) semantic desktop checklist and every check passed. **Approved (2026-10-22):** the pipeline is finished when Phase 2D (Text Styles) and Phase 2E (Effect Styles) are merged and desktop-verified. 2D is next. 2E comes after 2D |
| Semantic permanent ids | **Observed:** merged in [PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15) (merge commit `247fef8`, 2026-10-21). **Observed** the same day on his real file, same evidence: the dry run and the sync each reported 0 created and 41 updated (the migration from legacy tags), a rerun reported 41 unchanged, and rectangle `61:117` stayed bound. A JSON rename of a semantic token on the real file is not in that report (token pipeline question 1) |
| Primitive permanent ids | **Observed:** merged in [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) (merge commit `fe3533b`, 2026-10-22). **Observed** the same day, evidence CJ's report from Figma desktop on his real Camellia file: he ran the primitives desktop checklist and every check passed. Inventory showed 151 variables (110 Primitives plus 41 Semantic). The dry run would create 0 and update 110. The sync created 0 and updated 110. A rerun created 0 and updated 0. Rectangle `61:117` stayed bound. A connector test on a scratch file, not his file, also passed on 2026-10-21 (0 created, 110 updated, rerun 110 unchanged, renaming `blue/600` renamed the same variable). That scratch run is not this desktop check |
| **Next agreed task** | **The 2D sync PR against the fake Figma.** The planner pull request ([#21](https://github.com/cjhuang6/design-engineering-lab/pull/21)) is in review. It adds the pure function from the JSON to the 13 Text Style descriptions (`figma-plugin/src/plan-text-styles.ts`), its unit tests, and the 13 `type-` ids. The next pull request is item 2 of the [planned split](token-pipeline-roadmap.md#planned-pull-request-split): sync against the fake Figma (create, update in place, dry run, a second run, a missing font, a style that exists only in Figma, and a JSON rename that keeps the style id). Those tests use the in-memory fake. They do not prove Figma behavior. Do not start the menu pull request or Phase 2E from it |
| Deferred until a component needs them | **Approved (deferred, 2026-10-22).** Phase 2F Expression Paint Styles. Phase 2G Figma validation and audit: today's dry runs already report the diffs (the primitive and semantic commands report created, updated, unchanged, and in Figma but not in the JSON). The designer review workflow (Figma to the JSON). Open question 7, component tokens, is decided with the first component in the [components roadmap](components-roadmap.md). Open question 8, motion variable binding in Figma, waits because the Figma Motion API is in beta. None of these block 2D, 2E, or the start of components |
| Components & interactions | Not started. **Approved (2026-10-22):** Phase 3 starts after 2D and 2E are merged and desktop-verified. The deferred items above do not block it. See [entry criteria](components-roadmap.md#entry-criteria) |
| Figma file state | **Observed** 2026-10-22, evidence CJ's report from Figma desktop on his real Camellia file: Inventory showed 151 variables, 110 in `Primitives` (`Value` mode) and 41 in `Semantic` (`Light` and `Dark`). All 151 are tagged with permanent ids. Rectangle `61:117` stayed bound |

## Phases

### Token pipeline — in progress

Phases 2A, 2B, and 2C, plus permanent ids for semantic tokens and for primitive tokens, are done. **Approved (2026-10-22):** finish the pipeline with Phase 2D, then Phase 2E. Detail, scope, and open questions: [token pipeline roadmap](token-pipeline-roadmap.md).

- **Observed:** 2A and 2B are complete on `main`. The 2C build is merged. Semantic permanent ids are merged ([PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15)).
- **Observed:** primitive permanent ids are merged in [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) (`fe3533b`) and were checked on CJ's real file on 2026-10-22. Detail is in **Current status**.
- **Observed** 2026-10-21 on that file: the [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14) semantic desktop checklist passed, and the semantic permanent-id migration updated 41 variables, created 0, and left rectangle `61:117` bound.
- **Approved (2026-10-22):** Phase 2D Text Styles is the next pipeline phase. The four decisions in its task brief are decided, including binding family and weight. The planner pull request ([#21](https://github.com/cjhuang6/design-engineering-lab/pull/21)) is in review. The next pull request is the sync against the fake Figma. Phase 2E Effect Styles follows 2D. The pipeline is finished when those two are merged and desktop-verified.
- **Approved (deferred, 2026-10-22):** Phase 2F Expression Paint Styles, Phase 2G Figma validation and audit, and the designer-review path from Figma back to the JSON wait until a component needs them. They do not block 2D, 2E, or components.

The token pipeline document also has its own **Phase 3** (designer review: explore in Figma, then bring a patch back into the JSON) and **Phase 4** (an earlier component sketch). Those names are pipeline sections. They are not the components phase below. That pipeline Phase 3 is the deferred designer-review workflow.

### Components & interactions — not started

How components are designed around behavior, then prototyped and shipped. Detail: [components roadmap](components-roadmap.md).

- **Approved (2026-10-22):** this phase starts after Phase 2D and Phase 2E are merged and desktop-verified. The deferred token-pipeline items do not block it.
- **Approved:** one component per pull request, from an interaction brief written before code.
- **Proposal:** at least one AI-assisted interaction, and a candidate list CJ has not picked. See that roadmap.
- **Approved (CJ, 2026-10-23):** the first component is a proximity hex color picker ([brief](components/color-picker-brief.md)). **Unknown:** how far Figma component sync goes.
- **Approved (deferred, 2026-10-22):** where component tokens live is decided with the first component. The location is still open then.

## Where things live

| Document | What it's for |
|---|---|
| [Design system spec](camellia-design-system-v0.1.md) | Design intent: principles, palette, type scale. The JSON wins where the spec's values differ |
| [Token pipeline roadmap](token-pipeline-roadmap.md) | Pipeline phases, sync rules, decisions, and open questions |
| [Components roadmap](components-roadmap.md) | Components and interactions, after the token pipeline |
| [Verification](verification.md) | What each check proves and does not prove, and the implement/verify handoff |
| [Feature map](../.cursor/skills/verify-camellia/features/README.md) | What exists today, and how to drive it. Planned work stays in the roadmaps, not in the map |

## How to start as a new agent

1. Read [AGENTS.md](../AGENTS.md) in full and follow it. This file does not replace it.
2. Read **Current status** in this file, including the next agreed task.
3. Read the phase document for that task — the [token pipeline roadmap](token-pipeline-roadmap.md) or the [components roadmap](components-roadmap.md) — and then the docs that task names.

Take the next task from this file only. A phase document that still says "start here" or "do not start that other change" is stale if it disagrees with **Current status**.
