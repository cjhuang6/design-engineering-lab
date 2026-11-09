# Basic component library

Track 2 of Camellia: a library of ordinary controls with predictable behavior. Project-wide **current status** and the **next agreed task** stay in [docs/roadmap.md](../roadmap.md). Phase 2E (Effect Styles) stays that next task. This file does not start component code.

Every entry is labelled:

- **Approved**: CJ decided it.
- **Observed**: verified in the repository or in Figma, with the evidence noted.
- **Proposal**: suggested, not yet approved.
- **Unknown**: not yet determined.

**Approved (CJ, 2026-11-09):** the decisions in [What is already decided](#what-is-already-decided). Everything else in this file is an **Observed** fact, a **Proposal**, or an **Unknown**. No other decision is Approved. No track 2 pull request that changes the demo, the nav, or a component opens until CJ approves the part of this plan that pull request needs. An **Unknown** that belongs to a later component does not block an earlier one.

## What is already decided

**Approved (CJ, 2026-11-09).**

- Camellia has two component tracks.
- Track 2 follows standard specs. The behavior is the conventional, predictable kind.
- The goal of track 2 is to build the library of basic components, then use AI tools to create prototypes built from those components.
- Track 2 runs in parallel with Phase 2E. It does not wait for 2E, and it does not replace Phase 2E as the active pipeline task.
- This plan is documented and approved before any track 2 component code.
- The showcase navigation splits into three sections: (1) the standard basic components, (2) lab components, the innovative pieces, and (3) a reserved section that lists prototypes built from the basic components.

## Purpose

**Track 1** is the innovative showcase. Invent the interaction, then an interaction brief, a prototype, and a rationale note. That method stays [approved](../components-roadmap.md#working-method-approved) for track 1. **Observed** on `main`: the hex color picker, slot-code, and the guide-feedback card.

**Track 2** is this library. A person, and later an AI tool, should be able to predict a control from its name. Button submits. A checkbox checks. A switch turns on or off. The work is to match a published pattern and to draw it with Camellia's tokens.

The two tracks can both be in progress. A new invented piece still needs its own approval on track 1. This plan does not approve one.

## How a token name is written

**Observed** in `tokens/camellia.tokens.json` and in the generated `src/styles/tokens.css`.

A token has one value and two spellings. `size/control/md` is the path used in the docs and in Figma. The generated CSS custom property is `--size-control-md`. This plan uses the slash path. The CSS name is the same words joined with hyphens.

Semantic colors and the semantic shadows exist twice, under `theme.light` and `theme.dark`. The CSS declares the light values on `:root` and replaces them under `[data-theme="dark"]`. A component that uses those tokens follows the theme switch already on the showcase. Primitive tokens, including `feedback/error`, are declared once and do not change in the dark block.

## Spec source

**Proposal.** The behavior spec for track 2 is the [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/) (APG), the W3C guide for how common controls work with a keyboard and with assistive technology.

Two terms, once:

- A **screen reader** is software that speaks the interface.
- **ARIA** is a set of HTML attributes that tell that software what a control is and what state it is in. The name is Accessible Rich Internet Applications. A **role** is the control's type (`button`, `checkbox`, `switch`). **Focus** is the control that receives keyboard input. The **focus ring** is the visible outline on that control.

Each component below names the APG pattern it would follow. Where the APG has no pattern, the row says so.

**Proposal.** Track 2 replaces the track 1 interaction brief with a short conformance checklist. The checklist is how a reviewer tells that the component matches the pattern. It is not a place to invent a new behavior. The track 1 brief stays the rule for lab pieces.

**Proposal.** Build on the browser's own elements: `<button>`, `<input>`, `<label>`. Those elements already implement the keyboard behavior the APG describes, so the component does not rebuild it. A custom `role` on a `<div>` is out of scope for this library.

### Conformance checklist

**Proposal.** Copy this into the component's pull request and fill it in before implementation.

```markdown
# Conformance: <name>

## Pattern
The APG pattern, with the URL. If the APG has no pattern, the W3C forms tutorial section that applies instead.

## Role and name
The HTML element, the role it already has, and where the accessible name comes from (visible text, or an aria-label when there is no visible text).

## Keyboard
The keys in the pattern, and what each one does. "The browser already does this on <button>" is a valid line.

## Focus
Where focus lands on the way in, where it goes on the way out, and what the focus ring looks like. What a click does differently from a keyboard arrival.

## States
Rest, hover, pressed, focus, disabled, and the selected or invalid state when the pattern has one.

## Reduced motion
What still changes when the person has asked for less motion, and which Camellia duration token the full motion uses.

## Out of scope
What this pull request will not do.
```

### A headless library is an option, not the default

A **headless library** is a package that supplies keyboard, focus, and ARIA behavior, and leaves the visuals to us. Examples a later decision could consider: Radix, React Aria, Base UI.

**Proposal: no new dependency.** The library is native elements plus the APG, styled with Camellia tokens.

| | Native elements, no new package | Add a headless library |
|---|---|---|
| What CJ is learning | The keyboard and the roles are in our code and in the browser | The behavior lives in the package |
| Approval | No package change | **A dependency change. It needs CJ's approval** before `package.json` or the lockfile is edited |
| Risk | We can get a role or a key wrong, which the checklist and the tests are there to catch | The package's prop names become Camellia's prop names, and we take on its releases |
| Fit | Matches the current demo, which has no component library | Faster for Dialog, Select, and Tabs, which are on the later list |

**Unknown** until CJ picks. The recommendation is in [Decisions for CJ](#decisions-for-cj).

## Definition of done

**Proposal.** Every track 2 component pull request meets all of these. The nav pull request meets the ones that apply to a page rather than a control.

- **Tokens only.** The demo guardrail, `tests/guardrails/demo-token-css.test.mjs`, rejects a hardcoded color or a one-off length in `src/`. The hex picker and the showcase shell are the two labeled exceptions. The feedback card keeps its own local values the same way, under [question 2](../components-roadmap.md#open-questions). A basic component does not add a new exception block. If a value has no token, the pull request stops and the token decision goes to CJ before anyone hardcodes it.
- **Keyboard and screen reader.** The behavior matches the pattern named in the checklist. The tests cover the keys, the role, and the accessible name.
- **Reduced motion.** `prefers-reduced-motion` is the system setting a person turns on to ask sites for less motion. The page reads it with the CSS media query `prefers-reduced-motion: reduce`. **Proposal:** state changes use `duration/fast` (100ms) and `ease/standard`. Under reduced motion those transitions take no time. Expression durations (`duration/expression-sm`, `duration/expression-md`, `duration/expression-lg`, `ease/expression`) stay on track 1.
- **Light and dark.** Both themes, using the semantic tokens. The showcase already switches them with `data-theme="dark"`.
- **Tests.** A file in `tests/components/`.
- **Feature map.** A line in [.cursor/skills/verify-camellia](../../.cursor/skills/verify-camellia/features/README.md), and an update to the demo-app feature so the new entry point can be driven. The map is for what exists today. This plan does not add a line for a component that is not built yet.
- **Usage doc.** A short page for people and for AI tools: what the component is, the props it accepts, and one example. **Proposal** path: `docs/components/basics/<name>.md`.

**Proposal, shared visuals for every control:**

- Disabled uses `opacity/disabled` (0.4), matching the feedback card's unavailable Submit.
- The focus ring matches the feedback card. **Observed** in `GuideFeedback.css`: `outline` is `border/focus` (2px solid `color/focus`), and the offset is `border/width/2`. The ring is on `:focus-visible`, so it shows when the person arrives from the keyboard and stays off after a click.
- Hover styles sit inside `@media (hover: hover) and (pointer: fine)`, as the feedback card's hover styles do. A phone has no real hover, and a hover color can stick after a tap if it is not wrapped this way.
- **Proposal:** on a coarse pointer (a finger), the hit area is at least `size/touch-target` (44px) even when the drawn control is smaller. **Observed** in the feature map for slot-code: the visual button stays about 32px and the coarse hit target is 44px. The drawn size and the hit area are allowed to differ.
- Basics do not use the expression colors (`color/expression/pink`, `color/expression/blue`, `color/expression/green`), the expression motion tokens, or the frost materials. Those are for atmospheric work.
- Theme-aware shadows are `shadow/raised`, `shadow/control`, and `shadow/control-hover`. They change in the dark theme. The primitive shadows `shadow/none`, `shadow/sm`, `shadow/md`, and `shadow/lg` do not. Controls use the theme-aware ones.

## Order

**Proposal.** One pull request per step. The order is the list below.

| Step | Pull request | Why it is here |
|---|---|---|
| 0 | Showcase nav restructure | **Proposal, recommended first.** Button needs a section to land in. Detail: [Showcase navigation](#showcase-navigation) |
| 1 | Button | Smallest control. Primary, secondary, and ghost. Sizes from the control size tokens |
| 2 | IconButton | The same button, with an icon and an accessible name |
| 3 | TextField | One line, with label, help, and error |
| 4 | Chip / ToggleChip | The pressable chip the feedback card already invented by hand |
| 5 | Guide-feedback adoption | **Proposal.** Switch that card's buttons, chips, and one-line field over to the basics. This is the reuse proof, and it is the trigger for [question 2](#adoption-and-question-2). It waits until steps 1, 3, and 4 are merged |
| 6 | Checkbox | After the card has moved, so the selection controls are not tangled with that edit |
| 7 | Radio group | The pattern Segmented control follows |
| 8 | Switch | Same on/off family as Checkbox |
| 9 | Segmented control | After Radio group |
| 10 | Card / Surface | A container. The controls above can be reviewed without it |

**Later, not in this sequence.** Tooltip, Dialog, Select/Menu, Tabs. They need overlay behavior and, for Select, a pattern choice that is still open. See [Later](#later).

## Showcase navigation

**Approved (CJ, 2026-11-09).** The showcase nav splits into three sections:

1. **Standard basic components.** The track 2 library.
2. **Lab components.** The innovative pieces: slot-code, the hex color picker, the guide-feedback card, and future track 1 pieces.
3. **Prototypes.** A reserved section that lists prototypes built from the basic components. This is the AI prototyping goal. It is empty until a prototype exists.

**Observed** in `src/App.jsx` on `main`: the nav is Blocks, Tokens, and Pipeline. The links are hash links, the part of the address after `#`. `#tokens` opens Tokens, `#pipeline` opens Pipeline, and every other hash, including `#blocks` and an empty hash, opens Blocks. There is no router package.

**Proposal (pending CJ).** Keep Tokens and Pipeline as nav items after the three sections. That is five items. Working labels, in order:

1. Components
2. Lab
3. Prototypes
4. Tokens
5. Pipeline

Working hashes, matching those labels: `#components`, `#lab`, `#prototypes`, plus the existing `#tokens` and `#pipeline`.

**Unknown.** The final label wording. Site copy is reviewed separately. The working labels are a stand-in so the nav pull request has words to ship. A later copy review can rename them. A rename changes the hash, so the old hash should keep working the same way `#blocks` does.

**Proposal.** `#blocks` redirects to the lab section. Someone with an old link lands on Lab, and the address bar changes to the lab hash. The browser back button should not bounce between `#blocks` and the lab hash. An empty hash keeps opening Lab, because an empty hash opens Blocks today and Lab is that same page.

**Proposal, what each section shows at first.**

- Lab shows the three cards that Blocks shows today. The page moves. The cards do not get redesigned in the nav pull request.
- Components is an empty section until Button. One short sentence says the library will live here. The sentence is site copy, so its wording is part of the **Unknown** above.
- Prototypes is reserved and empty. The same copy note applies. Nothing is listed until a prototype built from the basics exists.

**Proposal.** This is its own pull request, before Button. It updates the demo-app feature in the feature map, because the entry points change. It does not add a component, and it does not edit the token file.

## Button

**Proposal.** Step 1. Variants: primary, secondary, ghost. Sizes: `sm`, `md`, `lg`.

**States.** Rest, hover, pressed, keyboard focus, disabled.

**Spec.** [Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/). Element: `<button>`. Enter activates. Space activates. The accessible name is the visible label. A native `<button>` already has the role, so the component does not set `role="button"`.

**Tokens.**

| Part | Token | Notes |
|---|---|---|
| Height | `size/control/sm` 32px, `size/control/md` 40px, `size/control/lg` 48px | The three sizes that already exist |
| Horizontal padding | `control/padding-inline/sm` (`space/3`, 12px), `md` (`space/4`, 16px), `lg` (`space/5`, 20px) | Paired with the size of the same name |
| Vertical padding | `space/0` | See the height note below |
| Label | `label/md` | 14px type, 20px line box. **Observed** on the card's Cancel and Submit |
| Primary rest | `color/action/primary`, `color/action/primary-text` | |
| Primary hover | `color/action/primary-hover` | |
| Primary pressed | `color/action/primary-pressed` | |
| Disabled | `opacity/disabled` | |
| Focus | `border/focus`, offset `border/width/2` | Shared ring above |
| Motion | `duration/fast`, `ease/standard` | Color and shadow only |

There is no `color/action/secondary`. **Proposal** for secondary, taken from the card's Cancel button (**Observed** in `GuideFeedback.css`): fill `color/surface/primary`, label `color/text/secondary`, shadow `shadow/control`, hover shadow `shadow/control-hover`.

**Proposal** for ghost: transparent fill, label `color/text/primary`, hover fill `color/surface/subtle`. No shadow.

**Unknown.**

- **Height math.** `label/md` has a 20px line box. `size/control/md` is 40px, so the leftover vertical space is 10px a side. The space tokens jump from `space/1` (4px) to `space/2` (8px). 10px is not a token. `control/padding-block/md` is 12px a side, and 20 + 24 = 44, which is `size/touch-target`, not `size/control/md`. The fixed height and the padding tokens do not add up. **Proposal:** the height is the `size/control/*` token, horizontal padding is `control/padding-inline/*`, and vertical padding is `space/0`. That is how the card's buttons are built.
- **Radius.** The card's buttons use `radius/full`. The design spec says most UI sits between `radius/md` (8px) and `radius/lg` (12px). **Proposal:** `radius/md` for the basic button. The card keeps its pill until the adoption pull request.
- **Unavailable.** A native `disabled` button cannot be focused, so a screen reader user tabs past it. `aria-disabled="true"` announces unavailable and leaves it focusable. The card uses the focusable form on Submit when the comment is too long, so the error can still be reached. **Proposal:** support both, and have the usage doc say which one to pick. The usual case is native `disabled`.
- **Press scale.** The card scales to 0.96 on press. That number is a local value, `--feedback-card-press-scale`, and there is no scale token. **Proposal:** the basic button does not scale. The card may keep the scale as a local wrapper until question 2 is decided.

## IconButton

**Proposal.** Step 2. A Button with no visible words.

**States.** The same as Button.

**Spec.** The same [Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/). The accessible name cannot come from visible text, so the component requires a name, passed to `aria-label`. An accessible name is the text a screen reader reads for the control. An icon button without one is announced as a blank button.

**Tokens.** The Button tokens, plus the icon glyph size: `size/icon/sm` 16px, `size/icon/md` 20px, `size/icon/lg` 24px. **Proposal:** pair them with the control size of the same name (16 inside 32, 20 inside 40, 24 inside 48). The icon color is `color/icon/primary` on secondary and ghost, and `color/action/primary-text` on primary.

**Unknown.** Where the icon graphic comes from. **Proposal:** no icon package. The caller passes the icon in. Adding a package is a dependency change and needs CJ's approval. A shared Camellia icon set is a later decision, not this pull request.

## TextField

**Proposal.** Step 3. One line. A visible label, optional help text, and an error.

**States.** Rest, hover, keyboard focus, disabled, error. A filled field is a field with a value, not a separate color.

**Spec.** The APG has no text-field pattern. **Proposal:** a native `<input>` with a `<label>`, following the W3C forms tutorials on [labels](https://www.w3.org/WAI/tutorials/forms/labels/) and [notifications](https://www.w3.org/WAI/tutorials/forms/notifications/). The label is tied to the input with `for` and `id`. Help text and the error are tied with `aria-describedby`, which points at the id of that extra text so the screen reader reads it with the field. When the error is showing, the input has `aria-invalid="true"`.

**Late validation. Observed** on the guide-feedback comment field (`model.js`, `GuideFeedback.jsx`):

- Typing does not turn the error on. `setComment` keeps the error only when it was already showing and the text is still too long.
- Leaving the field (blur) while the text is over the limit turns the error on.
- Trying to submit while the text is over the limit turns the error on and does not submit.
- Editing the text back under the limit turns the error off immediately.

**Proposal.** TextField uses that timing. The error appears on blur and on submit. It clears as soon as the value is valid. It does not appear on every keystroke before the first blur or submit. The component shows the message. The screen that uses it decides the rule, the way the card decides "too long."

**Tokens. Observed** on the card's field, and **Proposal** for the basic field:

| Part | Token |
|---|---|
| Height, default md | `size/control/md` (40px). **Proposal:** sm and lg exist too, from `size/control/sm` and `size/control/lg` |
| Inline padding | **Proposal:** `control/padding-inline` at the same size name. The card uses `space/3` (12px) on a 40px field, which is the sm padding |
| Border | `border/width/1`, `border/style/solid`, `color/border/default`, `radius/md` |
| Fill and text | `color/surface/primary`, `color/text/primary`, `body/md` |
| Placeholder | `color/text/placeholder` |
| Label and help | `label/sm`, `color/text/secondary` |
| Hover border | **Proposal:** `color/border/strong`. The card uses `color/text/tertiary` |
| Error border and error text | `feedback/error`, type `label/sm` |
| Focus | The shared ring. The card also paints the border `color/action/primary` on focus. **Proposal:** the ring is enough, so focus does not add a second blue |

**Unknown.**

- `feedback/error` (`--feedback-error`, `#EF4444`) is a primitive. **Observed:** the dark theme block in `tokens.css` does not override it, so the red is the same in both themes. **Proposal:** use it anyway, as the card does. A semantic error color with its own dark value is a token-file change and waits for the table in [Adoption](#adoption-and-question-2).
- A success state. `feedback/success` exists and has the same one-value limit. The card's field has no success state. **Proposal:** the first TextField has no success state.
- Read-only. **Proposal:** out of the first pull request.

## Chip / ToggleChip

**Proposal.** Step 4. ToggleChip is the one the feedback card needs. Several can be on at once. That is a group of toggle buttons, not a radio group.

**States.** Rest, hover, pressed (`aria-pressed="true"`), keyboard focus, disabled.

**Spec.** The toggle button inside the [Button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/). Element: `<button>` with `aria-pressed` set to `true` or `false`. Enter and Space toggle it. The APG says the visible label stays the same when the state changes, so the screen reader can announce "pressed" against a stable name. A group of chips uses `role="group"` and a visible label, which is what the card does.

A static chip that does nothing is **Unknown** for this pull request. **Proposal:** ship the toggle only.

**Tokens that exist, Observed on the card's chip:**

| Part | Token |
|---|---|
| Radius | `radius/full` |
| Resting shadow | `shadow/control`, hover `shadow/control-hover` |
| Resting fill and label | `color/surface/primary`, `color/text/secondary` |
| Selected fill and label | `color/surface/selected`, `color/action/primary` |
| Selected ring | `border/width/1` and `color/action/primary`. There is no selected-border token. The card composes these two |
| Gap inside the chip | `space/1` |
| Type weight | `font/weight/medium`, `font/family/sans`, `tracking/normal` |
| Motion | `duration/fast`, `ease/standard` |

**Tokens that do not exist. Observed** as local values on the card, not in the JSON:

| Local value | What it is | Nearest real token |
|---|---|---|
| 28px height | `--feedback-card-chip-height` | `size/control/sm` is 32px |
| 13px type | `--feedback-card-chip-size` | `label/sm` is 12px, `body/sm` is 14px |
| 6px and 10px padding | chip pad start and end | `space/2` is 8px, `space/3` is 12px |
| 6px gap between chips | `--feedback-card-chip-gap` | `space/2` is 8px. The card's row gap is already `space/2` |

**Proposal.** ToggleChip uses only real tokens: height `size/control/sm`, type `label/sm`, padding from `space/2` and `space/3`, gap `space/2`. The card's 28px and 13px stay on the card until the adoption pull request, which is the question 2 decision point. This pull request does not add tokens.

## Checkbox

**Proposal.** Step 6.

**States.** Unchecked, checked, hover, keyboard focus, disabled. The mixed state (`aria-checked="mixed"`, a checkbox that means "some of the children are checked") is **Unknown**. **Proposal:** checked and unchecked only, in this pull request.

**Spec.** [Checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/). Space toggles the checkbox that has focus. **Proposal:** a native `<input type="checkbox">` with a `<label>`, so the browser does the key and the checked state. A group with a visible name uses a `<fieldset>` and a `<legend>`.

**Tokens. Proposal.**

| Part | Token |
|---|---|
| Drawn box | `size/icon/md` (20px). **Unknown** whether `size/icon/sm` (16px) is a better fit. The hit area follows the shared coarse-pointer rule, `size/touch-target` |
| Unchecked | `color/surface/primary`, `color/border/default`, `border/width/1`, `radius/sm` (4px, so it does not look like a radio) |
| Hover | `color/border/strong` |
| Checked fill and mark | `color/action/primary`, `color/action/primary-text` |
| Focus | The shared ring |
| Label | `label/md`, `color/text/primary`, gap `space/2` |

## Radio group

**Proposal.** Step 7. One choice in a set.

**States.** Per option: unchecked, checked, hover, keyboard focus, disabled. The group has a visible name.

**Spec.** [Radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/). Tab moves into the group, onto the checked option, or onto the first option when none is checked. Tab moves out to the next control. Arrow keys move the check to the next or previous option and wrap at the ends. Space checks the focused option when it is not already checked. **Proposal:** native `<input type="radio">` elements that share a `name`, inside a `<fieldset>` and `<legend>`. The browser already moves the check with the arrow keys.

**Tokens. Proposal.** The checkbox tokens, with `radius/full` on the circle and a checked dot in `color/action/primary`. The outer ring uses `color/border/default`.

**Unknown.** Whether a group may start with nothing checked. The pattern allows it. **Proposal:** allow it.

## Switch

**Proposal.** Step 8. On or off. The label does not change when the state changes. The APG calls that out: a screen reader says "on" or "off" against a stable name.

**States.** Off, on, hover, keyboard focus, disabled. No mixed state. The pattern says a switch is only the two values.

**Spec.** [Switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/). Space changes the state. Enter is optional in the pattern. **Proposal:** a native `<input type="checkbox" role="switch">`. On a real checkbox the checked state is the `checked` attribute, which is what the pattern says to use instead of `aria-checked` for that element. Choose a switch when the meaning is on/off. Choose a checkbox when the meaning is checked/unchecked. They should not be styled as each other.

**Tokens. Proposal.**

| Part | Token |
|---|---|
| On fill | `color/action/primary`. **Unknown** alternative: `color/functional/accent`, the green. **Proposal:** the action blue, so "on" is not read as a success message |
| Off track | `color/border/strong` |
| Thumb | `color/surface/primary` |
| Focus and disabled | The shared ring and `opacity/disabled` |
| Label | `label/md`, gap `space/2` |

**Unknown.** The track's width and height. No switch size token exists. Candidates, all real tokens: height `size/icon/lg` (24px) or `size/control/sm` (32px), width `size/control/md` (40px) or `size/control/lg` (48px). The hit area is at least `size/touch-target`. **Proposal:** height `size/control/sm`, width `size/control/lg`, and CJ confirms at the Switch pull request.

## Segmented control

**Proposal.** Step 9. One choice, drawn as a row of segments. It does not switch a panel of content. That second job is Tabs, which is later.

**States.** Selected, unselected, hover, keyboard focus, disabled. In the radio pattern, moving with the arrow keys moves the focus and the selection together. Focus sitting on one segment while another stays selected is a different interaction. That idea is the track 1 "Single-choice segments" candidate, and it is still only a proposal there.

**Spec.** The [Radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/), same keys as Radio group. **Proposal:** the same native radios, styled as a segment row.

**Tokens. Proposal.**

| Part | Token |
|---|---|
| Track | `color/surface/subtle`, padding `space/1`, radius `radius/lg` |
| Segment height | `size/control/md` |
| Selected segment | `color/surface/primary`, `color/text/primary`, `shadow/control` |
| Unselected label | `color/text/secondary` |
| Type | `label/md` |
| Focus | The shared ring, on the segment that has focus |

**Unknown.** The track radius, if `radius/md` fits the rest of the library better than `radius/lg`.

## Card / Surface

**Proposal.** Step 10. A surface to put other components on. It is not a control. It has no role and no keys. A card that is also a link or a button is a different component and is out of scope here.

**States.** Rest only, in light and dark.

**Spec.** None. The APG has no card pattern.

**Tokens. Proposal.**

| Part | Token |
|---|---|
| Fill and text | `color/surface/primary`, `color/text/primary` |
| Padding | `space/4`. **Observed** on the feedback card |
| Radius | `radius/lg` (12px) |
| Shadow | `shadow/raised` |

**Observed** in `tokens.css`: `shadow/raised` already includes a 1px ring in its shadow value. **Proposal:** Card does not also set `border/subtle`. Two edges would stack.

**Unknown.** A flat variant (`border/subtle`, `shadow/none`) and a larger radius. The feedback card uses `radius/2xl` (24px). **Proposal:** that radius stays on the card, because the card is a track 1 piece. The basic surface uses `radius/lg`, which is the top of the range the design spec gives most UI.

## Later

**Proposal.** Not scheduled. Each one is still its own future pull request, after the list above, and only when CJ asks.

| Candidate | Pattern | Tokens already in the file | Still open |
|---|---|---|---|
| Tooltip | [Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/) | `z/tooltip` | How it opens from the keyboard, and Escape to dismiss |
| Dialog | [Dialog (Modal)](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | `z/overlay`, `z/modal` | Focus has to stay inside until the dialog closes. That behavior is the reason it is later |
| Select / Menu | Three different patterns: [Combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/), [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/), [Menu button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) | `z/dropdown` | **Unknown** which pattern a Camellia Select is. A menu is a list of actions. A listbox is a list of choices. A combobox is a field with a popup |
| Tabs | [Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | None specific | Tabs switch panels. Segmented control does not |

## Adoption and question 2

**Proposal.** Step 5, after Button, TextField, and ToggleChip are on `main`. One pull request switches the guide-feedback card's hand-rolled controls over to the basics:

- Cancel and Submit become Button (secondary and primary).
- The reason chips become ToggleChip.
- The comment field becomes TextField.

**Observed** those three are hand-rolled in `src/components/guide-feedback/`. The rating scale and the receipt stay on the card. They are the invented interaction, which is track 1.

**Unknown.** "Add a comment" and "Edit" (`guide-feedback-link`). They are buttons colored with `color/action/link`. **Proposal:** leave them on the card in this pull request. Ghost, as proposed above, uses `color/text/primary`, not the link color.

This pull request is the trigger named in components-roadmap [question 2](../components-roadmap.md#open-questions). **Approved (CJ, 2026-11-02):** a value used by one component stays on that component, and `componentTokensIncluded` stays false, until a second component needs the same contract.

The card and the library are that second consumer when they need a value that no current token holds. The values most likely to collide are the chip's local ones (28px, 13px, 6px, 10px) and the press scale (0.96). The receipt height (60px) and the card max width (320px) stay on the card. The library does not need them.

**Proposal, the decision point.** Before that pull request edits `tokens/camellia.tokens.json`, CJ is shown a table of every token the edit would add, change, or delete. Each row names the token, its layer, and its kind.

- **Layer** is where it sits: primitive (a raw value), semantic (a purpose, with light and dark where the color or shadow changes), or component (a contract for one component).
- **Kind** is the type: color, dimension, number, duration, and so on.

No token-file edit lands in the pull request until CJ approves that table. **Proposal:** prefer changing the card to tokens that already exist (`size/control/sm`, `label/sm`, the space tokens) and keep the press scale as a local card value. A new token is only for a value CJ wants to keep that has no token today. Approving a row in the table is the approval to edit the file. The table does not, by itself, turn on a component-token layer.

## AI prototyping

**Approved** goal: once the basics exist, AI tools build prototypes out of them. The reserved Prototypes section of the nav is where those prototypes are listed.

**Unknown. No choice is made here.** What would make the library usable by an AI tool, with the tradeoff for each:

| Option | What it is | Gain | Cost |
|---|---|---|---|
| Usage doc per component | The short page already in the definition of done | A person and a model read the same page. The props are written down | Prose is easy for a model to over-read. A prop that is only implied will get invented |
| Consistent prop names | The same names on every component. A **prop** is a named input, such as `size` or `disabled` | A model that has seen Button can use IconButton. **Possible set, not chosen:** `variant`, `size` (`sm`, `md`, `lg`), `disabled`, and the label as children. IconButton would take the accessible name as `label` | The names are a public contract. Renaming them later is a breaking change |
| Machine-readable manifest | A JSON file listing each component, its props, its states, the tokens it uses, and the pattern URL | A tool can read it without parsing prose | A second source to keep in step with the code. It goes stale if it is written by hand |
| An index written for AI tools | One markdown page listing every basic component, the file it lives in, and a short example. A person can paste it into a prompt, or a tool can fetch it | One place to point a tool | It goes stale unless it is generated from the components or checked |
| Figma Code Connect | Figma's link from a Figma component to a code snippet. Components-roadmap [question 3](../components-roadmap.md#open-questions) | Design-to-code stays tied to the real component | Question 3 is **Unknown**. Code Connect and any Figma write need CJ's approval. It does not help a prototype that never opens Figma |

The definition of done already includes the usage doc. That is a **Proposal** for the doc itself, and it is not a choice among the five options above.

## Figma

**Unknown.** Whether each basic component is also a Figma component, whether the plugin syncs it, and whether Code Connect is in scope. That is components-roadmap [question 3](../components-roadmap.md#open-questions). It does not block the React demo. The color picker shipped the same way.

**Approved** rule, restated: writing to a Figma file, or running Plugin API operations against one, needs CJ's approval in the task. This plan does not include either. Track 2 pull requests do not add a plugin command and do not edit the token file unless the adoption table has been approved.

## Decisions for CJ

A recommendation is not a decision. CJ can accept it, pick the other option, or leave the row **Unknown** until the pull request that needs it. An **Unknown** on a later component does not block an earlier pull request. No track 2 code, including the nav, starts until the rows that pull request needs are answered.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Headless dependency | A. Native HTML plus the APG. No new package. B. Add a headless library (Radix, React Aria, or Base UI) | A. B needs an explicit approval to change `package.json` and the lockfile |
| 2 | Nav items after the three approved sections | A. Five items. The three sections, then Tokens, then Pipeline. B. Only the three sections. Tokens and Pipeline leave the bar | A. Working order: Components, Lab, Prototypes, Tokens, Pipeline |
| 3 | Nav label wording | A. Ship the nav pull request with the working labels. B. Wait for a copy review before any nav change | A. The wording stays **Unknown**. A later copy review can rename them. The hashes follow the labels, and a renamed hash keeps the old one working |
| 4 | Existing `#blocks` hash | A. Redirect. `#blocks` changes the address to the lab hash, and the back button does not bounce. An empty hash opens Lab, which is what an empty hash does today when it opens Blocks. B. Alias. `#blocks` and the lab hash both show Lab, and the address can stay `#blocks`. C. `#blocks` stops working | A |
| 5 | When the nav pull request lands | A. Its own pull request, before Button. B. The same pull request as Button | A. Button then has a section to land in, and the Button pull request stays one component |
| 6 | Button height and padding | A. Fixed height `size/control/*`, horizontal padding `control/padding-inline/*`, vertical padding `space/0`. B. Height is the line box plus `control/padding-block/*` | A. For `label/md` (20px line box), B does not land on `size/control/*`. The space scale has no 6px, 10px, or 14px step |
| 7 | Button radius | A. `radius/md`. B. `radius/lg`. C. `radius/full`, matching the feedback card's buttons | A. The card keeps its pill until the adoption pull request |
| 8 | Secondary and ghost, with no secondary action color in the tokens | A. Secondary: `color/surface/primary`, `color/text/secondary`, `shadow/control`. Ghost: transparent fill, `color/text/primary`, hover `color/surface/subtle`. B. Ghost uses `color/action/link`, matching Add a comment and Edit | A |
| 9 | Unavailable button | A. Native `disabled` only. The button leaves the tab order. B. `aria-disabled` only. It stays focusable. C. Both, and the usage doc says which to use | C. The card's Submit stays focusable when the comment is too long, so the error can be reached. The usual case is native `disabled` |
| 10 | TextField error color | A. `feedback/error`, as the card does today. The same red in light and dark. B. Add a semantic error color with a dark value before TextField | A. B is a token-file change and goes through the adoption table first |
| 11 | TextField validation timing | A. Late. Show the error on blur and on submit. Clear it as soon as the value is valid. B. Show the error on every change | A. This is the feedback card's timing |
| 12 | TextField padding at md | A. `control/padding-inline/md` (16px) with `size/control/md`. B. `space/3` (12px), matching the card's field | A. The size name and the padding name match. The card changes at adoption |
| 13 | ToggleChip size | A. Existing tokens only. Height `size/control/sm`, type `label/sm`. B. New tokens for the card's 28px height and 13px type | A. B waits for the token table at adoption |
| 14 | Icon source | A. No icon package. The caller passes the icon, and IconButton requires an accessible name. B. Add an icon package | A. B is a dependency change |
| 15 | Checkbox mixed state | A. Checked and unchecked only. B. Include the mixed state in the first Checkbox pull request | A |
| 16 | Switch on color | A. `color/action/primary`. B. `color/functional/accent` | A. On is an action, not a success message |
| 17 | Switch track size | A. Height `size/control/sm` (32px), width `size/control/lg` (48px). B. Height `size/icon/lg` (24px), width `size/control/md` (40px). C. Decide at the Switch pull request, from tokens that exist | A, confirmed when that pull request opens. No new size token |
| 18 | Segmented control pattern | A. Radio group. One choice, no panel. B. Tabs. The choice switches a panel | A. Panel switching stays in the later Tabs candidate |
| 19 | Card surface | A. `radius/lg`, `shadow/raised`, no extra border. B. `radius/2xl`, matching the feedback card. C. `border/subtle` and `shadow/none` | A. `shadow/raised` already includes a hairline |
| 20 | Focus ring | A. The card's ring. `outline` is `border/focus`, offset is `border/width/2`, on `:focus-visible`. B. Change the border width on focus, which changes the control's size | A |
| 21 | Guide-feedback adoption scope | A. Cancel, Submit, the toggle chips, and the comment field. B. Also Add a comment and Edit | A. Those two use `color/action/link`, and ghost under row 8A does not |
| 22 | When adoption lands | A. After ToggleChip (steps 1, 3, and 4). B. After Card, once the whole first list exists | A. The card needs those three, not the later controls |
| 23 | Question 2 at adoption | A. Before any edit to `tokens/camellia.tokens.json`, show every new, changed, and deleted token with its layer and its kind, and wait for CJ. Prefer changing the card to tokens that already exist. B. Turn on a component-token layer as soon as the second consumer exists | A. The approved rule opens the decision. It does not create the layer. The receipt height and the card max width stay on the card |
| 24 | AI prototyping enablement | A. Usage doc per component. B. Consistent prop names. C. A JSON manifest. D. One index written for AI tools. E. Figma Code Connect | No choice is made. If a starting order helps: A and B with the first component, C and D when a second component exists, E after question 3. The usage doc is already in the definition of done |
| 25 | Figma parity | A. Demo only. Question 3 stays open. B. Also build Figma components. C. Also Code Connect | A. Figma writes need CJ's approval. This plan does not include them |
