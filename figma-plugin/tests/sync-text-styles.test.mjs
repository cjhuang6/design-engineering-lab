import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PRIMITIVE_SHARED_ID_KEY,
  PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE,
  planPrimitives,
} from "../src/plan-primitives.ts";
import {
  TEXT_STYLE_SHARED_ID_KEY,
  TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE,
  planTextStyles,
} from "../src/plan-text-styles.ts";
import { syncTextStyles } from "../src/sync-text-styles.ts";
import { runTextStyleSync } from "../src/text-style-command.ts";

const tokens = JSON.parse(
  readFileSync(new URL("../../tokens/camellia.tokens.json", import.meta.url), "utf8"),
);
const plan = planTextStyles(tokens);
const primitivePlan = planPrimitives(tokens);
const primitiveCollection = primitivePlan.collectionName;

const DEFAULT_FONTS = [
  ["Geist", "Regular"],
  ["Geist", "Medium"],
  ["Geist", "SemiBold"],
  ["Geist Mono", "Regular"],
  ["Geist Mono", "Medium"],
  ["Geist Mono", "SemiBold"],
];

function createFakeFigma({ fonts = DEFAULT_FONTS, binding = "keep" } = {}) {
  let nextId = 1;
  const collections = [];
  const variables = [];
  const styles = [];
  const counts = {
    collectionsCreated: 0,
    variablesCreated: 0,
    stylesCreated: 0,
    propertyWrites: 0,
    boundWrites: 0,
    sharedPluginDataWrites: 0,
    fontLoads: 0,
    fontLists: 0,
  };

  const pluginDataStore = () => {
    const sharedPluginData = Object.create(null);
    return {
      getSharedPluginData(namespace, key) {
        const bucket = sharedPluginData[namespace];
        return bucket && key in bucket ? bucket[key] : "";
      },
      setSharedPluginData(namespace, key, value) {
        if (!sharedPluginData[namespace]) sharedPluginData[namespace] = Object.create(null);
        if (value === "") delete sharedPluginData[namespace][key];
        else sharedPluginData[namespace][key] = value;
      },
    };
  };

  const api = {
    variables: {
      async getLocalVariableCollectionsAsync() {
        return [...collections];
      },
      async getLocalVariablesAsync() {
        return [...variables];
      },
      createVariableCollection(name) {
        counts.collectionsCreated++;
        const collection = { id: `VariableCollectionId:${nextId++}`, name };
        collections.push(collection);
        return collection;
      },
      createVariable(name, collection, resolvedType) {
        counts.variablesCreated++;
        const pluginData = pluginDataStore();
        const variable = {
          id: `VariableID:${nextId++}`,
          name,
          resolvedType,
          variableCollectionId: collection.id,
          getSharedPluginData: pluginData.getSharedPluginData,
          setSharedPluginData: pluginData.setSharedPluginData,
        };
        variables.push(variable);
        return variable;
      },
    },
    async getLocalTextStylesAsync() {
      return [...styles];
    },
    createTextStyle() {
      counts.stylesCreated++;
      const pluginData = pluginDataStore();
      const bound = Object.create(null);
      let name = "";
      let fontSize = 12;
      let fontName = { family: "Inter", style: "Regular" };
      let lineHeight = { unit: "AUTO" };
      let letterSpacing = { unit: "PERCENT", value: 0 };
      let textCase = "ORIGINAL";
      const style = {
        id: `S:${nextId++}`,
        type: "TEXT",
        get name() {
          return name;
        },
        set name(value) {
          counts.propertyWrites++;
          name = value;
        },
        get fontSize() {
          return fontSize;
        },
        set fontSize(value) {
          counts.propertyWrites++;
          fontSize = value;
        },
        get fontName() {
          return fontName;
        },
        set fontName(value) {
          counts.propertyWrites++;
          fontName = value;
        },
        get lineHeight() {
          return lineHeight;
        },
        set lineHeight(value) {
          counts.propertyWrites++;
          lineHeight = value;
        },
        get letterSpacing() {
          return letterSpacing;
        },
        set letterSpacing(value) {
          counts.propertyWrites++;
          letterSpacing = value;
        },
        get textCase() {
          return textCase;
        },
        set textCase(value) {
          counts.propertyWrites++;
          textCase = value;
        },
        get boundVariables() {
          return { ...bound };
        },
        setBoundVariable(field, variable) {
          counts.boundWrites++;
          if (binding === "throw") throw new Error("Text style binding is not supported");
          if (binding === "drop") return;
          if (variable === null) {
            delete bound[field];
            return;
          }
          bound[field] = { type: "VARIABLE_ALIAS", id: variable.id };
        },
        getSharedPluginData: pluginData.getSharedPluginData,
        setSharedPluginData(namespace, key, value) {
          counts.sharedPluginDataWrites++;
          pluginData.setSharedPluginData(namespace, key, value);
        },
        remove() {
          throw new Error("text styles must not be deleted");
        },
      };
      styles.push(style);
      return style;
    },
    async listAvailableFontsAsync() {
      counts.fontLists++;
      return fonts.map(([family, style]) => ({ fontName: { family, style } }));
    },
    async loadFontAsync(fontName) {
      counts.fontLoads++;
      const found = fonts.some(([family, style]) => family === fontName.family && style === fontName.style);
      if (!found) throw new Error(`The font "${fontName.family} ${fontName.style}" could not be loaded`);
    },
  };

  return { api, counts, collections, variables, styles };
}

function seedFontVariables(fake) {
  const collection = fake.api.variables.createVariableCollection(primitiveCollection);
  for (const name of [
    "font/family/sans",
    "font/family/mono",
    "font/weight/regular",
    "font/weight/medium",
    "font/weight/semibold",
  ]) {
    const planned = primitivePlan.variables.find((variable) => variable.name === name);
    const variable = fake.api.variables.createVariable(name, collection, planned.type);
    variable.setSharedPluginData(
      PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE,
      PRIMITIVE_SHARED_ID_KEY,
      planned.id,
    );
  }
}

let fake;
beforeEach(() => {
  fake = createFakeFigma();
  seedFontVariables(fake);
  globalThis.figma = fake.api;
});

const sync = (dryRun = false, nextPlan = plan) =>
  syncTextStyles(nextPlan, { dryRun, primitiveCollectionName: primitiveCollection });
const find = (name) => fake.styles.find((style) => style.name === name);
const styleWrites = () => ({
  stylesCreated: fake.counts.stylesCreated,
  propertyWrites: fake.counts.propertyWrites,
  boundWrites: fake.counts.boundWrites,
  sharedPluginDataWrites: fake.counts.sharedPluginDataWrites,
  fontLoads: fake.counts.fontLoads,
  variablesCreated: fake.counts.variablesCreated,
});
const variableByPrimId = (id) =>
  fake.variables.find(
    (variable) =>
      variable.getSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY) === id,
  );

test("dry run on an empty file reports 13 creates and writes nothing", async () => {
  const report = await sync(true);

  assert.equal(report.dryRun, true);
  assert.equal(report.created.length, 13);
  assert.deepEqual(report.updated, []);
  assert.equal(report.unchanged, 0);
  assert.deepEqual(report.notInJson, []);
  assert.deepEqual(report.errors, []);
  assert.equal(fake.styles.length, 0);
  assert.equal(fake.counts.stylesCreated, 0);
  assert.equal(fake.counts.propertyWrites, 0);
  assert.equal(fake.counts.boundWrites, 0);
  assert.equal(fake.counts.sharedPluginDataWrites, 0);
  assert.equal(fake.counts.fontLoads, 0);
  assert.equal(fake.counts.fontLists, 1);
  assert.equal(fake.counts.variablesCreated, 5);
});

test("first sync creates the 13 styles, binds family and weight, and keeps the pixel line height", async () => {
  const report = await sync();

  assert.deepEqual(report.errors, []);
  assert.deepEqual(
    report.created,
    plan.styles.map((style) => style.name),
  );
  assert.equal(report.unchanged, 0);
  assert.deepEqual(report.notInJson, []);
  assert.equal(fake.styles.length, 13);
  assert.equal(fake.counts.variablesCreated, 5);
  assert.equal(fake.counts.fontLoads, 4);
  assert.equal(fake.counts.fontLists, 0);

  for (const planned of plan.styles) {
    const style = find(planned.name);
    const family = variableByPrimId(planned.fontFamilyId);
    const weight = variableByPrimId(planned.fontWeightId);
    assert.ok(style, planned.name);
    assert.ok(family, planned.fontFamilyVariable);
    assert.ok(weight, planned.fontWeightVariable);
    assert.equal(style.fontSize, planned.fontSize, planned.name);
    assert.deepEqual(style.lineHeight, { unit: "PIXELS", value: planned.lineHeight.value }, planned.name);
    assert.deepEqual(style.letterSpacing, { unit: "PERCENT", value: planned.letterSpacing.value }, planned.name);
    assert.deepEqual(style.fontName, { family: planned.fontFamilyName, style: planned.fontStyle }, planned.name);
    assert.equal(
      style.getSharedPluginData(TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE, TEXT_STYLE_SHARED_ID_KEY),
      planned.id,
      planned.name,
    );
    assert.equal(style.boundVariables.fontFamily.type, "VARIABLE_ALIAS", planned.name);
    assert.equal(style.boundVariables.fontFamily.id, family.id, planned.name);
    assert.equal(style.boundVariables.fontWeight.id, weight.id, planned.name);
  }
});

test("second sync is all unchanged and writes nothing", async () => {
  await sync();
  find("Camellia/Body/MD").textCase = "UPPER";
  const writes = styleWrites();
  const lists = fake.counts.fontLists;

  const report = await sync();

  assert.equal(report.unchanged, 13);
  assert.deepEqual(report.created, []);
  assert.deepEqual(report.updated, []);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.notInJson, []);
  assert.equal(fake.styles.length, 13);
  assert.deepEqual(styleWrites(), writes);
  assert.equal(fake.counts.fontLists, lists);
  assert.equal(find("Camellia/Body/MD").textCase, "UPPER");
});

test("a changed size updates the same style in place", async () => {
  await sync();
  const before = find("Camellia/Body/MD");
  const idBefore = before.id;
  const createdBefore = fake.counts.stylesCreated;

  const changed = structuredClone(tokens);
  changed.body.md.$value.fontSize = { value: 21, unit: "px" };
  changed.body.md.$extensions["com.cjhuang.camellia"].lineHeightPx = 32;
  const report = await sync(false, planTextStyles(changed));

  assert.equal(report.created.length, 0);
  assert.deepEqual(report.errors, []);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], new RegExp(`^Camellia/Body/MD \\[font size, line height\\] \\(${idBefore}\\)$`));
  assert.equal(fake.styles.length, 13);
  assert.equal(fake.counts.stylesCreated, createdBefore);
  assert.equal(find("Camellia/Body/MD").id, idBefore);
  assert.equal(find("Camellia/Body/MD").fontSize, 21);
  assert.deepEqual(find("Camellia/Body/MD").lineHeight, { unit: "PIXELS", value: 32 });
  assert.equal(find("Camellia/Body/SM").fontSize, 14);
});

test("a font binding that points at the wrong variable is repaired in place", async () => {
  await sync();
  const display = find("Camellia/Display/LG");
  const planned = plan.styles.find((style) => style.name === "Camellia/Display/LG");
  const mono = variableByPrimId(plan.styles.find((style) => style.name === "Camellia/Code/SM").fontFamilyId);
  display.setBoundVariable("fontFamily", mono);
  const idBefore = display.id;

  const report = await sync();

  assert.equal(report.created.length, 0);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], new RegExp(`^Camellia/Display/LG \\[font family binding\\] \\(${idBefore}\\)$`));
  assert.equal(display.id, idBefore);
  assert.equal(display.boundVariables.fontFamily.id, variableByPrimId(planned.fontFamilyId).id);
  assert.equal(display.fontName.style, "SemiBold");
});

test("dry run after a change reports the update and writes nothing", async () => {
  await sync();
  const body = find("Camellia/Body/MD");
  body.fontSize = 99;
  const writes = styleWrites();

  const report = await sync(true);

  assert.equal(report.dryRun, true);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], /^Camellia\/Body\/MD \[font size\]/);
  assert.equal(body.fontSize, 99);
  assert.deepEqual(styleWrites(), writes);
});

test("a Figma rename is restored to the planned name and keeps the style id", async () => {
  await sync();
  const body = find("Camellia/Body/MD");
  const idBefore = body.id;
  body.name = "Camellia/Body/Renamed";

  const report = await sync();

  assert.equal(report.created.length, 0);
  assert.deepEqual(report.notInJson, []);
  assert.match(report.updated[0], new RegExp(`^Camellia/Body/MD \\[name\\] \\(${idBefore}\\)$`));
  assert.equal(find("Camellia/Body/MD").id, idBefore);
  assert.equal(find("Camellia/Body/Renamed"), undefined);
});

test("a missing font is an error for that style and does not substitute another font", async () => {
  fake = createFakeFigma({
    fonts: [
      ["Geist", "Regular"],
      ["Geist Mono", "Regular"],
    ],
  });
  seedFontVariables(fake);
  globalThis.figma = fake.api;

  const dry = await sync(true);
  assert.deepEqual(dry.created, [
    "Camellia/Body/LG",
    "Camellia/Body/MD",
    "Camellia/Body/SM",
    "Camellia/Code/MD",
    "Camellia/Code/SM",
  ]);
  assert.equal(dry.errors.length, 8);
  assert.equal(fake.styles.length, 0);
  assert.equal(fake.counts.stylesCreated, 0);
  assert.equal(fake.counts.fontLoads, 0);
  assert.equal(fake.counts.propertyWrites, 0);

  const report = await sync();
  assert.deepEqual(report.created, dry.created);
  assert.equal(report.errors.length, 8);
  assert.equal(fake.styles.length, 5);

  const semi = report.errors.find((line) => line.startsWith("Camellia/Display/LG"));
  const medium = report.errors.find((line) => line.startsWith("Camellia/Label/MD"));
  assert.match(semi, /family "Geist"/);
  assert.match(semi, /style "SemiBold"/);
  assert.match(semi, /The family "Geist" has: Regular/);
  assert.match(semi, /No other font was substituted/);
  assert.match(medium, /family "Geist"/);
  assert.match(medium, /style "Medium"/);
  for (const line of report.errors) {
    assert.doesNotMatch(line, /Inter|system-ui|sans-serif/);
  }
  for (const style of fake.styles) {
    assert.notEqual(style.fontName.family, "Inter");
    assert.equal(style.fontName.style, "Regular");
  }
  assert.equal(fake.styles.some((style) => style.name.startsWith("Camellia/Display")), false);
  assert.equal(fake.styles.some((style) => style.name.startsWith("Camellia/Heading")), false);
  assert.equal(fake.styles.some((style) => style.name.startsWith("Camellia/Label")), false);
  assert.equal(fake.counts.fontLoads, 4);
});

test("a style that exists only in Figma is reported and kept", async () => {
  await sync();
  const scratch = fake.api.createTextStyle();
  scratch.name = "Camellia/Scratch";
  const idBefore = scratch.id;
  const createdBefore = fake.counts.stylesCreated;

  const report = await sync();

  assert.deepEqual(report.notInJson, ["Camellia/Scratch"]);
  assert.equal(report.unchanged, 13);
  assert.equal(fake.styles.length, 14);
  assert.equal(scratch.id, idBefore);
  assert.equal(scratch.name, "Camellia/Scratch");
  assert.equal(fake.counts.stylesCreated, createdBefore);
});

test("a JSON rename keeps the same style id when the type- id matches", async () => {
  await sync();
  const before = find("Camellia/Display/LG");
  const idBefore = before.id;
  const tokenId = before.getSharedPluginData(
    TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE,
    TEXT_STYLE_SHARED_ID_KEY,
  );
  const createdBefore = fake.counts.stylesCreated;

  const renamed = structuredClone(tokens);
  renamed.display.hero = renamed.display.lg;
  delete renamed.display.lg;
  const next = planTextStyles(renamed);
  const report = await sync(false, next);

  assert.equal(report.created.length, 0);
  assert.deepEqual(report.notInJson, []);
  assert.deepEqual(report.errors, []);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], new RegExp(`^Camellia/Display/HERO \\[name\\] \\(${idBefore}\\)$`));
  assert.equal(fake.styles.length, 13);
  assert.equal(fake.counts.stylesCreated, createdBefore);
  const after = find("Camellia/Display/HERO");
  assert.equal(after.id, idBefore);
  assert.equal(
    after.getSharedPluginData(TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE, TEXT_STYLE_SHARED_ID_KEY),
    tokenId,
  );
  assert.equal(find("Camellia/Display/LG"), undefined);

  const writes = styleWrites();
  const again = await sync(false, next);
  assert.equal(again.unchanged, 13);
  assert.deepEqual(again.updated, []);
  assert.deepEqual(styleWrites(), writes);
});

test("a dropped font binding keeps the plain font and the second run changes nothing", async () => {
  fake = createFakeFigma({ binding: "drop" });
  seedFontVariables(fake);
  globalThis.figma = fake.api;

  const report = await sync();
  const display = find("Camellia/Display/LG");

  assert.deepEqual(report.errors, []);
  assert.equal(report.created.length, 13);
  assert.deepEqual(display.fontName, { family: "Geist", style: "SemiBold" });
  assert.equal(display.fontSize, 48);
  assert.deepEqual(display.lineHeight, { unit: "PIXELS", value: 52 });
  assert.equal(display.boundVariables.fontFamily, undefined);
  assert.equal(display.boundVariables.fontWeight, undefined);
  assert.ok(fake.counts.boundWrites > 0);

  const writes = styleWrites();
  const again = await sync();
  assert.equal(again.unchanged, 13);
  assert.deepEqual(again.updated, []);
  assert.deepEqual(again.created, []);
  assert.deepEqual(styleWrites(), writes);
});

test("a thrown font binding falls back to the plain font and does not fail the style", async () => {
  fake = createFakeFigma({ binding: "throw" });
  seedFontVariables(fake);
  globalThis.figma = fake.api;

  const report = await sync();
  const display = find("Camellia/Display/LG");

  assert.deepEqual(report.errors, []);
  assert.equal(report.created.length, 13);
  assert.deepEqual(display.fontName, { family: "Geist", style: "SemiBold" });
  assert.equal(display.fontSize, 48);
  assert.equal(display.boundVariables.fontFamily, undefined);

  const writes = styleWrites();
  const again = await sync();
  assert.equal(again.unchanged, 13);
  assert.deepEqual(styleWrites(), writes);
});

test("an untagged style with the planned name is adopted and keeps its style id", async () => {
  const created = fake.api.createTextStyle();
  created.name = "Camellia/Body/MD";
  created.fontName = { family: "Geist", style: "Regular" };
  created.fontSize = 16;
  created.lineHeight = { unit: "PIXELS", value: 24 };
  created.letterSpacing = { unit: "PERCENT", value: 0 };
  const idBefore = created.id;
  const planned = plan.styles.find((style) => style.name === "Camellia/Body/MD");

  const report = await sync();

  assert.equal(report.created.includes("Camellia/Body/MD"), false);
  assert.equal(report.created.length, 12);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], /^Camellia\/Body\/MD \[font family binding, font weight binding, token id\]/);
  assert.equal(fake.styles.length, 13);
  assert.equal(find("Camellia/Body/MD").id, idBefore);
  assert.equal(
    created.getSharedPluginData(TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE, TEXT_STYLE_SHARED_ID_KEY),
    planned.id,
  );
  assert.equal(created.boundVariables.fontFamily.id, variableByPrimId(planned.fontFamilyId).id);
  assert.equal(created.boundVariables.fontWeight.id, variableByPrimId(planned.fontWeightId).id);
});

test("renaming the JSON before the id is stored leaves the old style and creates the new name", async () => {
  await sync();
  const before = find("Camellia/Display/LG");
  const idBefore = before.id;
  before.setSharedPluginData(TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE, TEXT_STYLE_SHARED_ID_KEY, "");
  const createdBefore = fake.counts.stylesCreated;

  const renamed = structuredClone(tokens);
  renamed.display.hero = renamed.display.lg;
  delete renamed.display.lg;
  const report = await sync(false, planTextStyles(renamed));

  assert.deepEqual(report.created, ["Camellia/Display/HERO"]);
  assert.deepEqual(report.notInJson, ["Camellia/Display/LG"]);
  assert.equal(fake.styles.length, 14);
  assert.equal(fake.counts.stylesCreated, createdBefore + 1);
  assert.equal(before.id, idBefore);
  assert.equal(before.name, "Camellia/Display/LG");
  assert.notEqual(find("Camellia/Display/HERO").id, idBefore);
});

test("a rename that would take another style's name throws before any write", async () => {
  await sync();
  const original = find("Camellia/Display/LG");
  const blocker = fake.api.createTextStyle();
  blocker.name = "Camellia/Display/HERO";
  const writes = styleWrites();

  const renamed = structuredClone(tokens);
  renamed.display.hero = renamed.display.lg;
  delete renamed.display.lg;

  await assert.rejects(
    sync(false, planTextStyles(renamed)),
    /setting Camellia\/Display\/HERO would collide with another text style/,
  );

  assert.equal(original.name, "Camellia/Display/LG");
  assert.equal(blocker.name, "Camellia/Display/HERO");
  assert.equal(fake.styles.length, 14);
  assert.deepEqual(styleWrites(), writes);
});

test("two text styles with the same token id throw before any write", async () => {
  await sync();
  const original = find("Camellia/Display/LG");
  const tokenId = original.getSharedPluginData(
    TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE,
    TEXT_STYLE_SHARED_ID_KEY,
  );
  const extra = fake.api.createTextStyle();
  extra.name = "Camellia/Scratch";
  extra.setSharedPluginData(TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE, TEXT_STYLE_SHARED_ID_KEY, tokenId);
  const writes = styleWrites();

  await assert.rejects(sync(), new RegExp(`two text styles have id "${tokenId}"`));

  assert.equal(original.name, "Camellia/Display/LG");
  assert.equal(fake.styles.length, 14);
  assert.deepEqual(styleWrites(), writes);
});

test("font variables are found by prim- id, and a missing id throws before any write", async () => {
  for (const variable of fake.variables) {
    variable.setSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY, "");
  }
  const writes = styleWrites();

  await assert.rejects(sync(), (error) => {
    assert.match(error.message, /Text Style font variables are missing from "Primitives"/);
    assert.match(error.message, /font\/family\/sans exists but its id is "missing"/);
    assert.match(error.message, /font\/family\/mono exists but its id is "missing"/);
    assert.match(error.message, /font\/weight\/regular exists but its id is "missing"/);
    assert.match(error.message, /font\/weight\/medium exists but its id is "missing"/);
    assert.match(error.message, /font\/weight\/semibold exists but its id is "missing"/);
    return true;
  });

  assert.equal(fake.styles.length, 0);
  assert.equal(fake.counts.fontLoads, 0);
  assert.deepEqual(styleWrites(), writes);
});

test("no primitive collection throws before any text style is written", async () => {
  fake.collections.length = 0;
  fake.variables.length = 0;

  await assert.rejects(
    sync(),
    /no collection is named "Primitives", so Text Styles have no font variables to bind/,
  );
  assert.equal(fake.styles.length, 0);
  assert.equal(fake.counts.stylesCreated, 0);
  assert.equal(fake.counts.fontLoads, 0);
});

const DRY_RUN_TOAST =
  "Camellia · Text Styles (dry run) · Would create 13 · Would update 0 · Unchanged 0 · Not in JSON 0 · Errors 0";
const APPLY_TOAST =
  "Camellia · Text Styles · Created 13 · Updated 0 · Unchanged 0 · Not in JSON 0 · Errors 0";

async function captureCommand(dryRun) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => {
    lines.push(args.map((part) => String(part)).join(" "));
  };
  try {
    const message = await runTextStyleSync(tokens, dryRun);
    return { message, log: lines.join("\n") };
  } finally {
    console.log = original;
  }
}

test("the manifest registers the Text Style commands after Semantic", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const commands = manifest.menu
    .filter((item) => item.command)
    .map((item) => ({ name: item.name, command: item.command }));
  const semantic = commands.findIndex((item) => item.command === "sync-semantic");
  assert.ok(semantic > 0);
  assert.deepEqual(commands.slice(semantic + 1), [
    { name: "Sync Text Styles — dry run", command: "sync-text-styles-dry-run" },
    { name: "Sync Text Styles", command: "sync-text-styles" },
  ]);
});

test("the plugin entry dispatches dry run and apply to the Text Style command", () => {
  const source = readFileSync(new URL("../code.ts", import.meta.url), "utf8");
  assert.match(source, /"sync-text-styles-dry-run": \(\) => syncTextStylesCommand\(true\)/);
  assert.match(source, /"sync-text-styles": \(\) => syncTextStylesCommand\(false\)/);
  assert.match(source, /return runTextStyleSync\(tokens, dryRun\)/);
});

test("the dry-run command reports 13 creates and writes nothing", async () => {
  const { message, log } = await captureCommand(true);

  assert.equal(message, DRY_RUN_TOAST);
  assert.match(log, /Camellia · Sync Text Styles — DRY RUN, nothing changed/);
  assert.match(log, /Would create \(13\)/);
  assert.match(log, /Camellia\/Display\/LG/);
  assert.match(log, /Camellia\/Code\/SM/);
  assert.doesNotMatch(log, /^Created \(/m);
  assert.equal(fake.styles.length, 0);
  assert.equal(fake.counts.stylesCreated, 0);
  assert.equal(fake.counts.propertyWrites, 0);
  assert.equal(fake.counts.boundWrites, 0);
  assert.equal(fake.counts.sharedPluginDataWrites, 0);
  assert.equal(fake.counts.fontLoads, 0);
  assert.equal(fake.counts.fontLists, 1);
});

test("the apply command creates the 13 styles", async () => {
  const { message, log } = await captureCommand(false);

  assert.equal(message, APPLY_TOAST);
  assert.match(log, /Camellia · Sync Text Styles$/m);
  assert.doesNotMatch(log, /DRY RUN/);
  assert.match(log, /Created \(13\)/);
  assert.equal(fake.styles.length, 13);
  assert.equal(fake.counts.stylesCreated, 13);
  assert.equal(fake.counts.fontLoads, 4);
  assert.equal(find("Camellia/Display/LG").fontName.style, "SemiBold");
  assert.equal(find("Camellia/Label/MD").fontName.style, "Medium");
  assert.equal(find("Camellia/Body/MD").fontName.style, "Regular");
  assert.equal(find("Camellia/Code/SM").fontName.family, "Geist Mono");
});

test("running the apply command again reports a no-op and writes nothing", async () => {
  await runTextStyleSync(tokens, false);
  const writes = styleWrites();

  const { message, log } = await captureCommand(false);

  assert.equal(
    message,
    "Camellia · Text Styles · Created 0 · Updated 0 · Unchanged 13 · Not in JSON 0 · Errors 0",
  );
  assert.match(log, /Unchanged: 13/);
  assert.doesNotMatch(log, /^(Created|Updated) \(/m);
  assert.equal(fake.styles.length, 13);
  assert.deepEqual(styleWrites(), writes);
});

test("the dry-run command reports an update and leaves the style unchanged", async () => {
  await runTextStyleSync(tokens, false);
  const body = find("Camellia/Body/MD");
  body.fontSize = 99;
  const writes = styleWrites();

  const { message, log } = await captureCommand(true);

  assert.equal(
    message,
    "Camellia · Text Styles (dry run) · Would create 0 · Would update 1 · Unchanged 12 · Not in JSON 0 · Errors 0",
  );
  assert.match(log, /Would update \(1\)/);
  assert.match(log, /Camellia\/Body\/MD \[font size\]/);
  assert.match(log, /DRY RUN, nothing changed/);
  assert.equal(body.fontSize, 99);
  assert.deepEqual(styleWrites(), writes);
  assert.equal(fake.counts.fontLoads, writes.fontLoads);
});

test("the dry-run command reports a missing font and writes nothing", async () => {
  fake = createFakeFigma({
    fonts: [
      ["Geist", "Regular"],
      ["Geist Mono", "Regular"],
    ],
  });
  seedFontVariables(fake);
  globalThis.figma = fake.api;

  const { message, log } = await captureCommand(true);

  assert.match(
    message,
    /^Camellia · Text Styles \(dry run\) · Would create 5 · Would update 0 · Unchanged 0 · Not in JSON 0 · Errors 8$/,
  );
  assert.match(log, /DRY RUN, nothing changed/);
  assert.match(log, /family "Geist"/);
  assert.match(log, /style "SemiBold"/);
  assert.match(log, /style "Medium"/);
  assert.match(log, /No other font was substituted/);
  assert.equal(fake.styles.length, 0);
  assert.equal(fake.counts.stylesCreated, 0);
  assert.equal(fake.counts.fontLoads, 0);
  assert.equal(fake.counts.propertyWrites, 0);
});
