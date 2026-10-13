// Make the Figma "Primitives" collection match the plan. Variables are
// updated in place (same ID) so layers bound to them stay bound. Nothing is
// ever deleted.

import type { PlannedValue, PlannedVariable, PrimitivesPlan } from "./plan-primitives.ts";

export interface SyncReport {
  dryRun: boolean;
  collection: string;
  collectionCreated: boolean;
  modeRenamed: string | null;
  created: string[];
  updated: string[];
  unchanged: number;
  notInJson: string[];
  errors: string[];
}

export async function syncPrimitives(
  plan: PrimitivesPlan,
  { dryRun }: { dryRun: boolean },
): Promise<SyncReport> {
  const report: SyncReport = {
    dryRun,
    collection: plan.collectionName,
    collectionCreated: false,
    modeRenamed: null,
    created: [],
    updated: [],
    unchanged: 0,
    notInJson: [],
    errors: [],
  };

  // --- 1. Find everything and check for blocking problems before any change.
  const collections = (await figma.variables.getLocalVariableCollectionsAsync()).filter(
    (c) => c.name === plan.collectionName,
  );
  if (collections.length > 1) {
    throw new Error(`${collections.length} collections are named "${plan.collectionName}"; expected one`);
  }
  let collection: VariableCollection | undefined = collections[0];

  const existing = new Map<string, Variable>();
  if (collection) {
    if (collection.modes.length !== 1) {
      throw new Error(`"${plan.collectionName}" has ${collection.modes.length} modes; expected 1`);
    }
    const collectionId = collection.id;
    const variables = (await figma.variables.getLocalVariablesAsync()).filter(
      (v) => v.variableCollectionId === collectionId,
    );
    for (const variable of variables) {
      if (existing.has(variable.name)) {
        throw new Error(`"${plan.collectionName}" has two variables named ${variable.name}`);
      }
      existing.set(variable.name, variable);
    }
  }

  const typeConflicts = plan.variables
    .filter((p) => existing.has(p.name) && existing.get(p.name)!.resolvedType !== p.type)
    .map((p) => `${p.name} is ${existing.get(p.name)!.resolvedType} in Figma but ${p.type} in JSON`);
  if (typeConflicts.length > 0) {
    throw new Error(
      `type changes need a manual decision (Figma can't change a variable's type in place):\n` +
        typeConflicts.join("\n"),
    );
  }

  const planned = new Set(plan.variables.map((p) => p.name));
  report.notInJson = [...existing.keys()].filter((name) => !planned.has(name));

  // --- 2. Collection and its single mode.
  if (!collection) {
    report.collectionCreated = true;
    if (!dryRun) {
      collection = figma.variables.createVariableCollection(plan.collectionName);
    }
  }
  if (collection && collection.modes[0].name !== plan.modeName) {
    if (!report.collectionCreated) report.modeRenamed = `${collection.modes[0].name} → ${plan.modeName}`;
    if (!dryRun) collection.renameMode(collection.modes[0].modeId, plan.modeName);
  }

  // --- 3. Create or update each variable.
  for (const p of plan.variables) {
    const variable = existing.get(p.name);
    try {
      if (!variable) {
        if (!dryRun && collection) {
          const created = figma.variables.createVariable(p.name, collection, p.type);
          apply(created, p, collection.modes[0].modeId, allFields);
        }
        report.created.push(p.name);
        continue;
      }

      const modeId = collection!.modes[0].modeId;
      const changed = differences(variable, p, modeId);
      if (changed.length === 0) {
        report.unchanged++;
        continue;
      }
      report.updated.push(`${p.name} [${changed.join(", ")}] (${variable.id})`);
      if (!dryRun) apply(variable, p, modeId, changed);
    } catch (error) {
      report.errors.push(`${p.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return report;
}

type Field = "value" | "scopes" | "code syntax" | "description";
const allFields: Field[] = ["value", "scopes", "code syntax", "description"];

function apply(variable: Variable, p: PlannedVariable, modeId: string, fields: Field[]): void {
  if (fields.includes("value")) variable.setValueForMode(modeId, p.value);
  if (fields.includes("scopes") && p.scopes !== null) variable.scopes = p.scopes;
  if (fields.includes("code syntax")) variable.setVariableCodeSyntax("WEB", p.webSyntax);
  if (fields.includes("description")) variable.description = p.description;
}

function differences(variable: Variable, p: PlannedVariable, modeId: string): Field[] {
  const changed: Field[] = [];
  if (!sameValue(variable.valuesByMode[modeId], p.value)) changed.push("value");
  if (p.scopes !== null && !sameSet(variable.scopes, p.scopes)) changed.push("scopes");
  if (variable.codeSyntax.WEB !== p.webSyntax) changed.push("code syntax");
  if (variable.description !== p.description) changed.push("description");
  return changed;
}

/**
 * Figma stores numbers in lower precision than the JSON (0.247059 reads back
 * as 0.24705900251865387). Without a tolerance every run would report every
 * variable as updated. 1e-4 is far below one 8-bit color step (1/255 ≈ 0.004).
 */
const TOLERANCE = 1e-4;
const near = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) < TOLERANCE;

function sameValue(actual: VariableValue | undefined, expected: PlannedValue): boolean {
  if (actual === undefined) return false;
  if (typeof expected === "number") return near(actual, expected);
  if (typeof expected === "string") return actual === expected;
  if (typeof actual !== "object" || actual === null) return false;

  if ("r" in expected) {
    if (!("r" in actual)) return false;
    const alpha = "a" in actual ? actual.a : 1;
    return (
      near(actual.r, expected.r) &&
      near(actual.g, expected.g) &&
      near(actual.b, expected.b) &&
      near(alpha, expected.a)
    );
  }

  // EASING
  if (!("type" in actual) || actual.type !== expected.type) return false;
  const a = "easingFunctionCubicBezier" in actual ? actual.easingFunctionCubicBezier : undefined;
  const e = expected.easingFunctionCubicBezier;
  if (!a || !e) return a === e;
  return near(a.x1, e.x1) && near(a.y1, e.y1) && near(a.x2, e.x2) && near(a.y2, e.y2);
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && b.every((item) => a.includes(item));
