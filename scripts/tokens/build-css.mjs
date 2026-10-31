/**
 * Camellia Design System — CSS token build.
 *
 * Reads the platform-neutral DTCG source (tokens/camellia.tokens.json) and
 * writes CSS custom properties to src/styles/tokens.css using a
 * custom Style Dictionary format named `camellia/css`.
 *
 * Why a custom format? The built-in `css/variables` format (with the `css`
 * transform group) doesn't understand several DTCG shapes or Camellia
 * conventions:
 *   - duration objects ({ value, unit }) and gradients print "[object Object]"
 *   - unit hints in $extensions (tracking is in em) are ignored
 *   - theme/{mode}/… tokens keep the mode in their name instead of becoming
 *     one semantic name with a dark override
 *   - group-level recipes (frost, expression fields) are never composed
 *
 * How it works:
 *   1. Style Dictionary loads the JSON, applies group-level $type inheritance
 *      and fails the build if any {reference} points at a missing token.
 *   2. The format converts each token's *original* DTCG value to CSS. Any
 *      reference is written as var(--…) instead of being inlined.
 *   3. Recipe groups (frost, expression fields) are composed into a few
 *      ready-to-use values; their part tokens are not emitted on their own.
 *   4. Light and mode-independent tokens go in :root, dark overrides go in
 *      [data-theme="dark"], and the result is sanity-checked before writing.
 */

import { readFile } from "node:fs/promises";
import StyleDictionary from "style-dictionary";
import { fileHeader } from "style-dictionary/utils";

const SOURCE_FILE = "tokens/camellia.tokens.json";
const BUILD_PATH = "src/styles/";
const OUTPUT_FILE = "tokens.css";

/** Namespace for Camellia-specific metadata inside DTCG `$extensions`. */
const CAMELLIA = "com.cjhuang.camellia";

/** Camellia's `$extensions` block on a token or group (empty object if none). */
const camelliaExt = (node) => node?.$extensions?.[CAMELLIA] ?? {};

/**
 * Camellia's `$extensions` for a Style Dictionary token. Read from
 * `token.original` because Style Dictionary also resolves references inside
 * $extensions, which would turn trackingIntent "{tracking.tight}" into -0.02.
 */
const tokenExt = (token) => camelliaExt(token?.original);

// Style Dictionary strips `$extensions` from *groups* in the dictionary it
// hands to formats, but frost and expression recipes are declared on groups.
// Keep the raw JSON around so the format can look them up.
const sourceTree = JSON.parse(await readFile(SOURCE_FILE, "utf8"));

/* -------------------------------------------------------------------------- *
 * 1. Naming
 * -------------------------------------------------------------------------- */

/**
 * Semantic tokens live under theme/{mode}/…. Returns the mode ("light",
 * "dark") for those tokens, or null for everything else.
 */
function themeModeOf(path) {
  return path[0] === "theme" ? path[1] : null;
}

/**
 * Token path → CSS custom property name. theme/{mode} is stripped so light and
 * dark share one public name.
 *
 *   ["color", "primitive", "blue", "600"]           → --color-primitive-blue-600
 *   ["theme", "dark", "color", "action", "primary"] → --color-action-primary
 */
function cssVarName(path) {
  const publicPath = themeModeOf(path) ? path.slice(2) : path;
  return `--${publicPath.join("-")}`;
}

/* -------------------------------------------------------------------------- *
 * 2. References
 * -------------------------------------------------------------------------- */

/** Matches a value that is exactly one DTCG reference, e.g. "{space.4}". */
const REFERENCE = /^\{([^{}]+)\}$/;

const isReference = (value) =>
  typeof value === "string" && REFERENCE.test(value);

/** "{theme.light.color.focus}" → "var(--color-focus)" */
function referenceToVar(reference) {
  const path = reference.match(REFERENCE)[1].split(".");
  return `var(${cssVarName(path)})`;
}

/* -------------------------------------------------------------------------- *
 * 3. Values: DTCG $type → CSS
 * -------------------------------------------------------------------------- */

/**
 * Convert a DTCG value of the given $type into a CSS value string.
 *
 * References are checked first, so they become var() whether they are the
 * whole value ("{blur.md}") or one part of a composite (a border's color).
 *
 * `token` is only passed for top-level values so serializers can read that
 * token's $extensions (e.g. tracking's unit).
 */
function toCss(value, type, token) {
  if (isReference(value)) return referenceToVar(value);

  const serialize = serializers[type];
  if (!serialize) {
    const where = token ? ` (${token.path.join(".")})` : "";
    throw new Error(`camellia/css: no CSS serializer for $type "${type}"${where}`);
  }
  return serialize(value, token);
}

/** A token's own value, as CSS. */
const tokenCss = (token) => toCss(token.original.$value, token.$type, token);

const serializers = {
  // { colorSpace: "srgb", components: [r, g, b], hex, alpha? }
  //   opaque      → #3f6eeb
  //   translucent → rgba(127, 179, 255, 0.18)
  color(value) {
    if (value.colorSpace !== "srgb") {
      throw new Error(`camellia/css: unsupported colorSpace "${value.colorSpace}"`);
    }
    const [r, g, b] = value.components.map((c) => Math.round(c * 255));
    const alpha = value.alpha ?? 1;

    if (alpha === 1) {
      return value.hex ? value.hex.toLowerCase() : `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },

  // { value: 16, unit: "px" } → 16px
  dimension: (value) => valueWithUnit(value, "dimension"),

  // { value: 100, unit: "ms" } → 100ms
  duration: (value) => valueWithUnit(value, "duration"),

  // Numbers are unitless unless Camellia attaches a unit:
  //   tracking.tight = -0.02 with { unit: "em" } → -0.02em
  //   opacity.muted  = 0.64                      → 0.64
  number(value, token) {
    if (typeof value !== "number") {
      throw new Error(`camellia/css: expected a number, got ${JSON.stringify(value)}`);
    }
    const { unit } = tokenExt(token);
    return unit ? `${value}${unit}` : String(value);
  },

  fontWeight: (value) => String(value),

  // ["Geist", "Segoe UI", "sans-serif"] → Geist, 'Segoe UI', sans-serif
  // Names containing spaces must be quoted; generic families must not be.
  fontFamily(value) {
    const families = Array.isArray(value) ? value : [value];
    return families
      .map((family) => (/\s/.test(family) ? `'${family}'` : family))
      .join(", ");
  },

  // [0.4, 0, 0.2, 1] → cubic-bezier(0.4, 0, 0.2, 1)
  cubicBezier: (value) => `cubic-bezier(${value.join(", ")})`,

  // DTCG also allows an object form ({ dashArray, lineCap }) that has no
  // direct CSS equivalent; Camellia only uses keywords like "solid".
  strokeStyle(value) {
    if (typeof value !== "string") {
      throw new Error("camellia/css: object strokeStyle values are not supported");
    }
    return value;
  },

  // { width, style, color } → border shorthand: 1px solid #cdd7e6
  border: (value) =>
    [
      toCss(value.width, "dimension"),
      toCss(value.style, "strokeStyle"),
      toCss(value.color, "color"),
    ].join(" "),

  // One layer, or an array of layers, in box-shadow syntax:
  //   [inset] <offset-x> <offset-y> <blur> <spread> <color>
  shadow(value) {
    const layers = Array.isArray(value) ? value : [value];
    return layers
      .map((layer) =>
        [
          layer.inset ? "inset" : null,
          toCss(layer.offsetX, "dimension"),
          toCss(layer.offsetY, "dimension"),
          toCss(layer.blur, "dimension"),
          toCss(layer.spread, "dimension"),
          toCss(layer.color, "color"),
        ]
          .filter(Boolean)
          .join(" "),
      )
      .join(", ");
  },

  // `font` shorthand: <weight> <size>/<line-height> <family>
  // letter-spacing can't be part of `font`; tokenDeclarations() emits it as a
  // separate variable.
  typography: (value) =>
    `${toCss(value.fontWeight, "fontWeight")} ` +
    `${toCss(value.fontSize, "dimension")}/${toCss(value.lineHeight, "number")} ` +
    `${toCss(value.fontFamily, "fontFamily")}`,
};

/** DTCG dimension/duration object → "16px" / "100ms". */
function valueWithUnit(value, type) {
  if (typeof value?.value !== "number" || typeof value?.unit !== "string") {
    throw new Error(`camellia/css: expected a ${type} { value, unit }, got ${JSON.stringify(value)}`);
  }
  return `${value.value}${value.unit}`;
}

/* -------------------------------------------------------------------------- *
 * 4. Declarations for a single token
 * -------------------------------------------------------------------------- */

/**
 * One token → one or more CSS declarations: { name, value, comment? }.
 */
function tokenDeclarations(token) {
  const name = cssVarName(token.path);
  const ext = tokenExt(token);
  const comment = token.$description;

  // The source can pin an exact CSS value. shadow.none uses this: its DTCG
  // value is a fully transparent shadow (for tools that need a shadow
  // object), but in CSS the right value is `none`.
  if (ext.cssValue !== undefined) {
    return [{ name, value: ext.cssValue, comment }];
  }

  const declarations = [{ name, value: tokenCss(token), comment }];

  // Typography also gets a `-letter-spacing` variable, since `font` can't
  // carry it. Prefer the em-based trackingIntent (it scales with font size)
  // over the px letterSpacing that was calculated for one size.
  if (token.$type === "typography") {
    const letterSpacing = ext.trackingIntent ?? token.original.$value.letterSpacing;
    if (letterSpacing !== undefined) {
      declarations.push({
        name: `${name}-letter-spacing`,
        value: toCss(letterSpacing, "dimension"),
      });
    }
  }

  return declarations;
}

/* -------------------------------------------------------------------------- *
 * 5. Recipes: groups that compose into one usable CSS value
 * -------------------------------------------------------------------------- */

/**
 * Walk the raw source tree and collect recipe groups, identified by their
 * Camellia $extensions:
 *   { recipe: "frost" }                    → frost material (frost/light/subtle)
 *   { target: "background", composition } → expression field (expression/field/ice)
 */
function findRecipes(node, path = [], found = []) {
  for (const [key, child] of Object.entries(node)) {
    const isGroup =
      !key.startsWith("$") &&
      typeof child === "object" &&
      child !== null &&
      !("$value" in child);
    if (!isGroup) continue;

    const childPath = [...path, key];
    const ext = camelliaExt(child);

    if (ext.recipe === "frost") {
      found.push({ kind: "frost", path: childPath, ext });
    } else if (ext.target === "background" && ext.composition) {
      found.push({ kind: "expression", path: childPath, ext });
    } else {
      findRecipes(child, childPath, found);
    }
  }
  return found;
}

/**
 * Frost = translucent fill + hairline border + backdrop blur/saturation.
 * Outputs the three values a component sets:
 *
 *   .panel {
 *     background: var(--frost-light-subtle-background);
 *     border: var(--frost-light-subtle-border);
 *     backdrop-filter: var(--frost-light-subtle-backdrop-filter);
 *   }
 */
function frostDeclarations(recipe, getToken) {
  const name = cssVarName(recipe.path);
  const part = (key) => getToken([...recipe.path, key]);

  // CSS saturate() accepts 1.15 or 115%; Camellia stores the percent form.
  const saturation = part("saturation");
  const { cssPercent } = tokenExt(saturation);
  const saturate = cssPercent !== undefined ? `${cssPercent}%` : tokenCss(saturation);

  return [
    { name: `${name}-background`, value: tokenCss(part("background")) },
    { name: `${name}-border`, value: tokenCss(part("border")) },
    {
      name: `${name}-backdrop-filter`,
      value: `blur(${tokenCss(part("blur"))}) saturate(${saturate})`,
    },
  ];
}

/**
 * Expression field = stacked radial gradients over a base color, layered in
 * the order given by `composition`. Outputs one value for `background`:
 *
 *   .hero { background: var(--expression-field-ice); }
 */
function expressionDeclarations(recipe, getToken) {
  const { composition } = recipe.ext;

  const layers = composition.map((layerKey, index) => {
    const layer = getToken([...recipe.path, layerKey]);

    if (layer.$type === "gradient") return radialGradient(layer);

    if (layer.$type === "color") {
      // In the `background` shorthand, a plain color is only allowed as the
      // final layer.
      if (index !== composition.length - 1) {
        throw new Error(
          `camellia/css: color layer "${layerKey}" must be last in ${recipe.path.join(".")} composition`,
        );
      }
      return tokenCss(layer);
    }

    throw new Error(`camellia/css: unsupported expression layer type "${layer.$type}"`);
  });

  return [{ name: cssVarName(recipe.path), value: layers.join(", ") }];
}

/**
 * DTCG gradients only describe color stops. Camellia's $extensions add the
 * geometry: { gradientType: "radial", center: { x, y } } as 0–1 fractions.
 *
 *   → radial-gradient(circle at 24% 28%, rgba(165, 204, 255, 0.72), transparent 42%)
 */
function radialGradient(token) {
  const { gradientType, center } = tokenExt(token);
  if (gradientType !== "radial" || !center) {
    throw new Error(
      `camellia/css: ${token.path.join(".")} needs gradientType "radial" and a center in $extensions`,
    );
  }

  const stops = token.original.$value.map(({ color, position }) => {
    // Gradients interpolate in premultiplied color, so `transparent` fades
    // cleanly without a grey fringe.
    const stopColor =
      !isReference(color) && color.alpha === 0 ? "transparent" : toCss(color, "color");
    return position === 0 ? stopColor : `${stopColor} ${percent(position)}`;
  });

  return `radial-gradient(circle at ${percent(center.x)} ${percent(center.y)}, ${stops.join(", ")})`;
}

/** 0.42 → "42%", rounded so float noise (57.99999999999999) doesn't leak out. */
const percent = (fraction) => `${Number((fraction * 100).toFixed(3))}%`;

/* -------------------------------------------------------------------------- *
 * 6. Output layout
 * -------------------------------------------------------------------------- */

/**
 * :root sections, in output order. Each lists the top-level token groups it
 * contains. A token in an unlisted group fails the build instead of being
 * silently dropped.
 */
const ROOT_SECTIONS = [
  { title: "Primitive colors", groups: ["color", "feedback"] },
  { title: "Semantic tokens (light; dark overrides below)", groups: ["theme"] },
  { title: "Typography", groups: ["font", "tracking", "display", "heading", "body", "label", "code"] },
  { title: "Spacing", groups: ["space", "layout", "control"] },
  { title: "Radius", groups: ["radius"] },
  { title: "Border", groups: ["border"] },
  { title: "Shadows", groups: ["shadow"] },
  { title: "Opacity", groups: ["opacity"] },
  { title: "Blur", groups: ["blur"] },
  { title: "Frost materials", groups: ["frost"] },
  { title: "Motion", groups: ["duration", "ease"] },
  { title: "Scale", groups: ["scale"] },
  { title: "Breakpoints", groups: ["breakpoint"] },
  { title: "Sizing", groups: ["size"] },
  { title: "Z-index", groups: ["z"] },
  { title: "Expression backgrounds", groups: ["expression"] },
];

const renderDeclaration = ({ name, value, comment }) =>
  `  ${name}: ${value};${comment ? ` /* ${comment} */` : ""}`;

function renderBlock(selector, sections) {
  const body = sections
    .filter((section) => section.declarations.length > 0)
    .map((section) =>
      [`  /* ${section.title} */`, ...section.declarations.map(renderDeclaration)].join("\n"),
    )
    .join("\n\n");
  return `${selector} {\n${body}\n}\n`;
}

/**
 * Fail the build on output that would be silently broken in the browser.
 */
function validate({ rootDeclarations, darkDeclarations, css }) {
  const problems = [];

  const findDuplicates = (declarations, selector) => {
    const seen = new Set();
    for (const { name } of declarations) {
      if (seen.has(name)) problems.push(`${name} is declared twice in ${selector}`);
      seen.add(name);
    }
    return seen;
  };
  const rootNames = findDuplicates(rootDeclarations, ":root");
  findDuplicates(darkDeclarations, "the dark block");

  // Dark mode may only override names that already exist in light mode.
  for (const { name } of darkDeclarations) {
    if (!rootNames.has(name)) problems.push(`${name} exists only in dark mode`);
  }

  // Every var() must point at a declared variable. This also catches anything
  // that references an internal recipe part (e.g. an expression layer).
  for (const [, name] of css.matchAll(/var\((--[\w-]+)\)/g)) {
    if (!rootNames.has(name)) problems.push(`var(${name}) is used but never declared`);
  }

  for (const leak of ["[object Object]", "undefined", "NaN"]) {
    if (css.includes(leak)) problems.push(`output contains "${leak}"`);
  }
  if (/--theme-(light|dark)-/.test(css)) {
    problems.push("output contains mode-prefixed names (--theme-light-* / --theme-dark-*)");
  }

  if (problems.length > 0) {
    throw new Error(`camellia/css produced invalid CSS:\n  - ${[...new Set(problems)].join("\n  - ")}`);
  }
}

/* -------------------------------------------------------------------------- *
 * 7. The format
 * -------------------------------------------------------------------------- */

StyleDictionary.registerFormat({
  name: "camellia/css",
  async format({ dictionary, file }) {
    const tokensByPath = new Map(
      dictionary.allTokens.map((token) => [token.path.join("."), token]),
    );
    const getToken = (path) => {
      const token = tokensByPath.get(path.join("."));
      if (!token) throw new Error(`camellia/css: missing token ${path.join(".")}`);
      return token;
    };

    const recipes = findRecipes(sourceTree);
    const recipeContaining = (token) =>
      recipes.find((recipe) => recipe.path.every((key, i) => token.path[i] === key));

    // Turn every token into an entry ({ path, declarations }), keeping source
    // order. All tokens inside a recipe group become one entry, emitted where
    // the first of them appears.
    const entries = [];
    const composedRecipes = new Set();

    for (const token of dictionary.allTokens) {
      const recipe = recipeContaining(token);

      if (!recipe) {
        entries.push({ path: token.path, declarations: tokenDeclarations(token) });
        continue;
      }
      if (composedRecipes.has(recipe)) continue;
      composedRecipes.add(recipe);

      const compose = recipe.kind === "frost" ? frostDeclarations : expressionDeclarations;
      entries.push({ path: recipe.path, declarations: compose(recipe, getToken) });
    }

    // Split by theme mode: light and mode-independent → :root, dark → override block.
    const unknownModes = entries
      .map((entry) => themeModeOf(entry.path))
      .filter((mode) => mode && mode !== "light" && mode !== "dark");
    if (unknownModes.length > 0) {
      throw new Error(`camellia/css: unsupported theme mode(s): ${[...new Set(unknownModes)].join(", ")}`);
    }
    const darkEntries = entries.filter((entry) => themeModeOf(entry.path) === "dark");
    const rootEntries = entries.filter((entry) => themeModeOf(entry.path) !== "dark");

    const unplacedGroups = rootEntries
      .map((entry) => entry.path[0])
      .filter((group) => !ROOT_SECTIONS.some((section) => section.groups.includes(group)));
    if (unplacedGroups.length > 0) {
      throw new Error(
        `camellia/css: add top-level group(s) ${[...new Set(unplacedGroups)].join(", ")} to ROOT_SECTIONS`,
      );
    }

    const rootSections = ROOT_SECTIONS.map((section) => ({
      title: section.title,
      declarations: rootEntries
        .filter((entry) => section.groups.includes(entry.path[0]))
        .flatMap((entry) => entry.declarations),
    }));
    const darkDeclarations = darkEntries.flatMap((entry) => entry.declarations);

    // Composite semantic tokens (e.g. --border-subtle) are redeclared in the
    // dark block too: a custom property's var() references are resolved on
    // the element where it is declared, so a :root-only --border-subtle would
    // keep the light color inside a nested [data-theme="dark"] subtree.
    const { lightSelector, darkSelector } = camelliaExt(sourceTree).targets.css;
    const css =
      renderBlock(lightSelector, rootSections) +
      "\n" +
      renderBlock(darkSelector, [
        { title: "Dark semantic overrides", declarations: darkDeclarations },
      ]);

    validate({
      rootDeclarations: rootSections.flatMap((section) => section.declarations),
      darkDeclarations,
      css,
    });

    return (await fileHeader({ file })) + css;
  },
});

/* -------------------------------------------------------------------------- *
 * 8. Build
 * -------------------------------------------------------------------------- */

const sd = new StyleDictionary({
  source: [SOURCE_FILE],

  platforms: {
    css: {
      // camellia/css converts original DTCG values itself, so no value
      // transforms are needed. name/kebab only gives each token a unique
      // internal name (theme-light-… vs theme-dark-…), which keeps Style
      // Dictionary's name-collision check quiet; public CSS names come from
      // cssVarName().
      transforms: ["name/kebab"],
      buildPath: BUILD_PATH,

      files: [
        {
          destination: OUTPUT_FILE,
          format: "camellia/css",
          options: {
            showFileHeader: true,
          },
        },
      ],
    },
  },
});

await sd.buildPlatform("css");

console.log(`✓ Generated ${BUILD_PATH}${OUTPUT_FILE}`);
