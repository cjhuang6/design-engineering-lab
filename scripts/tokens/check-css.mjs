/**
 * Camellia Design System — generated CSS check.
 *
 * Validates that src/styles/tokens.css correctly represents
 * tokens/camellia.tokens.json. Both files are only read, never written.
 *
 * This script deliberately doesn't use Style Dictionary or import anything
 * from build-css.mjs: it reads the DTCG JSON directly, derives what the CSS
 * *should* contain, and compares that with what the CSS *does* contain. A bug
 * in the build can't hide by being repeated here.
 *
 * Usage:
 *   node scripts/tokens/check-css.mjs              # checks the default output
 *   node scripts/tokens/check-css.mjs path/to.css  # checks another CSS file
 *
 * Exits with code 1 if any check fails.
 */

import { readFile } from "node:fs/promises";

const SOURCE_FILE = "tokens/camellia.tokens.json";
const CSS_FILE = process.argv[2] ?? "src/styles/tokens.css";

/** Namespace for Camellia-specific metadata inside DTCG `$extensions`. */
const CAMELLIA = "com.cjhuang.camellia";
const camelliaExt = (node) => node?.$extensions?.[CAMELLIA] ?? {};

/* -------------------------------------------------------------------------- *
 * 1. Reading the DTCG source
 * -------------------------------------------------------------------------- */

/**
 * Flatten the token tree into a list of tokens:
 *   { path, type, value, ext, recipe }
 *
 * - `type` honours DTCG group-level $type inheritance (e.g. feedback/*).
 * - `recipe` is set for tokens inside a recipe group (frost material or
 *   expression field). Those parts are composed into other variables
 *   instead of being emitted on their own.
 */
function collectTokens(node, path = [], inheritedType, recipe, out = { tokens: [], recipes: [] }) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || typeof child !== "object" || child === null) continue;
    const childPath = [...path, key];

    if ("$value" in child) {
      out.tokens.push({
        path: childPath,
        type: child.$type ?? inheritedType,
        value: child.$value,
        ext: camelliaExt(child),
        recipe,
      });
      continue;
    }

    // A group: it may itself be a recipe.
    const ext = camelliaExt(child);
    let childRecipe = recipe;
    if (ext.recipe === "frost") {
      childRecipe = { kind: "frost", path: childPath, ext };
      out.recipes.push(childRecipe);
    } else if (ext.target === "background" && ext.composition) {
      childRecipe = { kind: "expression", path: childPath, ext };
      out.recipes.push(childRecipe);
    }

    collectTokens(child, childPath, child.$type ?? inheritedType, childRecipe, out);
  }
  return out;
}

/** theme/{mode}/… → "light" | "dark"; everything else → null. */
const themeModeOf = (path) => (path[0] === "theme" ? path[1] : null);

/** Expected CSS name for a token path; theme/{mode} is not part of it. */
function cssVarName(path) {
  const publicPath = themeModeOf(path) ? path.slice(2) : path;
  return `--${publicPath.join("-")}`;
}

const REFERENCE = /^\{([^{}]+)\}$/;
const isReference = (value) => typeof value === "string" && REFERENCE.test(value);

/** "{color.primitive.blue.600}" → "var(--color-primitive-blue-600)" */
const referenceToVar = (reference) =>
  `var(${cssVarName(reference.match(REFERENCE)[1].split("."))})`;

/* -------------------------------------------------------------------------- *
 * 2. Reading the generated CSS
 * -------------------------------------------------------------------------- */

/**
 * Parse the generated file into blocks: [{ selector, declarations: [{ name, value }] }].
 *
 * This is a small parser for flat token files, not a general CSS parser: it
 * assumes no nested rules and no semicolons inside values, both true for
 * custom-property-only output.
 */
function parseCss(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks = [];

  for (const [, selector, body] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = body
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const colon = part.indexOf(":");
        return { name: part.slice(0, colon).trim(), value: part.slice(colon + 1).trim() };
      });
    blocks.push({ selector: selector.trim(), declarations });
  }
  return blocks;
}

/**
 * Split on commas that aren't inside parentheses:
 *   "radial-gradient(a, b), #fff" → ["radial-gradient(a, b)", "#fff"]
 * Returns null if the parentheses don't balance.
 */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = "";

  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0) return null;

    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (depth !== 0) return null;
  parts.push(current.trim());
  return parts;
}

/** "#3f6eeb" | "rgb(…)" | "rgba(…)" | "transparent" → { r, g, b, a }, else null. */
function parseCssColor(text) {
  if (text === "transparent") return { r: 0, g: 0, b: 0, a: 0, transparent: true };

  const hex = text.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) {
    const [r, g, b] = hex.slice(1).map((pair) => parseInt(pair, 16));
    return { r, g, b, a: 1 };
  }

  const rgb = text.match(/^rgba?\(([^)]*)\)$/);
  if (rgb) {
    const [r, g, b, a = 1] = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  }
  return null;
}

/* -------------------------------------------------------------------------- *
 * 3. Comparison helpers
 * -------------------------------------------------------------------------- */

const approxEqual = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

/** "42%" → 0.42, else null. */
function parsePercent(text) {
  const match = text?.match(/^(-?\d*\.?\d+)%$/);
  return match ? Number(match[1]) / 100 : null;
}

/**
 * Does a CSS color string represent this DTCG color (or reference)?
 * A fully transparent DTCG color may be written as `transparent`.
 */
function matchesDtcgColor(cssText, dtcgColor) {
  if (isReference(dtcgColor)) return cssText === referenceToVar(dtcgColor);

  const parsed = parseCssColor(cssText);
  if (!parsed) return false;

  const alpha = dtcgColor.alpha ?? 1;
  if (alpha === 0 && parsed.transparent) return true;

  const [r, g, b] = dtcgColor.components.map((c) => Math.round(c * 255));
  return parsed.r === r && parsed.g === g && parsed.b === b && approxEqual(parsed.a, alpha);
}

/* -------------------------------------------------------------------------- *
 * 4. Checks
 *
 * Each check returns { problems: string[], detail?: string }. An empty
 * problems list means it passed.
 * -------------------------------------------------------------------------- */

/** :root and the dark selector each appear once, with no duplicate names. */
function checkStructure({ blocks, lightSelector, darkSelector }) {
  const problems = [];

  for (const selector of [lightSelector, darkSelector]) {
    const count = blocks.filter((block) => block.selector === selector).length;
    if (count !== 1) problems.push(`expected exactly one ${selector} block, found ${count}`);
  }
  for (const block of blocks) {
    if (block.selector !== lightSelector && block.selector !== darkSelector) {
      problems.push(`unexpected block ${block.selector}`);
    }
    const seen = new Set();
    for (const { name } of block.declarations) {
      if (!name.startsWith("--")) problems.push(`${block.selector}: "${name}" is not a custom property`);
      if (seen.has(name)) problems.push(`${block.selector}: ${name} is declared more than once`);
      seen.add(name);
    }
  }
  return { problems };
}

/** Stringified JS values leaking into CSS. Checks the raw file, comments included. */
function checkNoLeakedValues({ css }) {
  const problems = [];
  const lines = css.split("\n");

  for (const leak of ["[object Object]", "undefined", "NaN"]) {
    lines.forEach((line, index) => {
      if (line.includes(leak)) problems.push(`line ${index + 1} contains "${leak}": ${line.trim()}`);
    });
  }
  return { problems };
}

/** No --theme-light-* / --theme-dark-* names, declared or referenced. */
function checkNoModePrefixedNames({ css }) {
  const matches = css.match(/--theme-(light|dark)-[\w-]*/g) ?? [];
  return { problems: [...new Set(matches)].map((name) => `found ${name}`) };
}

/** Every var(--x) points at a declared variable. */
function checkReferencesResolve({ rootValues, darkValues }) {
  const problems = [];
  const declared = new Set([...rootValues.keys(), ...darkValues.keys()]);

  for (const [selector, values] of [[":root", rootValues], ["dark", darkValues]]) {
    for (const [name, value] of values) {
      for (const [, referenced] of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!declared.has(referenced)) {
          problems.push(`${selector} ${name} uses var(${referenced}), which is never declared`);
        }
      }
    }
  }
  return { problems };
}

/**
 * Every theme/dark token is written to the dark block under the same name as
 * its theme/light counterpart, and the dark block contains nothing else.
 */
function checkDarkMatchesLight({ tokens, rootValues, darkValues }) {
  const problems = [];
  const tokenPaths = new Set(tokens.map((token) => token.path.join(".")));
  const darkTokens = tokens.filter((token) => themeModeOf(token.path) === "dark");
  const expectedDarkNames = new Set();

  for (const token of darkTokens) {
    const name = cssVarName(token.path);
    const lightPath = ["theme", "light", ...token.path.slice(2)];
    expectedDarkNames.add(name);

    if (!tokenPaths.has(lightPath.join("."))) {
      problems.push(`${token.path.join(".")} has no light counterpart (${lightPath.join(".")}) in the JSON`);
    }
    if (!darkValues.has(name)) {
      problems.push(`${token.path.join(".")} should be ${name} in the dark block, but it's missing`);
    }
    if (!rootValues.has(name)) {
      problems.push(`${name} is overridden in dark mode but has no light value in :root`);
    }
  }

  for (const name of darkValues.keys()) {
    if (!expectedDarkNames.has(name)) {
      problems.push(`dark block declares ${name}, which isn't a theme/dark token`);
    }
  }
  return { problems, detail: `${darkTokens.length} dark overrides` };
}

/** Every plain JSON token, and every frost recipe, has its CSS variable. */
function checkCoverage({ tokens, recipes, rootValues }) {
  const problems = [];
  let expected = 0;

  for (const token of tokens) {
    if (token.recipe || themeModeOf(token.path) === "dark") continue;
    expected += 1;
    const name = cssVarName(token.path);
    if (!rootValues.has(name)) problems.push(`${token.path.join(".")} → ${name} is missing from :root`);
  }

  for (const recipe of recipes.filter((r) => r.kind === "frost")) {
    for (const suffix of ["background", "border", "backdrop-filter"]) {
      expected += 1;
      const name = `${cssVarName(recipe.path)}-${suffix}`;
      if (!rootValues.has(name)) problems.push(`frost recipe ${recipe.path.join(".")} → ${name} is missing`);
    }
  }
  return { problems, detail: `${expected} expected variables` };
}

/** duration tokens → <number>ms, with the same length of time. */
function checkDurations({ tokens, rootValues }) {
  const problems = [];
  const durations = tokens.filter((token) => token.type === "duration");

  for (const token of durations) {
    const name = cssVarName(token.path);
    const css = rootValues.get(name);
    const expectedMs = token.value.unit === "s" ? token.value.value * 1000 : token.value.value;
    const match = css?.match(/^(-?\d*\.?\d+)ms$/);

    if (!match) problems.push(`${name}: expected ms, got "${css}"`);
    else if (!approxEqual(Number(match[1]), expectedMs)) problems.push(`${name}: expected ${expectedMs}ms, got ${css}`);
  }
  return { problems, detail: `${durations.length} tokens` };
}

/** Numbers marked { unit: "em" } in $extensions (tracking) → <number>em. */
function checkTracking({ tokens, rootValues }) {
  const problems = [];
  const emTokens = tokens.filter((token) => token.type === "number" && token.ext.unit === "em");

  for (const token of emTokens) {
    const name = cssVarName(token.path);
    const css = rootValues.get(name);
    const match = css?.match(/^(-?\d*\.?\d+)em$/);

    if (!match) problems.push(`${name}: expected em, got "${css}"`);
    else if (!approxEqual(Number(match[1]), token.value)) problems.push(`${name}: expected ${token.value}em, got ${css}`);
  }
  return { problems, detail: `${emTokens.length} tokens` };
}

/** cubicBezier [x1, y1, x2, y2] → cubic-bezier(x1, y1, x2, y2). */
function checkCubicBeziers({ tokens, rootValues }) {
  const problems = [];
  const curves = tokens.filter((token) => token.type === "cubicBezier");

  for (const token of curves) {
    const name = cssVarName(token.path);
    const css = rootValues.get(name);
    const match = css?.match(/^cubic-bezier\(([^)]*)\)$/);
    const numbers = match?.[1].split(",").map((n) => Number(n.trim()));

    const same =
      numbers?.length === 4 && numbers.every((n, i) => approxEqual(n, token.value[i]));
    if (!same) problems.push(`${name}: expected cubic-bezier(${token.value.join(", ")}), got "${css}"`);
  }
  return { problems, detail: `${curves.length} tokens` };
}

/** shadow/none → none (and any other shadow with a pinned cssValue). */
function checkShadowNone({ tokens, rootValues }) {
  const problems = [];
  const none = tokens.find((token) => token.path.join(".") === "shadow.none");

  if (!none) problems.push("shadow.none is missing from the JSON");
  else if (rootValues.get("--shadow-none") !== "none") {
    problems.push(`--shadow-none: expected "none", got "${rootValues.get("--shadow-none")}"`);
  }

  const otherPinnedShadows = tokens.filter(
    (t) => t !== none && t.type === "shadow" && t.ext.cssValue !== undefined,
  );
  for (const token of otherPinnedShadows) {
    const name = cssVarName(token.path);
    if (rootValues.get(name) !== token.ext.cssValue) {
      problems.push(`${name}: expected pinned cssValue "${token.ext.cssValue}", got "${rootValues.get(name)}"`);
    }
  }
  return { problems };
}

/**
 * Each expression field is one complete `background` value:
 *   - one layer per `composition` entry, in order
 *   - gradient layers are radial-gradient(circle at X% Y%, …) whose center
 *     and color stops match the JSON
 *   - the base layer comes last and matches the base color token
 *   - the layer parts are not emitted as separate variables
 */
function checkExpressionFields({ tokens, recipes, rootValues, darkValues }) {
  const problems = [];
  const tokensByPath = new Map(tokens.map((token) => [token.path.join("."), token]));
  const fields = recipes.filter((recipe) => recipe.kind === "expression");

  for (const field of fields) {
    const name = cssVarName(field.path);
    const css = rootValues.get(name);
    const report = (message) => problems.push(`${name}: ${message}`);

    if (!css) {
      report("missing from :root");
      continue;
    }

    const layers = splitTopLevel(css);
    if (!layers) {
      report("unbalanced parentheses (value is incomplete)");
      continue;
    }

    const { composition } = field.ext;
    if (layers.length !== composition.length) {
      report(`expected ${composition.length} layers (${composition.join(", ")}), got ${layers.length}`);
      continue;
    }

    composition.forEach((layerKey, index) => {
      const layerToken = tokensByPath.get([...field.path, layerKey].join("."));
      const layerCss = layers[index];

      if (!layerToken) {
        report(`composition lists "${layerKey}", but ${field.path.join(".")}.${layerKey} isn't a token`);
      } else if (layerToken.type === "color") {
        if (index !== composition.length - 1) report(`color layer "${layerKey}" must be the last layer`);
        if (!matchesDtcgColor(layerCss, layerToken.value)) {
          report(`base layer "${layerKey}" should match ${JSON.stringify(layerToken.value)}, got "${layerCss}"`);
        }
      } else if (layerToken.type === "gradient") {
        checkRadialGradientLayer(layerCss, layerToken, (message) => report(`layer "${layerKey}": ${message}`));
      } else {
        report(`layer "${layerKey}" has unsupported type ${layerToken.type}`);
      }
    });
  }

  // Internal layer variables like --expression-field-ice-blue must not exist.
  const allNames = [...rootValues.keys(), ...darkValues.keys()];
  for (const field of fields) {
    const prefix = `${cssVarName(field.path)}-`;
    for (const leaked of allNames.filter((name) => name.startsWith(prefix))) {
      problems.push(`internal layer variable ${leaked} should not be emitted`);
    }
  }

  return { problems, detail: `${fields.length} fields` };
}

/** One gradient layer vs. its DTCG gradient token + Camellia geometry. */
function checkRadialGradientLayer(layerCss, token, report) {
  const match = layerCss.match(/^radial-gradient\((.*)\)$/s);
  if (!match) return report(`expected radial-gradient(...), got "${layerCss}"`);

  const [shape, ...stops] = splitTopLevel(match[1]);

  // Geometry: "circle at 24% 28%" ↔ $extensions center { x: 0.24, y: 0.28 }.
  const { center } = token.ext;
  const at = shape.match(/^circle at (\S+) (\S+)$/);
  const [x, y] = [parsePercent(at?.[1]), parsePercent(at?.[2])];
  if (!center) report("JSON is missing $extensions center");
  else if (x === null || y === null || !approxEqual(x, center.x, 1e-4) || !approxEqual(y, center.y, 1e-4)) {
    report(`expected "circle at ${center.x * 100}% ${center.y * 100}%", got "${shape}"`);
  }

  // Color stops: same count, colors and positions as the DTCG $value.
  if (stops.length !== token.value.length) {
    return report(`expected ${token.value.length} color stops, got ${stops.length}`);
  }
  token.value.forEach((expected, index) => {
    // "<color> <position>%" — the position may be omitted for the first stop
    // (CSS defaults it to 0%).
    const stop = stops[index].match(/^(.*\S)\s+(-?\d*\.?\d+%)$/);
    const color = stop ? stop[1] : stops[index];
    const position = stop ? parsePercent(stop[2]) : index === 0 ? 0 : null;

    if (!matchesDtcgColor(color, expected.color)) {
      report(`stop ${index + 1}: color "${color}" doesn't match the JSON`);
    }
    if (position === null || !approxEqual(position, expected.position, 1e-4)) {
      report(`stop ${index + 1}: expected position ${expected.position * 100}%, got "${stops[index]}"`);
    }
  });
}

/* -------------------------------------------------------------------------- *
 * 5. Run and report
 * -------------------------------------------------------------------------- */

const [sourceText, css] = await Promise.all([
  readFile(SOURCE_FILE, "utf8"),
  readFile(CSS_FILE, "utf8"),
]);
const sourceTree = JSON.parse(sourceText);

const { tokens, recipes } = collectTokens(sourceTree);
const { lightSelector, darkSelector } = camelliaExt(sourceTree).targets.css;

const blocks = parseCss(css);
const declarationsFor = (selector) =>
  blocks.filter((block) => block.selector === selector).flatMap((block) => block.declarations);
const rootValues = new Map(declarationsFor(lightSelector).map(({ name, value }) => [name, value]));
const darkValues = new Map(declarationsFor(darkSelector).map(({ name, value }) => [name, value]));

const context = { css, blocks, tokens, recipes, lightSelector, darkSelector, rootValues, darkValues };

const CHECKS = [
  ["One :root block and one dark block, no duplicates", checkStructure],
  ["No [object Object], undefined or NaN", checkNoLeakedValues],
  ["No --theme-light-* / --theme-dark-* variables", checkNoModePrefixedNames],
  ["Every var() reference is declared", checkReferencesResolve],
  ["Dark overrides reuse light variable names", checkDarkMatchesLight],
  ["Every JSON token has a CSS variable", checkCoverage],
  ["duration → ms", checkDurations],
  ["tracking → em", checkTracking],
  ["cubicBezier → cubic-bezier(...)", checkCubicBeziers],
  ["shadow/none → none", checkShadowNone],
  ["Expression fields are complete radial-gradient(...) values", checkExpressionFields],
];

console.log("Camellia token CSS check");
console.log(`  source:    ${SOURCE_FILE}`);
console.log(`  generated: ${CSS_FILE}\n`);

let failed = 0;
for (const [title, check] of CHECKS) {
  const { problems, detail } = check(context);
  const suffix = detail ? ` (${detail})` : "";

  if (problems.length === 0) {
    console.log(`  ✔ ${title}${suffix}`);
  } else {
    failed += 1;
    console.log(`  ✖ ${title}${suffix} — ${problems.length} problem(s)`);
    for (const problem of problems) console.log(`      - ${problem}`);
  }
}

const totalDeclarations = rootValues.size + darkValues.size;
console.log(
  `\nVariables: ${totalDeclarations} declarations ` +
    `(${rootValues.size} in ${lightSelector}, ${darkValues.size} in ${darkSelector})`,
);

if (failed === 0) {
  console.log(`\nPASS — all ${CHECKS.length} checks passed`);
} else {
  console.log(`\nFAIL — ${failed} of ${CHECKS.length} checks failed`);
  process.exitCode = 1;
}
