# Components & interactions

Phase 3 of the project roadmap: components, with the weight on how they behave. Project-wide **current status** and the **next agreed task** live in [docs/roadmap.md](roadmap.md). This file does not restate them. The phase has not started.

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

## Working method (Approved)

One component per pull request. The pull request contains the four parts below, in this order. Code does not start a component that has no interaction brief in the same change.

**(a) Interaction brief, written before code.** The concept, the states, keyboard behavior, pointer behavior, motion, and accessibility. Motion uses Camellia's duration and ease tokens (`duration/fast`, `duration/normal`, `duration/slow`, `ease/standard`, `ease/enter`, `ease/exit`). The expression tokens (`duration/expression-sm`, `duration/expression-md`, `duration/expression-lg`, `ease/expression`) are for motion that is deliberately expressive. The brief names the token. It does not invent a millisecond value or a cubic-bezier.

**(b) Prototype in Figma and in code.** The Figma prototype and the code prototype are how the interaction is tried. Neither is a second source of truth for color, type, space, radius, or motion. Those come from the token file.

**(c) Ship in the React demo, Camellia tokens only.** The component lands in the demo app and reads the generated custom properties. No hardcoded colors or one-off lengths. The demo guardrail already rejects those in `src/`.

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

## Proposals

**Proposal:** at least one shipped component includes an interaction that was explored with an AI prototyping tool before the code was finished. The rationale note says what the tool suggested and what was kept. Which tool, and which component, is **Unknown**. The interaction brief is still written before implementation code. The AI prototype does not replace the brief or the tokens.

**Proposal — candidate components. CJ picks. This list is not an approved order, and it is not a decision about which component is first.**

| Candidate | Interaction idea |
|---|---|
| Press feedback | A control whose design is the state model: rest, hover, press, keyboard focus, disabled. Feedback uses duration and ease tokens |
| Disclosure | Show and hide content with a height animation, a keyboard path, and a reduced-motion path |
| Single-choice segments | Pointer and arrow keys move one selection. Focus is visible when it differs from the selected segment |
| Theme switch | Flips `data-theme` so semantic colors change. The control does not introduce a second palette |
| Inline status | A field moves among neutral, error, and success using feedback and semantic colors that already exist |

## Open questions

| # | Question | Status | Blocks |
|---|---|---|---|
| 1 | **Which component is first?** The candidates above are a proposal. CJ chooses | Unknown | Starting Phase 3 |
| 2 | **Where component tokens live.** The canonical token file sets `componentTokensIncluded` to false and excludes component tokens until the foundation is frozen. The design spec's Components collection and Profile Card tokens are not in the JSON (token pipeline [open question 7](token-pipeline-roadmap.md#open-questions)). Putting component tokens in that file changes the canonical schema and needs CJ's approval. Until then, a component uses primitive and semantic tokens that already exist | **Approved (deferred, 2026-10-22).** Decide it with the first component. The location is still open then. It does not block starting Phase 3 | A component-token layer, until that first component |
| 3 | **Figma component sync scope.** Whether each component is also a Figma component, whether the plugin syncs it, and whether Code Connect is in scope. The earlier pipeline note said Code Connect gets evaluated when components exist. That evaluation has not happened | Unknown | Figma component parity. It does not block the React demo |
