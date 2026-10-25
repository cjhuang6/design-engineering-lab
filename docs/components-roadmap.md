# Components & interactions

Phase 3 of the project roadmap: components, with the weight on how they behave. Project-wide **current status** and the **next agreed task** live in [docs/roadmap.md](roadmap.md). This file does not restate them. The color picker is in progress in draft [PR #25](https://github.com/cjhuang6/design-engineering-lab/pull/25). The rest of the phase has not started.

Every entry is labelled:

- **Approved**: CJ decided it.
- **Observed**: verified in the repository or in Figma, with the evidence noted.
- **Proposal**: suggested, not yet approved.
- **Unknown**: not yet determined.

The token pipeline roadmap uses "Phase 3" for a designer-review workflow and "Phase 4" for an earlier component sketch, including a note that Button might be first. Those sections are not this phase. This document is the components plan. The Button note does not choose the first component.

## Direction (Approved)

**Approved (2026-10-22):** Phase 2D (Text Styles) and Phase 2E (Effect Styles) come first. Then build components with the emphasis on behavior: how a component responds, and the interaction model behind that response.

The goal is original interaction concepts, prototyped and shipped in code. Invent the interaction. Do not implement a component by following a spec line by line. The approved goal includes prototyping in Figma and with AI tools, alongside code. What ships is the coded component in this repository. Whether at least one interaction must be AI-assisted is a [proposal](#proposals) below, not a requirement yet.

## Entry criteria

**Approved (2026-10-22):** Phase 3 starts after Phase 2D (Text Styles) and Phase 2E (Effect Styles) are merged and desktop-verified.

These deferred token-pipeline items do not block that start. **Approved (deferred, 2026-10-22).** The trigger is: until a component needs them, except where a tighter trigger is named.

- Phase 2F Expression Paint Styles.
- Phase 2G Figma validation and audit. Today's dry runs already report the diffs: the primitive and semantic commands report created, updated, unchanged, and in-Figma-only.
- The designer review workflow (Figma back to the JSON).
- Component tokens (token pipeline [open question 7](token-pipeline-roadmap.md#open-questions)). Trigger: decided with the first component.
- Motion variable binding in Figma (token pipeline [open question 8](token-pipeline-roadmap.md#open-questions)). The Figma Motion API is in beta. Trigger: until a component needs that binding.

What is merged and desktop-verified is [Current status](roadmap.md#current-status). An agent does not open a component pull request from this document alone.

## First component

**Approved (CJ, 2026-10-23):** the first component is a proximity hex color picker, direction B. The interaction brief is [proximity hex color picker](components/color-picker-brief.md).

The picker uses Camellia's color tokens only.

**In progress (CJ, 2026-10-24).** CJ approved building this picker now, in parallel with Phase 2D. The React component is in draft [PR #25](https://github.com/cjhuang6/design-engineering-lab/pull/25), at `src/components/hex-color-picker/`. Phase 2D is still the next agreed task. The [entry criteria](#entry-criteria) still apply to the rest of Phase 3. **Decided (CJ, 2026-10-23):** a throwaway prototype, a standalone HTML file outside this repo, settled the picker's interaction details. That file is not in the repository.

Values that are not tokens yet are placeholders on the component, in one block commented `PLACEHOLDER - candidate token, see color-picker-brief.md`. They are not in the token JSON. Where component tokens live is still [question 2](#open-questions).

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

**(a) Interaction brief, written before code.** The concept, the states, keyboard behavior, pointer behavior, motion, and accessibility. Motion uses Camellia's duration and ease tokens (`duration/fast`, `duration/normal`, `duration/slow`, `ease/standard`, `ease/enter`, `ease/exit`). The expression tokens (`duration/expression-sm`, `duration/expression-md`, `duration/expression-lg`, `ease/expression`) are for motion that is deliberately expressive. The brief names the token. It does not invent a millisecond value or a cubic-bezier.

**(b) Prototype in Figma and in code.** The Figma prototype and the code prototype are how the interaction is tried. Neither is a second source of truth for color, type, space, radius, or motion. Those come from the token file.

**(c) Ship in the React demo, Camellia tokens only.** The component lands in the demo app and reads the generated custom properties. No hardcoded colors or one-off lengths. The demo guardrail already rejects those in `src/`. The color picker's candidate values are the one exception: a labeled placeholder block on the component, until question 2 decides where component tokens live. The guardrail allows that block and still rejects hardcoded colors and one-off lengths everywhere else in `src/`.

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

## Open questions

| # | Question | Status | Blocks |
|---|---|---|---|
| 1 | **Which component is first?** | **Approved (CJ, 2026-10-23).** A proximity hex color picker, direction B. Brief: [proximity hex color picker](components/color-picker-brief.md). The later candidates, including the toggle, are still a proposal | Choosing the first component. **In progress:** draft [PR #25](https://github.com/cjhuang6/design-engineering-lab/pull/25), in parallel with Phase 2D. The rest of Phase 3 still waits on the [entry criteria](#entry-criteria) |
| 2 | **Where component tokens live.** The canonical token file sets `componentTokensIncluded` to false and excludes component tokens until the foundation is frozen. The design spec's Components collection and Profile Card tokens are not in the JSON (token pipeline [open question 7](token-pipeline-roadmap.md#open-questions)). Putting component tokens in that file changes the canonical schema and needs CJ's approval. Until then, a component uses primitive and semantic tokens that already exist. The color picker brief lists candidate component tokens for hover, press, grow-in, and idle. They are not created yet. The picker ships them as component-local placeholders until this is decided. That list does not decide where those tokens live | **Approved (deferred, 2026-10-22).** Decide it with the first component. The location is still open then. It does not block starting Phase 3 | A component-token layer, until that first component |
| 3 | **Figma component sync scope.** Whether each component is also a Figma component, whether the plugin syncs it, and whether Code Connect is in scope. The earlier pipeline note said Code Connect gets evaluated when components exist. That evaluation has not happened | Unknown | Figma component parity. It does not block the React demo |
