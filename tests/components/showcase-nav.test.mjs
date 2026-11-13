import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

const COMPONENTS_COPY =
  "Core components built to spec on Camellia tokens. Button and TextField are up first.";
const PROTOTYPES_COPY =
  "Product prototypes assembled from Camellia components with AI tools. First builds coming soon.";
const LAB_CARDS = ["Security code", "Hex color picker", "Guide feedback"];

let App;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "showcase-nav-"));
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: { App: "src/App.jsx" },
    bundle: true,
    format: "esm",
    platform: "neutral",
    jsx: "automatic",
    outdir: dir,
    plugins: [
      {
        name: "css",
        setup(build) {
          build.onResolve({ filter: /\.css(\?raw)?$/ }, (args) => {
            if (args.path.endsWith("?raw")) {
              return {
                path: resolve(args.resolveDir, args.path.slice(0, -"?raw".length)),
                namespace: "css-raw",
              };
            }
            return { path: "empty.css", namespace: "css-empty" };
          });
          build.onLoad({ filter: /.*/, namespace: "css-empty" }, () => ({
            contents: "export default {}",
            loader: "js",
          }));
          build.onLoad({ filter: /.*/, namespace: "css-raw" }, async (args) => ({
            contents: `export default ${JSON.stringify(await readFile(args.path, "utf8"))}`,
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
  ({ default: App } = await import(pathToFileURL(join(dir, "App.js")).href));
});

function hashFrom(url) {
  const value = String(url);
  const index = value.indexOf("#");
  return index === -1 ? "" : value.slice(index);
}

function installHistory(initialHash) {
  const stack = [];
  let index = 0;
  const calls = [];

  function write(hash, mode, url) {
    calls.push({ mode, url: String(url) });
    const entry = { hash };
    if (mode === "replace") {
      if (stack.length === 0) stack.push(entry);
      else stack[index] = entry;
    } else {
      stack.splice(index + 1);
      stack.push(entry);
      index = stack.length - 1;
    }
    window.location.hash = hash;
    window.location.href = `http://localhost/${hash}`;
  }

  write(initialHash, "replace", initialHash || "http://localhost/");
  calls.length = 0;

  function back() {
    if (index === 0) return false;
    index -= 1;
    window.location.hash = stack[index].hash;
    window.location.href = `http://localhost/${stack[index].hash}`;
    window.dispatchEvent(new Event("hashchange"));
    return true;
  }

  function forward() {
    if (index >= stack.length - 1) return false;
    index += 1;
    window.location.hash = stack[index].hash;
    window.location.href = `http://localhost/${stack[index].hash}`;
    window.dispatchEvent(new Event("hashchange"));
    return true;
  }

  window.history = {
    get length() {
      return stack.length;
    },
    get state() {
      return null;
    },
    replaceState(_state, _title, url) {
      write(hashFrom(url), "replace", url);
    },
    pushState(_state, _title, url) {
      write(hashFrom(url), "push", url);
    },
    back,
    forward,
  };

  return {
    calls,
    entry: () => stack[index].hash,
    length: () => stack.length,
    back,
    forward,
  };
}

async function mount(hash) {
  const history = installHistory(hash);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(App));
  });
  return {
    history,
    host,
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

async function followHash(hash) {
  window.history.pushState(null, "", hash);
  await act(async () => {
    window.dispatchEvent(new Event("hashchange"));
  });
}

async function goBack(history) {
  let moved = false;
  await act(async () => {
    moved = history.back();
  });
  return moved;
}

async function goForward(history) {
  let moved = false;
  await act(async () => {
    moved = history.forward();
  });
  return moved;
}

function currentLabel(root) {
  return root.querySelector("a[aria-current='page']")?.textContent;
}

function navLabels(root) {
  return [...root.querySelectorAll(".showcase-nav a")].map((link) => ({
    label: link.textContent,
    href: link.getAttribute("href"),
  }));
}

function cardButton(root, name) {
  const label = `Open ${name} details`;
  return [...root.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === label);
}

describe("showcase hash routing", { concurrency: false }, () => {
test("each hash opens its section and marks that link current", async () => {
  const cases = [
    {
      hash: "#components",
      current: "Components",
      present: [COMPONENTS_COPY, "Primary md", "Primary disabled", "Primary unavailable", "No button activated.", "Icon button", "No icon button activated.", "Toggle chip", "Selected Clear.", "Checkbox", "Some devices is mixed.", "Radio group", "Nothing selected.", "Gift wrap"],
      absent: [PROTOTYPES_COPY, ...LAB_CARDS.map((name) => `Open ${name} details`)],
    },
    {
      hash: "#lab",
      current: "Lab",
      present: LAB_CARDS,
      absent: [COMPONENTS_COPY, PROTOTYPES_COPY],
      cards: true,
    },
    {
      hash: "#prototypes",
      current: "Prototypes",
      present: [PROTOTYPES_COPY],
      absent: [COMPONENTS_COPY, ...LAB_CARDS.map((name) => `Open ${name} details`)],
    },
    {
      hash: "#tokens",
      current: "Tokens",
      present: ["Camellia Design System", "Use dark theme"],
      absent: [COMPONENTS_COPY, PROTOTYPES_COPY],
    },
    {
      hash: "#pipeline",
      current: "Pipeline",
      present: ["Pipeline", "A write-up of the token pipeline will live on this page."],
      absent: [COMPONENTS_COPY, PROTOTYPES_COPY],
    },
  ];

  for (const item of cases) {
    const view = await mount(item.hash);
    try {
      assert.deepEqual(navLabels(view.host), [
        { label: "Components", href: "#components" },
        { label: "Lab", href: "#lab" },
        { label: "Prototypes", href: "#prototypes" },
        { label: "Tokens", href: "#tokens" },
        { label: "Pipeline", href: "#pipeline" },
      ]);
      assert.equal(currentLabel(view.host), item.current);
      assert.equal(window.location.hash, item.hash);
      assert.deepEqual(view.history.calls, []);
      const text = view.host.textContent;
      for (const expected of item.present) assert.ok(text.includes(expected), `${item.hash} missing ${expected}`);
      for (const unexpected of item.absent) {
        assert.equal(text.includes(unexpected), false, `${item.hash} showed ${unexpected}`);
      }
      for (const name of LAB_CARDS) {
        assert.equal(cardButton(view.host, name) != null, item.cards === true, `${item.hash} card ${name}`);
      }
      if (item.cards) assert.equal(view.host.querySelector(".showcase-sr")?.textContent, "Lab");
      if (item.hash === "#components") {
        const iconButton = [...view.host.querySelectorAll("button")].find(
          (button) => button.getAttribute("aria-label") === "Primary sm",
        );
        assert.ok(iconButton);
        assert.equal(iconButton.classList.contains("camellia-icon-button"), true);
        assert.equal(iconButton.classList.contains("camellia-button"), true);
        assert.ok(iconButton.querySelector("[aria-hidden='true'] svg"));
      }
    } finally {
      await view.unmount();
    }
  }
});

test("an empty hash opens Lab and leaves the address unchanged", async () => {
  const view = await mount("");
  try {
    assert.equal(window.location.hash, "");
    assert.equal(currentLabel(view.host), "Lab");
    assert.deepEqual(view.history.calls, []);
    for (const name of LAB_CARDS) assert.ok(cardButton(view.host, name), name);
    assert.equal(view.host.textContent.includes(COMPONENTS_COPY), false);
    await followHash("#components");
    assert.equal(currentLabel(view.host), "Components");
    assert.ok(view.host.textContent.includes(COMPONENTS_COPY));
    assert.equal(cardButton(view.host, "Security code") == null, true);
    await followHash("#lab");
    assert.equal(currentLabel(view.host), "Lab");
    assert.equal(window.location.hash, "#lab");
  } finally {
    await view.unmount();
  }
});

test("#blocks redirects to #lab with replaceState, and back does not return to #blocks", async () => {
  const direct = await mount("#blocks");
  try {
    assert.equal(window.location.hash, "#lab");
    assert.equal(direct.history.entry(), "#lab");
    assert.equal(direct.history.length(), 1);
    assert.deepEqual(
      direct.history.calls.map((call) => call.mode),
      ["replace"],
    );
    assert.equal(direct.history.calls[0].url.endsWith("#lab"), true);
    assert.equal(currentLabel(direct.host), "Lab");
    for (const name of LAB_CARDS) assert.ok(cardButton(direct.host, name), name);
    assert.equal(await goBack(direct.history), false);
    assert.equal(window.location.hash, "#lab");
  } finally {
    await direct.unmount();
  }

  const fromTokens = await mount("#tokens");
  try {
    assert.equal(currentLabel(fromTokens.host), "Tokens");
    await followHash("#blocks");
    assert.equal(window.location.hash, "#lab");
    assert.equal(fromTokens.history.entry(), "#lab");
    assert.equal(currentLabel(fromTokens.host), "Lab");
    assert.deepEqual(
      fromTokens.history.calls.map((call) => [call.mode, hashFrom(call.url)]),
      [
        ["push", "#blocks"],
        ["replace", "#lab"],
      ],
    );
    assert.equal(await goBack(fromTokens.history), true);
    assert.equal(window.location.hash, "#tokens");
    assert.equal(currentLabel(fromTokens.host), "Tokens");
    assert.equal(await goForward(fromTokens.history), true);
    assert.equal(window.location.hash, "#lab");
    assert.equal(currentLabel(fromTokens.host), "Lab");
  } finally {
    await fromTokens.unmount();
  }
});
});
