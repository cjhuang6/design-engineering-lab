import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  planSemantic,
  SEMANTIC_SHARED_ID_KEY,
  SEMANTIC_SHARED_PLUGIN_DATA_NAMESPACE,
} from "../src/plan-semantic.ts";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const tokens = readJson("../../tokens/camellia.tokens.json");
const tokensCss = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

const plan = planSemantic(tokens);
const byName = new Map(plan.variables.map((variable) => [variable.name, variable]));
const get = (name) => {
  const variable = byName.get(name);
  assert.ok(variable, `${name} should be planned`);
  return variable;
};

const cloneTokens = () => structuredClone(tokens);
const camellia = (node) => node.$extensions["com.cjhuang.camellia"];

const referenceToFigmaName = (reference) => {
  assert.match(reference, /^\{[^{}]+\}$/);
  return reference.slice(1, -1).replaceAll(".", "/");
};

const actionPrimaryLight = referenceToFigmaName(tokens.theme.light.color.action.primary.$value);

const FILL = ["FRAME_FILL", "SHAPE_FILL"];
const TEXT = ["TEXT_FILL"];
const STROKE = ["STROKE_COLOR"];
const SHAPE = ["SHAPE_FILL"];
const ACCENT = ["SHAPE_FILL", "STROKE_COLOR"];
const GAP = ["GAP"];

/** The approved Phase 2C scope table: 26 color rows, then 15 spacing rows. */
const expected = [
  ["color/background/canvas", "COLOR", "color/base/white", "color/base/black", FILL],
  ["color/surface/primary", "COLOR", "color/base/white", "color/primitive/ice/950", FILL],
  ["color/surface/secondary", "COLOR", "color/primitive/ice/50", "color/primitive/ice/900", FILL],
  ["color/surface/subtle", "COLOR", "color/primitive/ice/100", "color/primitive/ice/950", FILL],
  ["color/surface/selected", "COLOR", "color/primitive/blue/50", "color/primitive/blue/950", FILL],
  ["color/text/primary", "COLOR", "color/primitive/ice/900", "color/primitive/ice/50", TEXT],
  ["color/text/secondary", "COLOR", "color/primitive/ice/600", "color/primitive/ice/300", TEXT],
  ["color/text/tertiary", "COLOR", "color/primitive/ice/500", "color/primitive/ice/400", TEXT],
  ["color/text/inverse", "COLOR", "color/base/white", "color/primitive/ice/950", TEXT],
  ["color/icon/primary", "COLOR", "color/primitive/ice/800", "color/primitive/ice/100", SHAPE],
  ["color/icon/secondary", "COLOR", "color/primitive/ice/600", "color/primitive/ice/300", SHAPE],
  ["color/border/subtle", "COLOR", "color/primitive/ice/200", "color/primitive/alpha/blue-400/18", STROKE],
  ["color/border/default", "COLOR", "color/primitive/ice/300", "color/primitive/alpha/blue-400/30", STROKE],
  ["color/border/strong", "COLOR", "color/primitive/ice/400", "color/primitive/alpha/blue-400/50", STROKE],
  ["color/action/primary", "COLOR", actionPrimaryLight, "color/primitive/blue/400", FILL],
  ["color/action/primary-hover", "COLOR", "color/primitive/blue/700", "color/primitive/blue/300", FILL],
  ["color/action/primary-pressed", "COLOR", "color/primitive/blue/800", "color/primitive/blue/500", FILL],
  ["color/action/primary-text", "COLOR", "color/base/white", "color/primitive/ice/950", TEXT],
  ["color/action/link", "COLOR", "color/primitive/blue/700", "color/primitive/blue/300", TEXT],
  ["color/action/link-hover", "COLOR", "color/primitive/blue/800", "color/primitive/blue/200", TEXT],
  ["color/focus", "COLOR", "color/primitive/blue/500", "color/primitive/blue/400", STROKE],
  ["color/functional/accent", "COLOR", "color/primitive/green/500", "color/primitive/green/400", ACCENT],
  ["color/functional/surface", "COLOR", "color/primitive/green/50", "color/primitive/alpha/green-400/12", FILL],
  ["color/expression/pink", "COLOR", "color/primitive/pink/400", "color/primitive/pink/400", FILL],
  ["color/expression/blue", "COLOR", "color/primitive/blue/300", "color/primitive/blue/400", FILL],
  ["color/expression/green", "COLOR", "color/primitive/green/300", "color/primitive/green/400", FILL],
  ["layout/content-gap/sm", "FLOAT", "space/2", "space/2", GAP],
  ["layout/content-gap/md", "FLOAT", "space/4", "space/4", GAP],
  ["layout/content-gap/lg", "FLOAT", "space/6", "space/6", GAP],
  ["layout/section-gap/sm", "FLOAT", "space/6", "space/6", GAP],
  ["layout/section-gap/md", "FLOAT", "space/12", "space/12", GAP],
  ["layout/section-gap/lg", "FLOAT", "space/16", "space/16", GAP],
  ["layout/page-gutter/mobile", "FLOAT", "space/4", "space/4", GAP],
  ["layout/page-gutter/tablet", "FLOAT", "space/6", "space/6", GAP],
  ["layout/page-gutter/desktop", "FLOAT", "space/8", "space/8", GAP],
  ["control/padding-inline/sm", "FLOAT", "space/3", "space/3", GAP],
  ["control/padding-inline/md", "FLOAT", "space/4", "space/4", GAP],
  ["control/padding-inline/lg", "FLOAT", "space/5", "space/5", GAP],
  ["control/padding-block/sm", "FLOAT", "space/2", "space/2", GAP],
  ["control/padding-block/md", "FLOAT", "space/3", "space/3", GAP],
  ["control/padding-block/lg", "FLOAT", "space/4", "space/4", GAP],
];

test("targets the Semantic collection with Light then Dark", () => {
  assert.equal(plan.collectionName, "Semantic");
  assert.deepEqual(plan.modeNames, ["Light", "Dark"]);
});

test("plans 26 color aliases and 15 spacing aliases, with unique names", () => {
  assert.equal(plan.variables.length, 41);
  assert.equal(plan.variables.filter((variable) => variable.type === "COLOR").length, 26);
  assert.equal(plan.variables.filter((variable) => variable.type === "FLOAT").length, 15);
  assert.equal(plan.variables.filter((variable) => variable.name.startsWith("layout/")).length, 9);
  assert.equal(plan.variables.filter((variable) => variable.name.startsWith("control/")).length, 6);
  assert.equal(byName.size, plan.variables.length);
});

test("every approved row has its type, both aliases, scopes, code syntax, and description", () => {
  assert.deepEqual(
    plan.variables.map((variable) => variable.name),
    expected.map((row) => row[0]),
  );
  for (const [name, type, light, dark, scopes] of expected) {
    const variable = get(name);
    assert.equal(variable.type, type, name);
    assert.deepEqual(variable.aliases, { Light: light, Dark: dark }, name);
    assert.equal(variable.aliasIds.Light, nodeAt(tokens, light).$extensions["com.cjhuang.camellia"].id, name);
    assert.equal(variable.aliasIds.Dark, nodeAt(tokens, dark).$extensions["com.cjhuang.camellia"].id, name);
    assert.deepEqual(variable.scopes, scopes, name);
    assert.equal(variable.webSyntax, `var(--${name.replaceAll("/", "-")})`, name);
    assert.equal(variable.description, "", name);
    assert.match(variable.id, /^sem-[0-9a-f]{6}$/, name);
  }
});

test("every semantic variable has a unique permanent id", () => {
  assert.equal(SEMANTIC_SHARED_PLUGIN_DATA_NAMESPACE, "com.cjhuang.camellia");
  assert.equal(SEMANTIC_SHARED_ID_KEY, "id");
  const ids = plan.variables.map((variable) => variable.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const variable of plan.variables) {
    assert.match(variable.id, /^sem-[0-9a-f]{6}$/, variable.name);
    assert.notEqual(variable.id, variable.name, variable.name);
    const root = variable.name.startsWith("color/") ? tokens.theme.light : tokens;
    assert.equal(nodeAt(root, variable.name).$extensions["com.cjhuang.camellia"].id, variable.id, variable.name);
  }
});

test("light and dark leaves share one id, including deferred borders", () => {
  const seen = new Set(plan.variables.map((variable) => variable.id));
  for (const variable of plan.variables.filter((item) => item.name.startsWith("color/"))) {
    const light = nodeAt(tokens.theme.light, variable.name);
    const dark = nodeAt(tokens.theme.dark, variable.name);
    assert.equal(light.$extensions["com.cjhuang.camellia"].id, variable.id, variable.name);
    assert.equal(dark.$extensions["com.cjhuang.camellia"].id, variable.id, variable.name);
  }
  for (const leaf of ["subtle", "default", "strong", "focus"]) {
    const light = tokens.theme.light.border[leaf].$extensions["com.cjhuang.camellia"].id;
    const dark = tokens.theme.dark.border[leaf].$extensions["com.cjhuang.camellia"].id;
    assert.equal(light, dark, `border/${leaf}`);
    assert.match(light, /^sem-[0-9a-f]{6}$/, `border/${leaf}`);
    assert.equal(seen.has(light), false, `border/${leaf} is not a Figma variable`);
  }
});

function nodeAt(root, name) {
  let node = root;
  for (const part of name.split("/")) node = node[part];
  return node;
}

function unusedId(tree) {
  const used = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const id = node.$extensions?.["com.cjhuang.camellia"]?.id;
    if (typeof id === "string") used.add(id);
    for (const value of Object.values(node)) walk(value);
  };
  walk(tree);
  for (let n = 0; n <= 0xffffff; n++) {
    const id = `sem-${n.toString(16).padStart(6, "0")}`;
    if (!used.has(id)) return id;
  }
  throw new Error("no free semantic id");
}

test("every WEB code syntax names a variable that exists in tokens.css", () => {
  for (const variable of plan.variables) {
    const match = variable.webSyntax.match(/^var\((--[\w-]+)\)$/);
    assert.ok(match, `${variable.name} code syntax should look like var(--…)`);
    const declaration = new RegExp(`^\\s*${match[1]}:`, "m");
    assert.match(tokensCss, declaration, `${match[1]} is not declared in tokens.css`);
  }
  assert.equal(get("color/action/primary").webSyntax, "var(--color-action-primary)");
  assert.equal(get("layout/content-gap/md").webSyntax, "var(--layout-content-gap-md)");
});

test("composite border tokens are absent", () => {
  const deferred = ["border/subtle", "border/default", "border/strong", "border/focus"];
  for (const name of deferred) {
    assert.equal(byName.has(name), false, `${name} is deferred and must not be planned`);
  }
});

test("feedback colors stay out of Semantic", () => {
  const feedback = ["feedback/success", "feedback/warning", "feedback/error", "feedback/info"];
  for (const name of feedback) {
    assert.equal(byName.has(name), false, `${name} stays in Primitives`);
  }
});

test("collection and mode names are read from the JSON, not hardcoded", () => {
  const renamed = cloneTokens();
  const root = camellia(renamed);
  root.targets.figma.semanticCollection = "Semantics";
  root.targets.figma.semanticModes = ["Day", "Night"];
  camellia(renamed.theme).figmaCollection = "Semantics";
  camellia(renamed.theme).modeMap = { light: "Day", dark: "Night" };
  for (const groupName of ["layout", "control"]) {
    camellia(renamed[groupName]).figmaCollection = "Semantics";
    camellia(renamed[groupName]).modes = ["Day", "Night"];
  }

  const planned = planSemantic(renamed);
  assert.equal(planned.collectionName, "Semantics");
  assert.deepEqual(planned.modeNames, ["Day", "Night"]);
  assert.deepEqual(planned.variables[0].aliases, {
    Day: "color/base/white",
    Night: "color/base/black",
  });
});

test("a one-sided theme token fails the plan", () => {
  const broken = cloneTokens();
  delete broken.theme.dark.color.focus;
  assert.throws(
    () => planSemantic(broken),
    /one-sided theme token color\/focus; missing Dark/,
  );
});

test("a raw value fails the plan", () => {
  const broken = cloneTokens();
  broken.theme.light.color.action.primary.$value = "#1D4ED8";
  assert.throws(
    () => planSemantic(broken),
    /theme\.light\.color\.action\.primary must be a single reference/,
  );
});

test("a reference that is not in the Primitives plan fails", () => {
  const broken = cloneTokens();
  broken.theme.dark.color.border.subtle.$value = "{theme.dark.color.focus}";
  assert.throws(
    () => planSemantic(broken),
    /theme\.dark\.color\.border\.subtle references \{theme\.dark\.color\.focus\}, which is not in the Primitives plan/,
  );
});

test("a reference to a primitive of the wrong Figma type fails", () => {
  const broken = cloneTokens();
  broken.layout["content-gap"].md.$value = "{color.base.white}";
  assert.throws(
    () => planSemantic(broken),
    /layout\.content-gap\.md is FLOAT but color\/base\/white is COLOR/,
  );
});

test("a theme group extension that disagrees with the root fails", () => {
  const broken = cloneTokens();
  camellia(broken.theme).figmaCollection = "Other";
  assert.throws(
    () => planSemantic(broken),
    /theme figmaCollection "Other" disagrees with targets\.figma\.semanticCollection "Semantic"/,
  );
});

test("a theme modeMap that disagrees with the root fails", () => {
  const broken = cloneTokens();
  camellia(broken.theme).modeMap.dark = "Night";
  assert.throws(
    () => planSemantic(broken),
    /theme modeMap disagrees with targets\.figma\.semanticModes/,
  );
});

test("a layout modes list that disagrees with the root fails", () => {
  const broken = cloneTokens();
  camellia(broken.layout).modes = ["Dark", "Light"];
  assert.throws(
    () => planSemantic(broken),
    /layout modes \["Dark","Light"\] disagree with targets\.figma\.semanticModes \["Light","Dark"\]/,
  );
});

test("an unexpected $type fails the plan", () => {
  const broken = cloneTokens();
  const shadow = { $type: "shadow", $value: "{shadow.sm}" };
  broken.theme.light.extra = shadow;
  broken.theme.dark.extra = structuredClone(shadow);
  assert.throws(() => planSemantic(broken), /theme\.light\.extra has unexpected \$type "shadow"/);
});

test("a color with no approved scopes fails the plan", () => {
  const broken = cloneTokens();
  const id = unusedId(broken);
  const extensions = { $extensions: { "com.cjhuang.camellia": { id } } };
  broken.theme.light.color.extra = { $type: "color", $value: "{color.base.white}", ...extensions };
  broken.theme.dark.color.extra = { $type: "color", $value: "{color.base.black}", ...extensions };
  assert.throws(() => planSemantic(broken), /color\/extra has no approved scopes/);
});

test("renaming a primitive keeps the semantic alias on that primitive's id", () => {
  const renamed = cloneTokens();
  const previousId = tokens.color.primitive.blue["600"].$extensions["com.cjhuang.camellia"].id;
  renamed.color.primitive.blue.action = renamed.color.primitive.blue["600"];
  delete renamed.color.primitive.blue["600"];
  renamed.theme.light.color.action.primary.$value = "{color.primitive.blue.action}";

  const planned = planSemantic(renamed);
  const row = planned.variables.find((variable) => variable.name === "color/action/primary");
  assert.ok(row);
  assert.equal(row.aliases.Light, "color/primitive/blue/action");
  assert.equal(row.aliasIds.Light, previousId);
  assert.equal(row.aliases.Dark, "color/primitive/blue/400");
  assert.equal(row.aliasIds.Dark, tokens.color.primitive.blue["400"].$extensions["com.cjhuang.camellia"].id);
});

test("renaming a semantic path keeps its id and its group's scopes", () => {
  const renamed = cloneTokens();
  const light = renamed.theme.light.color.action;
  const dark = renamed.theme.dark.color.action;
  const previous = plan.variables.find((variable) => variable.name === "color/action/primary");
  light.main = light.primary;
  dark.main = dark.primary;
  delete light.primary;
  delete dark.primary;

  const planned = planSemantic(renamed);
  const main = planned.variables.find((variable) => variable.name === "color/action/main");
  assert.ok(main);
  assert.equal(main.id, previous.id);
  assert.deepEqual(main.scopes, previous.scopes);
  assert.equal(planned.variables.some((variable) => variable.name === "color/action/primary"), false);
  assert.equal(planned.variables.length, plan.variables.length);
});

test("a semantic token with no id names the path", () => {
  const broken = cloneTokens();
  delete broken.theme.light.color.focus.$extensions;
  assert.throws(
    () => planSemantic(broken),
    /plan-semantic: theme\.light\.color\.focus id is missing; expected sem-\[0-9a-f\]\{6\}/,
  );
});

test("a semantic id in the wrong format names the path", () => {
  const broken = cloneTokens();
  broken.theme.dark.color.focus.$extensions["com.cjhuang.camellia"].id = "sem-ABC123";
  assert.throws(
    () => planSemantic(broken),
    /plan-semantic: theme\.dark\.color\.focus id is "sem-ABC123"; expected sem-\[0-9a-f\]\{6\}/,
  );
});

test("light and dark ids that differ name the path", () => {
  const broken = cloneTokens();
  const id = unusedId(broken);
  broken.theme.dark.color.action.primary.$extensions["com.cjhuang.camellia"].id = id;
  assert.throws(
    () => planSemantic(broken),
    new RegExp(`plan-semantic: color/action/primary ids differ between Light \\(sem-[0-9a-f]{6}\\) and Dark \\(${id}\\)`),
  );
});

test("two semantic paths that share an id name both paths", () => {
  const broken = cloneTokens();
  const id = broken.theme.light.color.action.primary.$extensions["com.cjhuang.camellia"].id;
  broken.theme.light.color.focus.$extensions["com.cjhuang.camellia"].id = id;
  broken.theme.dark.color.focus.$extensions["com.cjhuang.camellia"].id = id;
  assert.throws(
    () => planSemantic(broken),
    new RegExp(`plan-semantic: color/focus reuses id "${id}" already used by color/action/primary`),
  );
});

test("a layout token with no id names the path", () => {
  const broken = cloneTokens();
  delete broken.layout["content-gap"].md.$extensions;
  assert.throws(
    () => planSemantic(broken),
    /plan-semantic: layout\.content-gap\.md id is missing; expected sem-\[0-9a-f\]\{6\}/,
  );
});

test("deferred border ids that differ name the path", () => {
  const broken = cloneTokens();
  const id = unusedId(broken);
  broken.theme.dark.border.subtle.$extensions["com.cjhuang.camellia"].id = id;
  assert.throws(
    () => planSemantic(broken),
    new RegExp(`plan-semantic: border/subtle ids differ between Light \\(sem-[0-9a-f]{6}\\) and Dark \\(${id}\\)`),
  );
});

test("descriptions are copied when both modes agree, and a disagreement fails", () => {
  const described = cloneTokens();
  described.theme.light.color.focus.$description = "Focus ring";
  described.theme.dark.color.focus.$description = "Focus ring";
  const focus = planSemantic(described).variables.find((variable) => variable.name === "color/focus");
  assert.equal(focus.description, "Focus ring");

  const broken = cloneTokens();
  broken.theme.light.color.focus.$description = "Focus ring";
  assert.throws(
    () => planSemantic(broken),
    /color\/focus descriptions disagree between modes/,
  );
});
