// Read-only: this plugin must not create, modify, or delete anything yet.

async function main(): Promise<void> {
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

  figma.closePlugin(
    `Camellia Sync ready · ${collections.length} collections, ${variables.length} variables, ` +
      `${textStyles.length} text, ${effectStyles.length} effect, ${paintStyles.length} paint styles`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(error);
  figma.closePlugin(`Camellia Sync failed: ${message}`);
});
