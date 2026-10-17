import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MAP_DIR = ".cursor/skills/verify-camellia/features";
const INDEX = "README.md";
const MANIFEST = "figma-plugin/manifest.json";
const PACKAGE = "package.json";
const REPO_PATH = /^(?:src|scripts|figma-plugin|tokens|docs|\.cursor|\.github)\/[\w./-]*$/;
const GENERATED = [/^figma-plugin\/dist\//, /^dist\//];

const featureFiles = (await readdir(MAP_DIR)).filter((name) => name.endsWith(".md") && name !== INDEX).sort();
const index = await readFile(join(MAP_DIR, INDEX), "utf8");
const features = Object.fromEntries(
  await Promise.all(featureFiles.map(async (name) => [name, await readFile(join(MAP_DIR, name), "utf8")])),
);
const allText = [index, ...Object.values(features)].join("\n");
const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const scripts = JSON.parse(await readFile(PACKAGE, "utf8")).scripts ?? {};

function checkMenuCommands() {
  const names = manifest.menu.filter((item) => item.name).map((item) => item.name);
  const problems = names
    .filter((name) => !allText.includes(`\`${name}\``))
    .map((name) => `menu command "${name}" is not in the map`);
  const menuPaths = allText.split("\n").filter((line) => line.includes("Camellia Figma Sync →"));
  for (const line of menuPaths) {
    const named = [...line.matchAll(/Camellia Figma Sync → `([^`]+)`/g)].map((match) => match[1]);
    for (const name of named) {
      if (!names.includes(name)) problems.push(`the map names menu command "${name}", which is not in ${MANIFEST}`);
    }
  }
  return problems;
}

function checkNpmScripts() {
  const used = [...allText.matchAll(/npm run ([\w:-]+)/g)].map((match) => match[1]);
  return [...new Set(used)].filter((name) => !(name in scripts)).map((name) => `"npm run ${name}" is not in ${PACKAGE}`);
}

function checkPaths() {
  const paths = [...allText.matchAll(/`([^`\s]+)`/g)]
    .map((match) => match[1])
    .filter((path) => REPO_PATH.test(path) && !GENERATED.some((pattern) => pattern.test(path)));
  return [...new Set(paths)].filter((path) => !existsSync(path)).map((path) => `path ${path} does not exist`);
}

function checkIndexLinks() {
  const linked = [...index.matchAll(/\]\(\.\/([\w-]+\.md)\)/g)].map((match) => match[1]);
  const problems = featureFiles.filter((name) => !linked.includes(name)).map((name) => `${name} is not linked from ${INDEX}`);
  for (const name of linked) {
    if (!featureFiles.includes(name)) problems.push(`${INDEX} links ${name}, which does not exist`);
  }
  return problems;
}

function checkFeatureStructure() {
  const problems = [];
  for (const [name, text] of Object.entries(features)) {
    if (!/^# \S/.test(text)) problems.push(`${name} does not start with an H1 title`);
    const h2 = [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim());
    const expected = h2.length === 4 &&
      h2[0] === "Sub-features" &&
      h2[1] === "How to get to it (user POV)" &&
      h2[2].startsWith("Driving it with ") &&
      h2[3] === "Gotchas";
    if (!expected) problems.push(`${name} headings are [${h2.join(" | ")}]; expected the four contract headings in order`);
    if (!/^Preconditions:$/m.test(text)) problems.push(`${name} has no "Preconditions:" line`);
  }
  return problems;
}

const CHECKS = [
  ["Plugin menu commands are in the map", checkMenuCommands],
  ["npm scripts named in the map exist", checkNpmScripts],
  ["Repository paths named in the map exist", checkPaths],
  ["Index links every feature file", checkIndexLinks],
  ["Feature files follow the entry contract", checkFeatureStructure],
];

let failed = 0;
for (const [title, check] of CHECKS) {
  const problems = check();
  if (problems.length === 0) {
    console.log(`✔ ${title}`);
    continue;
  }
  failed += 1;
  console.log(`✖ ${title}`);
  for (const problem of problems) console.log(`    - ${problem}`);
}

if (failed > 0) {
  console.log(`\nFAIL — ${failed} of ${CHECKS.length} checks failed`);
  process.exitCode = 1;
} else {
  console.log(`\nPASS — all ${CHECKS.length} checks passed`);
}
