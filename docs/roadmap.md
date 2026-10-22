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
| Token pipeline | **Observed:** Phases 2A and 2B are on `main` ([PR #5](https://github.com/cjhuang6/design-engineering-lab/pull/5), merge commit `6f4058f`). Phase 2C's build is merged ([PR #11](https://github.com/cjhuang6/design-engineering-lab/pull/11), [PR #12](https://github.com/cjhuang6/design-engineering-lab/pull/12), [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14)). **Observed** 2026-10-21, evidence CJ's report from Figma desktop on his real Camellia file: he ran the [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14) semantic desktop checklist and every check passed |
| Semantic permanent ids | **Observed:** merged in [PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15) (merge commit `247fef8`, 2026-10-21). **Observed** the same day on his real file, same evidence: the dry run and the sync each reported 0 created and 41 updated (the migration from legacy tags), a rerun reported 41 unchanged, and rectangle `61:117` stayed bound |
| Primitive permanent ids | **Observed:** not merged. [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16) is open. **Observed** only as scratch-file evidence, not on CJ's file: on 2026-10-21 a connector test on a scratch Figma file reported 0 created and 110 updated, a rerun reported 110 unchanged, and renaming `blue/600` renamed the same variable. That run is not the desktop checklist on his Camellia file |
| **Next agreed task** | **CJ runs the primitives desktop checklist and merges [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16).** Use the checklist on that branch, [figma-primitives-sync.md](https://github.com/cjhuang6/design-engineering-lab/blob/cursor/primitive-token-ids-a52a/.cursor/skills/verify-camellia/features/figma-primitives-sync.md), section "Permanent ids, on the file that already has Primitives". The [copy on main](../.cursor/skills/verify-camellia/features/figma-primitives-sync.md) does not describe that migration. Do not start Phase 2D or [Components & interactions](components-roadmap.md) from this line |
| Components & interactions | Not started. **Approved:** it waits until the token-pipeline items still open are closed or CJ explicitly defers them. See [entry criteria](components-roadmap.md#entry-criteria) |
| Figma file state | **Observed** 2026-10-21, evidence CJ's report from Figma desktop on his real Camellia file: a `Primitives` collection with 110 variables (`Value` mode) and a `Semantic` collection with 41 variables (`Light` and `Dark` modes). Every semantic variable is tagged with a permanent id |

## Phases

### Token pipeline — in progress

Phases 2A, 2B, and 2C, plus permanent ids for semantic tokens and for primitive tokens. Detail, scope, and open questions: [token pipeline roadmap](token-pipeline-roadmap.md).

- **Observed:** 2A and 2B are complete on `main`. The 2C build is merged. Semantic permanent ids are merged ([PR #15](https://github.com/cjhuang6/design-engineering-lab/pull/15)).
- **Observed:** primitive permanent ids are not on `main`. They are open in [PR #16](https://github.com/cjhuang6/design-engineering-lab/pull/16).
- **Observed** 2026-10-21 on CJ's real Camellia file: the [PR #14](https://github.com/cjhuang6/design-engineering-lab/pull/14) semantic desktop checklist passed, and the semantic permanent-id migration updated 41 variables, created 0, and left rectangle `61:117` bound. Detail is in **Current status**.
- Later pipeline work (text styles, effect styles, paint styles, the audit, and a designer-review path from Figma back to the JSON) stays in the token pipeline roadmap. It is not the next agreed task.

The token pipeline document also has its own **Phase 3** (designer review: explore in Figma, then bring a patch back into the JSON) and **Phase 4** (an earlier component sketch). Those names are pipeline sections. They are not the components phase below.

### Components & interactions — not started

How components are designed around behavior, then prototyped and shipped. Detail: [components roadmap](components-roadmap.md).

- **Approved:** this phase starts after the token pipeline's remaining items are closed or CJ explicitly defers them.
- **Approved:** one component per pull request, from an interaction brief written before code.
- **Proposal:** at least one AI-assisted interaction, and a candidate list CJ has not picked. See that roadmap.
- **Unknown:** which component is first, where component tokens would live, and how far Figma component sync goes.

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
