import { CAMELLIA, camelliaExtensions, collectTokens, isReference } from "./dtcg.ts";
import type { DtcgToken, DtcgTree } from "./dtcg.ts";
import { planPrimitives } from "./plan-primitives.ts";
import type { PlannedVariable } from "./plan-primitives.ts";

export { CAMELLIA as TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE };

export const TEXT_STYLE_SHARED_ID_KEY = "id";

const TEXT_STYLE_ID_PATTERN = /^type-[0-9a-f]{6}$/;

const TEXT_STYLE_GROUPS = ["display", "heading", "body", "label", "code"];

const FONT_STYLE_BY_WEIGHT: Record<number, string> = {
  400: "Regular",
  500: "Medium",
  600: "SemiBold",
};

export interface PlannedPixels {
  unit: "PIXELS";
  value: number;
}

export interface PlannedPercent {
  unit: "PERCENT";
  value: number;
}

export interface PlannedTextStyle {
  name: string;
  id: string;
  fontFamilyVariable: string;
  fontFamilyId: string;
  fontFamilyName: string;
  fontWeightVariable: string;
  fontWeightId: string;
  fontStyle: string;
  fontSize: number;
  lineHeight: PlannedPixels;
  letterSpacing: PlannedPercent;
}

export interface TextStylePlan {
  styles: PlannedTextStyle[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const round = (n: number) => Number(n.toFixed(6));

const EM_RATIO_TO_FIGMA_PERCENT = 100;

export function planTextStyles(tree: DtcgTree): TextStylePlan {
  const primitives = new Map(
    planPrimitives(tree).variables.map((variable) => [variable.name, variable]),
  );
  const tokens = collectTokens(tree);
  const byPath = new Map(tokens.map((token) => [token.path.join("/"), token]));
  const idOwners = idsOnNonTextStyleTokens(tree);
  const styleNames = new Map<string, string>();
  const styles: PlannedTextStyle[] = [];

  for (const token of tokens) {
    const group = token.path[0] ?? "";
    const inGroup = TEXT_STYLE_GROUPS.includes(group);
    if (token.type === "typography" && !inGroup) {
      throw new Error(
        `plan-text-styles: ${token.path.join(".")} is typography outside ${TEXT_STYLE_GROUPS.join(", ")}`,
      );
    }
    if (inGroup && token.type !== "typography") {
      throw new Error(
        `plan-text-styles: ${token.path.join(".")} is in a Text Style group but its $type is "${token.type}"`,
      );
    }
    if (!inGroup) continue;

    const where = token.path.join(".");
    const name = styleName(token.path);
    claimStyleName(styleNames, name, where);
    const id = requireTextStyleId(token);
    claimTextStyleId(idOwners, name, id);
    const family = requireFamily(token, primitives);
    const weight = requireWeight(token, primitives);

    styles.push({
      name,
      id,
      fontFamilyVariable: family.variable,
      fontFamilyId: family.id,
      fontFamilyName: family.family,
      fontWeightVariable: weight.variable,
      fontWeightId: weight.id,
      fontStyle: weight.style,
      fontSize: fontSizePx(token),
      lineHeight: { unit: "PIXELS", value: lineHeightPx(token) },
      letterSpacing: letterSpacingOf(token, byPath),
    });
  }

  return { styles };
}

function styleName(path: string[]): string {
  if (path.length !== 2) {
    throw new Error(
      `plan-text-styles: ${path.join(".")} must be one group and one size, like display.lg`,
    );
  }
  const [group, size] = path;
  if (!group || !size) {
    throw new Error(
      `plan-text-styles: ${path.join(".")} must be one group and one size, like display.lg`,
    );
  }
  return `Camellia/${group.charAt(0).toUpperCase()}${group.slice(1)}/${size.toUpperCase()}`;
}

function requireTextStyleId(token: DtcgToken): string {
  const id = token.camellia.id;
  if (typeof id === "string" && TEXT_STYLE_ID_PATTERN.test(id)) return id;
  const shown = id === undefined ? "missing" : JSON.stringify(id);
  throw new Error(
    `plan-text-styles: ${token.path.join(".")} id is ${shown}; expected type-[0-9a-f]{6}`,
  );
}

function claimTextStyleId(idOwners: Map<string, string>, name: string, id: string): void {
  const owner = idOwners.get(id);
  if (owner !== undefined) {
    throw new Error(`plan-text-styles: ${name} reuses id "${id}" already used by ${owner}`);
  }
  idOwners.set(id, name);
}

function claimStyleName(names: Map<string, string>, name: string, where: string): void {
  const owner = names.get(name);
  if (owner !== undefined) {
    throw new Error(`plan-text-styles: ${where} and ${owner} both plan the Text Style "${name}"`);
  }
  names.set(name, where);
}

function requireFamily(
  token: DtcgToken,
  primitives: Map<string, PlannedVariable>,
): { variable: string; id: string; family: string } {
  const where = token.path.join(".");
  const reference = referenceField(token, "fontFamily");
  const variable = reference.slice(1, -1).split(".").join("/");
  const primitive = primitives.get(variable);
  if (!primitive || primitive.type !== "STRING" || !variable.startsWith("font/family/")) {
    throw new Error(
      `plan-text-styles: ${where} fontFamily references ${reference}, which is not a font/family variable`,
    );
  }
  if (typeof primitive.value !== "string" || primitive.value.length === 0) {
    throw new Error(`plan-text-styles: ${where} font family variable ${variable} has no family name`);
  }
  return { variable, id: primitive.id, family: primitive.value };
}

function requireWeight(
  token: DtcgToken,
  primitives: Map<string, PlannedVariable>,
): { variable: string; id: string; style: string } {
  const where = token.path.join(".");
  const reference = referenceField(token, "fontWeight");
  const variable = reference.slice(1, -1).split(".").join("/");
  const primitive = primitives.get(variable);
  if (!primitive || primitive.type !== "FLOAT" || !variable.startsWith("font/weight/")) {
    throw new Error(
      `plan-text-styles: ${where} fontWeight references ${reference}, which is not a font/weight variable`,
    );
  }
  if (typeof primitive.value !== "number") {
    throw new Error(`plan-text-styles: ${where} font weight variable ${variable} is not a number`);
  }
  const style = FONT_STYLE_BY_WEIGHT[primitive.value];
  if (style === undefined) {
    throw new Error(
      `plan-text-styles: ${where} font weight ${primitive.value} has no style name; expected 400, 500, or 600`,
    );
  }
  return { variable, id: primitive.id, style };
}

function referenceField(token: DtcgToken, field: "fontFamily" | "fontWeight"): string {
  const value = composite(token)[field];
  if (!isReference(value)) {
    throw new Error(
      `plan-text-styles: ${token.path.join(".")} ${field} must reference a variable, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function fontSizePx(token: DtcgToken): number {
  const value = composite(token).fontSize;
  if (!isRecord(value) || value.unit !== "px" || typeof value.value !== "number" || !Number.isFinite(value.value)) {
    throw new Error(
      `plan-text-styles: ${token.path.join(".")} fontSize must be a px dimension, got ${JSON.stringify(value)}`,
    );
  }
  return value.value;
}

function lineHeightPx(token: DtcgToken): number {
  const value = token.camellia.lineHeightPx;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    const shown = value === undefined ? "missing" : JSON.stringify(value);
    throw new Error(
      `plan-text-styles: ${token.path.join(".")} lineHeightPx must be a number of pixels, got ${shown}`,
    );
  }
  return value;
}

function letterSpacingOf(token: DtcgToken, byPath: Map<string, DtcgToken>): PlannedPercent {
  const where = token.path.join(".");
  const intent = token.camellia.trackingIntent;
  if (!isReference(intent)) {
    throw new Error(
      `plan-text-styles: ${where} trackingIntent must reference a tracking token, got ${JSON.stringify(intent)}`,
    );
  }
  const name = intent.slice(1, -1).split(".").join("/");
  const tracking = byPath.get(name);
  if (!tracking || tracking.path[0] !== "tracking") {
    throw new Error(`plan-text-styles: ${where} trackingIntent ${intent} is not a tracking token`);
  }
  if (tracking.type !== "number" || typeof tracking.value !== "number" || !Number.isFinite(tracking.value)) {
    throw new Error(`plan-text-styles: ${where} tracking token ${name} must be an em ratio`);
  }
  if (tracking.camellia.unit !== "em") {
    throw new Error(
      `plan-text-styles: ${where} tracking token ${name} must use em, got ${JSON.stringify(tracking.camellia.unit)}`,
    );
  }
  return { unit: "PERCENT", value: round(tracking.value * EM_RATIO_TO_FIGMA_PERCENT) };
}

function composite(token: DtcgToken): Record<string, unknown> {
  if (!isRecord(token.value)) {
    throw new Error(`plan-text-styles: ${token.path.join(".")} $value must be a typography composite`);
  }
  return token.value;
}

function idsOnNonTextStyleTokens(tree: DtcgTree): Map<string, string> {
  const owners = new Map<string, string>();
  walk(tree, [], undefined, owners);
  return owners;
}

function walk(
  node: unknown,
  path: string[],
  inheritedType: string | undefined,
  owners: Map<string, string>,
): void {
  if (!isRecord(node)) return;
  const type = typeof node.$type === "string" ? node.$type : inheritedType;
  const textStyle = "$value" in node && TEXT_STYLE_GROUPS.includes(path[0] ?? "") && type === "typography";
  const id = camelliaExtensions(node).id;
  if (typeof id === "string" && !textStyle && !owners.has(id)) {
    owners.set(id, path.length === 0 ? "(root)" : path.join("/"));
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    walk(child, [...path, key], type, owners);
  }
}
