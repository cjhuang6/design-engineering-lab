import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

let Card;
let CardDemo;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "card-"));
  const outfile = join(dir, "Card.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/card/Card.jsx"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    jsx: "automatic",
    outfile,
    plugins: [
      {
        name: "shim-imports",
        setup(build) {
          build.onResolve({ filter: /\.css$/ }, () => ({ path: "empty.css", namespace: "css-empty" }));
          build.onLoad({ filter: /.*/, namespace: "css-empty" }, () => ({
            contents: "export {}",
            loader: "js",
          }));
          build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => ({
            path: import.meta.resolve(args.path),
            external: true,
          }));
        },
      },
    ],
  });
  ({ Card, CardDemo } = await import(pathToFileURL(outfile).href));
});

async function mount(node) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  return {
    host,
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function switchNamed(host, name) {
  return [...host.querySelectorAll("label")].find(
    (item) => item.querySelector(".camellia-switch-label")?.textContent === name,
  );
}

function declarations(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of stripped.matchAll(rule)) {
    const selector = match[1].trim();
    for (const part of match[2].split(";")) {
      const colon = part.indexOf(":");
      if (colon < 0) continue;
      const property = part.slice(0, colon).trim();
      const value = part.slice(colon + 1).trim();
      if (property) found.push({ selector, property, value });
    }
  }
  return found;
}

describe("card", { concurrency: false }, () => {
  test("a card is one div with its text and no control attributes", async () => {
    const view = await mount(createElement(Card, null, "Note"));
    try {
      const cards = view.host.querySelectorAll(".camellia-card");
      assert.equal(cards.length, 1);
      const card = cards[0];
      assert.equal(card.tagName, "DIV");
      assert.equal(card.className, "camellia-card");
      assert.equal(card.textContent, "Note");
      assert.equal(card.hasAttribute("role"), false);
      assert.equal(card.hasAttribute("tabindex"), false);
      assert.equal(card.hasAttribute("href"), false);
    } finally {
      await view.unmount();
    }
  });

  test("className follows camellia-card and other attributes pass through", async () => {
    const view = await mount(
      createElement(Card, { className: "plan-card", id: "plan", "data-testid": "plan-surface" }, "Note"),
    );
    try {
      const card = view.host.querySelector(".camellia-card");
      assert.equal(card.className, "camellia-card plan-card");
      assert.equal(card.id, "plan");
      assert.equal(card.getAttribute("data-testid"), "plan-surface");
    } finally {
      await view.unmount();
    }
  });

  test("the demo holds two switches and a save button inside the card", async () => {
    const view = await mount(createElement(CardDemo));
    try {
      assert.equal(view.host.querySelector("h2").textContent, "Card");
      assert.equal(view.host.querySelector(".camellia-card-demo-title").textContent, "Notifications");
      const email = switchNamed(view.host, "Email");
      const push = switchNamed(view.host, "Push");
      assert.equal(email.querySelector("input").checked, true);
      assert.equal(push.querySelector("input").checked, false);
      const save = [...view.host.querySelectorAll("button")].find((button) => button.textContent === "Save");
      assert.ok(save);
      const card = view.host.querySelector(".camellia-card");
      assert.equal(card.tagName, "DIV");
      assert.notEqual(card, save);
      assert.equal(card.contains(save), true);
      assert.equal(card.contains(email), true);
      assert.equal(card.contains(push), true);
    } finally {
      await view.unmount();
    }
  });

  test("the stylesheet paints a raised surface and sets no border, motion, or overflow", async () => {
    const css = await readFile(join(ROOT, "src/components/card/Card.css"), "utf8");
    const rows = declarations(css);
    const card = rows.filter((row) => row.selector === ".camellia-card");
    function value(property) {
      const row = card.find((item) => item.property === property);
      assert.ok(row, property);
      return row.value;
    }
    assert.equal(value("padding"), "var(--space-4)");
    assert.equal(value("border-radius"), "var(--radius-lg)");
    assert.equal(value("background"), "var(--color-surface-primary)");
    assert.equal(value("color"), "var(--color-text-primary)");
    assert.equal(value("box-shadow"), "var(--shadow-raised)");
    assert.equal(css.includes("box-sizing: border-box"), true);
    assert.equal(css.includes("max-width: 100%"), true);
    const banned = new Set([
      "border",
      "border-width",
      "border-style",
      "border-color",
      "overflow",
      "overflow-x",
      "overflow-y",
    ]);
    for (const row of rows) assert.equal(banned.has(row.property), false, row.property);
    assert.equal(rows.some((row) => row.property === "overflow-wrap"), true);
    assert.equal(css.includes("transition"), false);
    assert.equal(css.includes(":hover"), false);
    assert.equal(css.includes(":focus"), false);
    assert.equal(css.includes(":active"), false);
    assert.equal(css.includes("data-theme"), false);
  });
});
