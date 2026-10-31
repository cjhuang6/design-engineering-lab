import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { planPrimitives } from "../src/plan-primitives.ts";
import {
  planTextStyles,
  TEXT_STYLE_SHARED_ID_KEY,
  TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE,
} from "../src/plan-text-styles.ts";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const tokens = readJson("../../tokens/camellia.tokens.json");

const plan = planTextStyles(tokens);
const primitives = planPrimitives(tokens);
const byName = new Map(plan.styles.map((style) => [style.name, style]));
const primitiveByName = new Map(primitives.variables.map((variable) => [variable.name, variable]));

const get = (name) => {
  const style = byName.get(name);
  assert.ok(style, `${name} should be planned`);
  return style;
};

const cloneTokens = () => structuredClone(tokens);

const EXPECTED = [
  ["Camellia/Display/LG", "display/lg", "font/family/sans", "Geist", "font/weight/semibold", "SemiBold", 48, 52, -2],
  ["Camellia/Display/SM", "display/sm", "font/family/sans", "Geist", "font/weight/semibold", "SemiBold", 40, 44, -2],
  ["Camellia/Heading/XL", "heading/xl", "font/family/sans", "Geist", "font/weight/semibold", "SemiBold", 32, 38, -2],
  ["Camellia/Heading/LG", "heading/lg", "font/family/sans", "Geist", "font/weight/semibold", "SemiBold", 28, 34, -2],
  ["Camellia/Heading/MD", "heading/md", "font/family/sans", "Geist", "font/weight/semibold", "SemiBold", 24, 30, 0],
  ["Camellia/Heading/SM", "heading/sm", "font/family/sans", "Geist", "font/weight/semibold", "SemiBold", 20, 26, 0],
  ["Camellia/Body/LG", "body/lg", "font/family/sans", "Geist", "font/weight/regular", "Regular", 18, 28, 0],
  ["Camellia/Body/MD", "body/md", "font/family/sans", "Geist", "font/weight/regular", "Regular", 16, 24, 0],
  ["Camellia/Body/SM", "body/sm", "font/family/sans", "Geist", "font/weight/regular", "Regular", 14, 20, 0],
  ["Camellia/Label/MD", "label/md", "font/family/sans", "Geist", "font/weight/medium", "Medium", 14, 20, 0],
  ["Camellia/Label/SM", "label/sm", "font/family/sans", "Geist", "font/weight/medium", "Medium", 12, 16, 0],
  ["Camellia/Code/MD", "code/md", "font/family/mono", "Geist Mono", "font/weight/regular", "Regular", 14, 20, 0],
  ["Camellia/Code/SM", "code/sm", "font/family/mono", "Geist Mono", "font/weight/regular", "Regular", 12, 16, 0],
];

test("plans the 13 approved Text Styles and nothing else", () => {
  assert.deepEqual(
    plan.styles.map((style) => style.name),
    EXPECTED.map(([name]) => name),
  );
});

test("Display/LG plans a 52px line height and binds the sans family variable", () => {
  const display = get("Camellia/Display/LG");
  const sans = primitiveByName.get("font/family/sans");
  const semibold = primitiveByName.get("font/weight/semibold");
  assert.ok(sans);
  assert.ok(semibold);

  assert.deepEqual(display.lineHeight, { unit: "PIXELS", value: 52 });
  assert.equal(display.fontFamilyVariable, "font/family/sans");
  assert.equal(display.fontFamilyId, sans.id);
  assert.equal(display.fontFamilyName, "Geist");
  assert.equal(display.fontWeightVariable, "font/weight/semibold");
  assert.equal(display.fontWeightId, semibold.id);
  assert.equal(display.fontStyle, "SemiBold");
  assert.equal(display.fontSize, 48);
  assert.deepEqual(display.letterSpacing, { unit: "PERCENT", value: -2 });
});

test("each Text Style binds the matching family and weight variables", () => {
  for (const [name, , familyVariable, familyName, weightVariable, fontStyle, fontSize, lineHeight, letterSpacing] of EXPECTED) {
    const style = get(name);
    const family = primitiveByName.get(familyVariable);
    const weight = primitiveByName.get(weightVariable);
    assert.ok(family, familyVariable);
    assert.ok(weight, weightVariable);
    assert.equal(style.fontFamilyVariable, familyVariable, name);
    assert.equal(style.fontFamilyId, family.id, name);
    assert.equal(style.fontFamilyName, familyName, name);
    assert.equal(style.fontWeightVariable, weightVariable, name);
    assert.equal(style.fontWeightId, weight.id, name);
    assert.equal(style.fontStyle, fontStyle, name);
    assert.equal(style.fontSize, fontSize, name);
    assert.deepEqual(style.lineHeight, { unit: "PIXELS", value: lineHeight }, name);
    assert.deepEqual(style.letterSpacing, { unit: "PERCENT", value: letterSpacing }, name);
  }
});

test("every Text Style has a unique type- id stored on its token", () => {
  assert.equal(TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE, "com.cjhuang.camellia");
  assert.equal(TEXT_STYLE_SHARED_ID_KEY, "id");
  const ids = plan.styles.map((style) => style.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 13);

  const otherIds = new Set();
  const typeIds = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const id = node.$extensions?.["com.cjhuang.camellia"]?.id;
    if (typeof id === "string") {
      if (id.startsWith("type-")) typeIds.add(id);
      else otherIds.add(id);
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(tokens);

  assert.equal(typeIds.size, 13);
  for (const style of plan.styles) {
    assert.match(style.id, /^type-[0-9a-f]{6}$/, style.name);
    assert.equal(otherIds.has(style.id), false, style.name);
    const tokenPath = EXPECTED.find(([styleName]) => styleName === style.name)[1];
    assert.equal(nodeAt(tokens, tokenPath).$extensions["com.cjhuang.camellia"].id, style.id, style.name);
  }
});

function nodeAt(root, name) {
  let node = root;
  for (const part of name.split("/")) node = node[part];
  return node;
}

test("renaming a typography path keeps its id", () => {
  const renamed = cloneTokens();
  const previous = get("Camellia/Display/LG");
  renamed.display.hero = renamed.display.lg;
  delete renamed.display.lg;

  const planned = planTextStyles(renamed);
  const hero = planned.styles.find((style) => style.name === "Camellia/Display/HERO");
  assert.ok(hero);
  assert.equal(hero.id, previous.id);
  assert.equal(hero.fontSize, previous.fontSize);
  assert.deepEqual(hero.lineHeight, previous.lineHeight);
  assert.equal(planned.styles.some((style) => style.name === "Camellia/Display/LG"), false);
  assert.equal(planned.styles.length, plan.styles.length);
});

test("typography composites and tracking do not become new variables", () => {
  const stringNames = primitives.variables.filter((variable) => variable.type === "STRING").map((variable) => variable.name);
  assert.deepEqual(stringNames, ["font/family/sans", "font/family/mono"]);
  for (const prefix of ["display/", "heading/", "body/", "label/", "code/", "tracking/"]) {
    assert.equal(
      primitives.variables.some((variable) => variable.name.startsWith(prefix)),
      false,
      prefix,
    );
  }
  assert.equal(primitives.variables.length, 118);
});

test("line height follows lineHeightPx, not the unitless ratio", () => {
  const pixels = cloneTokens();
  pixels.display.lg.$extensions["com.cjhuang.camellia"].lineHeightPx = 60;
  assert.equal(style(pixels, "Camellia/Display/LG").lineHeight.value, 60);

  const ratio = cloneTokens();
  ratio.display.lg.$value.lineHeight = 2;
  assert.deepEqual(style(ratio, "Camellia/Display/LG").lineHeight, { unit: "PIXELS", value: 52 });
});

test("letter spacing follows the em tracking ratio, not the px value on the composite", () => {
  const pixels = cloneTokens();
  pixels.display.lg.$value.letterSpacing = { value: -5, unit: "px" };
  assert.deepEqual(style(pixels, "Camellia/Display/LG").letterSpacing, { unit: "PERCENT", value: -2 });

  const tighter = cloneTokens();
  tighter.tracking.tight.$value = -0.03;
  assert.equal(style(tighter, "Camellia/Display/LG").letterSpacing.value, -3);
  assert.equal(style(tighter, "Camellia/Heading/LG").letterSpacing.value, -3);
  assert.equal(style(tighter, "Camellia/Body/MD").letterSpacing.value, 0);

  const technical = cloneTokens();
  technical.display.lg.$extensions["com.cjhuang.camellia"].trackingIntent = "{tracking.technical}";
  assert.deepEqual(style(technical, "Camellia/Display/LG").letterSpacing, { unit: "PERCENT", value: 10 });
});

function style(tree, name) {
  const found = planTextStyles(tree).styles.find((item) => item.name === name);
  assert.ok(found, name);
  return found;
}

test("a Text Style with no id names the path", () => {
  const broken = cloneTokens();
  delete broken.display.lg.$extensions["com.cjhuang.camellia"].id;
  assert.throws(
    () => planTextStyles(broken),
    /plan-text-styles: display\.lg id is missing; expected type-\[0-9a-f\]\{6\}/,
  );
});

test("a Text Style id in the wrong format names the path", () => {
  const broken = cloneTokens();
  broken.display.lg.$extensions["com.cjhuang.camellia"].id = "type-ABC123";
  assert.throws(
    () => planTextStyles(broken),
    /plan-text-styles: display\.lg id is "type-ABC123"; expected type-\[0-9a-f\]\{6\}/,
  );
});

test("a primitive or semantic id on a Text Style names the path", () => {
  const broken = cloneTokens();
  broken.display.lg.$extensions["com.cjhuang.camellia"].id = "prim-000000";
  assert.throws(
    () => planTextStyles(broken),
    /plan-text-styles: display\.lg id is "prim-000000"; expected type-\[0-9a-f\]\{6\}/,
  );

  broken.display.lg.$extensions["com.cjhuang.camellia"].id = "sem-4c4a41";
  assert.throws(
    () => planTextStyles(broken),
    /plan-text-styles: display\.lg id is "sem-4c4a41"; expected type-\[0-9a-f\]\{6\}/,
  );
});

test("two Text Styles that share an id name both styles", () => {
  const broken = cloneTokens();
  const id = get("Camellia/Display/LG").id;
  broken.display.sm.$extensions["com.cjhuang.camellia"].id = id;
  assert.throws(
    () => planTextStyles(broken),
    new RegExp(`plan-text-styles: Camellia/Display/SM reuses id "${id}" already used by Camellia/Display/LG`),
  );
});

test("a type- id copied onto another token fails", () => {
  const broken = cloneTokens();
  const id = get("Camellia/Display/LG").id;
  broken.shadow.none.$extensions["com.cjhuang.camellia"].id = id;
  assert.throws(
    () => planTextStyles(broken),
    new RegExp(`plan-text-styles: Camellia/Display/LG reuses id "${id}" already used by shadow/none`),
  );
});

test("a primitive id copied onto a Text Style fails the primitive plan", () => {
  const broken = cloneTokens();
  const id = primitiveByName.get("color/base/white").id;
  broken.display.lg.$extensions["com.cjhuang.camellia"].id = id;
  assert.throws(
    () => planPrimitives(broken),
    new RegExp(`plan-primitives: color/base/white reuses id "${id}" already used by display/lg`),
  );
});

test("a font weight outside 400, 500, and 600 fails the plan", () => {
  const broken = cloneTokens();
  broken.font.weight.semibold.$value = 700;
  assert.throws(
    () => planTextStyles(broken),
    /plan-text-styles: display\.lg font weight 700 has no style name; expected 400, 500, or 600/,
  );
});

test("font family and weight must reference those variables", () => {
  const rawFamily = cloneTokens();
  rawFamily.display.lg.$value.fontFamily = "Geist";
  assert.throws(
    () => planTextStyles(rawFamily),
    /plan-text-styles: display\.lg fontFamily must reference a variable/,
  );

  const spacing = cloneTokens();
  spacing.display.lg.$value.fontWeight = "{space.4}";
  assert.throws(
    () => planTextStyles(spacing),
    /plan-text-styles: display\.lg fontWeight references \{space\.4\}, which is not a font\/weight variable/,
  );
});

test("a typography token outside the Text Style groups fails the plan", () => {
  const broken = cloneTokens();
  broken.shadow.hero = structuredClone(broken.display.lg);
  broken.shadow.hero.$extensions["com.cjhuang.camellia"].id = "type-abcdef";
  assert.throws(
    () => planTextStyles(broken),
    /plan-text-styles: shadow\.hero is typography outside display, heading, body, label, code/,
  );
});

test("a non-typography token inside a Text Style group fails the plan", () => {
  const broken = cloneTokens();
  broken.display.note = { $type: "number", $value: 1 };
  assert.throws(
    () => planTextStyles(broken),
    /plan-text-styles: display\.note is in a Text Style group but its \$type is "number"/,
  );
});

test("a nested typography token fails instead of inventing a name", () => {
  const broken = cloneTokens();
  broken.display.stacked = { xl: structuredClone(broken.display.lg) };
  broken.display.stacked.xl.$extensions["com.cjhuang.camellia"].id = "type-abcdef";
  assert.throws(
    () => planTextStyles(broken),
    /plan-text-styles: display\.stacked\.xl must be one group and one size, like display\.lg/,
  );
});

test("a missing line height or tracking intent names the path", () => {
  const noLineHeight = cloneTokens();
  delete noLineHeight.display.lg.$extensions["com.cjhuang.camellia"].lineHeightPx;
  assert.throws(
    () => planTextStyles(noLineHeight),
    /plan-text-styles: display\.lg lineHeightPx must be a number of pixels, got missing/,
  );

  const noTracking = cloneTokens();
  delete noTracking.display.lg.$extensions["com.cjhuang.camellia"].trackingIntent;
  assert.throws(
    () => planTextStyles(noTracking),
    /plan-text-styles: display\.lg trackingIntent must reference a tracking token/,
  );

  const pixels = cloneTokens();
  pixels.tracking.tight.$extensions["com.cjhuang.camellia"].unit = "px";
  assert.throws(
    () => planTextStyles(pixels),
    /plan-text-styles: display\.lg tracking token tracking\/tight must use em, got "px"/,
  );
});
