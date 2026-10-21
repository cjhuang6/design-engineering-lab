import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { figmaTargets } from "../src/dtcg.ts";
import { planPrimitives } from "../src/plan-primitives.ts";
import { planSemantic } from "../src/plan-semantic.ts";
import { syncPrimitives } from "../src/sync-primitives.ts";
import { syncSemantic } from "../src/sync-semantic.ts";

const tokens = JSON.parse(
  readFileSync(new URL("../../tokens/camellia.tokens.json", import.meta.url), "utf8"),
);
const primitivesPlan = planPrimitives(tokens);
const semanticPlan = planSemantic(tokens);
const primitiveCollectionName = figmaTargets(tokens).primitiveCollection;

/**
 * Stand-in for the Figma variables calls both syncs make.
 *
 * Documented behavior this fake follows:
 * - createVariableAlias returns { type: "VARIABLE_ALIAS", id }
 *   https://developers.figma.com/docs/plugins/api/VariableAlias/
 * - valuesByMode stores that alias and does not resolve it
 *   https://developers.figma.com/docs/plugins/api/Variable/ (valuesByMode)
 * - getPluginData returns "" when the key is absent, and setPluginData(key, "")
 *   removes the key (PluginDataMixin in @figma/plugin-typings)
 * - addMode returns the new mode id. When modeLimit is set, it throws
 *   "in addMode: Limited to N modes only"
 *   https://developers.figma.com/docs/plugins/api/VariableCollection/ (addMode)
 *   A real file's pricing tier is not known here, so the limit is opt-in.
 *
 * Not re-confirmed in the Camellia file (copied from the primitives fake and
 * from Figma's variable guide, https://github.com/figma/mcp-server-guide/blob/main/skills/figma-use/references/variable-patterns.md):
 * - A new collection starts as one mode named "Mode 1". addMode appends, and
 *   defaultModeId stays on that first mode. The authoring example renames
 *   modes[0] and then calls addMode
 *   (https://developers.figma.com/docs/plugins/working-with-variables/).
 * - A new variable's scopes start as ["ALL_SCOPES"].
 * - Numbers are stored with Math.fround, as in sync-primitives.test.mjs.
 *
 * Not modeled: alias resolution, the mode picker, variableIds, extended
 * collections, and the 100 kB plugin-data cap. Tests assign valuesByMode
 * directly to stand in for a value Figma already stored; the real property
 * is readonly.
 */
function createFakeFigma() {
  let nextId = 1;
  const collections = [];
  const variables = [];
  const counts = {
    collectionsCreated: 0,
    modesAdded: 0,
    modesRenamed: 0,
    variablesCreated: 0,
    valueWrites: 0,
    codeSyntaxWrites: 0,
    pluginDataWrites: 0,
    primitiveValueWrites: 0,
  };

  const lowPrecision = (value) => {
    if (typeof value === "number") return Math.fround(value);
    if (value && typeof value === "object" && "r" in value) {
      return {
        r: Math.fround(value.r),
        g: Math.fround(value.g),
        b: Math.fround(value.b),
        a: Math.fround(value.a ?? 1),
      };
    }
    return structuredClone(value);
  };

  const fake = {
    modeLimit: null,
    counts,
    collections,
    variables,
    variables_api: {
      async getLocalVariableCollectionsAsync() {
        return [...collections];
      },
      async getLocalVariablesAsync() {
        return [...variables];
      },
      createVariableAlias(variable) {
        return { type: "VARIABLE_ALIAS", id: variable.id };
      },
      createVariableCollection(name) {
        counts.collectionsCreated++;
        const modeId = `mode:${nextId++}`;
        const collection = {
          id: `VariableCollectionId:${nextId++}`,
          name,
          defaultModeId: modeId,
          modes: [{ modeId, name: "Mode 1" }],
          renameMode(targetId, newName) {
            counts.modesRenamed++;
            this.modes = this.modes.map((mode) =>
              mode.modeId === targetId ? { ...mode, name: newName } : mode,
            );
          },
          addMode(modeName) {
            if (fake.modeLimit !== null && this.modes.length >= fake.modeLimit) {
              throw new Error(`in addMode: Limited to ${fake.modeLimit} modes only`);
            }
            counts.modesAdded++;
            const addedId = `mode:${nextId++}`;
            this.modes = [...this.modes, { modeId: addedId, name: modeName }];
            return addedId;
          },
        };
        collections.push(collection);
        return collection;
      },
      createVariable(name, collection, resolvedType) {
        counts.variablesCreated++;
        const pluginData = Object.create(null);
        const variable = {
          id: `VariableID:${nextId++}`,
          name,
          resolvedType,
          variableCollectionId: collection.id,
          valuesByMode: {},
          scopes: ["ALL_SCOPES"],
          codeSyntax: {},
          description: "",
          setValueForMode(modeId, value) {
            counts.valueWrites++;
            const owner = collections.find((item) => item.id === this.variableCollectionId);
            if (owner?.name === primitiveCollectionName) counts.primitiveValueWrites++;
            this.valuesByMode[modeId] = lowPrecision(value);
          },
          setVariableCodeSyntax(platform, value) {
            counts.codeSyntaxWrites++;
            this.codeSyntax[platform] = value;
          },
          getPluginData(key) {
            return key in pluginData ? pluginData[key] : "";
          },
          setPluginData(key, value) {
            counts.pluginDataWrites++;
            if (value === "") delete pluginData[key];
            else pluginData[key] = value;
          },
        };
        variables.push(variable);
        return variable;
      },
    },
  };
  return fake;
}

let fake;
beforeEach(() => {
  fake = createFakeFigma();
  globalThis.figma = { variables: fake.variables_api };
});

const sync = (dryRun = false, plan = semanticPlan) =>
  syncSemantic(plan, { dryRun, primitiveCollectionName });

const snapshotCounts = () => ({ ...fake.counts });
const semanticCollection = () => fake.collections.find((collection) => collection.name === semanticPlan.collectionName);
const semanticVariables = () => {
  const collection = semanticCollection();
  if (!collection) return [];
  return fake.variables.filter((variable) => variable.variableCollectionId === collection.id);
};
const primitiveVariables = () => {
  const collection = fake.collections.find((item) => item.name === primitiveCollectionName);
  if (!collection) return [];
  return fake.variables.filter((variable) => variable.variableCollectionId === collection.id);
};
const findSemantic = (name) => semanticVariables().find((variable) => variable.name === name);
const findPrimitive = (name) => primitiveVariables().find((variable) => variable.name === name);
const modeId = (name) => semanticCollection().modes.find((mode) => mode.name === name).modeId;

async function seedPrimitives() {
  await syncPrimitives(primitivesPlan, { dryRun: false });
}

function removeVariables(ids) {
  for (let index = fake.variables.length - 1; index >= 0; index--) {
    if (ids.has(fake.variables[index].id)) fake.variables.splice(index, 1);
  }
}

function primitiveNamedInPlan(type) {
  const row = semanticPlan.variables.find((variable) => variable.type === type);
  assert.ok(row, `semantic plan has no ${type} row`);
  const modeName = semanticPlan.modeNames[0];
  const primitiveName = row.aliases[modeName];
  assert.equal(typeof primitiveName, "string", `${row.name} ${modeName}`);
  return primitiveName;
}

test("dry run on an empty semantic collection reports 41 creates and writes nothing", async () => {
  await seedPrimitives();
  const counts = snapshotCounts();

  const report = await sync(true);

  assert.equal(report.dryRun, true);
  assert.equal(report.collectionCreated, true);
  assert.equal(report.created.length, 41);
  assert.deepEqual(report.updated, []);
  assert.equal(report.unchanged, 0);
  assert.deepEqual(report.notInJson, []);
  assert.deepEqual(report.errors, []);
  assert.equal(semanticCollection(), undefined);
  assert.deepEqual(snapshotCounts(), counts);
});

test("first sync creates Semantic with Light then Dark and 41 aliases", async () => {
  await seedPrimitives();
  const report = await sync();

  assert.equal(report.created.length, 41);
  assert.deepEqual(report.updated, []);
  assert.deepEqual(report.errors, []);
  assert.equal(report.collectionCreated, true);

  const collection = semanticCollection();
  assert.ok(collection);
  assert.deepEqual(
    collection.modes.map((mode) => mode.name),
    ["Light", "Dark"],
  );
  assert.equal(collection.defaultModeId, collection.modes[0].modeId);
  assert.equal(semanticVariables().length, 41);

  for (const planned of semanticPlan.variables) {
    const variable = findSemantic(planned.name);
    assert.ok(variable, planned.name);
    assert.equal(variable.resolvedType, planned.type, planned.name);
    assert.deepEqual(variable.scopes, planned.scopes, planned.name);
    assert.equal(variable.codeSyntax.WEB, planned.webSyntax, planned.name);
    assert.equal(variable.description, "", planned.name);
    assert.equal(variable.getPluginData("token"), planned.name, planned.name);
    for (const [modeName, primitiveName] of Object.entries(planned.aliases)) {
      assert.deepEqual(
        variable.valuesByMode[modeId(modeName)],
        { type: "VARIABLE_ALIAS", id: findPrimitive(primitiveName).id },
        `${planned.name} ${modeName}`,
      );
    }
  }

  const pink = findSemantic("color/expression/pink");
  const pinkTarget = findPrimitive("color/primitive/pink/400").id;
  assert.equal(pink.valuesByMode[modeId("Light")].id, pinkTarget);
  assert.equal(pink.valuesByMode[modeId("Dark")].id, pinkTarget);

  const darkAlpha = [
    ["color/border/subtle", "color/primitive/alpha/blue-400/18"],
    ["color/border/default", "color/primitive/alpha/blue-400/30"],
    ["color/border/strong", "color/primitive/alpha/blue-400/50"],
    ["color/functional/surface", "color/primitive/alpha/green-400/12"],
  ];
  for (const [semanticName, primitiveName] of darkAlpha) {
    assert.equal(
      findSemantic(semanticName).valuesByMode[modeId("Dark")].id,
      findPrimitive(primitiveName).id,
      semanticName,
    );
  }
});

test("second sync creates nothing, updates nothing, and does not write", async () => {
  await seedPrimitives();
  await sync();
  const counts = snapshotCounts();

  const report = await sync();

  assert.equal(report.created.length, 0);
  assert.deepEqual(report.updated, []);
  assert.equal(report.unchanged, 41);
  assert.deepEqual(report.notInJson, []);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(snapshotCounts(), counts);
});

test("changing a token reference updates that column on the same variable id", async () => {
  await seedPrimitives();
  await sync();
  const before = findSemantic("color/action/primary");
  const idBefore = before.id;

  const changed = structuredClone(tokens);
  changed.theme.light.color.action.primary.$value = "{color.primitive.blue.500}";
  const report = await sync(false, planSemantic(changed));

  assert.equal(report.created.length, 0);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], /^color\/action\/primary \[Light value\] \(VariableID:/);
  const after = findSemantic("color/action/primary");
  assert.equal(after.id, idBefore);
  assert.equal(semanticVariables().length, 41);
  assert.equal(after.valuesByMode[modeId("Light")].id, findPrimitive("color/primitive/blue/500").id);
  assert.equal(after.valuesByMode[modeId("Dark")].id, findPrimitive("color/primitive/blue/400").id);
});

test("a raw color sitting in Figma is replaced by the alias", async () => {
  await seedPrimitives();
  await sync();
  const variable = findSemantic("color/surface/primary");
  const light = modeId("Light");
  variable.valuesByMode[light] = { r: 1, g: 0, b: 0, a: 1 };

  const report = await sync();

  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], /^color\/surface\/primary \[Light value\] \(VariableID:/);
  assert.deepEqual(variable.valuesByMode[light], {
    type: "VARIABLE_ALIAS",
    id: findPrimitive("color/base/white").id,
  });
  assert.match(report.updated[0], new RegExp(`\\(${variable.id}\\)$`));
});

test("dry run reports drifted values and writes nothing", async () => {
  await seedPrimitives();
  await sync();
  const variable = findSemantic("color/action/primary");
  const light = modeId("Light");
  variable.valuesByMode[light] = { r: 0, g: 1, b: 0, a: 1 };
  const counts = snapshotCounts();

  const report = await sync(true);

  assert.equal(report.collectionCreated, false);
  assert.deepEqual(report.created, []);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], /^color\/action\/primary \[Light value\] /);
  assert.deepEqual(variable.valuesByMode[light], { r: 0, g: 1, b: 0, a: 1 });
  assert.deepEqual(snapshotCounts(), counts);
});

test("drifted scopes, code syntax, and description are repaired", async () => {
  await seedPrimitives();
  await sync();
  findSemantic("color/text/primary").scopes = ["ALL_SCOPES"];
  findSemantic("layout/content-gap/md").setVariableCodeSyntax("WEB", "var(--wrong)");
  findSemantic("color/focus").description = "edited in Figma";

  const report = await sync();

  assert.equal(report.updated.length, 3);
  assert.deepEqual(findSemantic("color/text/primary").scopes, ["TEXT_FILL"]);
  assert.equal(findSemantic("layout/content-gap/md").codeSyntax.WEB, "var(--layout-content-gap-md)");
  assert.equal(findSemantic("color/focus").description, "");
});

test("a renamed variable is restored in place when its token key matches", async () => {
  await seedPrimitives();
  await sync();
  const variable = findSemantic("color/action/primary");
  const idBefore = variable.id;
  variable.name = "color/action/renamed";
  const countsBeforeCreate = fake.counts.variablesCreated;

  const report = await sync();

  assert.equal(report.created.length, 0);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], /^color\/action\/primary \[name\] \(VariableID:/);
  assert.equal(variable.id, idBefore);
  assert.equal(variable.name, "color/action/primary");
  assert.equal(semanticVariables().length, 41);
  assert.equal(fake.counts.variablesCreated, countsBeforeCreate);
});

test("a variable with an empty token key and a planned name is adopted", async () => {
  await seedPrimitives();
  await sync();
  const variable = findSemantic("layout/content-gap/md");
  const idBefore = variable.id;
  variable.setPluginData("token", "");
  const writes = fake.counts.pluginDataWrites;

  const report = await sync();

  assert.equal(report.created.length, 0);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], /^layout\/content-gap\/md \[token\] \(VariableID:/);
  assert.equal(variable.id, idBefore);
  assert.equal(variable.getPluginData("token"), "layout/content-gap/md");
  assert.equal(semanticVariables().length, 41);
  assert.equal(fake.counts.pluginDataWrites, writes + 1);
});

test("variables that exist only in Figma are reported and kept", async () => {
  await seedPrimitives();
  await sync();
  const collection = semanticCollection();
  const emptyKey = fake.variables_api.createVariable("local/scratch", collection, "COLOR");
  const otherKey = fake.variables_api.createVariable("local/other", collection, "FLOAT");
  otherKey.setPluginData("token", "made-up");
  emptyKey.setValueForMode(modeId("Light"), { r: 1, g: 1, b: 1, a: 1 });

  const report = await sync();

  assert.deepEqual(report.notInJson, ["local/scratch", "local/other"]);
  assert.equal(report.created.length, 0);
  assert.deepEqual(report.updated, []);
  assert.equal(semanticVariables().includes(emptyKey), true);
  assert.equal(semanticVariables().includes(otherKey), true);
  assert.equal(emptyKey.getPluginData("token"), "");
  assert.equal(otherKey.getPluginData("token"), "made-up");
  assert.equal(semanticVariables().length, 43);
});

test("two variables with the same token value throw before any write", async () => {
  await seedPrimitives();
  await sync();
  const original = findSemantic("color/action/primary");
  const before = structuredClone(original.valuesByMode);
  const extra = fake.variables_api.createVariable("local/dup", semanticCollection(), "COLOR");
  extra.setPluginData("token", "color/action/primary");
  const counts = snapshotCounts();

  await assert.rejects(sync(), /two variables with token "color\/action\/primary"/);

  assert.deepEqual(snapshotCounts(), counts);
  assert.deepEqual(original.valuesByMode, before);
  assert.equal(semanticVariables().length, 42);
});

test("setting a planned name that another variable already has throws before any write", async () => {
  await seedPrimitives();
  await sync();
  const variable = findSemantic("color/action/primary");
  variable.name = "temp-name";
  const blocker = fake.variables_api.createVariable("color/action/primary", semanticCollection(), "COLOR");
  blocker.setPluginData("token", "not-a-path");
  const counts = snapshotCounts();

  await assert.rejects(sync(), /setting color\/action\/primary would collide with another "Semantic" variable/);

  assert.deepEqual(snapshotCounts(), counts);
  assert.equal(variable.name, "temp-name");
  assert.equal(blocker.name, "color/action/primary");
});

test("two variables with the same name throw before any write", async () => {
  await seedPrimitives();
  await sync();
  fake.variables_api.createVariable("color/focus", semanticCollection(), "COLOR");
  const counts = snapshotCounts();

  await assert.rejects(sync(), /two variables named color\/focus/);

  assert.deepEqual(snapshotCounts(), counts);
});

test("primitive variables are unchanged and gain no plugin data", async () => {
  await seedPrimitives();
  const before = primitiveVariables().map(serializeVariable);
  const primitiveWrites = fake.counts.primitiveValueWrites;

  await sync();
  await sync();

  assert.deepEqual(primitiveVariables().map(serializeVariable), before);
  assert.equal(fake.counts.primitiveValueWrites, primitiveWrites);
  for (const variable of primitiveVariables()) {
    assert.equal(variable.getPluginData("token"), "");
  }
});

test("a missing primitive throws before any semantic write and lists every missing name", async () => {
  await seedPrimitives();
  const colorName = primitiveNamedInPlan("COLOR");
  const floatName = primitiveNamedInPlan("FLOAT");
  assert.notEqual(colorName, floatName);
  removeVariables(new Set([findPrimitive(colorName).id, findPrimitive(floatName).id]));
  const counts = snapshotCounts();

  await assert.rejects(
    () => sync(),
    (error) => {
      assert.ok(error instanceof Error);
      const listed = error.message
        .split("\n")
        .filter((line) => line.endsWith(" is missing"))
        .map((line) => line.slice(0, -" is missing".length))
        .sort();
      assert.deepEqual(listed, [colorName, floatName].sort());
      const other = error.message
        .split("\n")
        .slice(1)
        .filter((line) => !line.endsWith(" is missing"));
      assert.deepEqual(other, []);
      return true;
    },
  );

  assert.equal(semanticCollection(), undefined);
  assert.deepEqual(snapshotCounts(), counts);
});

test("a primitive whose type disagrees with the row throws before any semantic write", async () => {
  await seedPrimitives();
  findPrimitive("space/4").resolvedType = "STRING";
  const counts = snapshotCounts();

  await assert.rejects(
    sync(),
    /space\/4 is STRING in "Primitives" but FLOAT is required/,
  );

  assert.equal(semanticCollection(), undefined);
  assert.deepEqual(snapshotCounts(), counts);
});

test("aliases are resolved only inside the named primitives collection", async () => {
  await seedPrimitives();
  const counts = snapshotCounts();

  await assert.rejects(
    () => syncSemantic(semanticPlan, { dryRun: false, primitiveCollectionName: "Elsewhere" }),
    /no collection is named "Elsewhere"/,
  );

  assert.equal(semanticCollection(), undefined);
  assert.deepEqual(snapshotCounts(), counts);
});

test("two primitives collections stop the sync before it writes", async () => {
  await seedPrimitives();
  fake.variables_api.createVariableCollection(primitiveCollectionName);
  const counts = snapshotCounts();

  await assert.rejects(sync(), /2 collections are named "Primitives"/);

  assert.equal(semanticCollection(), undefined);
  assert.deepEqual(snapshotCounts(), counts);
});

test("a semantic type conflict throws before any write", async () => {
  await seedPrimitives();
  await sync();
  const variable = findSemantic("color/focus");
  const before = structuredClone(variable.valuesByMode);
  variable.resolvedType = "FLOAT";
  const counts = snapshotCounts();

  await assert.rejects(
    sync(),
    /type changes need a manual decision \(Figma can't change a variable's type in place\):\ncolor\/focus is FLOAT in Figma but COLOR in JSON/,
  );

  assert.deepEqual(snapshotCounts(), counts);
  assert.deepEqual(variable.valuesByMode, before);
});

test("a duplicate Semantic collection throws before any write", async () => {
  await seedPrimitives();
  fake.variables_api.createVariableCollection(semanticPlan.collectionName);
  fake.variables_api.createVariableCollection(semanticPlan.collectionName);
  const counts = snapshotCounts();

  await assert.rejects(sync(), /2 collections are named "Semantic"/);

  assert.deepEqual(snapshotCounts(), counts);
  assert.equal(semanticVariables().length, 0);
});

test("each wrong mode shape throws before any semantic write", async () => {
  const shapes = [["Light"], ["Light", "Dark", "Contrast"], ["Dark", "Light"], ["Mode 1"]];

  for (const names of shapes) {
    fake = createFakeFigma();
    globalThis.figma = { variables: fake.variables_api };
    await seedPrimitives();
    const collection = fake.variables_api.createVariableCollection(semanticPlan.collectionName);
    collection.renameMode(collection.modes[0].modeId, names[0]);
    for (const name of names.slice(1)) collection.addMode(name);
    const counts = snapshotCounts();
    const variableCount = fake.variables.length;

    await assert.rejects(
      sync(),
      new RegExp(`modes are ${names.join(", ")}; expected Light, Dark`),
    );

    assert.deepEqual(snapshotCounts(), counts);
    assert.equal(fake.variables.length, variableCount);
  }
});

test("a file plan that cannot add a second mode fails with a clear error and writes no variables", async () => {
  await seedPrimitives();
  fake.modeLimit = 1;

  await assert.rejects(
    () => sync(),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /The file's plan cannot hold Light and Dark/);
      assert.match(error.message, /in addMode: Limited to 1 modes only/);
      assert.match(error.message, /will not delete it/);
      return true;
    },
  );

  const collection = semanticCollection();
  assert.ok(collection);
  assert.deepEqual(
    collection.modes.map((mode) => mode.name),
    ["Light"],
  );
  assert.equal(semanticVariables().length, 0);

  const counts = snapshotCounts();
  await assert.rejects(sync(), /modes are Light; expected Light, Dark/);
  assert.deepEqual(snapshotCounts(), counts);
  assert.equal(semanticVariables().length, 0);
});

test("an error on one variable is reported without stopping the others", async () => {
  await seedPrimitives();
  const original = fake.variables_api.createVariable;
  fake.variables_api.createVariable = (name, collection, type) => {
    if (name === "color/action/primary") throw new Error("boom");
    return original(name, collection, type);
  };

  const report = await sync();

  assert.equal(report.created.length, 40);
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /^color\/action\/primary: boom/);
  assert.equal(semanticVariables().length, 40);
  assert.equal(findSemantic("color/action/primary"), undefined);
  const focus = findSemantic("color/focus");
  assert.equal(focus.valuesByMode[modeId("Light")].type, "VARIABLE_ALIAS");
  assert.equal(focus.getPluginData("token"), "color/focus");
});

// mulberry32, Tommy Ettinger, public domain. Master seed is fixed.
// A failure prints `seed <n>`. Replay that draw with CAMELLIA_SYNC_SEED=<n>.
const MASTER_SEED = 0x2c5eed01;
const seedForDraw = (draw) => (MASTER_SEED + Math.imul(draw, 0x9e3779b9)) >>> 0;

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (rng, n) => Math.floor(rng() * n);
const pick = (rng, items) => items[int(rng, items.length)];

function shuffle(rng, items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = int(rng, index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function serializeVariable(variable) {
  return {
    id: variable.id,
    name: variable.name,
    resolvedType: variable.resolvedType,
    variableCollectionId: variable.variableCollectionId,
    valuesByMode: structuredClone(variable.valuesByMode),
    scopes: [...variable.scopes],
    codeSyntax: { ...variable.codeSyntax },
    description: variable.description,
    token: variable.getPluginData("token"),
  };
}

function createEmptySemantic() {
  const collection = fake.variables_api.createVariableCollection(semanticPlan.collectionName);
  collection.renameMode(collection.modes[0].modeId, semanticPlan.modeNames[0]);
  for (const name of semanticPlan.modeNames.slice(1)) collection.addMode(name);
  return collection;
}

function breakVariable(rng, variable) {
  const kind = int(rng, 6);
  const collection = semanticCollection();
  const mode = pick(rng, collection.modes);
  if (kind === 0) {
    const currentId = variable.valuesByMode[mode.modeId]?.id;
    const candidates = primitiveVariables().filter(
      (primitive) => primitive.resolvedType === variable.resolvedType && primitive.id !== currentId,
    );
    if (candidates.length > 0) {
      variable.setValueForMode(mode.modeId, fake.variables_api.createVariableAlias(pick(rng, candidates)));
      return;
    }
  }
  if (kind === 0 || kind === 1) {
    const raw =
      variable.resolvedType === "COLOR"
        ? { r: rng(), g: rng(), b: rng(), a: 1 }
        : 1 + int(rng, 1000);
    variable.setValueForMode(mode.modeId, raw);
    return;
  }
  if (kind === 2) {
    variable.scopes = ["WIDTH_HEIGHT"];
    return;
  }
  if (kind === 3) {
    variable.setVariableCodeSyntax("WEB", "var(--hand-edit)");
    return;
  }
  if (kind === 4) {
    variable.description = "hand edit";
    return;
  }
  variable.name = `hand-edit/${variable.id}`;
}

async function runDraw(seed) {
  let label = "setup";
  try {
    const rng = mulberry32(seed);
    fake = createFakeFigma();
    globalThis.figma = { variables: fake.variables_api };
    await seedPrimitives();
    const primitivesBefore = primitiveVariables().map(serializeVariable);

    const kind = int(rng, 4);
    const orphanCount = rng() < 0.5 ? 0 : 1 + int(rng, 3);
    label = `kind ${kind}, orphans ${orphanCount}`;

    if (kind === 2 || kind === 3) {
      const setup = await sync();
      assert.deepEqual(setup.errors, [], setup.errors.join("\n"));
      if (kind === 3) {
        const present = semanticVariables();
        const removeCount = 1 + int(rng, present.length - 1);
        removeVariables(new Set(shuffle(rng, present).slice(0, removeCount).map((variable) => variable.id)));
      }
      const remaining = semanticVariables().filter((variable) =>
        semanticPlan.variables.some((planned) => planned.token === variable.getPluginData("token")),
      );
      if (remaining.length > 0 && rng() < 0.8) {
        label += ", broken";
        const sampleSize = 1 + int(rng, remaining.length);
        for (const variable of shuffle(rng, remaining).slice(0, sampleSize)) breakVariable(rng, variable);
      }
    } else if (kind === 1 || orphanCount > 0) {
      createEmptySemantic();
    }

    if (orphanCount > 0) {
      const collection = semanticCollection();
      for (let index = 0; index < orphanCount; index++) {
        const orphan = fake.variables_api.createVariable(
          `only-in-figma/${index}/${seed}`,
          collection,
          pick(rng, ["COLOR", "FLOAT"]),
        );
        if (rng() < 0.5) orphan.setPluginData("token", `unplanned/${index}/${seed}`);
        const light = collection.modes[0].modeId;
        orphan.setValueForMode(
          light,
          orphan.resolvedType === "FLOAT" ? 7 : { r: 0.2, g: 0.2, b: 0.2, a: 1 },
        );
      }
    }

    assert.deepEqual(primitiveVariables().map(serializeVariable), primitivesBefore);

    const plannedNames = new Set(semanticPlan.variables.map((planned) => planned.name));
    const plannedTokens = new Set(semanticPlan.variables.map((planned) => planned.token));
    const idsBefore = new Map();
    const orphanSnapshots = [];
    for (const variable of semanticVariables()) {
      const token = variable.getPluginData("token");
      if (plannedTokens.has(token)) idsBefore.set(token, variable.id);
      else if (token === "" && plannedNames.has(variable.name)) idsBefore.set(variable.name, variable.id);
      else orphanSnapshots.push(serializeVariable(variable));
    }

    const report1 = await sync();
    assert.deepEqual(report1.errors, [], report1.errors.join("\n"));
    assertSemanticMatchesPlan(orphanSnapshots);
    for (const [identity, id] of idsBefore) {
      const variable = semanticVariables().find((item) => item.getPluginData("token") === identity);
      assert.equal(variable?.id, id, identity);
    }
    assert.deepEqual(primitiveVariables().map(serializeVariable), primitivesBefore);

    const counts = snapshotCounts();
    const semanticAfter = semanticVariables().map(serializeVariable);
    const report2 = await sync();
    assert.equal(report2.created.length, 0);
    assert.deepEqual(report2.updated, []);
    assert.deepEqual(report2.errors, []);
    assert.equal(report2.unchanged, semanticPlan.variables.length);
    assert.equal(report2.notInJson.length, orphanSnapshots.length);
    assert.deepEqual(snapshotCounts(), counts);
    assert.deepEqual(semanticVariables().map(serializeVariable), semanticAfter);
    assert.deepEqual(primitiveVariables().map(serializeVariable), primitivesBefore);
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    throw new Error(`${label}\n${message}`);
  }
}

function assertSemanticMatchesPlan(orphanSnapshots) {
  const collection = semanticCollection();
  assert.ok(collection);
  assert.deepEqual(
    collection.modes.map((mode) => mode.name),
    semanticPlan.modeNames,
  );
  assert.equal(collection.defaultModeId, collection.modes[0].modeId);

  const variables = semanticVariables();
  const byToken = new Map();
  for (const variable of variables) {
    const token = variable.getPluginData("token");
    if (token === "") continue;
    assert.equal(byToken.has(token), false, token);
    byToken.set(token, variable);
  }

  for (const planned of semanticPlan.variables) {
    const variable = byToken.get(planned.token);
    assert.ok(variable, planned.name);
    assert.equal(variable.name, planned.name, planned.name);
    assert.equal(variable.resolvedType, planned.type, planned.name);
    assert.equal(variable.description, planned.description, planned.name);
    assert.equal(variable.codeSyntax.WEB, planned.webSyntax, planned.name);
    assert.deepEqual([...variable.scopes].sort(), [...planned.scopes].sort(), planned.name);
    for (const modeName of semanticPlan.modeNames) {
      const value = variable.valuesByMode[modeId(modeName)];
      assert.equal(value?.type, "VARIABLE_ALIAS", `${planned.name} ${modeName}`);
      assert.equal(value.id, findPrimitive(planned.aliases[modeName]).id, `${planned.name} ${modeName}`);
    }
  }

  const extras = variables.filter(
    (variable) => !semanticPlan.variables.some((planned) => planned.token === variable.getPluginData("token")),
  );
  assert.equal(extras.length, orphanSnapshots.length);
  for (const orphan of orphanSnapshots) {
    const variable = variables.find((item) => item.id === orphan.id);
    assert.ok(variable, orphan.id);
    assert.deepEqual(serializeVariable(variable), orphan);
  }
}

test("syncing twice matches syncing once across 40 seeded states", async () => {
  const replay = process.env.CAMELLIA_SYNC_SEED;
  const seeds =
    replay === undefined
      ? Array.from({ length: 40 }, (_, draw) => seedForDraw(draw))
      : [Number(replay)];

  for (const [draw, seed] of seeds.entries()) {
    try {
      await runDraw(seed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `seed ${seed} (draw ${draw} of ${seeds.length}). Replay: CAMELLIA_SYNC_SEED=${seed} npm test\n${message}`,
      );
    }
  }
});
