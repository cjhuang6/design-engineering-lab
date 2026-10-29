// Platform-neutral helpers for reading the DTCG token tree.
// No Figma APIs here, so this file can run under Node for tests.

export type DtcgTree = Record<string, unknown>;

export interface DtcgToken {
  path: string[];
  type: string;
  value: unknown;
  description: string;
  camellia: Record<string, unknown>;
}

export const CAMELLIA = "com.cjhuang.camellia";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function camelliaExtensions(node: Record<string, unknown>): Record<string, unknown> {
  const extensions = isObject(node.$extensions) ? node.$extensions : {};
  const camellia = extensions[CAMELLIA];
  return isObject(camellia) ? camellia : {};
}

/**
 * Every token in the tree, in source order. A token is any object with a
 * `$value`. `$type` may be declared on a parent group and is inherited
 * (feedback declares `"$type": "color"` once for all four colors).
 */
export function collectTokens(
  node: Record<string, unknown>,
  path: string[] = [],
  inheritedType?: string,
): DtcgToken[] {
  const type = typeof node.$type === "string" ? node.$type : inheritedType;

  if ("$value" in node) {
    if (!type) throw new Error(`dtcg: token ${path.join(".")} has no $type`);
    const description = typeof node.$description === "string" ? node.$description : "";
    return [{ path, type, value: node.$value, description, camellia: camelliaExtensions(node) }];
  }

  const tokens: DtcgToken[] = [];
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !isObject(child)) continue;
    tokens.push(...collectTokens(child, [...path, key], type));
  }
  return tokens;
}

/** Matches a value that is exactly one DTCG reference, e.g. "{space.4}". */
export const isReference = (value: unknown): value is string =>
  typeof value === "string" && /^\{[^{}]+\}$/.test(value);

export interface FigmaTargets {
  primitiveCollection: string;
  semanticCollection: string;
  semanticModes: string[];
}

/** Camellia's Figma target settings from the root `$extensions`. */
export function figmaTargets(tree: DtcgTree): FigmaTargets {
  const extensions = isObject(tree.$extensions) ? tree.$extensions : {};
  const camellia = isObject(extensions[CAMELLIA]) ? extensions[CAMELLIA] : {};
  const targets = isObject(camellia.targets) ? camellia.targets : {};
  const figma = isObject(targets.figma) ? targets.figma : {};

  return {
    primitiveCollection: requireTargetString(figma.primitiveCollection, "primitiveCollection"),
    semanticCollection: requireTargetString(figma.semanticCollection, "semanticCollection"),
    semanticModes: requireTargetStrings(figma.semanticModes, "semanticModes"),
  };
}

function requireTargetString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`dtcg: $extensions.${CAMELLIA}.targets.figma.${field} is missing`);
  }
  return value;
}

function requireTargetStrings(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new Error(`dtcg: $extensions.${CAMELLIA}.targets.figma.${field} is missing`);
  }
  return [...value];
}
