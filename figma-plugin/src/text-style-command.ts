import { figmaTargets } from "./dtcg.ts";
import type { DtcgTree } from "./dtcg.ts";
import { planTextStyles } from "./plan-text-styles.ts";
import { syncTextStyles } from "./sync-text-styles.ts";
import type { TextStyleSyncReport } from "./sync-text-styles.ts";

const LABEL = "Text Styles";

export async function runTextStyleSync(tokens: DtcgTree, dryRun: boolean): Promise<string> {
  const plan = planTextStyles(tokens);
  const report = await syncTextStyles(plan, {
    dryRun,
    primitiveCollectionName: figmaTargets(tokens).primitiveCollection,
  });
  logTextStyleReport(report);
  return textStyleToast(report);
}

function textStyleToast(report: TextStyleSyncReport): string {
  const created = report.dryRun ? "Would create" : "Created";
  const updated = report.dryRun ? "Would update" : "Updated";
  const summary =
    `${created} ${report.created.length} · ${updated} ${report.updated.length} · ` +
    `Unchanged ${report.unchanged} · Not in JSON ${report.notInJson.length} · Errors ${report.errors.length}`;
  return `Camellia · ${LABEL}${report.dryRun ? " (dry run)" : ""} · ${summary}`;
}

function logTextStyleReport(report: TextStyleSyncReport): void {
  const list = (title: string, items: string[]) => {
    if (items.length === 0) return;
    console.log(`${title} (${items.length}):`);
    for (const item of items) console.log(`  ${item}`);
  };

  console.log(`Camellia · Sync ${LABEL}${report.dryRun ? " — DRY RUN, nothing changed" : ""}`);
  list(report.dryRun ? "Would create" : "Created", report.created);
  list(report.dryRun ? "Would update" : "Updated", report.updated);
  console.log(`Unchanged: ${report.unchanged}`);
  list("In Figma but not in JSON (left untouched)", report.notInJson);
  list("Errors", report.errors);
}
