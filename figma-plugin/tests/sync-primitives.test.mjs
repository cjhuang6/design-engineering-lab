import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { planPrimitives } from "../src/plan-primitives.ts";
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
  const counts = { collectionsCreated: 0, variablesCreated: 0, valueWrites: 0 };

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
  assert.equal(find("space/4").valuesByMode[modeId()], 16);
  assert.deepEqual(find("duration/normal").scopes, ["ALL_SCOPES"], "motion keeps Figma's default scopes");
});

test("second sync is a no-op: nothing created, nothing updated, no writes", async () => {
  await sync();
  const writesAfterFirstRun = fake.counts.valueWrites;

  const report = await sync();
  assert.equal(report.created.length, 0);
  assert.deepEqual(report.updated, []);
  assert.equal(report.unchanged, 110);
  assert.equal(fake.counts.collectionsCreated, 1);
  assert.equal(fake.variables.length, 110);
  assert.equal(fake.counts.valueWrites, writesAfterFirstRun);
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
