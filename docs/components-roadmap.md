# Components & interactions

Phase 3 of the project roadmap: components, with the weight on how they behave. Project-wide **current status** and the **next agreed task** live in [docs/roadmap.md](roadmap.md). This file does not restate them. The color picker is merged in [PR #25](https://github.com/cjhuang6/design-engineering-lab/pull/25) (`953f851`, 2026-10-25). **Observed** on `main`, with CJ's per-component approvals while Phase 2E waited: the showcase shell, the slot-code component, and the guide-feedback card, listed in [Current status](roadmap.md#current-status). This file does not choose the next task.

Every entry is labelled:

- **Approved**: CJ decided it.
- **Observed**: verified in the repository or in Figma, with the evidence noted.
- **Proposal**: suggested, not yet approved.
- **Unknown**: not yet determined.

The token pipeline roadmap uses "Phase 3" for a designer-review workflow and "Phase 4" for an earlier component sketch, including a note that Button might be first. Those sections are not this phase. This document is the components plan. The Button note does not choose the first component.

## Two tracks

**Approved (CJ, 2026-11-09).** Camellia has two component tracks. They can both be in progress. This file's approved method is track 1. Track 2 has its own plan: [basic component library](components/basic-library-plan.md).

**Track 1, lab components.** Invent the interaction, then write an interaction brief, prototype, and a rationale note. The three pieces on `main` are this track: the hex color picker, slot-code, and the guide-feedback card. The [Direction](#direction-approved), the [working method](#working-method-approved), and the interaction brief stay the rules for this track. A later invented piece still needs its own approval. This section does not approve the next one.

**Track 2, standard basic components.** Follow a published pattern, so the behavior is the conventional, predictable kind. The goal is to build that library, then use AI tools to make prototypes out of those pieces. **Approved (CJ, 2026-11-09):** the plan is written down and approved before any track 2 component code, and the track runs in parallel with Phase 2E. It does not wait for 2E, and it does not change the next agreed task. **Approved (CJ, 2026-11-09):** the showcase navigation splits into three sections, the basics, the lab pieces, and a reserved list of prototypes. **Approved (CJ, 2026-11-09):** the bar is Components, Lab, Prototypes, Tokens, and Pipeline, with hashes `#components`, `#lab`, `#prototypes`, `#tokens`, and `#pipeline`. An empty hash opens Lab. `#blocks` is replaced with `#lab`. Final label wording, including the Lab name, is still open. The other open proposals live in that plan. **Approved (CJ, 2026-11-10):** row 15, option B. Checkbox includes checked, unchecked, and mixed. Step 6 is Checkbox, on the Components page. **Approved (CJ, 2026-11-13):** a radio group may start with nothing selected, and the unchecked ring uses `color/icon/secondary` at rest and `color/icon/primary` on hover. Step 7 is Radio group, on the Components page. **Approved (CJ, 2026-11-13):** row 16, option A, the on track is `color/action/primary` and the hover is `color/action/primary-hover`. Row 17, option A, the track is `size/control/sm` tall and `size/control/lg` wide, with no new size token. Step 8 is Switch, on the Components page. **Approved (CJ, 2026-11-13):** row 18, option A. Segmented control is a radio group drawn as a row of segments. One choice. It does not switch a panel. Step 9 is Segmented control, on the Components page. **Approved (CJ, 2026-11-13):** row 19, option A. Card uses `radius/lg` and `shadow/raised` and does not add a border. `shadow/raised` already includes a 1px ring. Step 10 is Card, on the Components page.

The [later candidates](#proposals) table overlaps track 2 where a row names the same kind of control. The note under that table says which rows. An overlap does not turn a track 1 idea into a track 2 component, and it does not approve either one.

## Direction (Approved)

**Approved (CJ, 2026-11-09):** this direction is track 1. Track 2 is summarized in [Two tracks](#two-tracks) and planned in the [basic component library](components/basic-library-plan.md).

**Approved (2026-10-22):** Phase 2D (Text Styles) and Phase 2E (Effect Styles) come first. Then build components with the emphasis on behavior: how a component responds, and the interaction model behind that response. Components already on `main` are the per-component approvals in [Entry criteria](#entry-criteria).

The goal is original interaction concepts, prototyped and shipped in code. Invent the interaction. Do not implement a component by following a spec line by line. The approved goal includes prototyping in Figma and with AI tools, alongside code. What ships is the coded component in this repository. Whether at least one interaction must be AI-assisted is a [proposal](#proposals) below, not a requirement yet.

## Entry criteria

**Approved (2026-10-22):** Phase 3 starts after Phase 2D (Text Styles) and Phase 2E (Effect Styles) are merged and desktop-verified. **Approved (CJ, 2026-10-24):** the color picker started in parallel with Phase 2D. **Approved:** the showcase, slot-code, and guide-feedback also shipped under per-component approvals while Phase 2E waited. Those approvals are the ones named in [Current status](roadmap.md#current-status). They do not approve the next component.

These deferred token-pipeline items do not block that start. **Approved (deferred, 2026-10-22).** The trigger is: until a component needs them, except where a tighter trigger is named.

- Phase 2F Expression Paint Styles.
- Phase 2G Figma validation and audit. Today's dry runs already report the diffs: the primitive and semantic commands report created, updated, unchanged, and in-Figma-only.
- The designer review workflow (Figma back to the JSON).
- Component tokens (token pipeline [open question 7](token-pipeline-roadmap.md#open-questions)). Trigger: a second component needs the same contract. Until then the value stays on the component. See [question 2](#open-questions).
- Motion variable binding in Figma (token pipeline [open question 8](token-pipeline-roadmap.md#open-questions)). The Figma Motion API is in beta. Trigger: until a component needs that binding.

What is merged and desktop-verified is [Current status](roadmap.md#current-status). An agent does not open a component pull request from this document alone.

## First component

**Approved (CJ, 2026-10-23):** the first component is a proximity hex color picker, direction B. The interaction brief is [proximity hex color picker](components/color-picker-brief.md).

The picker uses Camellia's color tokens only.

**Observed (merged 2026-10-25).** [PR #25](https://github.com/cjhuang6/design-engineering-lab/pull/25) (`953f851`) is on `main`, at `src/components/hex-color-picker/`. **Approved (CJ, 2026-10-24):** CJ approved building this picker in parallel with Phase 2D. Phase 2E is the next agreed task ([Current status](roadmap.md#current-status)). **Decided (CJ, 2026-10-23):** a throwaway prototype, a standalone HTML file outside this repo, settled the picker's interaction details. That file is not in the repository.

Values that are not tokens yet stay on the component. The color picker uses one block commented `PLACEHOLDER - candidate token, see color-picker-brief.md`. The feedback card keeps its own values the same way. They are not in the token JSON. [Question 2](#open-questions) keeps them there.

| Placeholder | Value | Used for |
|---|---|---|
| `--hex-picker-duration-grow` | 200ms | Selection mark grow-in. May later map to `duration/normal` |
| `--hex-picker-duration-idle` | 2400ms | One breath |
| `--hex-picker-delay-idle` | 600ms | After grow-in, before the first breath |
| `--hex-picker-duration-autostop` | 11000ms | Idle ends after the last interaction |
| `--hex-picker-ease-overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Grow-in |
| `--hex-picker-ease-sine` | `cubic-bezier(0.37, 0, 0.63, 1)` | Each half of a breath |
| `--hex-picker-scale-press` | 0.94 | Press dip |
| `--hex-picker-scale-hover` | 1.15 | Proximity |
| `--hex-picker-darken` | 0.12 | Proximity |
| `--hex-picker-radius` | 80px | Proximity |
| `--hex-picker-mark-size` | 35% | Inner hexagon |
| `--hex-picker-scale-idle` | 1.12 | Peak of the breath |
| `--hex-picker-white-hairline` | 1px | Light-theme edge of the white center cell. Color is `--color-border-subtle` |

Cell width uses `--size-control-md` (40px). The gap between cells uses `--space-1` (4px). The brief left target size unknown and said to use a size token that already exists. The tracking margin around the honeycomb uses `--space-6` (24px).

The toggle stays on the [later list](#proposals), credited to daz.

## Working method (Approved)

One component per pull request. The pull request contains the four parts below, in this order. Code does not start a component that has no interaction brief in the same change.

**Proposal:** track 2 would use the conformance checklist in the [basic component library](components/basic-library-plan.md) instead of this brief. That swap is part of the plan, and it waits for CJ to approve the plan. Until then, a component pull request still follows the four parts below.

**(a) Interaction brief, written before code.** The concept, the states, keyboard behavior, pointer behavior, motion, and accessibility. Motion uses Camellia's duration and ease tokens (`duration/fast`, `duration/normal`, `duration/slow`, `ease/standard`, `ease/enter`, `ease/exit`). The expression tokens (`duration/expression-sm`, `duration/expression-md`, `duration/expression-lg`, `ease/expression`) are for motion that is deliberately expressive. The brief names the token. It does not invent a millisecond value or a cubic-bezier.

**(b) Prototype in Figma and in code.** The Figma prototype and the code prototype are how the interaction is tried. Neither is a second source of truth for color, type, space, radius, or motion. Those come from the token file.

**(c) Ship in the React demo, Camellia tokens only.** The component lands in the demo app and reads the generated custom properties. No hardcoded colors or one-off lengths. The demo guardrail already rejects those in `src/`. Two labeled blocks are the exception, because [question 2](#open-questions) keeps component-specific values on the component. The color picker block is `PLACEHOLDER - candidate token, see color-picker-brief.md`. The feedback card block holds its receipt height, max width, and press scale. The guardrail allows those blocks and still rejects hardcoded colors and one-off lengths everywhere else in `src/`.

**(d) A short design-rationale note.** Why the component behaves this way, and which alternatives were rejected. The note is also case-study material: a reader should be able to learn the interaction decision from it without opening the code.

## Interaction brief template

Copy this into the component's pull request and fill it in before implementation.

```markdown
# Interaction brief: <name>

## Concept
One paragraph. What interaction is being invented, and what the person using it should feel or understand. Not a spec checklist.

## States
Each state, what the person perceives, and what changes internally. Include rest and any disabled or unavailable state.

## Keyboard
Focus entry and exit, keys that activate or move, and what is announced or shown for focus.

## Pointer
Hover, press, drag, and release. What is the same as the keyboard path, and what exists only for the pointer.

## Motion
Which Camellia duration token and which ease token, and what property they animate. What `prefers-reduced-motion` does instead.

## Accessibility
Role, name, contrast (using semantic colors already in the system), target size, and anything that must not depend on color alone.

## Out of scope
What this component will not do in this pull request.
```

## Design-rationale template

The note for part (d). Keep it short enough to read as a case study.

```markdown
# Why <name> behaves this way

## Decision
The behavior that shipped, in a few sentences.

## Rejected
Two or more alternatives, and the reason each was rejected. "We did not try anything else" is not a rationale.

## What to learn
What a designer learning to ship in code should take from this component.
```

## How we collaborate on a component

**Proposal.** CJ agreed to this shape in principle on 2026-10-22. The details are still to settle. This section does not change the [working method](#working-method-approved) above.

1. CJ brings examples of the interaction.
2. Cami writes an interaction brief with two or three directions.
3. Cloud agents build rough prototypes of those directions, side by side, in the demo app. Side by side means the versions are in the demo at the same time, so CJ can compare them.
4. CJ tries those prototypes in a browser and chooses one.
5. The winner is refined into one pull request. The component uses Camellia tokens only. The pull request includes the short design-rationale note.
6. Figma comes after that coded pull request.

The approved working method includes a Figma prototype in the component pull request. This proposal puts Figma after the coded component. Which order wins is one of the details still to settle. Until CJ settles it, the approved working method stands.

## Showcase site

**Approved (CJ, 2026-10-25).** Turn the demo app, deployed at [https://cjhuang6.github.io/design-engineering-lab/](https://cjhuang6.github.io/design-engineering-lab/), into a public showcase of the components CJ explores, in the spirit of component galleries such as [bencho.dev](https://bencho.dev). How a component is explored and chosen stays in [How we collaborate on a component](#how-we-collaborate-on-a-component). This decision does not change the [next agreed task](roadmap.md#current-status).

**Observed** on `main`: the shell is [PR #32](https://github.com/cjhuang6/design-engineering-lab/pull/32) (`4542b7d`) and the phone layout is [PR #33](https://github.com/cjhuang6/design-engineering-lab/pull/33) (`8f9d3fe`). Refinements on that showcase are [#31](https://github.com/cjhuang6/design-engineering-lab/pull/31), [#34](https://github.com/cjhuang6/design-engineering-lab/pull/34), [#35](https://github.com/cjhuang6/design-engineering-lab/pull/35), [#37](https://github.com/cjhuang6/design-engineering-lab/pull/37), [#41](https://github.com/cjhuang6/design-engineering-lab/pull/41), and [#44](https://github.com/cjhuang6/design-engineering-lab/pull/44). GitHub Pages is [PR #27](https://github.com/cjhuang6/design-engineering-lab/pull/27) (`27d44ba`). The demo loads self-hosted Geist ([PR #28](https://github.com/cjhuang6/design-engineering-lab/pull/28), `75fdad3`). The top navigation is Components, Lab, Prototypes, Tokens, and Pipeline, using hash links (`#components`, `#lab`, `#prototypes`, `#tokens`, `#pipeline`). An empty hash opens Lab. `#blocks` is replaced with `#lab`. Tokens is the token reference. Pipeline is a placeholder page. Components and Prototypes are empty pages. Lab holds the three cards. The live cards are the slot-code security component ([PR #36](https://github.com/cjhuang6/design-engineering-lab/pull/36) `5235ee7`, with [#38](https://github.com/cjhuang6/design-engineering-lab/pull/38)–[#40](https://github.com/cjhuang6/design-engineering-lab/pull/40), [#42](https://github.com/cjhuang6/design-engineering-lab/pull/42), [#43](https://github.com/cjhuang6/design-engineering-lab/pull/43), [#45](https://github.com/cjhuang6/design-engineering-lab/pull/45)), the hex color picker, and the guide-feedback receipt card ([PR #49](https://github.com/cjhuang6/design-engineering-lab/pull/49) `c370dca`, [#50](https://github.com/cjhuang6/design-engineering-lab/pull/50) `a787c6b`, [#51](https://github.com/cjhuang6/design-engineering-lab/pull/51) `e7a6bcb`, [#52](https://github.com/cjhuang6/design-engineering-lab/pull/52) `681bb93`, [#53](https://github.com/cjhuang6/design-engineering-lab/pull/53) `837dd86`). [PR #49](https://github.com/cjhuang6/design-engineering-lab/pull/49) also added `theme.light.shadow.*` and `theme.dark.shadow.*` (`raised`, `control`, `control-hover`) to `tokens/camellia.tokens.json`.

**Approved (CJ, 2026-11-09):** the nav is Components, Lab, Prototypes, Tokens, and Pipeline. Working labels shipped. `#blocks` redirects to `#lab`. Final label wording is still open in the [basic component library](components/basic-library-plan.md#showcase-navigation).

**Step 1, site shell.** Top navigation with a component page, Tokens, and Pipeline. The token reference moves to Tokens. The README's [pipeline explanation and diagram](../README.md#pipeline) move to Pipeline. **Observed** in `src/App.jsx`: the nav says Components, Lab, Prototypes, Tokens, and Pipeline, the links are hashes, `#blocks` is replaced with `#lab`, and no router library was added. Tokens is the token reference. The Pipeline page is still the placeholder sentence, so that README section has not moved.

**Step 2, component cards.** Each component is a live, interactive card. Expanding a card shows the design idea, the logic, notes, and learnings. Each component folder gets a small notes file, so adding a component means adding a folder. The hex color picker's brief, [proximity hex color picker](components/color-picker-brief.md), supplies most of its write-up. Slot-code and guide-feedback are the other cards on `main`.

**Deferred.** Search and filter chips, for example by interaction type: hover, press, drag, select, type. Revisit only once there are many components.

**Later.** A custom domain once there are a few cards.

## Proposals

**Proposal:** at least one shipped component includes an interaction that was explored with an AI prototyping tool before the code was finished. The rationale note says what the tool suggested and what was kept. Which tool, and which component, is **Unknown**. The interaction brief is still written before implementation code. The AI prototype does not replace the brief or the tokens.

**Approved (CJ, 2026-10-23): the first component is the proximity hex color picker**, direction B. Brief: [proximity hex color picker](components/color-picker-brief.md).

**Proposal — later candidates.** This list is not an approved order. It is what might come after the color picker.

| Candidate | Interaction idea |
|---|---|
| Press feedback | A control whose design is the state model: rest, hover, press, keyboard focus, disabled. Feedback uses duration and ease tokens |
| Disclosure | Show and hide content with a height animation, a keyboard path, and a reduced-motion path |
| Single-choice segments | Pointer and arrow keys move one selection. Focus is visible when it differs from the selected segment |
| Theme switch | Flips `data-theme` so semantic colors change. The control does not introduce a second palette |
| Inline status | A field moves among neutral, error, and success using feedback and semantic colors that already exist |
| Toggle | Hover states on a switch. Dropped as the first component for now. A later idea, credited to [daz](https://daz.typenote.co/toggle-hover-states) |

**Overlap with track 2.** Press feedback overlaps Button, Single-choice segments overlaps Segmented control, Inline status overlaps TextField, and Toggle overlaps Switch. Track 2 follows the standard pattern in the [basic component library](components/basic-library-plan.md). The interaction idea in this table stays a track 1 proposal when CJ still wants an invented version. Single-choice segments, as written here, keeps focus visible on a segment that is not the selected one. The standard radio pattern moves focus and the selection together, which is what track 2 Segmented control follows. Disclosure and Theme switch have no track 2 row. A theme switch could later be a track 2 Switch that flips `data-theme`, and that use is still undecided. Overlap does not approve a row here and does not approve a track 2 component.

## Open questions

| # | Question | Status | Blocks |
|---|---|---|---|
| 1 | **Which component is first?** | **Approved (CJ, 2026-10-23).** A proximity hex color picker, direction B. Brief: [proximity hex color picker](components/color-picker-brief.md). The later candidates, including the toggle, are still a proposal | Choosing the first component. **Observed:** merged in [PR #25](https://github.com/cjhuang6/design-engineering-lab/pull/25) (`953f851`, 2026-10-25), in parallel with Phase 2D. Slot-code and guide-feedback later shipped under per-component approvals. The [entry criteria](#entry-criteria) still gate the next component |
| 2 | **Where component tokens live.** The canonical token file sets `componentTokensIncluded` to false. The design spec's Components collection and Profile Card tokens are not in the JSON (token pipeline [open question 7](token-pipeline-roadmap.md#open-questions)). A value used by one component stays on that component. A component token layer is a later decision, revisited when a second component needs the same contract. The feedback card's local values today are `--feedback-card-receipt-height` 60px, `--feedback-card-max-width` 320px, and `--feedback-card-press-scale` 0.96. **Approved (CJ, 2026-11-10):** the adoption pull request removed the chip locals and uses ToggleChip. The one-line comment field uses TextField at the existing 40px control size. The hex picker's placeholder block stays local the same way. | **Approved (CJ, 2026-11-02).** Option A. Component-specific values stay on the component. `componentTokensIncluded` stays false. | A shared component-token layer, until a second component needs the same contract |
| 3 | **Figma component sync scope.** Whether each component is also a Figma component, whether the plugin syncs it, and whether Code Connect is in scope. The earlier pipeline note said Code Connect gets evaluated when components exist. That evaluation has not happened | Unknown | Figma component parity. It does not block the React demo |
