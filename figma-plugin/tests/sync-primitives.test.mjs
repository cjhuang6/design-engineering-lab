import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  planPrimitives,
  PRIMITIVE_SHARED_ID_KEY,
  PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE,
} from "../src/plan-primitives.ts";
import { syncPrimitives } from "../src/sync-primitives.ts";

const tokens = JSON.parse(
  readFileSync(new URL("../../tokens/camellia.tokens.json", import.meta.url), "utf8"),
);
const plan = planPrimitives(tokens);

/**
 * A minimal stand-in for figma.variables: just the calls syncPrimitives
 * makes. Numbers are stored at 32-bit precision like real Figma, so tests
 * prove the sync tolerates read-back noise.
 */
function createFakeFigma() {
  let nextId = 1;
  const collections = [];
  const variables = [];
  const counts = { collectionsCreated: 0, variablesCreated: 0, valueWrites: 0, sharedPluginDataWrites: 0 };

  const lowPrecision = (value) => {
    if (typeof value === "number") return Math.fround(value);
    if (value && typeof value === "object" && "r" in value) {
      return { r: Math.fround(value.r), g: Math.fround(value.g), b: Math.fround(value.b), a: Math.fround(value.a) };
    }
    return structuredClone(value);
  };

  const fake = {
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
      createVariableCollection(name) {
        counts.collectionsCreated++;
        const collection = {
          id: `VariableCollectionId:${nextId++}`,
          name,
          modes: [{ modeId: `mode:${nextId++}`, name: "Mode 1" }],
          renameMode(modeId, newName) {
            this.modes = this.modes.map((m) => (m.modeId === modeId ? { ...m, name: newName } : m));
          },
        };
        collections.push(collection);
        return collection;
      },
      createVariable(name, collection, resolvedType) {
        counts.variablesCreated++;
        const sharedPluginData = Object.create(null);
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
            this.valuesByMode[modeId] = lowPrecision(value);
          },
          setVariableCodeSyntax(platform, value) {
            this.codeSyntax[platform] = value;
          },
          getSharedPluginData(namespace, key) {
            const bucket = sharedPluginData[namespace];
            return bucket && key in bucket ? bucket[key] : "";
          },
          setSharedPluginData(namespace, key, value) {
            counts.sharedPluginDataWrites++;
            if (!sharedPluginData[namespace]) sharedPluginData[namespace] = Object.create(null);
            if (value === "") delete sharedPluginData[namespace][key];
            else sharedPluginData[namespace][key] = value;
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

const sync = (dryRun = false) => syncPrimitives(plan, { dryRun });
const find = (name) => fake.variables.find((v) => v.name === name);
const modeId = () => fake.collections[0].modes[0].modeId;

test("dry run on an empty file reports everything and changes nothing", async () => {
  const report = await sync(true);
  assert.equal(report.collectionCreated, true);
  assert.equal(report.created.length, 110);
  assert.equal(fake.counts.collectionsCreated, 0);
  assert.equal(fake.counts.variablesCreated, 0);
  assert.equal(fake.counts.sharedPluginDataWrites, 0);
});

test("first sync creates one collection, one Value mode, and every variable", async () => {
  const report = await sync();
  assert.equal(report.created.length, 110);
  assert.deepEqual(report.errors, []);
  assert.equal(fake.collections.length, 1);
  assert.equal(fake.collections[0].name, "Primitives");
  assert.deepEqual(fake.collections[0].modes.map((m) => m.name), ["Value"]);
  assert.equal(fake.variables.length, 110);

  const blue = find("color/primitive/blue/600");
  assert.equal(blue.resolvedType, "COLOR");
  assert.deepEqual(blue.scopes, []);
  assert.equal(blue.codeSyntax.WEB, "var(--color-primitive-blue-600)");
  assert.equal(
    blue.getSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY),
    plan.variables.find((variable) => variable.name === "color/primitive/blue/600").id,
  );
  assert.equal(find("space/4").valuesByMode[modeId()], 16);
  assert.deepEqual(find("duration/normal").scopes, ["ALL_SCOPES"], "motion keeps Figma's default scopes");
});

test("second sync is a no-op: nothing created, nothing updated, no writes", async () => {
  await sync();
  const writesAfterFirstRun = fake.counts.valueWrites;
  const pluginWrites = fake.counts.sharedPluginDataWrites;

  const report = await sync();
  assert.equal(report.created.length, 0);
  assert.deepEqual(report.updated, []);
  assert.equal(report.unchanged, 110);
  assert.equal(fake.counts.collectionsCreated, 1);
  assert.equal(fake.variables.length, 110);
  assert.equal(fake.counts.valueWrites, writesAfterFirstRun);
  assert.equal(fake.counts.sharedPluginDataWrites, pluginWrites);
});

test("a changed token updates the same variable in place (same ID)", async () => {
  await sync();
  const before = find("feedback/success");
  const idBefore = before.id;

  const changed = structuredClone(tokens);
  changed.feedback.success.$value = { colorSpace: "srgb", components: [1, 0, 0], hex: "#FF0000" };
  const report = await syncPrimitives(planPrimitives(changed), { dryRun: false });

  assert.equal(report.created.length, 0);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], /^feedback\/success \[value\]/);
  assert.equal(fake.variables.length, 110);
  assert.equal(find("feedback/success").id, idBefore);
  assert.equal(find("feedback/success").valuesByMode[modeId()].r, 1);
});

test("dry run after a change reports the update but writes nothing", async () => {
  await sync();
  find("radius/md").valuesByMode[modeId()] = 999;
  const writes = fake.counts.valueWrites;

  const report = await sync(true);
  assert.equal(report.updated.length, 1);
  assert.equal(find("radius/md").valuesByMode[modeId()], 999);
  assert.equal(fake.counts.valueWrites, writes);
});

test("scope, code syntax, and description drift is repaired", async () => {
  await sync();
  find("space/4").scopes = ["ALL_SCOPES"];
  find("radius/md").setVariableCodeSyntax("WEB", "var(--wrong)");
  find("color/primitive/blue/600").description = "edited in Figma";

  const report = await sync();
  assert.equal(report.updated.length, 3);
  assert.deepEqual(find("space/4").scopes, ["GAP"]);
  assert.equal(find("radius/md").codeSyntax.WEB, "var(--radius-md)");
  assert.match(find("color/primitive/blue/600").description, /Default accessible/);
});

test("variables that exist only in Figma are reported, never deleted", async () => {
  await sync();
  fake.variables_api.createVariable("color/primitive/experimental", fake.collections[0], "COLOR");

  const report = await sync();
  assert.deepEqual(report.notInJson, ["color/primitive/experimental"]);
  assert.equal(fake.variables.length, 111);
});

test("a type conflict stops the sync before anything changes", async () => {
  await sync();
  const radius = find("radius/md");
  radius.resolvedType = "STRING";
  radius.valuesByMode[modeId()] = "eight";
  const writes = fake.counts.valueWrites;

  await assert.rejects(sync(), /radius\/md is STRING in Figma but FLOAT in JSON/);
  assert.equal(fake.counts.valueWrites, writes);
});

test("duplicate collections stop the sync instead of guessing", async () => {
  fake.variables_api.createVariableCollection("Primitives");
  fake.variables_api.createVariableCollection("Primitives");
  await assert.rejects(sync(), /2 collections are named "Primitives"/);
});

test("a renamed mode is reported and restored to Value", async () => {
  await sync();
  fake.collections[0].renameMode(modeId(), "Mode 1");

  const report = await sync();
  assert.equal(report.modeRenamed, "Mode 1 → Value");
  assert.equal(fake.collections[0].modes[0].name, "Value");
});

test("an error on one variable is reported without stopping the others", async () => {
  const createVariable = fake.variables_api.createVariable;
  fake.variables_api.createVariable = (name, collection, type) => {
    if (type === "TIMING") throw new Error("TIMING is not a supported API");
    return createVariable(name, collection, type);
  };

  const report = await sync();
  assert.equal(report.created.length, 104);
  assert.equal(report.errors.length, 6);
  assert.match(report.errors[0], /^duration\/fast: TIMING is not a supported API/);
  assert.equal(fake.variables.length, 104);
});

function clearPrimitiveIds() {
  for (const variable of fake.variables) {
    variable.setSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY, "");
  }
}

test("dry run reports a name-match migration and writes nothing", async () => {
  await sync();
  clearPrimitiveIds();
  const valueWrites = fake.counts.valueWrites;
  const pluginWrites = fake.counts.sharedPluginDataWrites;
  const ids = new Map(fake.variables.map((variable) => [variable.id, variable.name]));

  const report = await sync(true);

  assert.equal(report.collectionCreated, false);
  assert.deepEqual(report.created, []);
  assert.equal(report.updated.length, 110);
  assert.equal(report.unchanged, 0);
  assert.deepEqual(report.notInJson, []);
  assert.deepEqual(report.errors, []);
  for (const line of report.updated) {
    assert.match(line, /\[token id\] \(VariableID:/);
  }
  assert.equal(fake.counts.valueWrites, valueWrites);
  assert.equal(fake.counts.sharedPluginDataWrites, pluginWrites);
  for (const variable of fake.variables) {
    assert.equal(variable.getSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY), "");
    assert.equal(ids.get(variable.id), variable.name);
  }
});

test("name-match migration tags ids, creates nothing, and a second run changes nothing", async () => {
  await sync();
  const ids = new Map(fake.variables.map((variable) => [variable.id, variable.name]));
  clearPrimitiveIds();
  const createdBefore = fake.counts.variablesCreated;

  const report = await sync();

  assert.equal(report.created.length, 0);
  assert.equal(report.updated.length, 110);
  assert.deepEqual(report.notInJson, []);
  assert.deepEqual(report.errors, []);
  assert.equal(fake.variables.length, 110);
  assert.equal(fake.counts.variablesCreated, createdBefore);
  for (const variable of fake.variables) {
    assert.equal(ids.get(variable.id), variable.name);
    const planned = plan.variables.find((item) => item.name === variable.name);
    assert.equal(
      variable.getSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY),
      planned.id,
      variable.name,
    );
  }

  const valueWrites = fake.counts.valueWrites;
  const pluginWrites = fake.counts.sharedPluginDataWrites;
  const again = await sync();
  assert.equal(again.created.length, 0);
  assert.deepEqual(again.updated, []);
  assert.equal(again.unchanged, 110);
  assert.equal(fake.counts.valueWrites, valueWrites);
  assert.equal(fake.counts.sharedPluginDataWrites, pluginWrites);
});

test("a JSON rename keeps the variable id and matches by the permanent id", async () => {
  await sync();
  const before = find("color/primitive/blue/600");
  const idBefore = before.id;
  const tokenId = before.getSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY);
  const valueBefore = structuredClone(before.valuesByMode);
  const createdBefore = fake.counts.variablesCreated;

  const renamed = structuredClone(tokens);
  renamed.color.primitive.blue.action = renamed.color.primitive.blue["600"];
  delete renamed.color.primitive.blue["600"];
  const next = planPrimitives(renamed);

  const report = await syncPrimitives(next, { dryRun: false });

  assert.equal(report.created.length, 0);
  assert.equal(report.updated.length, 1);
  assert.match(report.updated[0], /^color\/primitive\/blue\/action \[name, code syntax\] \(VariableID:/);
  assert.deepEqual(report.notInJson, []);
  assert.deepEqual(report.errors, []);
  assert.equal(fake.variables.length, 110);
  assert.equal(fake.counts.variablesCreated, createdBefore);
  const after = find("color/primitive/blue/action");
  assert.equal(after.id, idBefore);
  assert.equal(after.getSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY), tokenId);
  assert.equal(after.codeSyntax.WEB, "var(--color-primitive-blue-action)");
  assert.deepEqual(after.valuesByMode, valueBefore);
  assert.equal(find("color/primitive/blue/600"), undefined);

  const valueWrites = fake.counts.valueWrites;
  const pluginWrites = fake.counts.sharedPluginDataWrites;
  const again = await syncPrimitives(next, { dryRun: false });
  assert.equal(again.created.length, 0);
  assert.deepEqual(again.updated, []);
  assert.equal(again.unchanged, 110);
  assert.equal(fake.counts.valueWrites, valueWrites);
  assert.equal(fake.counts.sharedPluginDataWrites, pluginWrites);
});

test("renaming the JSON before migration leaves the old variable and creates the new name", async () => {
  await sync();
  const before = find("color/primitive/blue/600");
  const idBefore = before.id;
  clearPrimitiveIds();
  const createdBefore = fake.counts.variablesCreated;

  const renamed = structuredClone(tokens);
  renamed.color.primitive.blue.action = renamed.color.primitive.blue["600"];
  delete renamed.color.primitive.blue["600"];

  const report = await syncPrimitives(planPrimitives(renamed), { dryRun: false });

  assert.deepEqual(report.created, ["color/primitive/blue/action"]);
  assert.deepEqual(report.notInJson, ["color/primitive/blue/600"]);
  assert.equal(report.updated.length, 109);
  assert.equal(fake.variables.length, 111);
  assert.equal(fake.counts.variablesCreated, createdBefore + 1);
  assert.equal(before.id, idBefore);
  assert.equal(before.name, "color/primitive/blue/600");
  assert.notEqual(find("color/primitive/blue/action").id, idBefore);
});

test("two variables with the same token id throw before any write", async () => {
  await sync();
  const original = find("color/primitive/blue/600");
  const tokenId = original.getSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY);
  const valueBefore = structuredClone(original.valuesByMode);
  const extra = fake.variables_api.createVariable("color/primitive/blue/extra", fake.collections[0], "COLOR");
  extra.setSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY, tokenId);
  const valueWrites = fake.counts.valueWrites;
  const pluginWrites = fake.counts.sharedPluginDataWrites;

  await assert.rejects(sync(), new RegExp(`two variables with id "${tokenId}"`));

  assert.equal(fake.counts.valueWrites, valueWrites);
  assert.equal(fake.counts.sharedPluginDataWrites, pluginWrites);
  assert.deepEqual(original.valuesByMode, valueBefore);
  assert.equal(fake.variables.length, 111);
});

test("a rename that would take another variable's name throws before any write", async () => {
  await sync();
  const original = find("color/primitive/blue/600");
  const blocker = fake.variables_api.createVariable("color/primitive/blue/action", fake.collections[0], "COLOR");
  const valueWrites = fake.counts.valueWrites;

  const renamed = structuredClone(tokens);
  renamed.color.primitive.blue.action = renamed.color.primitive.blue["600"];
  delete renamed.color.primitive.blue["600"];

  await assert.rejects(
    syncPrimitives(planPrimitives(renamed), { dryRun: false }),
    /setting color\/primitive\/blue\/action would collide with another "Primitives" variable/,
  );

  assert.equal(fake.counts.valueWrites, valueWrites);
  assert.equal(original.name, "color/primitive/blue/600");
  assert.equal(blocker.name, "color/primitive/blue/action");
  assert.equal(fake.variables.length, 111);
});
