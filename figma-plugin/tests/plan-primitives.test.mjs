import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  planPrimitives,
  PRIMITIVE_SHARED_ID_KEY,
  PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE,
} from "../src/plan-primitives.ts";

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const tokens = readJson("../../tokens/camellia.tokens.json");
const tokensCss = readFileSync(new URL("../../src/styles/tokens.css", import.meta.url), "utf8");

const plan = planPrimitives(tokens);
const byName = new Map(plan.variables.map((v) => [v.name, v]));
const get = (name) => {
  const variable = byName.get(name);
  assert.ok(variable, `${name} should be planned`);
  return variable;
};
const withPrefix = (prefix) => plan.variables.filter((v) => v.name.startsWith(prefix));

/** A deep copy of the canonical tokens, so a test can break one value. */
const cloneTokens = () => structuredClone(tokens);

test("targets the Primitives collection with one Value mode", () => {
  assert.equal(plan.collectionName, "Primitives");
  assert.equal(plan.modeName, "Value");
});

test("plans the expected number of variables per group", () => {
  const expected = {
    "color/base/": 2,
    "color/primitive/ice/": 11,
    "color/primitive/blue/": 11,
    "color/primitive/green/": 10,
    "color/primitive/pink/": 10,
    "color/primitive/alpha/": 4,
    "feedback/": 4,
    "font/family/": 2,
    "font/weight/": 3,
    "space/": 13,
    "radius/": 6,
    "border/width/": 3,
    "opacity/": 4,
    "blur/": 4,
    "size/": 9,
    "breakpoint/": 4,
    "duration/": 6,
    "ease/": 4,
  };
  for (const [prefix, count] of Object.entries(expected)) {
    assert.equal(withPrefix(prefix).length, count, prefix);
  }
  const total = Object.values(expected).reduce((sum, n) => sum + n, 0);
  assert.equal(plan.variables.length, total);
  assert.equal(total, 110);
});

test("every variable name is unique", () => {
  assert.equal(byName.size, plan.variables.length);
});

test("every primitive variable has a unique permanent id", () => {
  assert.equal(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, "com.cjhuang.camellia");
  assert.equal(PRIMITIVE_SHARED_ID_KEY, "id");
  const ids = plan.variables.map((variable) => variable.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 110);
  const semanticIds = new Set();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const id = node.$extensions?.["com.cjhuang.camellia"]?.id;
    if (typeof id === "string" && id.startsWith("sem-")) semanticIds.add(id);
    for (const value of Object.values(node)) walk(value);
  };
  walk(tokens);
  for (const variable of plan.variables) {
    assert.match(variable.id, /^prim-[0-9a-f]{6}$/, variable.name);
    assert.equal(semanticIds.has(variable.id), false, variable.name);
    assert.equal(nodeAt(tokens, variable.name).$extensions["com.cjhuang.camellia"].id, variable.id, variable.name);
  }
});

function nodeAt(root, name) {
  let node = root;
  for (const part of name.split("/")) node = node[part];
  return node;
}

test("excluded groups never become Primitives variables", () => {
  const excluded = [
    "theme/", "layout/", "control/",
    "display/", "heading/", "body/", "label/", "code/", "tracking/",
    "shadow/", "frost/", "expression/", "z/", "border/style/",
  ];
  for (const prefix of excluded) {
    assert.deepEqual(withPrefix(prefix), [], prefix);
  }
});

test("a token in an unknown group fails the plan instead of being dropped", () => {
  const broken = cloneTokens();
  broken.mystery = { thing: { $type: "number", $value: 1 } };
  assert.throws(() => planPrimitives(broken), /mystery\.thing is in no RULES or EXCLUDED group/);
});

test("a reference inside a primitive group fails the plan", () => {
  const broken = cloneTokens();
  broken.space["4"].$value = "{space.2}";
  assert.throws(() => planPrimitives(broken), /space\.4 is a reference/);
});

test("color components match each token's hex, and alpha is carried", () => {
  const colors = plan.variables.filter((v) => v.type === "COLOR");
  assert.equal(colors.length, 52);

  const toHex = ({ r, g, b }) =>
    "#" + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

  for (const variable of colors) {
    const source = variable.name.split("/").reduce((node, key) => node[key], tokens);
    assert.equal(toHex(variable.value), source.$value.hex, variable.name);
  }

  assert.equal(get("color/primitive/blue/600").value.a, 1);
  assert.equal(get("color/primitive/alpha/blue-400/18").value.a, 0.18);
  assert.equal(get("color/primitive/alpha/green-400/12").value.a, 0.12);
});

test("px dimensions become plain numbers", () => {
  assert.deepEqual([get("space/4").type, get("space/4").value], ["FLOAT", 16]);
  assert.equal(get("radius/full").value, 9999);
  assert.equal(get("border/width/1").value, 1);
  assert.equal(get("blur/md").value, 12);
  assert.equal(get("size/control/md").value, 40);
  assert.equal(get("breakpoint/lg").value, 1024);
});

test("a non-px dimension fails the plan instead of guessing", () => {
  const broken = cloneTokens();
  broken.space["4"].$value = { value: 1, unit: "rem" };
  assert.throws(() => planPrimitives(broken), /space\.4 must be a px dimension/);
});

test("opacity ratios become Figma percentages", () => {
  assert.equal(get("opacity/disabled").value, 40);
  assert.equal(get("opacity/muted").value, 64);
  assert.equal(get("opacity/soft").value, 80);
  assert.equal(get("opacity/full").value, 100);
});

test("typography primitives use Figma's text and number types", () => {
  assert.deepEqual([get("font/family/sans").type, get("font/family/sans").value], ["STRING", "Geist"]);
  assert.equal(get("font/family/mono").value, "Geist Mono");
  assert.deepEqual([get("font/weight/semibold").type, get("font/weight/semibold").value], ["FLOAT", 600]);
});

test("durations become TIMING variables in seconds", () => {
  assert.deepEqual([get("duration/fast").type, get("duration/fast").value], ["TIMING", 0.1]);
  assert.equal(get("duration/normal").value, 0.2);
  assert.equal(get("duration/expression-lg").value, 0.9);
});

test("easing curves become EASING variables with a custom cubic-bezier", () => {
  const standard = get("ease/standard");
  assert.equal(standard.type, "EASING");
  assert.deepEqual(standard.value, {
    type: "CUSTOM_CUBIC_BEZIER",
    easingFunctionCubicBezier: { x1: 0.4, y1: 0, x2: 0.2, y2: 1 },
  });
  assert.deepEqual(get("ease/enter").value.easingFunctionCubicBezier, { x1: 0.16, y1: 1, x2: 0.3, y2: 1 });
});

test("scopes match the agreed picker visibility", () => {
  const scopesOf = (prefix) => [...new Set(withPrefix(prefix).map((v) => JSON.stringify(v.scopes)))];

  assert.deepEqual(scopesOf("color/"), ["[]"], "primitive colors are hidden from pickers");
  assert.deepEqual(scopesOf("feedback/"), [JSON.stringify(["ALL_FILLS", "STROKE_COLOR"])]);
  assert.deepEqual(scopesOf("font/family/"), [JSON.stringify(["FONT_FAMILY"])]);
  assert.deepEqual(scopesOf("font/weight/"), [JSON.stringify(["FONT_WEIGHT"])]);
  assert.deepEqual(scopesOf("space/"), [JSON.stringify(["GAP"])]);
  assert.deepEqual(scopesOf("radius/"), [JSON.stringify(["CORNER_RADIUS"])]);
  assert.deepEqual(scopesOf("border/width/"), [JSON.stringify(["STROKE_FLOAT"])]);
  assert.deepEqual(scopesOf("opacity/"), [JSON.stringify(["OPACITY"])]);
  assert.deepEqual(scopesOf("blur/"), [JSON.stringify(["EFFECT_FLOAT"])]);
  assert.deepEqual(scopesOf("size/"), [JSON.stringify(["WIDTH_HEIGHT"])]);
  assert.deepEqual(scopesOf("breakpoint/"), [JSON.stringify(["WIDTH_HEIGHT"])]);
  assert.deepEqual(scopesOf("duration/"), ["null"], "motion keeps Figma's default scopes");
  assert.deepEqual(scopesOf("ease/"), ["null"], "motion keeps Figma's default scopes");
});

test("every WEB code syntax names a variable that exists in tokens.css", () => {
  for (const variable of plan.variables) {
    const match = variable.webSyntax.match(/^var\((--[\w-]+)\)$/);
    assert.ok(match, `${variable.name} code syntax should look like var(--…)`);
    const declaration = new RegExp(`^\\s*${match[1]}:`, "m");
    assert.match(tokensCss, declaration, `${match[1]} is not declared in tokens.css`);
  }
  assert.equal(get("color/primitive/blue/600").webSyntax, "var(--color-primitive-blue-600)");
});

test("a primitive with no id names the path", () => {
  const broken = cloneTokens();
  delete broken.space["4"].$extensions;
  assert.throws(
    () => planPrimitives(broken),
    /plan-primitives: space\.4 id is missing; expected prim-\[0-9a-f\]\{6\}/,
  );
});

test("a primitive id in the wrong format names the path", () => {
  const broken = cloneTokens();
  broken.space["4"].$extensions["com.cjhuang.camellia"].id = "prim-ABC123";
  assert.throws(
    () => planPrimitives(broken),
    /plan-primitives: space\.4 id is "prim-ABC123"; expected prim-\[0-9a-f\]\{6\}/,
  );
});

test("a semantic id on a primitive names the path", () => {
  const broken = cloneTokens();
  broken.space["4"].$extensions["com.cjhuang.camellia"].id = "sem-4c4a41";
  assert.throws(
    () => planPrimitives(broken),
    /plan-primitives: space\.4 id is "sem-4c4a41"; expected prim-\[0-9a-f\]\{6\}/,
  );
});

test("two primitives that share an id name both paths", () => {
  const broken = cloneTokens();
  const [first, second] = plan.variables.filter((variable) => variable.name.startsWith("space/"));
  nodeAt(broken, second.name).$extensions["com.cjhuang.camellia"].id = first.id;
  assert.throws(
    () => planPrimitives(broken),
    new RegExp(`plan-primitives: ${second.name} reuses id "${first.id}" already used by ${first.name}`),
  );
});

test("a primitive id copied onto another token fails", () => {
  const broken = cloneTokens();
  const id = get("color/base/white").id;
  broken.shadow.none.$extensions["com.cjhuang.camellia"].id = id;
  assert.throws(
    () => planPrimitives(broken),
    new RegExp(`plan-primitives: color/base/white reuses id "${id}" already used by shadow/none`),
  );
});

test("renaming a primitive path keeps its id", () => {
  const renamed = cloneTokens();
  const previous = get("color/primitive/blue/600");
  renamed.color.primitive.blue.action = renamed.color.primitive.blue["600"];
  delete renamed.color.primitive.blue["600"];

  const planned = planPrimitives(renamed);
  const action = planned.variables.find((variable) => variable.name === "color/primitive/blue/action");
  assert.ok(action);
  assert.equal(action.id, previous.id);
  assert.equal(planned.variables.some((variable) => variable.name === "color/primitive/blue/600"), false);
  assert.equal(planned.variables.length, plan.variables.length);
});

test("token descriptions are copied to Figma", () => {
  assert.equal(
    get("color/primitive/blue/600").description,
    "Default accessible solid action blue with white text (~4.5:1).",
  );
  assert.equal(get("space/4").description, "");
});
