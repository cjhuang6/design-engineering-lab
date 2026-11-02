// DTCG tokens → the list of variables the Figma "Primitives" collection
// should contain. No Figma APIs here (types only), so tests can run it in Node.

import { CAMELLIA, camelliaExtensions, collectTokens, figmaTargets, isReference } from "./dtcg.ts";
import type { DtcgToken, DtcgTree } from "./dtcg.ts";

export { CAMELLIA as PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE };

export const PRIMITIVE_SHARED_ID_KEY = "id";

const PRIMITIVE_ID_PATTERN = /^prim-[0-9a-f]{6}$/;

export type PlannedValue = RGBA | number | string | MotionEasing;

export interface PlannedVariable {
  name: string;
  id: string;
  type: VariableResolvedDataType;
  value: PlannedValue;
  /** null = leave Figma's default. Motion variables have no matching scope. */
  scopes: VariableScope[] | null;
  webSyntax: string;
  description: string;
}

export interface PrimitivesPlan {
  collectionName: string;
  modeName: string;
  variables: PlannedVariable[];
}

interface Rule {
  prefix: string[];
  scopes: VariableScope[] | null;
  /** Figma opacity variables are percentages (64), DTCG opacity is a ratio (0.64). */
  percent?: boolean;
}

/** Token groups that become Primitives variables. First matching prefix wins. */
const RULES: Rule[] = [
  // Hidden from pickers: design with Semantic colors; Semantic aliases these.
  { prefix: ["color", "base"], scopes: [] },
  { prefix: ["color", "primitive"], scopes: [] },
  // Visible: feedback has no Semantic Light/Dark layer to use instead.
  { prefix: ["feedback"], scopes: ["ALL_FILLS", "STROKE_COLOR"] },
  { prefix: ["font", "family"], scopes: ["FONT_FAMILY"] },
  { prefix: ["font", "weight"], scopes: ["FONT_WEIGHT"] },
  { prefix: ["space"], scopes: ["GAP"] },
  { prefix: ["radius"], scopes: ["CORNER_RADIUS"] },
  { prefix: ["border", "width"], scopes: ["STROKE_FLOAT"] },
  { prefix: ["opacity"], scopes: ["OPACITY"], percent: true },
  { prefix: ["blur"], scopes: ["EFFECT_FLOAT"] },
  { prefix: ["size"], scopes: ["WIDTH_HEIGHT"] },
  { prefix: ["breakpoint"], scopes: ["WIDTH_HEIGHT"] },
  { prefix: ["duration"], scopes: null },
  { prefix: ["ease"], scopes: null },
];

/**
 * Token groups that are intentionally not Primitives variables, and where
 * they go instead. A token matching neither RULES nor EXCLUDED fails the plan
 * instead of being silently dropped.
 */
export const EXCLUDED: { prefix: string[]; reason: string }[] = [
  { prefix: ["theme"], reason: "Semantic collection (2C)" },
  { prefix: ["layout"], reason: "Semantic collection (2C)" },
  { prefix: ["control"], reason: "Semantic collection (2C)" },
  { prefix: ["display"], reason: "Text Styles (2D)" },
  { prefix: ["heading"], reason: "Text Styles (2D)" },
  { prefix: ["body"], reason: "Text Styles (2D)" },
  { prefix: ["label"], reason: "Text Styles (2D)" },
  { prefix: ["code"], reason: "Text Styles (2D)" },
  { prefix: ["tracking"], reason: "Text Styles (2D); em ratios can't be px variables" },
  { prefix: ["shadow"], reason: "Effect Styles (2E)" },
  { prefix: ["frost"], reason: "Effect Styles (2E)" },
  { prefix: ["expression"], reason: "Paint Styles (2F)" },
  { prefix: ["z"], reason: "CSS only; Figma has no z-index" },
  { prefix: ["border", "style"], reason: "CSS only; no Figma variable type" },
];

const startsWith = (path: string[], prefix: string[]) =>
  prefix.every((key, i) => path[i] === key);

export function planPrimitives(tree: DtcgTree): PrimitivesPlan {
  const variables: PlannedVariable[] = [];
  const idOwners = idsOnNonPrimitiveTokens(tree);

  for (const token of collectTokens(tree)) {
    const rule = RULES.find((r) => startsWith(token.path, r.prefix));
    if (!rule) {
      if (EXCLUDED.some((e) => startsWith(token.path, e.prefix))) continue;
      throw new Error(
        `plan-primitives: ${token.path.join(".")} is in no RULES or EXCLUDED group; decide where it belongs`,
      );
    }
    if (isReference(token.value)) {
      throw new Error(
        `plan-primitives: ${token.path.join(".")} is a reference (${token.value}); primitives must hold raw values`,
      );
    }

    const { type, value } = toFigmaValue(token, rule);
    const name = token.path.join("/");
    const id = requirePrimitiveId(token);
    claimPrimitiveId(idOwners, name, id);
    variables.push({
      name,
      id,
      type,
      value,
      scopes: rule.scopes,
      webSyntax: `var(--${token.path.join("-")})`,
      description: token.description,
    });
  }

  return {
    collectionName: figmaTargets(tree).primitiveCollection,
    modeName: "Value",
    variables,
  };
}

function toFigmaValue(
  token: DtcgToken,
  rule: Rule,
): { type: VariableResolvedDataType; value: PlannedValue } {
  const where = token.path.join(".");
  const value = token.value as any;

  switch (token.type) {
    case "color": {
      if (value?.colorSpace !== "srgb") {
        throw new Error(`plan-primitives: ${where} must be an srgb color`);
      }
      const [r, g, b] = value.components;
      return { type: "COLOR", value: { r, g, b, a: value.alpha ?? 1 } };
    }

    case "dimension":
      if (value?.unit !== "px" || typeof value?.value !== "number") {
        throw new Error(`plan-primitives: ${where} must be a px dimension, got ${JSON.stringify(value)}`);
      }
      return { type: "FLOAT", value: value.value };

    case "number":
    case "fontWeight":
      if (typeof value !== "number") {
        throw new Error(`plan-primitives: ${where} must be a number, got ${JSON.stringify(value)}`);
      }
      return { type: "FLOAT", value: rule.percent ? round(value * 100) : value };

    case "fontFamily": {
      // Figma has no fallback fonts; the full stack stays in CSS.
      const family = Array.isArray(value) ? value[0] : value;
      if (typeof family !== "string") {
        throw new Error(`plan-primitives: ${where} must be a font family name`);
      }
      return { type: "STRING", value: family };
    }

    case "duration": {
      // Figma TIMING variables are in seconds.
      const seconds =
        value?.unit === "ms" ? value.value / 1000 : value?.unit === "s" ? value.value : NaN;
      if (!Number.isFinite(seconds)) {
        throw new Error(`plan-primitives: ${where} must be a duration in ms or s, got ${JSON.stringify(value)}`);
      }
      return { type: "TIMING", value: round(seconds) };
    }

    case "cubicBezier": {
      if (!Array.isArray(value) || value.length !== 4) {
        throw new Error(`plan-primitives: ${where} must be four cubic-bezier numbers`);
      }
      const [x1, y1, x2, y2] = value;
      return {
        type: "EASING",
        value: { type: "CUSTOM_CUBIC_BEZIER", easingFunctionCubicBezier: { x1, y1, x2, y2 } },
      };
    }

    default:
      throw new Error(`plan-primitives: no Figma conversion for $type "${token.type}" (${where})`);
  }
}

/** Strip float noise: 0.64 * 100 = 64.00000000000001 → 64. */
const round = (n: number) => Number(n.toFixed(6));

function requirePrimitiveId(token: DtcgToken): string {
  const id = token.camellia.id;
  if (typeof id === "string" && PRIMITIVE_ID_PATTERN.test(id)) return id;
  const shown = id === undefined ? "missing" : JSON.stringify(id);
  throw new Error(
    `plan-primitives: ${token.path.join(".")} id is ${shown}; expected prim-[0-9a-f]{6}`,
  );
}

function claimPrimitiveId(idOwners: Map<string, string>, name: string, id: string): void {
  const owner = idOwners.get(id);
  if (owner !== undefined) {
    throw new Error(`plan-primitives: ${name} reuses id "${id}" already used by ${owner}`);
  }
  idOwners.set(id, name);
}

function idsOnNonPrimitiveTokens(tree: DtcgTree): Map<string, string> {
  const owners = new Map<string, string>();
  walk(tree, [], owners);
  return owners;
}

function walk(node: unknown, path: string[], owners: Map<string, string>): void {
  if (!isRecord(node)) return;
  const id = camelliaExtensions(node).id;
  const primitiveToken = "$value" in node && RULES.some((rule) => startsWith(path, rule.prefix));
  if (typeof id === "string" && !primitiveToken && !owners.has(id)) {
    owners.set(id, path.length === 0 ? "(root)" : path.join("/"));
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    walk(child, [...path, key], owners);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
