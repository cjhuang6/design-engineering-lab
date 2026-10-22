import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";

const DOCS = "docs";
const ROADMAP = "docs/roadmap.md";

test("docs/roadmap.md links every top-level docs markdown file", async () => {
  const names = (await readdir(DOCS)).filter((name) => name.endsWith(".md") && name !== "roadmap.md").sort();
  const roadmap = await readFile(ROADMAP, "utf8");
  const linked = [...roadmap.matchAll(/\]\((?:\.\/)?([^)\s#]+\.md)(?:#[^)\s]*)?\)/g)].map((match) => match[1]);
  const missing = names.filter((name) => !linked.includes(name));
  assert.deepEqual(missing, []);
});
