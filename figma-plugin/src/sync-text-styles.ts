import {
  PRIMITIVE_SHARED_ID_KEY,
  PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE,
} from "./plan-primitives.ts";
import {
  TEXT_STYLE_SHARED_ID_KEY,
  TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE,
} from "./plan-text-styles.ts";
import type { PlannedTextStyle, TextStylePlan } from "./plan-text-styles.ts";

export interface TextStyleSyncReport {
  dryRun: boolean;
  created: string[];
  updated: string[];
  unchanged: number;
  notInJson: string[];
  errors: string[];
}

export interface TextStyleSyncOptions {
  dryRun: boolean;
  primitiveCollectionName: string;
}

interface Match {
  planned: PlannedTextStyle;
  style?: TextStyle;
}

interface Pending {
  match: Match;
  family: Variable;
  weight: Variable;
  fields: string[];
}

interface PrimitiveIndex {
  byName: Map<string, Variable>;
  byId: Map<string, Variable>;
}

interface FontFailure {
  family: string;
  style: string;
  available: string[] | null;
}

const ALL_FIELDS = [
  "name",
  "font name",
  "font family binding",
  "font weight binding",
  "font size",
  "line height",
  "letter spacing",
  "token id",
];

export async function syncTextStyles(
  plan: TextStylePlan,
  { dryRun, primitiveCollectionName }: TextStyleSyncOptions,
): Promise<TextStyleSyncReport> {
  const report: TextStyleSyncReport = {
    dryRun,
    created: [],
    updated: [],
    unchanged: 0,
    notInJson: [],
    errors: [],
  };

  const indexed = await indexTextStyles(plan);
  report.notInJson = indexed.notInJson;
  const fonts = await loadFontVariables(primitiveCollectionName);
  const fontVariables = requireFontVariables(plan, fonts, primitiveCollectionName);

  const pending: Pending[] = [];
  for (const match of indexed.matches) {
    const family = fontVariables.get(match.planned.fontFamilyId);
    const weight = fontVariables.get(match.planned.fontWeightId);
    if (!family || !weight) {
      throw new Error(`${match.planned.name} is missing a font variable after the preflight`);
    }
    if (!match.style) {
      pending.push({ match, family, weight, fields: [...ALL_FIELDS] });
      continue;
    }
    const fields = differences(match.style, match.planned, family, weight);
    if (fields.length === 0) {
      report.unchanged++;
      continue;
    }
    pending.push({ match, family, weight, fields });
  }

  const failures = await failingFonts(pending, dryRun);

  for (const item of pending) {
    const planned = item.match.planned;
    const failure = failures.get(fontKey(planned.fontFamilyName, planned.fontStyle));
    if (needsFont(item.fields) && failure) {
      report.errors.push(fontFailureMessage(planned.name, failure));
      continue;
    }
    try {
      if (!item.match.style) {
        if (!dryRun) {
          const created = figma.createTextStyle();
          apply(created, planned, item.family, item.weight, item.fields);
        }
        report.created.push(planned.name);
        continue;
      }
      report.updated.push(`${planned.name} [${item.fields.join(", ")}] (${item.match.style.id})`);
      if (!dryRun) apply(item.match.style, planned, item.family, item.weight, item.fields);
    } catch (error) {
      report.errors.push(`${planned.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return report;
}

async function indexTextStyles(plan: TextStylePlan): Promise<{
  matches: Match[];
  notInJson: string[];
}> {
  const styles = await figma.getLocalTextStylesAsync();

  const byName = new Map<string, TextStyle>();
  for (const style of styles) {
    if (byName.has(style.name)) {
      throw new Error(`two text styles are named "${style.name}"`);
    }
    byName.set(style.name, style);
  }

  const byId = new Map<string, TextStyle>();
  for (const style of styles) {
    const tokenId = sharedId(style);
    if (tokenId === "") continue;
    if (byId.has(tokenId)) {
      throw new Error(`two text styles have id "${tokenId}"`);
    }
    byId.set(tokenId, style);
  }

  const matches: Match[] = [];
  const used = new Set<TextStyle>();
  for (const planned of plan.styles) {
    const tagged = byId.get(planned.id);
    if (tagged) {
      adopt(planned, tagged, byName, used, matches);
      continue;
    }
    const holder = byName.get(planned.name);
    if (holder && sharedId(holder) === "") {
      adopt(planned, holder, byName, used, matches);
      continue;
    }
    if (holder) throw nameCollision(planned.name, holder);
    matches.push({ planned });
  }

  return {
    matches,
    notInJson: styles.filter((style) => !used.has(style)).map((style) => style.name),
  };
}

function adopt(
  planned: PlannedTextStyle,
  style: TextStyle,
  byName: Map<string, TextStyle>,
  used: Set<TextStyle>,
  matches: Match[],
): void {
  if (used.has(style)) {
    throw new Error(`${planned.name} reuses id "${planned.id}" already matched to another text style`);
  }
  const holder = byName.get(planned.name);
  if (holder && holder !== style) throw nameCollision(planned.name, holder);
  used.add(style);
  matches.push({ planned, style });
}

function nameCollision(name: string, holder: TextStyle): Error {
  return new Error(`setting ${name} would collide with another text style (${holder.id})`);
}

async function loadFontVariables(collectionName: string): Promise<PrimitiveIndex> {
  const collections = (await figma.variables.getLocalVariableCollectionsAsync()).filter(
    (collection) => collection.name === collectionName,
  );
  if (collections.length !== 1) {
    throw new Error(
      collections.length === 0
        ? `no collection is named "${collectionName}", so Text Styles have no font variables to bind`
        : `${collections.length} collections are named "${collectionName}"; expected one`,
    );
  }

  const collectionId = collections[0].id;
  const variables = (await figma.variables.getLocalVariablesAsync()).filter(
    (variable) => variable.variableCollectionId === collectionId,
  );
  const byName = new Map<string, Variable>();
  for (const variable of variables) {
    if (byName.has(variable.name)) {
      throw new Error(`"${collectionName}" has two variables named ${variable.name}`);
    }
    byName.set(variable.name, variable);
  }
  const byId = new Map<string, Variable>();
  for (const variable of variables) {
    const tokenId = variableSharedId(variable);
    if (tokenId === "") continue;
    if (byId.has(tokenId)) {
      throw new Error(`"${collectionName}" has two variables with id "${tokenId}"`);
    }
    byId.set(tokenId, variable);
  }
  return { byName, byId };
}

function requireFontVariables(
  plan: TextStylePlan,
  index: PrimitiveIndex,
  collectionName: string,
): Map<string, Variable> {
  const found = new Map<string, Variable>();
  const problems: string[] = [];
  const seen = new Set<string>();

  const consider = (name: string, id: string, type: "STRING" | "FLOAT") => {
    if (seen.has(id)) return;
    seen.add(id);
    const variable = index.byId.get(id);
    if (!variable) {
      const named = index.byName.get(name);
      if (!named) {
        problems.push(`${name} (${id}) is missing`);
        return;
      }
      const actual = variableSharedId(named);
      problems.push(`${name} exists but its id is "${actual === "" ? "missing" : actual}", not "${id}"`);
      return;
    }
    if (variable.resolvedType !== type) {
      problems.push(`${name} (${id}) is ${variable.resolvedType} but ${type} is required`);
      return;
    }
    found.set(id, variable);
  };

  for (const style of plan.styles) {
    consider(style.fontFamilyVariable, style.fontFamilyId, "STRING");
    consider(style.fontWeightVariable, style.fontWeightId, "FLOAT");
  }

  if (problems.length > 0) {
    throw new Error(
      `Text Style font variables are missing from "${collectionName}":\n${problems.join("\n")}`,
    );
  }
  return found;
}

function differences(
  style: TextStyle,
  planned: PlannedTextStyle,
  family: Variable,
  weight: Variable,
): string[] {
  const changed: string[] = [];
  if (style.name !== planned.name) changed.push("name");
  changed.push(...fontDifferences(style, planned, family, weight));
  if (style.fontSize !== planned.fontSize) changed.push("font size");
  if (!sameLineHeight(style.lineHeight, planned.lineHeight.value)) changed.push("line height");
  if (!sameLetterSpacing(style.letterSpacing, planned.letterSpacing.value)) changed.push("letter spacing");
  if (sharedId(style) !== planned.id) changed.push("token id");
  return changed;
}

function fontDifferences(
  style: TextStyle,
  planned: PlannedTextStyle,
  family: Variable,
  weight: Variable,
): string[] {
  const familyAlias = boundVariableId(style, "fontFamily");
  const weightAlias = boundVariableId(style, "fontWeight");
  const familyBound = familyAlias === family.id;
  const weightBound = weightAlias === weight.id;
  if (familyBound && weightBound) return [];

  // Figma may drop setBoundVariable on a text style.
  const plainOk =
    style.fontName.family === planned.fontFamilyName && style.fontName.style === planned.fontStyle;
  const settled = plainOk && sharedId(style) === planned.id;
  const familyNeedsWrite = !familyBound && !(settled && familyAlias === "");
  const weightNeedsWrite = !weightBound && !(settled && weightAlias === "");
  if (!familyNeedsWrite && !weightNeedsWrite) return [];

  const changed: string[] = [];
  if (!plainOk) changed.push("font name");
  if (familyNeedsWrite) changed.push("font family binding");
  if (weightNeedsWrite) changed.push("font weight binding");
  return changed;
}

function apply(
  style: TextStyle,
  planned: PlannedTextStyle,
  family: Variable,
  weight: Variable,
  fields: readonly string[],
): void {
  if (fields.includes("name")) style.name = planned.name;
  const writeFont =
    fields.includes("font name") ||
    fields.includes("font family binding") ||
    fields.includes("font weight binding");
  if (writeFont) {
    style.fontName = { family: planned.fontFamilyName, style: planned.fontStyle };
    bindFont(style, "fontFamily", family);
    bindFont(style, "fontWeight", weight);
  }
  if (fields.includes("font size")) style.fontSize = planned.fontSize;
  if (fields.includes("line height")) {
    style.lineHeight = { unit: "PIXELS", value: planned.lineHeight.value };
  }
  if (fields.includes("letter spacing")) {
    style.letterSpacing = { unit: "PERCENT", value: planned.letterSpacing.value };
  }
  if (fields.includes("token id")) {
    style.setSharedPluginData(
      TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE,
      TEXT_STYLE_SHARED_ID_KEY,
      planned.id,
    );
  }
}

function bindFont(style: TextStyle, field: "fontFamily" | "fontWeight", variable: Variable): void {
  try {
    style.setBoundVariable(field, variable);
  } catch {
    // Figma rejected the binding.
  }
}

function needsFont(fields: readonly string[]): boolean {
  return fields.some((field) => field !== "name" && field !== "token id");
}

async function failingFonts(pending: readonly Pending[], dryRun: boolean): Promise<Map<string, FontFailure>> {
  const needed = new Map<string, PlannedTextStyle>();
  for (const item of pending) {
    if (!needsFont(item.fields)) continue;
    const planned = item.match.planned;
    needed.set(fontKey(planned.fontFamilyName, planned.fontStyle), planned);
  }
  const failures = new Map<string, FontFailure>();
  if (needed.size === 0) return failures;

  if (dryRun) {
    const fonts = await readFontList();
    for (const planned of needed.values()) {
      const available = fonts === null ? null : stylesForFamily(fonts, planned.fontFamilyName);
      const present = available !== null && available.includes(planned.fontStyle);
      if (present) continue;
      failures.set(fontKey(planned.fontFamilyName, planned.fontStyle), {
        family: planned.fontFamilyName,
        style: planned.fontStyle,
        available,
      });
    }
    return failures;
  }

  const failed: PlannedTextStyle[] = [];
  for (const planned of needed.values()) {
    try {
      await figma.loadFontAsync({ family: planned.fontFamilyName, style: planned.fontStyle });
    } catch {
      failed.push(planned);
    }
  }
  if (failed.length === 0) return failures;

  const fonts = await readFontList();
  for (const planned of failed) {
    failures.set(fontKey(planned.fontFamilyName, planned.fontStyle), {
      family: planned.fontFamilyName,
      style: planned.fontStyle,
      available: fonts === null ? null : stylesForFamily(fonts, planned.fontFamilyName),
    });
  }
  return failures;
}

async function readFontList(): Promise<Font[] | null> {
  try {
    return await figma.listAvailableFontsAsync();
  } catch {
    return null;
  }
}

function stylesForFamily(fonts: readonly Font[], family: string): string[] {
  const styles: string[] = [];
  for (const font of fonts) {
    if (font.fontName.family !== family) continue;
    if (!styles.includes(font.fontName.style)) styles.push(font.fontName.style);
  }
  return styles;
}

function fontFailureMessage(styleName: string, failure: FontFailure): string {
  const tried = `family "${failure.family}" and style "${failure.style}"`;
  let available: string;
  if (failure.available === null) {
    available = "The font list could not be read.";
  } else if (failure.available.length === 0) {
    available = `The family "${failure.family}" has no styles available.`;
  } else {
    available = `The family "${failure.family}" has: ${failure.available.join(", ")}.`;
  }
  return `${styleName}: font failed to load (${tried}). ${available} No other font was substituted.`;
}

function fontKey(family: string, style: string): string {
  return `${family}\0${style}`;
}

function sharedId(style: TextStyle): string {
  return style.getSharedPluginData(TEXT_STYLE_SHARED_PLUGIN_DATA_NAMESPACE, TEXT_STYLE_SHARED_ID_KEY);
}

function variableSharedId(variable: Variable): string {
  return variable.getSharedPluginData(PRIMITIVE_SHARED_PLUGIN_DATA_NAMESPACE, PRIMITIVE_SHARED_ID_KEY);
}

function boundVariableId(style: TextStyle, field: "fontFamily" | "fontWeight"): string {
  const alias = style.boundVariables?.[field];
  if (!alias || alias.type !== "VARIABLE_ALIAS") return "";
  return alias.id;
}

function sameLineHeight(actual: LineHeight, pixels: number): boolean {
  return actual.unit === "PIXELS" && actual.value === pixels;
}

function sameLetterSpacing(actual: LetterSpacing, percent: number): boolean {
  return actual.unit === "PERCENT" && actual.value === percent;
}
