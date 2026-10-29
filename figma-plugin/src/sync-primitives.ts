import {
  PRIMITIVE_SHARED_ID_KEY,
  PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE,
} from "./plan-primitives.ts";
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

interface Match {
  planned: PlannedVariable;
  variable?: Variable;
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

  const collections = (await figma.variables.getLocalVariableCollectionsAsync()).filter(
    (c) => c.name === plan.collectionName,
  );
  if (collections.length > 1) {
    throw new Error(`${collections.length} collections are named "${plan.collectionName}"; expected one`);
  }
  let collection: VariableCollection | undefined = collections[0];

  let matches: Match[];
  if (collection) {
    if (collection.modes.length !== 1) {
      throw new Error(`"${plan.collectionName}" has ${collection.modes.length} modes; expected 1`);
    }
    const indexed = await indexPrimitives(collection, plan);
    matches = indexed.matches;
    report.notInJson = indexed.notInJson;
    const typeConflict = typeConflictMessage(matches);
    if (typeConflict) throw new Error(typeConflict);
  } else {
    matches = plan.variables.map((planned) => ({ planned }));
  }

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

  for (const match of matches) {
    const planned = match.planned;
    try {
      if (!match.variable) {
        if (!dryRun && collection) {
          const created = figma.variables.createVariable(planned.name, collection, planned.type);
          apply(created, planned, collection.modes[0].modeId, allFields);
        }
        report.created.push(planned.name);
        continue;
      }

      const modeId = collection!.modes[0].modeId;
      const changed = differences(match.variable, planned, modeId);
      if (changed.length === 0) {
        report.unchanged++;
        continue;
      }
      report.updated.push(`${planned.name} [${changed.join(", ")}] (${match.variable.id})`);
      if (!dryRun) apply(match.variable, planned, modeId, changed);
    } catch (error) {
      report.errors.push(`${planned.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return report;
}

async function indexPrimitives(collection: VariableCollection, plan: PrimitivesPlan): Promise<{
  matches: Match[];
  notInJson: string[];
}> {
  const variables = (await figma.variables.getLocalVariablesAsync()).filter(
    (variable) => variable.variableCollectionId === collection.id,
  );

  const byName = new Map<string, Variable>();
  for (const variable of variables) {
    if (byName.has(variable.name)) {
      throw new Error(`"${collection.name}" has two variables named ${variable.name}`);
    }
    byName.set(variable.name, variable);
  }

  const byId = new Map<string, Variable>();
  for (const variable of variables) {
    const tokenId = sharedId(variable);
    if (tokenId === "") continue;
    if (byId.has(tokenId)) {
      throw new Error(`"${collection.name}" has two variables with id "${tokenId}"`);
    }
    byId.set(tokenId, variable);
  }

  const matches: Match[] = [];
  const used = new Set<Variable>();
  for (const planned of plan.variables) {
    const tagged = byId.get(planned.id);
    if (tagged) {
      adopt(collection.name, planned, tagged, byName, used, matches);
      continue;
    }

    const holder = byName.get(planned.name);
    if (holder && sharedId(holder) === "") {
      adopt(collection.name, planned, holder, byName, used, matches);
      continue;
    }
    if (holder) throw nameCollision(collection.name, planned.name, holder);

    matches.push({ planned });
  }

  return {
    matches,
    notInJson: variables.filter((variable) => !used.has(variable)).map((variable) => variable.name),
  };
}

function adopt(
  collectionName: string,
  planned: PlannedVariable,
  variable: Variable,
  byName: Map<string, Variable>,
  used: Set<Variable>,
  matches: Match[],
): void {
  if (used.has(variable)) {
    throw new Error(`${planned.name} reuses id "${planned.id}" already matched to another variable`);
  }
  const holder = byName.get(planned.name);
  if (holder && holder !== variable) throw nameCollision(collectionName, planned.name, holder);
  used.add(variable);
  matches.push({ planned, variable });
}

function nameCollision(collectionName: string, name: string, holder: Variable): Error {
  return new Error(
    `setting ${name} would collide with another "${collectionName}" variable (${holder.id})`,
  );
}

function typeConflictMessage(matches: readonly Match[]): string | null {
  const lines: string[] = [];
  for (const match of matches) {
    if (!match.variable) continue;
    if (match.variable.resolvedType === match.planned.type) continue;
    lines.push(
      `${match.planned.name} is ${match.variable.resolvedType} in Figma but ${match.planned.type} in JSON`,
    );
  }
  if (lines.length === 0) return null;
  return (
    `type changes need a manual decision (Figma can't change a variable's type in place):\n` +
    lines.join("\n")
  );
}

type Field = "name" | "value" | "scopes" | "code syntax" | "description" | "token id";
const allFields: Field[] = ["name", "value", "scopes", "code syntax", "description", "token id"];

function apply(variable: Variable, p: PlannedVariable, modeId: string, fields: Field[]): void {
  if (fields.includes("name")) variable.name = p.name;
  if (fields.includes("value")) variable.setValueForMode(modeId, p.value);
  if (fields.includes("scopes") && p.scopes !== null) variable.scopes = p.scopes;
  if (fields.includes("code syntax")) variable.setVariableCodeSyntax("WEB", p.webSyntax);
  if (fields.includes("description")) variable.description = p.description;
  if (fields.includes("token id")) {
    variable.setSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY, p.id);
  }
}

function differences(variable: Variable, p: PlannedVariable, modeId: string): Field[] {
  const changed: Field[] = [];
  if (variable.name !== p.name) changed.push("name");
  if (!sameValue(variable.valuesByMode[modeId], p.value)) changed.push("value");
  if (p.scopes !== null && !sameSet(variable.scopes, p.scopes)) changed.push("scopes");
  if (variable.codeSyntax.WEB !== p.webSyntax) changed.push("code syntax");
  if (variable.description !== p.description) changed.push("description");
  if (sharedId(variable) !== p.id) changed.push("token id");
  return changed;
}

function sharedId(variable: Variable): string {
  return variable.getSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY);
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
