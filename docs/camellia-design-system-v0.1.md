# Camellia Design System

**Version:** 0.1  
**Status:** Foundation / working specification  
**Tagline:** Quiet structure. Color in bloom.

Camellia is a design system for the space between design and code. It is intentionally restrained at the component level and expressive at the atmospheric level: crisp, airy, digital, icy, tropical, and experimental without becoming ornamental.

The name is a metaphor, not a visual theme. Camellia should **not** become flower-themed UI. Its visual identity comes from the tension between cold structure and moments of color, light, translucency, and motion.

---

## 1. Core principles

### 1.1 Atmosphere and interface are separate layers

> **Background = expressive**  
> **Surface = restrained**  
> **Content = crisp**  
> **Motion = subtle but alive**

Expressive color fields, iridescent textures, and refractive materials normally live behind or around the interface. UI surfaces remain white, icy, translucent, or softly frosted.

Do not combine a strong gradient and a strong frost treatment on the same component surface by default. A component may intentionally break this rule only when it is an expressive artifact rather than normal product UI.

### 1.2 Default UI should be quiet

A normal Camellia component should feel excellent even with all expressive effects removed. Personality should emerge through composition, motion, texture, atmospheric assets, and carefully controlled color—not through decorative treatment on every component.

### 1.3 Airy, not washed out

Light mode uses pure white as the primary canvas, with cool ice neutrals for secondary surfaces and borders. Airy blue is the primary interaction family. Mint/emerald green is functional. Pink belongs primarily to expression.

### 1.4 Dark mode is not an inversion

Dark mode uses a true black canvas with blue-black and icy translucent UI layered above it. Color becomes more luminous, but the interface should remain calm rather than neon or cyberpunk.

---

## 2. Token architecture

Camellia follows three layers:

```text
primitive -> semantic -> component
```

Example:

```text
blue/600
  -> color/action/primary
    -> profile-card/action/color
```

### 2.1 Primitive tokens

Raw values with no product meaning: color ramps, spacing values, radii, durations, and other foundations.

### 2.2 Semantic tokens

Meaningful aliases that describe purpose rather than appearance: `text/primary`, `surface/raised`, `action/primary`, `feedback/error`, and so on.

### 2.3 Component tokens

Local decisions for components that actually exist. Do not create large speculative component token sets in advance.

The first component namespace is `profile-card`.

---

## 3. Naming and Figma/code parity

Use `/` paths in Figma and convert the same path to kebab-case CSS custom properties.

```text
Figma: color/primitive/blue/600
CSS:   --color-primitive-blue-600

Figma: color/action/primary
CSS:   --color-action-primary

Figma: profile-card/padding
CSS:   --profile-card-padding
```

Recommended Figma collections:

- **Primitives** — raw values; no Light/Dark modes.
- **Semantic** — Light and Dark modes.
- **Components** — aliases semantic tokens wherever possible.

For future machine-readable token files, preserve a DTCG-friendly structure: each token should have a type, a value, and a description; aliases should point to other tokens rather than duplicating values.

---

# 4. Color

## 4.1 Base colors

| Token | Value | Purpose |
|---|---:|---|
| `base/white` | `#FFFFFF` | Main light canvas, highest white surface |
| `base/black` | `#000000` | Main dark canvas |

## 4.2 Ice neutrals

Cool neutrals create depth without tinting the entire product blue.

| Token | Value |
|---|---:|
| `ice/50` | `#FAFCFF` |
| `ice/100` | `#F1F5FC` |
| `ice/200` | `#E4EAF4` |
| `ice/300` | `#CDD7E6` |
| `ice/400` | `#9AA9BE` |
| `ice/500` | `#6D7D95` |
| `ice/600` | `#4A5A73` |
| `ice/700` | `#314056` |
| `ice/800` | `#1E2A3A` |
| `ice/900` | `#111A27` |
| `ice/950` | `#08111F` |

## 4.3 Air blue — primary

The light half of the scale is intentionally airy. The darker half exists so interactions can remain accessible.

| Token | Value |
|---|---:|
| `blue/50` | `#F0F8FF` |
| `blue/100` | `#E0EEFF` |
| `blue/200` | `#C7E0FF` |
| `blue/300` | `#A5CCFF` |
| `blue/400` | `#7FB3FF` |
| `blue/500` | `#5B8FF7` |
| `blue/600` | `#3F6EEB` |
| `blue/700` | `#2D52C7` |
| `blue/800` | `#1E3D9E` |
| `blue/900` | `#142B7A` |
| `blue/950` | `#0E1D54` |

### Accessibility notes for blue

- `blue/600` with white text is approximately **4.52:1**, clearing WCAG AA for normal text but with little margin. Treat `blue/600` as the lightest default solid background that may carry normal-size white text.
- `blue/700` with white is approximately **6.68:1** and is preferred for text links, hover/pressed states, or any situation where more contrast margin is desirable.
- `blue/500` against white is approximately **3.13:1**. It works well for focus indicators and non-text UI boundaries, but not for normal-size white text.
- On dark surfaces, `blue/400` with `ice/950` text has high contrast and becomes the preferred luminous interaction color.

## 4.4 Mint / emerald green — functional secondary

Green supports status, availability, progress, confirmation, connected states, and supportive functionality. It is not a competing primary brand action color.

| Token | Value |
|---|---:|
| `green/50` | `#ECFDF6` |
| `green/100` | `#D1FAE8` |
| `green/200` | `#A7F3D2` |
| `green/300` | `#6EE7B4` |
| `green/400` | `#28C995` |
| `green/500` | `#0FAF7A` |
| `green/600` | `#0D8A61` |
| `green/700` | `#0C6B50` |
| `green/800` | `#0E5542` |
| `green/900` | `#0D4638` |

For solid fills with white text, prefer `green/700` or darker. For lighter mint/emerald fills, use dark text.

## 4.5 Pink — expression

Pink adds emotion, bloom, highlights, atmospheric light, and imaginative energy. It is **not** a default action hierarchy color.

| Token | Value |
|---|---:|
| `pink/50` | `#FFF1F7` |
| `pink/100` | `#FFE1EE` |
| `pink/200` | `#FFC3DC` |
| `pink/300` | `#FF9AC6` |
| `pink/400` | `#FF7AB6` |
| `pink/500` | `#FF5FA2` |
| `pink/600` | `#E94389` |
| `pink/700` | `#C92F72` |
| `pink/800` | `#A82460` |
| `pink/900` | `#861F51` |

Do not create `action/tertiary = pink`. Pink belongs primarily under the `expression` semantic namespace.

## 4.6 Dedicated feedback accents

Brand colors do not replace conventional product feedback semantics.

| Token | Value | Role |
|---|---:|---|
| `feedback/success` | `#16A34A` | Success and completion |
| `feedback/warning` | `#F59E0B` | Warning and caution |
| `feedback/error` | `#EF4444` | Error and destructive state |
| `feedback/info` | `#3B82F6` | Informational state |

Feedback base colors should normally be used for icons, indicators, borders, or accents. Alert body text should use the standard accessible text tokens rather than assuming the accent itself is readable as small text.

---

# 5. Semantic color tokens

## 5.1 Light mode

| Semantic token | Maps to | Notes |
|---|---|---|
| `color/background/canvas` | `base/white` | Primary page canvas |
| `color/surface/primary` | `base/white` | Default components |
| `color/surface/secondary` | `ice/50` | Icy secondary layer |
| `color/surface/subtle` | `ice/100` | Quiet filled region |
| `color/surface/selected` | `blue/50` | Selected / highlighted region |
| `color/text/primary` | `ice/900` | Main text |
| `color/text/secondary` | `ice/600` | Supporting text |
| `color/text/tertiary` | `ice/500` | Low-emphasis text; avoid for essential small text |
| `color/text/inverse` | `base/white` | Text on dark solid fills |
| `color/icon/primary` | `ice/800` | Default icon |
| `color/icon/secondary` | `ice/600` | Supporting icon |
| `color/border/subtle` | `ice/200` | Default quiet divider |
| `color/border/default` | `ice/300` | Standard input/card border |
| `color/border/strong` | `ice/400` | Stronger separation |
| `color/action/primary` | `blue/600` | Solid primary action |
| `color/action/primary-hover` | `blue/700` | Hover |
| `color/action/primary-pressed` | `blue/800` | Pressed |
| `color/action/primary-text` | `base/white` | Text on primary action |
| `color/action/link` | `blue/700` | Inline/link text |
| `color/action/link-hover` | `blue/800` | Link hover |
| `color/focus` | `blue/500` | Focus ring |
| `color/functional/accent` | `green/500` | Status/icon/accent |
| `color/functional/surface` | `green/50` | Supportive functional fill |
| `color/expression/pink` | `pink/400` | Atmospheric / expressive use |
| `color/expression/blue` | `blue/300` | Atmospheric / expressive use |
| `color/expression/green` | `green/300` | Atmospheric / expressive use |

## 5.2 Dark mode

Dark mode begins with true black and layers icy blue-black surfaces on top.

| Semantic token | Maps to | Notes |
|---|---|---|
| `color/background/canvas` | `base/black` | True-black foundation |
| `color/surface/primary` | `ice/950` | Main dark UI layer |
| `color/surface/secondary` | `ice/900` | Raised / stronger dark surface |
| `color/surface/subtle` | `ice/950` | Quiet regions; separation comes from border/opacity |
| `color/surface/selected` | `blue/950` | Selected dark region |
| `color/text/primary` | `ice/50` | Main text |
| `color/text/secondary` | `ice/300` | Supporting text |
| `color/text/tertiary` | `ice/400` | Low-emphasis text |
| `color/text/inverse` | `ice/950` | Text on luminous light fills |
| `color/icon/primary` | `ice/100` | Default icon |
| `color/icon/secondary` | `ice/300` | Supporting icon |
| `color/border/subtle` | `rgba(127,179,255,0.18)` | Icy edge |
| `color/border/default` | `rgba(127,179,255,0.30)` | Standard icy edge |
| `color/border/strong` | `rgba(127,179,255,0.50)` | Strong edge |
| `color/action/primary` | `blue/400` | Luminous primary action |
| `color/action/primary-hover` | `blue/300` | Hover |
| `color/action/primary-pressed` | `blue/500` | Pressed |
| `color/action/primary-text` | `ice/950` | Dark text on luminous action |
| `color/action/link` | `blue/300` | Link |
| `color/action/link-hover` | `blue/200` | Link hover |
| `color/focus` | `blue/400` | Focus ring |
| `color/functional/accent` | `green/400` | Luminous functional accent |
| `color/functional/surface` | `rgba(40,201,149,0.12)` | Dark functional fill |
| `color/expression/pink` | `pink/400` | Atmospheric light |
| `color/expression/blue` | `blue/400` | Atmospheric light |
| `color/expression/green` | `green/400` | Atmospheric light |

---

# 6. Typography

## 6.1 Families

| Token | Value | Use |
|---|---|---|
| `font/family/sans` | `Geist` | Product UI and general typography |
| `font/family/mono` | `Geist Mono` | Code, token names, specs, technical labels |

Typography is intentionally quiet. Camellia's identity should be carried primarily by color, material, motion, and composition rather than by an eccentric typeface.

## 6.2 Weights

| Token | Value |
|---|---:|
| `font/weight/regular` | `400` |
| `font/weight/medium` | `500` |
| `font/weight/semibold` | `600` |

## 6.3 Type scale

| Style | Size | Line height | Weight | Family |
|---|---:|---:|---:|---|
| `display/lg` | `48px` | `52px` | `600` | Geist |
| `display/sm` | `40px` | `44px` | `600` | Geist |
| `heading/xl` | `32px` | `38px` | `600` | Geist |
| `heading/lg` | `28px` | `34px` | `600` | Geist |
| `heading/md` | `24px` | `30px` | `600` | Geist |
| `heading/sm` | `20px` | `26px` | `600` | Geist |
| `body/lg` | `18px` | `28px` | `400` | Geist |
| `body/md` | `16px` | `24px` | `400` | Geist |
| `body/sm` | `14px` | `20px` | `400` | Geist |
| `label/md` | `14px` | `20px` | `500` | Geist |
| `label/sm` | `12px` | `16px` | `500` | Geist |
| `code/md` | `14px` | `20px` | `400` | Geist Mono |
| `code/sm` | `12px` | `16px` | `400` | Geist Mono |

Recommended tracking:

| Token | Value | Use |
|---|---:|---|
| `tracking/tight` | `-0.02em` | Display and larger headings |
| `tracking/normal` | `0` | General UI |
| `tracking/technical` | `0.10em` | Sparse technical eyebrow labels only |

Do not overuse wide-tracked technical labels; they are an accent, not the default voice.

---

# 7. Spacing

Camellia uses a 4px mathematical base. Numeric names represent their relationship to the base rather than arbitrary size labels.

| Token | Value |
|---|---:|
| `space/0` | `0px` |
| `space/1` | `4px` |
| `space/2` | `8px` |
| `space/3` | `12px` |
| `space/4` | `16px` |
| `space/5` | `20px` |
| `space/6` | `24px` |
| `space/8` | `32px` |
| `space/10` | `40px` |
| `space/12` | `48px` |
| `space/16` | `64px` |
| `space/20` | `80px` |
| `space/24` | `96px` |

## 7.1 Semantic spacing aliases

| Token | Alias |
|---|---|
| `layout/content-gap/sm` | `space/2` |
| `layout/content-gap/md` | `space/4` |
| `layout/content-gap/lg` | `space/6` |
| `layout/section-gap/sm` | `space/6` |
| `layout/section-gap/md` | `space/12` |
| `layout/section-gap/lg` | `space/16` |
| `layout/page-gutter/mobile` | `space/4` |
| `layout/page-gutter/tablet` | `space/6` |
| `layout/page-gutter/desktop` | `space/8` |
| `control/padding-inline/sm` | `space/3` |
| `control/padding-inline/md` | `space/4` |
| `control/padding-inline/lg` | `space/5` |
| `control/padding-block/sm` | `space/2` |
| `control/padding-block/md` | `space/3` |
| `control/padding-block/lg` | `space/4` |

---

# 8. Radius

| Token | Value |
|---|---:|
| `radius/none` | `0px` |
| `radius/sm` | `4px` |
| `radius/md` | `8px` |
| `radius/lg` | `12px` |
| `radius/xl` | `16px` |
| `radius/full` | `9999px` |

Most Camellia UI should live between `radius/md` and `radius/lg`. `radius/xl` is more expressive. Avoid making every container excessively rounded.

---

# 9. Border

| Token | Value |
|---|---|
| `border/width/0` | `0px` |
| `border/width/1` | `1px` |
| `border/width/2` | `2px` |
| `border/subtle` | `1px solid {color/border/subtle}` |
| `border/default` | `1px solid {color/border/default}` |
| `border/strong` | `1px solid {color/border/strong}` |
| `border/focus` | `2px solid {color/focus}` |

Camellia should rely more on surface contrast and restrained borders than on heavy elevation shadows.

---

# 10. Elevation, opacity, blur, and frost

## 10.1 Shadows

| Token | Value | Guidance |
|---|---|---|
| `shadow/none` | `none` | Default for many components |
| `shadow/sm` | `0 1px 2px rgba(8,17,31,0.06)` | Subtle lift |
| `shadow/md` | `0 4px 12px rgba(8,17,31,0.08)` | Popover / raised region |
| `shadow/lg` | `0 12px 32px rgba(8,17,31,0.12)` | Rare, higher elevation |

Dark-mode shadows should be used sparingly; separation should come primarily from icy borders and surface values.

## 10.2 Opacity

| Token | Value |
|---|---:|
| `opacity/disabled` | `0.40` |
| `opacity/muted` | `0.64` |
| `opacity/soft` | `0.80` |
| `opacity/full` | `1` |

## 10.3 Blur

| Token | Value |
|---|---:|
| `blur/sm` | `4px` |
| `blur/md` | `12px` |
| `blur/lg` | `24px` |
| `blur/xl` | `40px` |

## 10.4 Frost material recipes

Frost is a material, not a default Card style.

### Light frost — subtle

```css
background: rgba(255, 255, 255, 0.72);
border: 1px solid rgba(255, 255, 255, 0.64);
backdrop-filter: blur(12px) saturate(115%);
-webkit-backdrop-filter: blur(12px) saturate(115%);
```

### Light frost — strong

```css
background: rgba(250, 252, 255, 0.82);
border: 1px solid rgba(205, 215, 230, 0.70);
backdrop-filter: blur(20px) saturate(120%);
-webkit-backdrop-filter: blur(20px) saturate(120%);
```

### Dark frost — subtle

```css
background: rgba(8, 17, 31, 0.72);
border: 1px solid rgba(127, 179, 255, 0.22);
backdrop-filter: blur(12px) saturate(125%);
-webkit-backdrop-filter: blur(12px) saturate(125%);
```

### Dark frost — strong

```css
background: rgba(8, 17, 31, 0.82);
border: 1px solid rgba(127, 179, 255, 0.34);
backdrop-filter: blur(20px) saturate(130%);
-webkit-backdrop-filter: blur(20px) saturate(130%);
```

### Frost usage rule

Use frost on overlays, selected hero artifacts, menus, experimental panels, or UI layered over expressive atmospheric backgrounds. Do **not** place a strong gradient directly inside a normal frosted card by default.

---

# 11. Motion

## 11.1 Duration

| Token | Value |
|---|---:|
| `duration/fast` | `100ms` |
| `duration/normal` | `200ms` |
| `duration/slow` | `300ms` |
| `duration/expression-sm` | `400ms` |
| `duration/expression-md` | `600ms` |
| `duration/expression-lg` | `900ms` |

## 11.2 Easing

| Token | Value |
|---|---|
| `ease/standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `ease/enter` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `ease/exit` | `cubic-bezier(0.4, 0, 1, 1)` |
| `ease/expression` | `cubic-bezier(0.22, 1, 0.36, 1)` |

Functional controls should normally use `100–300ms`. Expressive atmospheric or material transitions may use `400–900ms`.

Respect `prefers-reduced-motion`. Expression must never be required to understand state or content.

---

# 12. Responsive and sizing foundations

## 12.1 Breakpoints

| Token | Value |
|---|---:|
| `breakpoint/sm` | `640px` |
| `breakpoint/md` | `768px` |
| `breakpoint/lg` | `1024px` |
| `breakpoint/xl` | `1280px` |

Use breakpoints when the composition requires them, not as targets that every component must explicitly support.

## 12.2 Icon sizes

| Token | Value |
|---|---:|
| `size/icon/sm` | `16px` |
| `size/icon/md` | `20px` |
| `size/icon/lg` | `24px` |

## 12.3 Control heights

| Token | Value |
|---|---:|
| `size/control/sm` | `32px` |
| `size/control/md` | `40px` |
| `size/control/lg` | `48px` |

## 12.4 Content widths

| Token | Value |
|---|---:|
| `size/content/sm` | `640px` |
| `size/content/md` | `960px` |
| `size/content/lg` | `1200px` |

---

# 13. Z-index

| Token | Value | Use |
|---|---:|---|
| `z/base` | `0` | Normal content |
| `z/raised` | `10` | Local raised elements |
| `z/dropdown` | `100` | Menus and popovers |
| `z/sticky` | `200` | Sticky navigation |
| `z/overlay` | `300` | Page overlays |
| `z/modal` | `400` | Modal dialogs |
| `z/toast` | `500` | Notifications |
| `z/tooltip` | `600` | Tooltips |

Avoid arbitrary z-index values inside individual components.

---

# 14. Expression system

The expression layer is what makes Camellia recognizable without making every component decorative.

## 14.1 Palette relationship

- **Blue** — dominant atmosphere; air, cold light, digital clarity.
- **Green** — life and function; mint/emerald accents and refracted light.
- **Pink** — bloom and imagination; expression, highlights, soft emotional energy.
- **White / ice** — negative space and restraint.
- **Black** — immersive dark canvas.

## 14.2 Gradient / color-field recipes

These are **background atmospheres**, not default component fills. Prefer layered radial fields and blurred color rather than obvious rainbow linear gradients.

### `expression/field/ice`

```css
background:
  radial-gradient(circle at 24% 28%, rgba(165, 204, 255, 0.72), transparent 42%),
  radial-gradient(circle at 72% 62%, rgba(255, 195, 220, 0.44), transparent 38%),
  radial-gradient(circle at 58% 22%, rgba(167, 243, 210, 0.30), transparent 34%),
  #FAFCFF;
```

### `expression/field/tropical`

```css
background:
  radial-gradient(circle at 22% 36%, rgba(127, 179, 255, 0.62), transparent 40%),
  radial-gradient(circle at 68% 28%, rgba(110, 231, 180, 0.48), transparent 36%),
  radial-gradient(circle at 78% 72%, rgba(255, 154, 198, 0.44), transparent 38%),
  #F0F8FF;
```

### `expression/field/pink-dream`

```css
background:
  radial-gradient(circle at 30% 38%, rgba(255, 154, 198, 0.58), transparent 40%),
  radial-gradient(circle at 68% 58%, rgba(165, 204, 255, 0.62), transparent 42%),
  #FAFCFF;
```

In production, these recipes may be replaced by generated/raster/vector atmospheric assets while preserving the same visual relationships.

---

# 15. Generative visual language / AI art direction

This section is intentionally written so the file can be supplied to another AI agent when generating Camellia branding images, website assets, hero backgrounds, documentation art, social graphics, or experimental visual material.

## 15.1 Positive direction

Create an **airy, high-key abstract visual** using pale icy blue as the dominant field, with restrained mint green and soft pink appearing as secondary light or refracted color. Use translucent, flowing, glass-like organic forms, iridescent folds, thin membranes, soft diffusion, subtle frosted texture, and delicate luminous edges.

The visual should feel like **light passing through ice, translucent material, or a thin refractive membrane**. Shapes should feel formed by light and material rather than drawn as graphic symbols. Favor asymmetry, negative space, partial forms entering or leaving the frame, gentle directional flow, and soft depth.

Desired qualities:

- airy
- crisp
- icy
- digital
- atmospheric
- tactile
- translucent
- refractive
- soft-focus
- high-key
- organic but not botanical
- experimental but controlled
- optimistic and comfortable to look at

## 15.2 Preferred forms

Use:

- diffused pastel light fields
- airy blue-dominant atmosphere
- restrained mint and pink color blooms
- iridescent or refractive folds
- flowing translucent ribbons
- thin glass-like membranes
- abstract organic folds and sheets
- soft frost or fine grain
- luminous edges
- large areas of white or quiet negative space
- cropped/asymmetric material forms rather than centered objects

## 15.3 Avoid

Avoid:

- recurring glass spheres, bubbles, or glossy balls
- literal flowers as the primary motif
- obvious rainbow gradients
- hard neon colors
- cyberpunk styling
- chrome objects
- heavy black shadows in light mode
- generic 3D blobs
- decorative blobs with no material logic
- liquid-metal aesthetics
- dense psychedelic color
- gradients baked into every UI card
- a floral or beauty-brand visual identity

## 15.4 UI + visual asset composition

When an expressive asset is paired with UI:

1. Put the strongest color and texture **behind or around the interface**.
2. Keep the UI surface white, icy, or softly translucent.
3. Preserve clear text contrast and crisp edges.
4. Use frost as a separating material layer, not as an excuse to add more color.
5. Let some atmospheric color show through translucent surfaces, but keep content readable.
6. On responsive layouts, allow the expressive field to crop, shift, or disappear before compromising the component itself.

## 15.5 Reusable AI prompt seed

> Create a Camellia Design System visual: airy, high-key, clean and digital, with pale icy baby blue as the dominant atmosphere and restrained mint green and soft pink appearing as refracted light. Use translucent flowing ribbons, thin glass-like membranes, iridescent folds, soft diffusion, subtle frost, fine luminous edges and generous negative space. Forms should feel produced by light passing through ice or translucent material, organic and asymmetric rather than geometric. Keep the composition calm and premium, with the expressive material living in the background and any UI layer remaining white, icy, crisp or softly frosted. Avoid obvious rainbow gradients, neon cyberpunk styling, chrome, heavy shadows, generic 3D blobs, recurring glass spheres or bubbles, and literal flowers.

---

# 16. Light and dark visual behavior

## Light mode

The canvas is pure white. Secondary surfaces introduce barely perceptible ice. Air blue supplies interaction. Green provides functional life. Pink appears as atmosphere rather than hierarchy.

Typical stack:

```text
pure white canvas
  -> icy secondary surface
    -> restrained border
      -> crisp dark content
        -> airy blue action
          -> expressive background material when appropriate
```

## Dark mode

The canvas is black. UI surfaces are blue-black, translucent, and edged with icy blue. Brighter blue and green become luminous without becoming neon. Pink may appear in background refraction or atmospheric light.

Typical stack:

```text
black canvas
  -> blue-black UI surface
    -> icy translucent border / frost
      -> near-white content
        -> luminous baby blue interaction
          -> restrained mint / pink atmospheric glow
```

---

# 17. Accessibility rules

1. Target WCAG AA contrast for normal text and essential controls.
2. Do not assume that a visually prominent pastel color is readable with white text.
3. Use `blue/600` or darker for normal-size white text in light-mode solid actions; prefer `blue/700` when possible for additional contrast margin.
4. Use dark text on `blue/50–500`, `green/50–600`, and most pale expressive surfaces unless contrast testing demonstrates otherwise.
5. Pink is not a substitute for error red or destructive semantics.
6. Never rely on color alone for success, warning, error, selection, or state.
7. Focus indicators must remain visible against both the component and surrounding canvas.
8. Frost/translucency must not reduce text contrast below requirements; add a more opaque local surface when necessary.
9. Respect `prefers-reduced-motion` and provide a low/no-motion path for expressive transitions.
10. Generated atmospheric art must be treated as decoration; do not place essential information inside the texture.

---

# 18. Component tokens — Profile Card v0.1

The Profile Card is Camellia's first real component namespace. Keep it intentionally simple so it validates the system rather than inventing a second visual language.

| Component token | Alias / value |
|---|---|
| `profile-card/surface` | `{color/surface/primary}` |
| `profile-card/border` | `{border/subtle}` |
| `profile-card/radius` | `{radius/lg}` |
| `profile-card/padding` | `{space/6}` |
| `profile-card/content-gap` | `{space/4}` |
| `profile-card/metadata-gap` | `{space/2}` |
| `profile-card/title-type` | `{heading/sm}` |
| `profile-card/body-type` | `{body/sm}` |
| `profile-card/title-color` | `{color/text/primary}` |
| `profile-card/body-color` | `{color/text/secondary}` |
| `profile-card/link-color` | `{color/action/link}` |
| `profile-card/shadow` | `{shadow/none}` |
| `profile-card/transition-duration` | `{duration/normal}` |
| `profile-card/transition-ease` | `{ease/standard}` |

### Profile Card expressive behavior

A standard Profile Card should **not** contain a permanent gradient fill. If the card participates in an expressive composition, place the atmospheric field behind the card and optionally switch the card surface to one of the frost recipes.

Hover/focus may introduce a small border, light, or material response; avoid large translations or decorative animation that makes the component feel unstable.

---

# 19. Future component rule

When adding a new component:

```text
1. Build it from primitive + semantic tokens first.
2. Introduce component tokens only where the component needs a stable local contract.
3. Do not duplicate semantic values merely to create a component namespace.
4. Define interaction states and both themes at the same time.
5. Test accessibility before calling the component complete.
6. Add expressive behavior only after the functional component works without it.
```

Suggested next validation component: **Button**, because it exercises typography, spacing, sizing, color, states, focus, dark mode, and motion in a compact surface.

---

# 20. CSS starter mapping (historical)

**Approved (2026-10-22):** this section is historical. It predates the generated `src/styles/tokens.css`. It is not a source of truth. `tokens/camellia.tokens.json` is canonical.

The following is a starter implementation of the approved foundation. It is intentionally readable rather than exhaustive.

```css
:root {
  /* Base */
  --color-base-white: #FFFFFF;
  --color-base-black: #000000;

  /* Ice */
  --color-primitive-ice-50: #FAFCFF;
  --color-primitive-ice-100: #F1F5FC;
  --color-primitive-ice-200: #E4EAF4;
  --color-primitive-ice-300: #CDD7E6;
  --color-primitive-ice-400: #9AA9BE;
  --color-primitive-ice-500: #6D7D95;
  --color-primitive-ice-600: #4A5A73;
  --color-primitive-ice-700: #314056;
  --color-primitive-ice-800: #1E2A3A;
  --color-primitive-ice-900: #111A27;
  --color-primitive-ice-950: #08111F;

  /* Air blue */
  --color-primitive-blue-50: #F0F8FF;
  --color-primitive-blue-100: #E0EEFF;
  --color-primitive-blue-200: #C7E0FF;
  --color-primitive-blue-300: #A5CCFF;
  --color-primitive-blue-400: #7FB3FF;
  --color-primitive-blue-500: #5B8FF7;
  --color-primitive-blue-600: #3F6EEB;
  --color-primitive-blue-700: #2D52C7;
  --color-primitive-blue-800: #1E3D9E;
  --color-primitive-blue-900: #142B7A;
  --color-primitive-blue-950: #0E1D54;

  /* Functional green */
  --color-primitive-green-50: #ECFDF6;
  --color-primitive-green-100: #D1FAE8;
  --color-primitive-green-200: #A7F3D2;
  --color-primitive-green-300: #6EE7B4;
  --color-primitive-green-400: #28C995;
  --color-primitive-green-500: #0FAF7A;
  --color-primitive-green-600: #0D8A61;
  --color-primitive-green-700: #0C6B50;
  --color-primitive-green-800: #0E5542;
  --color-primitive-green-900: #0D4638;

  /* Expression pink */
  --color-primitive-pink-50: #FFF1F7;
  --color-primitive-pink-100: #FFE1EE;
  --color-primitive-pink-200: #FFC3DC;
  --color-primitive-pink-300: #FF9AC6;
  --color-primitive-pink-400: #FF7AB6;
  --color-primitive-pink-500: #FF5FA2;
  --color-primitive-pink-600: #E94389;
  --color-primitive-pink-700: #C92F72;
  --color-primitive-pink-800: #A82460;
  --color-primitive-pink-900: #861F51;

  /* Semantic: light */
  --color-background-canvas: var(--color-base-white);
  --color-surface-primary: var(--color-base-white);
  --color-surface-secondary: var(--color-primitive-ice-50);
  --color-surface-subtle: var(--color-primitive-ice-100);
  --color-text-primary: var(--color-primitive-ice-900);
  --color-text-secondary: var(--color-primitive-ice-600);
  --color-border-subtle: var(--color-primitive-ice-200);
  --color-border-default: var(--color-primitive-ice-300);
  --color-action-primary: var(--color-primitive-blue-600);
  --color-action-primary-hover: var(--color-primitive-blue-700);
  --color-action-primary-pressed: var(--color-primitive-blue-800);
  --color-action-primary-text: var(--color-base-white);
  --color-focus: var(--color-primitive-blue-500);

  /* Spacing */
  --space-0: 0px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Motion */
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-expression-sm: 400ms;
  --duration-expression-md: 600ms;
  --duration-expression-lg: 900ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-expression: cubic-bezier(0.22, 1, 0.36, 1);
}

[data-theme="dark"] {
  --color-background-canvas: var(--color-base-black);
  --color-surface-primary: var(--color-primitive-ice-950);
  --color-surface-secondary: var(--color-primitive-ice-900);
  --color-text-primary: var(--color-primitive-ice-50);
  --color-text-secondary: var(--color-primitive-ice-300);
  --color-border-subtle: rgba(127, 179, 255, 0.18);
  --color-border-default: rgba(127, 179, 255, 0.30);
  --color-action-primary: var(--color-primitive-blue-400);
  --color-action-primary-hover: var(--color-primitive-blue-300);
  --color-action-primary-pressed: var(--color-primitive-blue-500);
  --color-action-primary-text: var(--color-primitive-ice-950);
  --color-focus: var(--color-primitive-blue-400);
}
```

---

# 21. Definition of Camellia v0.1

Camellia v0.1 is successful if a new component or visual asset can be produced from this file and still feel part of the same system without copying an existing screen.

The system should consistently produce work that feels:

**quiet in structure, airy in color, crisp in content, alive in motion, and expressive in the atmosphere around the interface.**

