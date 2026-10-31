import { CAMELLIA, camelliaExtensions, collectTokens, figmaTargets, isReference } from "./dtcg.ts";
import type { DtcgToken, DtcgTree } from "./dtcg.ts";
import { planPrimitives } from "./plan-primitives.ts";
import type { PlannedVariable } from "./plan-primitives.ts";

export { CAMELLIA as SEMANTIC_SHARED_PLUGIN_DATA_NAMESPACE };

export const SEMANTIC_SHARED_ID_KEY = "id";

export const LEGACY_SEMANTIC_TOKEN_PLUGIN_DATA_KEY = "token";

const SEMANTIC_ID_PATTERN = /^sem-[0-9a-f]{6}$/;

export interface PlannedSemanticVariable {
  name: string;
  id: string;
  type: "COLOR" | "FLOAT";
  aliases: Record<string, string>;
  aliasIds: Record<string, string>;
  scopes: VariableScope[];
  webSyntax: string;
  description: string;
}

export interface SemanticPlan {
  collectionName: string;
  modeNames: string[];
  variables: PlannedSemanticVariable[];
}

const FRAME_AND_SHAPE: VariableScope[] = ["FRAME_FILL", "SHAPE_FILL"];
const TEXT: VariableScope[] = ["TEXT_FILL"];
const STROKE: VariableScope[] = ["STROKE_COLOR"];
const SHAPE: VariableScope[] = ["SHAPE_FILL"];
const SHAPE_AND_STROKE: VariableScope[] = ["SHAPE_FILL", "STROKE_COLOR"];
const GAP: VariableScope[] = ["GAP"];

const COLOR_SCOPES: Record<string, VariableScope[]> = {
  "color/background/canvas": FRAME_AND_SHAPE,
  "color/surface/primary": FRAME_AND_SHAPE,
  "color/surface/secondary": FRAME_AND_SHAPE,
  "color/surface/subtle": FRAME_AND_SHAPE,
  "color/surface/selected": FRAME_AND_SHAPE,
  "color/text/primary": TEXT,
  "color/text/secondary": TEXT,
  "color/text/tertiary": TEXT,
  "color/text/inverse": TEXT,
  "color/icon/primary": SHAPE,
  "color/icon/secondary": SHAPE,
  "color/border/subtle": STROKE,
  "color/border/default": STROKE,
  "color/border/strong": STROKE,
  "color/action/primary": FRAME_AND_SHAPE,
  "color/action/primary-hover": FRAME_AND_SHAPE,
  "color/action/primary-pressed": FRAME_AND_SHAPE,
  "color/action/primary-text": TEXT,
  "color/action/link": TEXT,
  "color/action/link-hover": TEXT,
  "color/focus": STROKE,
  "color/functional/accent": SHAPE_AND_STROKE,
  "color/functional/surface": FRAME_AND_SHAPE,
  "color/expression/pink": FRAME_AND_SHAPE,
  "color/expression/blue": FRAME_AND_SHAPE,
  "color/expression/green": FRAME_AND_SHAPE,
};

/**
 * Figma has no variable type for color + width + style.
 */
const DEFERRED_BORDER_LEAVES = new Set(["subtle", "default", "strong", "focus"]);

const DEFERRED_SHADOW_LEAVES = new Set(["raised", "control", "control-hover"]);

const MODE_INDEPENDENT_GROUPS = ["layout", "control"];

interface Draft {
  name: string;
  id: string;
  type: "COLOR" | "FLOAT";
  description: string;
  aliases: Record<string, string>;
  aliasIds: Record<string, string>;
}

interface ThemeIdentity {
  id: string;
  modeName: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function planSemantic(tree: DtcgTree): SemanticPlan {
  const targets = figmaTargets(tree);
  const modeNames = targets.semanticModes;
  if (new Set(modeNames).size !== modeNames.length) {
    throw new Error("plan-semantic: targets.figma.semanticModes has duplicate names");
  }

  const primitiveByName = new Map(
    planPrimitives(tree).variables.map((variable) => [variable.name, variable]),
  );
  const drafts = new Map<string, Draft>();
  const idOwners = new Map<string, string>();
  const themeIds = new Map<string, ThemeIdentity>();

  planTheme(tree, modeNames, targets.semanticCollection, primitiveByName, drafts, idOwners, themeIds);
  for (const groupName of MODE_INDEPENDENT_GROUPS) {
    planModeIndependentGroup(
      tree,
      groupName,
      modeNames,
      targets.semanticCollection,
      primitiveByName,
      drafts,
      idOwners,
    );
  }

  return {
    collectionName: targets.semanticCollection,
    modeNames: [...modeNames],
    variables: [...drafts.values()].map(toPlannedVariable),
  };
}

function planTheme(
  tree: DtcgTree,
  modeNames: readonly string[],
  semanticCollection: string,
  primitiveByName: Map<string, PlannedVariable>,
  drafts: Map<string, Draft>,
  idOwners: Map<string, string>,
  themeIds: Map<string, ThemeIdentity>,
): void {
  const theme = requireGroup(tree, "theme");
  const extensions = camelliaExtensions(theme);
  requireSameCollection("theme", extensions, semanticCollection);
  const keyByMode = themeModeKeys(extensions.modeMap, modeNames);

  for (const modeName of modeNames) {
    const jsonKey = keyByMode.get(modeName);
    if (jsonKey === undefined) {
      throw new Error("plan-semantic: theme modeMap disagrees with targets.figma.semanticModes");
    }
    const modeNode = theme[jsonKey];
    if (!isObject(modeNode)) {
      throw new Error(`plan-semantic: theme.${jsonKey} group is missing`);
    }
    for (const token of collectTokens(modeNode, ["theme", jsonKey])) {
      const name = token.path.slice(2).join("/");
      if (name.length === 0) {
        throw new Error(`plan-semantic: ${token.path.join(".")} has no semantic name`);
      }
      const deferred =
        (token.type === "border" && isDeferredCompositeBorder(token.path)) ||
        (token.type === "shadow" && isDeferredThemeShadow(token.path));
      if (deferred) {
        rememberThemeId(themeIds, idOwners, name, requireSemanticId(token), modeName);
        continue;
      }
      addThemeAlias(drafts, token, name, modeName, primitiveByName, idOwners, themeIds);
    }
  }

  for (const draft of drafts.values()) {
    for (const modeName of modeNames) {
      if (!(modeName in draft.aliases)) {
        throw new Error(`plan-semantic: one-sided theme token ${draft.name}; missing ${modeName}`);
      }
    }
  }
}

function planModeIndependentGroup(
  tree: DtcgTree,
  groupName: string,
  modeNames: readonly string[],
  semanticCollection: string,
  primitiveByName: Map<string, PlannedVariable>,
  drafts: Map<string, Draft>,
  idOwners: Map<string, string>,
): void {
  const group = requireGroup(tree, groupName);
  const extensions = camelliaExtensions(group);
  requireSameCollection(groupName, extensions, semanticCollection);
  requireSameModes(groupName, extensions.modes, modeNames);

  for (const token of collectTokens(group, [groupName])) {
    const type = figmaTypeFor(token, "spacing");
    const id = requireSemanticId(token);
    const primitive = resolveAlias(token, primitiveByName, type);
    const name = token.path.join("/");
    if (drafts.has(name)) {
      throw new Error(`plan-semantic: ${name} is planned twice`);
    }
    claimSemanticId(idOwners, name, id);
    const aliases: Record<string, string> = {};
    const aliasIds: Record<string, string> = {};
    for (const modeName of modeNames) {
      aliases[modeName] = primitive.name;
      aliasIds[modeName] = primitive.id;
    }
    drafts.set(name, { name, id, type, description: token.description, aliases, aliasIds });
  }
}

function addThemeAlias(
  drafts: Map<string, Draft>,
  token: DtcgToken,
  name: string,
  modeName: string,
  primitiveByName: Map<string, PlannedVariable>,
  idOwners: Map<string, string>,
  themeIds: Map<string, ThemeIdentity>,
): void {
  const type = figmaTypeFor(token, "theme");
  const id = requireSemanticId(token);
  rememberThemeId(themeIds, idOwners, name, id, modeName);
  const primitive = resolveAlias(token, primitiveByName, type);
  const existing = drafts.get(name);
  if (!existing) {
    drafts.set(name, {
      name,
      id,
      type,
      description: token.description,
      aliases: { [modeName]: primitive.name },
      aliasIds: { [modeName]: primitive.id },
    });
    return;
  }
  if (existing.type !== type) {
    throw new Error(`plan-semantic: ${name} $type disagrees between modes`);
  }
  if (existing.description !== token.description) {
    throw new Error(`plan-semantic: ${name} descriptions disagree between modes`);
  }
  if (modeName in existing.aliases) {
    throw new Error(`plan-semantic: ${name} appears twice under ${modeName}`);
  }
  existing.aliases[modeName] = primitive.name;
  existing.aliasIds[modeName] = primitive.id;
}

function toPlannedVariable(draft: Draft): PlannedSemanticVariable {
  return {
    name: draft.name,
    id: draft.id,
    type: draft.type,
    aliases: { ...draft.aliases },
    aliasIds: { ...draft.aliasIds },
    scopes: scopesFor(draft.name, draft.type),
    webSyntax: `var(--${draft.name.split("/").join("-")})`,
    description: draft.description,
  };
}

function scopesFor(name: string, type: "COLOR" | "FLOAT"): VariableScope[] {
  if (type === "FLOAT") {
    if (name.startsWith("layout/") || name.startsWith("control/")) return GAP;
    throw new Error(`plan-semantic: ${name} has no approved scopes`);
  }
  const scopes = COLOR_SCOPES[name] ?? colorScopeFamily(name);
  if (!scopes) throw new Error(`plan-semantic: ${name} has no approved scopes`);
  return scopes;
}

const COLOR_SCOPE_FAMILIES: { prefix: string; scopes: VariableScope[] }[] = [
  { prefix: "color/action/primary-text", scopes: TEXT },
  { prefix: "color/action/link", scopes: TEXT },
  { prefix: "color/action/", scopes: FRAME_AND_SHAPE },
  { prefix: "color/text/", scopes: TEXT },
  { prefix: "color/icon/", scopes: SHAPE },
  { prefix: "color/border/", scopes: STROKE },
  { prefix: "color/focus", scopes: STROKE },
  { prefix: "color/background/", scopes: FRAME_AND_SHAPE },
  { prefix: "color/surface/", scopes: FRAME_AND_SHAPE },
  { prefix: "color/expression/", scopes: FRAME_AND_SHAPE },
  { prefix: "color/functional/accent", scopes: SHAPE_AND_STROKE },
  { prefix: "color/functional/", scopes: FRAME_AND_SHAPE },
];

function colorScopeFamily(name: string): VariableScope[] | undefined {
  return COLOR_SCOPE_FAMILIES.find((family) => name.startsWith(family.prefix))?.scopes;
}

function requireSemanticId(token: DtcgToken): string {
  const id = token.camellia.id;
  if (typeof id === "string" && SEMANTIC_ID_PATTERN.test(id)) return id;
  const shown = id === undefined ? "missing" : JSON.stringify(id);
  throw new Error(
    `plan-semantic: ${token.path.join(".")} id is ${shown}; expected sem-[0-9a-f]{6}`,
  );
}

function claimSemanticId(idOwners: Map<string, string>, name: string, id: string): void {
  const owner = idOwners.get(id);
  if (owner !== undefined && owner !== name) {
    throw new Error(`plan-semantic: ${name} reuses id "${id}" already used by ${owner}`);
  }
  idOwners.set(id, name);
}

function rememberThemeId(
  themeIds: Map<string, ThemeIdentity>,
  idOwners: Map<string, string>,
  name: string,
  id: string,
  modeName: string,
): void {
  const prior = themeIds.get(name);
  if (prior === undefined) {
    themeIds.set(name, { id, modeName });
    claimSemanticId(idOwners, name, id);
    return;
  }
  if (prior.id !== id) {
    throw new Error(
      `plan-semantic: ${name} ids differ between ${prior.modeName} (${prior.id}) and ${modeName} (${id})`,
    );
  }
}

function figmaTypeFor(token: DtcgToken, group: "theme" | "spacing"): "COLOR" | "FLOAT" {
  if (group === "theme" && token.type === "color") return "COLOR";
  if (group === "spacing" && token.type === "dimension") return "FLOAT";
  throw new Error(`plan-semantic: ${token.path.join(".")} has unexpected $type "${token.type}"`);
}

function resolveAlias(
  token: DtcgToken,
  primitiveByName: Map<string, PlannedVariable>,
  figmaType: "COLOR" | "FLOAT",
): { name: string; id: string } {
  const where = token.path.join(".");
  if (!isReference(token.value)) {
    throw new Error(
      `plan-semantic: ${where} must be a single reference, got ${JSON.stringify(token.value)}`,
    );
  }
  const primitiveName = token.value.slice(1, -1).split(".").join("/");
  const primitive = primitiveByName.get(primitiveName);
  if (!primitive) {
    throw new Error(
      `plan-semantic: ${where} references ${token.value}, which is not in the Primitives plan`,
    );
  }
  if (primitive.type !== figmaType) {
    throw new Error(`plan-semantic: ${where} is ${figmaType} but ${primitiveName} is ${primitive.type}`);
  }
  return { name: primitiveName, id: primitive.id };
}

function isDeferredCompositeBorder(path: string[]): boolean {
  const leaf = path[3];
  return (
    path.length === 4 &&
    path[0] === "theme" &&
    path[2] === "border" &&
    leaf !== undefined &&
    DEFERRED_BORDER_LEAVES.has(leaf)
  );
}

function isDeferredThemeShadow(path: string[]): boolean {
  const leaf = path[3];
  return (
    path.length === 4 &&
    path[0] === "theme" &&
    path[2] === "shadow" &&
    leaf !== undefined &&
    DEFERRED_SHADOW_LEAVES.has(leaf)
  );
}

function requireGroup(tree: DtcgTree, name: string): Record<string, unknown> {
  const group = tree[name];
  if (!isObject(group)) throw new Error(`plan-semantic: ${name} group is missing`);
  return group;
}

function requireSameCollection(
  groupName: string,
  extensions: Record<string, unknown>,
  expected: string,
): void {
  if (extensions.figmaCollection === expected) return;
  const actual =
    typeof extensions.figmaCollection === "string" ? JSON.stringify(extensions.figmaCollection) : "(missing)";
  throw new Error(
    `plan-semantic: ${groupName} figmaCollection ${actual} disagrees with targets.figma.semanticCollection ${JSON.stringify(expected)}`,
  );
}

function requireSameModes(groupName: string, actual: unknown, expected: readonly string[]): void {
  const same =
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((mode, index) => mode === expected[index]);
  if (same) return;
  const shown = Array.isArray(actual) ? JSON.stringify(actual) : "(missing)";
  throw new Error(
    `plan-semantic: ${groupName} modes ${shown} disagree with targets.figma.semanticModes ${JSON.stringify(expected)}`,
  );
}

function themeModeKeys(modeMap: unknown, modeNames: readonly string[]): Map<string, string> {
  const disagree = "plan-semantic: theme modeMap disagrees with targets.figma.semanticModes";
  if (!isObject(modeMap)) throw new Error(disagree);
  const keyByMode = new Map<string, string>();
  for (const [jsonKey, figmaMode] of Object.entries(modeMap)) {
    if (typeof figmaMode !== "string" || keyByMode.has(figmaMode)) throw new Error(disagree);
    keyByMode.set(figmaMode, jsonKey);
  }
  if (keyByMode.size !== modeNames.length || modeNames.some((modeName) => !keyByMode.has(modeName))) {
    throw new Error(disagree);
  }
  return keyByMode;
}
