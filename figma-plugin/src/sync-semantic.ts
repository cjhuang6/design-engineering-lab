// Make the Figma "Semantic" collection match the plan. Variables are matched
// by the `token` plugin-data key and updated in place (same ID). Nothing is
// ever deleted. Aliases point at primitives; this file does not write to them.

import { SEMANTIC_TOKEN_PLUGIN_DATA_KEY } from "./plan-semantic.ts";
import type { PlannedSemanticVariable, SemanticPlan } from "./plan-semantic.ts";

export interface SemanticSyncReport {
  dryRun: boolean;
  collection: string;
  collectionCreated: boolean;
  created: string[];
  updated: string[];
  unchanged: number;
  notInJson: string[];
  errors: string[];
}

export interface SemanticSyncOptions {
  dryRun: boolean;
  primitiveCollectionName: string;
}

interface Match {
  planned: PlannedSemanticVariable;
  variable?: Variable;
}

export async function syncSemantic(
  plan: SemanticPlan,
  { dryRun, primitiveCollectionName }: SemanticSyncOptions,
): Promise<SemanticSyncReport> {
  const report: SemanticSyncReport = {
    dryRun,
    collection: plan.collectionName,
    collectionCreated: false,
    created: [],
    updated: [],
    unchanged: 0,
    notInJson: [],
    errors: [],
  };

  const collections = (await figma.variables.getLocalVariableCollectionsAsync()).filter(
    (collection) => collection.name === plan.collectionName,
  );
  if (collections.length > 1) {
    throw new Error(
      `${collections.length} collections are named "${plan.collectionName}"; expected one`,
    );
  }
  let collection: VariableCollection | undefined = collections[0];

  let matches: Match[];
  if (collection) {
    assertModes(collection, plan.modeNames);
    const indexed = await indexSemantic(collection, plan);
    matches = indexed.matches;
    report.notInJson = indexed.notInJson;
    const typeConflict = typeConflictMessage(matches);
    if (typeConflict) throw new Error(typeConflict);
  } else {
    matches = plan.variables.map((planned) => ({ planned }));
  }

  const primitives = await loadPrimitives(primitiveCollectionName);
  const aliasErrors = aliasProblems(plan, primitives, primitiveCollectionName);
  if (aliasErrors.length > 0) {
    throw new Error(
      `Semantic aliases do not match "${primitiveCollectionName}":\n${aliasErrors.join("\n")}`,
    );
  }

  if (!collection) {
    report.collectionCreated = true;
    if (!dryRun) collection = createCollectionWithModes(plan);
  }

  const modeIds = collection ? modeIdByName(collection, plan.modeNames) : undefined;
  const fields = everyField(plan.modeNames);

  for (const match of matches) {
    const planned = match.planned;
    try {
      if (!match.variable) {
        if (!dryRun) {
          if (!collection || !modeIds) {
            throw new Error(`"${plan.collectionName}" is missing after creation`);
          }
          const created = figma.variables.createVariable(planned.name, collection, planned.type);
          apply(created, planned, plan.modeNames, modeIds, primitives, fields);
        }
        report.created.push(planned.name);
        continue;
      }

      if (!modeIds) throw new Error(`"${plan.collectionName}" is missing its modes`);
      const changed = differences(match.variable, planned, plan.modeNames, modeIds, primitives);
      if (changed.length === 0) {
        report.unchanged++;
        continue;
      }
      report.updated.push(`${planned.name} [${changed.join(", ")}] (${match.variable.id})`);
      if (!dryRun) {
        apply(match.variable, planned, plan.modeNames, modeIds, primitives, changed);
      }
    } catch (error) {
      report.errors.push(`${planned.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return report;
}

function assertModes(collection: VariableCollection, modeNames: readonly string[]): void {
  const actualNames = collection.modes.map((mode) => mode.name);
  const same =
    actualNames.length === modeNames.length &&
    actualNames.every((name, index) => name === modeNames[index]);
  if (same) return;
  throw new Error(
    `"${collection.name}" modes are ${actualNames.join(", ")}; expected ${modeNames.join(", ")}. ` +
      `This sync does not rename, reorder, or delete modes.`,
  );
}

async function indexSemantic(collection: VariableCollection, plan: SemanticPlan): Promise<{
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

  const byToken = new Map<string, Variable>();
  for (const variable of variables) {
    const token = variable.getPluginData(SEMANTIC_TOKEN_PLUGIN_DATA_KEY);
    if (token === "") continue;
    if (byToken.has(token)) {
      throw new Error(`"${collection.name}" has two variables with token "${token}"`);
    }
    byToken.set(token, variable);
  }

  const matches: Match[] = [];
  const used = new Set<Variable>();
  for (const planned of plan.variables) {
    const keyed = byToken.get(planned.token);
    if (keyed) {
      const holder = byName.get(planned.name);
      if (holder && holder !== keyed) throw nameCollision(collection.name, planned.name, holder);
      used.add(keyed);
      matches.push({ planned, variable: keyed });
      continue;
    }

    const holder = byName.get(planned.name);
    const token = holder?.getPluginData(SEMANTIC_TOKEN_PLUGIN_DATA_KEY);
    if (holder && token === "") {
      used.add(holder);
      matches.push({ planned, variable: holder });
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

async function loadPrimitives(name: string): Promise<Map<string, Variable>> {
  const collections = (await figma.variables.getLocalVariableCollectionsAsync()).filter(
    (collection) => collection.name === name,
  );
  if (collections.length !== 1) {
    throw new Error(
      collections.length === 0
        ? `no collection is named "${name}", so Semantic aliases have nowhere to point`
        : `${collections.length} collections are named "${name}"; expected one`,
    );
  }

  const collectionId = collections[0].id;
  const variables = (await figma.variables.getLocalVariablesAsync()).filter(
    (variable) => variable.variableCollectionId === collectionId,
  );
  const byName = new Map<string, Variable>();
  for (const variable of variables) {
    if (byName.has(variable.name)) {
      throw new Error(`"${name}" has two variables named ${variable.name}`);
    }
    byName.set(variable.name, variable);
  }
  return byName;
}

function aliasProblems(
  plan: SemanticPlan,
  primitives: Map<string, Variable>,
  primitiveCollectionName: string,
): string[] {
  const problems: string[] = [];
  const reported = new Set<string>();
  const add = (line: string) => {
    if (reported.has(line)) return;
    reported.add(line);
    problems.push(line);
  };

  for (const planned of plan.variables) {
    for (const modeName of plan.modeNames) {
      const primitiveName = planned.aliases[modeName];
      if (primitiveName === undefined) {
        add(`${planned.name} has no ${modeName} alias in the plan`);
        continue;
      }
      const primitive = primitives.get(primitiveName);
      if (!primitive) {
        add(`${primitiveName} is missing`);
        continue;
      }
      if (primitive.resolvedType !== planned.type) {
        add(
          `${primitiveName} is ${primitive.resolvedType} in "${primitiveCollectionName}" but ${planned.type} is required`,
        );
      }
    }
  }
  return problems;
}

function createCollectionWithModes(plan: SemanticPlan): VariableCollection {
  const collection = figma.variables.createVariableCollection(plan.collectionName);
  const [first, ...rest] = plan.modeNames;
  if (!first) throw new Error(`"${plan.collectionName}" plan has no modes`);
  if (collection.modes.length === 0) {
    throw new Error(`"${plan.collectionName}" was created without a mode`);
  }
  if (collection.modes[0].name !== first) {
    collection.renameMode(collection.modes[0].modeId, first);
  }
  for (const name of rest) addModeOrExplain(collection, name, plan.modeNames);
  return collection;
}

// Documented throw from VariableCollection.addMode when the file's plan cannot
// add a mode. Leave the collection in place; this plugin does not call remove().
function addModeOrExplain(
  collection: VariableCollection,
  name: string,
  modeNames: readonly string[],
): void {
  try {
    collection.addMode(name);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/in addMode: Limited to \d+ modes only/.test(message)) {
      throw new Error(
        `The file's plan cannot hold ${modeNames.join(" and ")}: ${message}. ` +
          `"${collection.name}" may now exist with only its first mode. ` +
          `Delete that empty collection in Figma if you do not need it; this plugin will not delete it.`,
      );
    }
    throw error;
  }
}

function modeIdByName(collection: VariableCollection, modeNames: readonly string[]): Map<string, string> {
  const ids = new Map<string, string>();
  for (const modeName of modeNames) {
    const mode = collection.modes.find((item) => item.name === modeName);
    if (!mode) throw new Error(`"${collection.name}" is missing mode ${modeName}`);
    ids.set(modeName, mode.modeId);
  }
  return ids;
}

function valueField(modeName: string): string {
  return `${modeName} value`;
}

function everyField(modeNames: readonly string[]): string[] {
  return ["name", ...modeNames.map(valueField), "scopes", "code syntax", "description", "token"];
}

function differences(
  variable: Variable,
  planned: PlannedSemanticVariable,
  modeNames: readonly string[],
  modeIds: Map<string, string>,
  primitives: Map<string, Variable>,
): string[] {
  const changed: string[] = [];
  if (variable.name !== planned.name) changed.push("name");
  for (const modeName of modeNames) {
    const primitiveName = planned.aliases[modeName];
    const primitive = primitiveName ? primitives.get(primitiveName) : undefined;
    const modeId = modeIds.get(modeName);
    const actual = modeId ? variable.valuesByMode[modeId] : undefined;
    if (!primitive || !modeId || !sameAlias(actual, primitive.id)) changed.push(valueField(modeName));
  }
  if (!sameSet(variable.scopes, planned.scopes)) changed.push("scopes");
  if (variable.codeSyntax.WEB !== planned.webSyntax) changed.push("code syntax");
  if (variable.description !== planned.description) changed.push("description");
  if (variable.getPluginData(SEMANTIC_TOKEN_PLUGIN_DATA_KEY) !== planned.token) changed.push("token");
  return changed;
}

function apply(
  variable: Variable,
  planned: PlannedSemanticVariable,
  modeNames: readonly string[],
  modeIds: Map<string, string>,
  primitives: Map<string, Variable>,
  fields: readonly string[],
): void {
  if (fields.includes("name")) variable.name = planned.name;
  for (const modeName of modeNames) {
    if (!fields.includes(valueField(modeName))) continue;
    const primitiveName = planned.aliases[modeName];
    const primitive = primitiveName ? primitives.get(primitiveName) : undefined;
    const modeId = modeIds.get(modeName);
    if (!primitive || !modeId) throw new Error(`cannot write ${planned.name} ${modeName}`);
    variable.setValueForMode(modeId, figma.variables.createVariableAlias(primitive));
  }
  if (fields.includes("scopes")) variable.scopes = [...planned.scopes];
  if (fields.includes("code syntax")) variable.setVariableCodeSyntax("WEB", planned.webSyntax);
  if (fields.includes("description")) variable.description = planned.description;
  if (fields.includes("token")) variable.setPluginData(SEMANTIC_TOKEN_PLUGIN_DATA_KEY, planned.token);
}

function sameAlias(actual: VariableValue | undefined, primitiveId: string): boolean {
  return isAlias(actual) && actual.id === primitiveId;
}

function isAlias(value: VariableValue | undefined): value is VariableAlias {
  return typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS";
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && b.every((item) => a.includes(item));
