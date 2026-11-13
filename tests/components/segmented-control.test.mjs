import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

let SegmentedControl;
let SegmentedControlDemo;

const VIEW_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year", disabled: true },
];

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "segmented-control-"));
  const outfile = join(dir, "SegmentedControl.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/segmented-control/SegmentedControl.jsx"],
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
  ({ SegmentedControl, SegmentedControlDemo } = await import(pathToFileURL(outfile).href));
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

function groupNamed(host, name) {
  return [...host.querySelectorAll("fieldset")].find(
    (item) => item.querySelector("legend")?.textContent === name,
  );
}

function optionNamed(host, name) {
  return [...host.querySelectorAll("label")].find(
    (item) => item.querySelector(".camellia-segment-label")?.textContent === name,
  );
}

function inputNamed(host, name) {
  return optionNamed(host, name)?.querySelector("input");
}

function pressKey(target, key, type = "keydown") {
  const event = new window.KeyboardEvent(type, { bubbles: true, cancelable: true, key });
  target.dispatchEvent(event);
  return event;
}

async function activate(input) {
  await act(async () => {
    input.click();
  });
}

function mediaBlock(source, header) {
  const start = source.indexOf(header);
  assert.ok(start >= 0, header);
  let depth = 0;
  for (let index = source.indexOf("{", start); index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return { start, end: index + 1, body: source.slice(start, index + 1) };
    }
  }
  assert.fail(`unclosed ${header}`);
}

function view(props, options = VIEW_OPTIONS) {
  return createElement(SegmentedControl, {
    legend: "View",
    name: "view",
    options,
    ...props,
  });
}

describe("segmented control", { concurrency: false }, () => {
  test("a missing, blank, or non-string legend throws", async () => {
    await assert.rejects(() => mount(view({ legend: undefined })), /requires a visible legend/);
    await assert.rejects(() => mount(view({ legend: "  " })), /requires a visible legend/);
    await assert.rejects(() => mount(view({ legend: 1 })), /requires a visible legend/);
    await assert.rejects(
      () => mount(view({ legend: "View", label: "Range" })),
      /takes one visible legend/,
    );
  });

  test("a missing or blank name throws", async () => {
    await assert.rejects(() => mount(view({ name: undefined })), /requires a name/);
    await assert.rejects(() => mount(view({ name: "  " })), /requires a name/);
  });

  test("a value other than a non-empty string or null throws", async () => {
    await assert.rejects(() => mount(view({ value: "" })), /must be a non-empty string/);
    await assert.rejects(() => mount(view({ value: 1 })), /must be a non-empty string/);
    await assert.rejects(() => mount(view({ defaultValue: "  " })), /must be a non-empty string/);
  });

  test("options are required and well formed", async () => {
    await assert.rejects(
      () => mount(createElement(SegmentedControl, { legend: "View", name: "view" })),
      /options must be an array/,
    );
    await assert.rejects(() => mount(view({ options: [] })), /requires options/);
    await assert.rejects(() => mount(view({ options: "day" })), /options must be an array/);
    await assert.rejects(
      () => mount(view({ options: [{ value: "day", label: "  " }] })),
      /option requires a visible label/,
    );
    await assert.rejects(
      () => mount(view({ options: [{ value: "", label: "Day" }] })),
      /option requires a value/,
    );
    await assert.rejects(
      () => mount(view({
        options: [
          { value: "day", label: "Day" },
          { value: "day", label: "Again" },
        ],
      })),
      /values must be unique/,
    );
  });

  test("a native group starts with nothing selected", async () => {
    const viewHost = await mount(view({
      className: "extra",
      id: "range",
      role: "radiogroup",
      "aria-label": "Ignored",
      "aria-labelledby": "elsewhere",
    }));
    try {
      const group = groupNamed(viewHost.host, "View");
      const day = optionNamed(viewHost.host, "Day");
      const input = inputNamed(viewHost.host, "Day");
      assert.equal(group.tagName, "FIELDSET");
      assert.equal(group.id, "range");
      assert.equal(group.className, "camellia-segmented extra");
      assert.equal(group.getAttribute("role"), null);
      assert.equal(group.hasAttribute("aria-label"), false);
      assert.equal(group.hasAttribute("aria-labelledby"), false);
      assert.equal(group.querySelector("legend").textContent, "View");
      assert.equal(group.querySelector("[role='tabpanel']"), null);
      assert.equal(day.tagName, "LABEL");
      assert.equal(input.tagName, "INPUT");
      assert.equal(input.type, "radio");
      assert.equal(input.getAttribute("role"), null);
      assert.equal(input.name, "view");
      assert.equal(input.value, "day");
      assert.equal(input.checked, false);
      assert.equal(input.hasAttribute("aria-checked"), false);
      assert.equal(input.hasAttribute("aria-label"), false);
      assert.equal(day.getAttribute("data-state"), "unchecked");
      assert.equal(input.closest("label"), day);
      assert.equal(inputNamed(viewHost.host, "Week").name, "view");
      assert.equal(inputNamed(viewHost.host, "Week").checked, false);
      assert.equal(inputNamed(viewHost.host, "Year").checked, false);
      const names = [...group.querySelectorAll("input")].map((item) => item.name);
      assert.deepEqual(names, ["view", "view", "view", "view"]);
      assert.equal(group.querySelectorAll(".camellia-segment").length, 4);
    } finally {
      await viewHost.unmount();
    }
  });

  test("label is the legend when legend is omitted", async () => {
    const host = await mount(createElement(SegmentedControl, {
      label: "View",
      name: "view",
      options: [{ value: "day", label: "Day" }],
    }));
    try {
      const input = inputNamed(host.host, "Day");
      assert.equal(groupNamed(host.host, "View").querySelector("legend").textContent, "View");
      assert.equal(input.type, "radio");
      assert.equal(input.name, "view");
      assert.equal(input.hasAttribute("aria-label"), false);
    } finally {
      await host.unmount();
    }
  });

  test("an uncontrolled group selects one option and leaves the others clear", async () => {
    const changes = [];
    const host = await mount(view({
      defaultValue: "day",
      onValueChange: (next) => changes.push(next),
      options: [
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
      ],
    }));
    try {
      assert.equal(inputNamed(host.host, "Day").checked, true);
      assert.equal(optionNamed(host.host, "Day").getAttribute("data-state"), "checked");
      assert.equal(inputNamed(host.host, "Week").checked, false);
      await activate(inputNamed(host.host, "Day"));
      assert.deepEqual(changes, []);
      assert.equal(inputNamed(host.host, "Day").checked, true);
      await activate(inputNamed(host.host, "Week"));
      assert.deepEqual(changes, ["week"]);
      assert.equal(inputNamed(host.host, "Week").checked, true);
      assert.equal(inputNamed(host.host, "Day").checked, false);
      assert.equal(optionNamed(host.host, "Week").getAttribute("data-state"), "checked");
      assert.equal(optionNamed(host.host, "Day").getAttribute("data-state"), "unchecked");
    } finally {
      await host.unmount();
    }
  });

  test("an empty uncontrolled group stays empty until an option is chosen", async () => {
    const changes = [];
    const host = await mount(view({ onValueChange: (next) => changes.push(next) }));
    try {
      assert.equal(inputNamed(host.host, "Day").checked, false);
      await activate(inputNamed(host.host, "Week"));
      assert.deepEqual(changes, ["week"]);
      assert.equal(inputNamed(host.host, "Week").checked, true);
      assert.equal(inputNamed(host.host, "Day").checked, false);
    } finally {
      await host.unmount();
    }
  });

  test("a controlled group reports the next value and keeps the value prop", async () => {
    const changes = [];
    const host = await mount(view({
      value: null,
      defaultValue: "day",
      onValueChange: (next) => changes.push(next),
    }));
    try {
      assert.equal(inputNamed(host.host, "Day").checked, false);
      await activate(inputNamed(host.host, "Day"));
      assert.deepEqual(changes, ["day"]);
      assert.equal(inputNamed(host.host, "Day").checked, false);
      assert.equal(optionNamed(host.host, "Day").getAttribute("data-state"), "unchecked");
    } finally {
      await host.unmount();
    }
  });

  test("a controlled parent updates the selected option", async () => {
    function Harness() {
      const [current, setCurrent] = useState(null);
      return createElement(SegmentedControl, {
        legend: "View",
        name: "view",
        value: current,
        onValueChange: setCurrent,
        options: [
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
        ],
      });
    }
    const host = await mount(createElement(Harness));
    try {
      assert.equal(inputNamed(host.host, "Day").checked, false);
      await activate(inputNamed(host.host, "Week"));
      assert.equal(inputNamed(host.host, "Week").checked, true);
      assert.equal(inputNamed(host.host, "Day").checked, false);
      await activate(inputNamed(host.host, "Day"));
      assert.equal(inputNamed(host.host, "Day").checked, true);
      assert.equal(inputNamed(host.host, "Week").checked, false);
    } finally {
      await host.unmount();
    }
  });

  test("a disabled group leaves the tab order and does not select", async () => {
    const changes = [];
    const host = await mount(view({
      disabled: true,
      defaultValue: "day",
      onValueChange: (next) => changes.push(next),
      options: [
        { value: "day", label: "Day" },
        { value: "week", label: "Week" },
      ],
    }));
    try {
      const group = groupNamed(host.host, "View");
      const week = inputNamed(host.host, "Week");
      assert.equal(group.hasAttribute("disabled"), true);
      assert.equal(group.classList.contains("camellia-segmented-disabled"), true);
      assert.equal(week.hasAttribute("disabled"), true);
      assert.equal(optionNamed(host.host, "Week").classList.contains("camellia-segment-disabled"), false);
      assert.equal(inputNamed(host.host, "Day").checked, true);
      week.focus();
      assert.notEqual(document.activeElement, week);
      await activate(week);
      assert.deepEqual(changes, []);
      assert.equal(week.checked, false);
      assert.equal(inputNamed(host.host, "Day").checked, true);
    } finally {
      await host.unmount();
    }
  });

  test("a disabled option does not select, and the others still do", async () => {
    const changes = [];
    const host = await mount(view({ onValueChange: (next) => changes.push(next) }));
    try {
      const year = inputNamed(host.host, "Year");
      assert.equal(year.hasAttribute("disabled"), true);
      assert.equal(optionNamed(host.host, "Year").classList.contains("camellia-segment-disabled"), true);
      year.focus();
      assert.notEqual(document.activeElement, year);
      await activate(year);
      assert.deepEqual(changes, []);
      assert.equal(year.checked, false);
      await activate(inputNamed(host.host, "Day"));
      assert.deepEqual(changes, ["day"]);
      assert.equal(inputNamed(host.host, "Day").checked, true);
    } finally {
      await host.unmount();
    }
  });

  test("arrow keys, Space, and Enter are left to the browser", async () => {
    const changes = [];
    const host = await mount(view({ onValueChange: (next) => changes.push(next) }));
    try {
      const day = inputNamed(host.host, "Day");
      const down = pressKey(day, "ArrowDown");
      const up = pressKey(day, "ArrowUp");
      const right = pressKey(day, "ArrowRight");
      const left = pressKey(day, "ArrowLeft");
      const space = pressKey(day, " ");
      const enter = pressKey(day, "Enter");
      assert.equal(down.defaultPrevented, false);
      assert.equal(up.defaultPrevented, false);
      assert.equal(right.defaultPrevented, false);
      assert.equal(left.defaultPrevented, false);
      assert.equal(space.defaultPrevented, false);
      assert.equal(enter.defaultPrevented, false);
      assert.deepEqual(changes, []);
      assert.equal(day.checked, false);
      assert.equal(inputNamed(host.host, "Week").checked, false);
    } finally {
      await host.unmount();
    }
  });

  test("the gallery starts on Week, selects one option, and shows a disabled group", async () => {
    const host = await mount(createElement(SegmentedControlDemo));
    try {
      const viewGroup = groupNamed(host.host, "View");
      const alignment = groupNamed(host.host, "Alignment");
      assert.equal(viewGroup.tagName, "FIELDSET");
      assert.equal(inputNamed(host.host, "Week").checked, true);
      assert.equal(inputNamed(host.host, "Day").checked, false);
      assert.equal(inputNamed(host.host, "Month").checked, false);
      assert.equal(inputNamed(host.host, "Year").hasAttribute("disabled"), true);
      assert.equal(inputNamed(host.host, "Year").checked, false);
      assert.equal(host.host.querySelector("[aria-live='polite']").textContent, "Selected Week.");
      assert.equal(alignment.hasAttribute("disabled"), true);
      assert.equal(alignment.classList.contains("camellia-segmented-disabled"), true);
      assert.equal(inputNamed(host.host, "Center").checked, true);
      assert.equal(inputNamed(host.host, "Center").hasAttribute("disabled"), true);
      assert.equal(inputNamed(host.host, "Start").checked, false);
      await activate(inputNamed(host.host, "Month"));
      assert.equal(inputNamed(host.host, "Month").checked, true);
      assert.equal(inputNamed(host.host, "Week").checked, false);
      assert.equal(host.host.querySelector("[aria-live='polite']").textContent, "Selected Month.");
      await activate(inputNamed(host.host, "Year"));
      await activate(inputNamed(host.host, "Start"));
      assert.equal(inputNamed(host.host, "Year").checked, false);
      assert.equal(inputNamed(host.host, "Start").checked, false);
      assert.equal(inputNamed(host.host, "Month").checked, true);
      assert.equal(host.host.querySelector("[aria-live='polite']").textContent, "Selected Month.");
    } finally {
      await host.unmount();
    }
  });

  test("styles use tokens, and hover stays inside the fine-pointer query", async () => {
    const css = await readFile(join(ROOT, "src/components/segmented-control/SegmentedControl.css"), "utf8");
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css), false);
    assert.equal(/\d+px\b/.test(css), false);
    assert.equal(/\brgba?\(/.test(css), false);
    assert.equal(css.includes("color-border-default"), false);
    assert.equal(css.includes("scale("), false);
    assert.equal(css.includes("transform:"), true);
    assert.equal(/transition-property:[^;]*transform/.test(css), false);
    const hover = mediaBlock(css, "@media (hover: hover) and (pointer: fine)");
    assert.equal(css.slice(0, hover.start).includes(":hover"), false);
    assert.equal(css.slice(hover.end).includes(":hover"), false);
    assert.equal((hover.body.match(/:hover/g) || []).length, 2);
    assert.match(
      hover.body,
      /\.camellia-segment-input:not\(:disabled\):hover \+ \.camellia-segment-label \{\s*color: var\(--color-text-primary\);/,
    );
    assert.match(
      hover.body,
      /\.camellia-segment\[data-state='checked'\] \.camellia-segment-input:not\(:disabled\):hover \{\s*border-color: var\(--color-action-primary-hover\);\s*box-shadow: var\(--shadow-control-hover\);/,
    );
    assert.match(css, /\.camellia-segment-input:focus-visible \{\s*outline: var\(--border-focus\);\s*outline-offset: var\(--border-width-2\);/);
    assert.match(css, /@media \(pointer: coarse\) \{[\s\S]*var\(--size-touch-target\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.camellia-segment-input,\s*\.camellia-segment-label \{\s*transition: none;/);
    assert.match(css, /transition-property: background-color, color, border-color, box-shadow;/);
    assert.match(css, /transition-property: color;/);
    assert.match(css, /transition-duration: var\(--duration-fast\);/);
    assert.match(css, /transition-timing-function: var\(--ease-standard\);/);
    assert.match(css, /height: var\(--size-control-md\);/);
    assert.match(css, /padding-inline: var\(--control-padding-inline-md\);/);
    assert.match(css, /padding: var\(--space-1\);/);
    assert.match(css, /gap: var\(--space-1\);/);
    assert.match(css, /font: var\(--label-md\);/);
    assert.match(css, /letter-spacing: var\(--label-md-letter-spacing\);/);
    assert.match(css, /font-weight: var\(--font-weight-semibold\);/);
    assert.match(css, /border-radius: var\(--radius-lg\);/);
    assert.match(css, /border-radius: var\(--radius-md\);/);
    assert.match(css, /background: var\(--color-surface-subtle\);/);
    assert.match(css, /border-color: var\(--color-icon-secondary\);/);
    assert.match(css, /background: var\(--color-surface-primary\);/);
    assert.match(css, /color: var\(--color-text-primary\);/);
    assert.match(css, /color: var\(--color-text-secondary\);/);
    assert.match(css, /border-color: var\(--color-action-primary\);/);
    assert.match(css, /box-shadow: var\(--shadow-control\);/);
    assert.match(css, /opacity: var\(--opacity-disabled\);/);
    assert.equal(css.includes("color-border-default"), false);
    assert.equal(css.includes("color-surface-selected"), false);
  });

  test("the segment input declares a full width and height", async () => {
    const css = await readFile(join(ROOT, "src/components/segmented-control/SegmentedControl.css"), "utf8");
    const rule = css.match(/\.camellia-segment-input \{[^}]*\}/);
    assert.ok(rule);
    assert.match(rule[0], /position:\s*absolute;/);
    assert.match(rule[0], /inset:\s*0;/);
    assert.match(rule[0], /display:\s*block;/);
    assert.match(rule[0], /width:\s*100%;/);
    assert.match(rule[0], /height:\s*100%;/);
  });
});
