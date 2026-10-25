import tokens from "../tokens/camellia.tokens.json";
import { figmaTargets } from "./src/dtcg.ts";
import { planPrimitives } from "./src/plan-primitives.ts";
import { planSemantic } from "./src/plan-semantic.ts";
import { syncPrimitives } from "./src/sync-primitives.ts";
import { syncSemantic } from "./src/sync-semantic.ts";
import { runTextStyleSync } from "./src/text-style-command.ts";
import type { SyncReport } from "./src/sync-primitives.ts";
import type { SemanticSyncReport } from "./src/sync-semantic.ts";

async function inventory(): Promise<string> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const textStyles = await figma.getLocalTextStylesAsync();
  const effectStyles = await figma.getLocalEffectStylesAsync();
  const paintStyles = await figma.getLocalPaintStylesAsync();

  console.log("Camellia Figma Sync — read-only inventory");
  console.log(`File: ${figma.root.name}`);

  for (const collection of collections) {
    const modeNames = collection.modes.map((mode) => mode.name).join(", ");
    console.log(
      `Collection "${collection.name}": ${collection.variableIds.length} variables, modes: ${modeNames}`,
    );
  }

  console.log(`Variables:     ${variables.length}`);
  console.log(`Text styles:   ${textStyles.length}`);
  console.log(`Effect styles: ${effectStyles.length}`);
  console.log(`Paint styles:  ${paintStyles.length}`);

  return (
    `Camellia Sync ready · ${collections.length} collections, ${variables.length} variables, ` +
    `${textStyles.length} text, ${effectStyles.length} effect, ${paintStyles.length} paint styles`
  );
}

async function syncPrimitivesCommand(dryRun: boolean): Promise<string> {
  const plan = planPrimitives(tokens);
  const report = await syncPrimitives(plan, { dryRun });
  logReport(report);
  return toast(plan.collectionName, report);
}

async function syncSemanticCommand(dryRun: boolean): Promise<string> {
  const plan = planSemantic(tokens);
  const report = await syncSemantic(plan, {
    dryRun,
    primitiveCollectionName: figmaTargets(tokens).primitiveCollection,
  });
  logReport(report);
  return toast(plan.collectionName, report);
}

async function syncTextStylesCommand(dryRun: boolean): Promise<string> {
  return runTextStyleSync(tokens, dryRun);
}

function toast(collectionName: string, report: SyncReport | SemanticSyncReport): string {
  const would = report.dryRun ? "Would create" : "Created";
  const summary =
    `${would} ${report.created.length} · ${report.dryRun ? "Would update" : "Updated"} ${report.updated.length} · ` +
    `Unchanged ${report.unchanged} · Not in JSON ${report.notInJson.length} · Errors ${report.errors.length}`;
  return `Camellia · ${collectionName}${report.dryRun ? " (dry run)" : ""} · ${summary}`;
}

function logReport(report: SyncReport | SemanticSyncReport): void {
  const list = (title: string, items: string[]) => {
    if (items.length === 0) return;
    console.log(`${title} (${items.length}):`);
    for (const item of items) console.log(`  ${item}`);
  };

  console.log(`Camellia · Sync ${report.collection}${report.dryRun ? " — DRY RUN, nothing changed" : ""}`);
  if (report.collectionCreated) {
    console.log(`Collection "${report.collection}" ${report.dryRun ? "would be" : "was"} created`);
  }
  if ("modeRenamed" in report && report.modeRenamed) {
    console.log(`Mode ${report.dryRun ? "would be" : "was"} renamed: ${report.modeRenamed}`);
  }
  list(report.dryRun ? "Would create" : "Created", report.created);
  list(report.dryRun ? "Would update" : "Updated", report.updated);
  console.log(`Unchanged: ${report.unchanged}`);
  list("In Figma but not in JSON (left untouched)", report.notInJson);
  list("Errors", report.errors);
}

const commands: Record<string, () => Promise<string>> = {
  inventory,
  "sync-primitives-dry-run": () => syncPrimitivesCommand(true),
  "sync-primitives": () => syncPrimitivesCommand(false),
  "sync-semantic-dry-run": () => syncSemanticCommand(true),
  "sync-semantic": () => syncSemanticCommand(false),
  "sync-text-styles-dry-run": () => syncTextStylesCommand(true),
  "sync-text-styles": () => syncTextStylesCommand(false),
};

const command = commands[figma.command] ?? inventory;

command()
  .then((message) => figma.closePlugin(message))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    figma.closePlugin(`Camellia Sync failed: ${message}`);
  });
