import "../helpers/dom-shim.mjs";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

import {
  FILL_EMPTY,
  MOTION_FALLBACK,
  REST_WORD,
  RETRO_HOLD_MS,
  RETRO_MS,
  clampCountdown,
  cycleDurationMs,
  idleDelayMs,
  makeSchedule,
  percentAt,
  reelMotion,
  restSequence,
  retroClip,
  smoothClip,
  unbiasedBelow,
} from "../../src/components/slot-code/model.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SPIN_END = reelMotion(5, MOTION_FALLBACK, "spin").end;
const RETURN_END = reelMotion(5, MOTION_FALLBACK, "return").end;

let SlotCode;

test.before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "slot-code-"));
  const outfile = join(dir, "SlotCode.mjs");
  await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ["src/components/slot-code/SlotCode.jsx"],
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
  ({ SlotCode } = await import(pathToFileURL(outfile).href));
});

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return (mixed ^ (mixed >>> 14)) >>> 0;
  };
}

function assertSchedule(schedule, duration) {
  assert.ok(schedule.length >= 6 && schedule.length <= 10, `step count ${schedule.length}`);
  assert.equal(schedule[0].t <= 150, true);
  assert.equal(schedule[0].t >= 40, true);
  assert.equal(schedule.at(-1).t, duration);
  assert.equal(schedule.at(-1).p, 100);
  const jumps = schedule.map((step, index) => step.p - (index ? schedule[index - 1].p : 0));
  assert.equal(jumps.every((jump) => jump >= 1), true);
  assert.equal(jumps.some((jump) => jump >= 25), true);
  assert.equal(jumps.some((jump) => jump <= 2), true);
  let stalled = false;
  for (let index = 0; index < schedule.length - 1; index += 1) {
    const gap = schedule[index + 1].t - schedule[index].t;
    if (schedule[index].p >= 60 && gap >= 419.9 && gap <= 700.1) stalled = true;
    assert.equal(schedule[index + 1].p >= schedule[index].p, true);
    assert.equal(schedule[index + 1].t >= schedule[index].t, true);
  }
  assert.equal(stalled, true);
}

test("retro schedules stay inside the step, jump, and stall rules", () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const rng = makeRng(seed);
    const schedule = makeSchedule(RETRO_MS, (span) => unbiasedBelow(span, rng));
    assertSchedule(schedule, RETRO_MS);
  }
  const fallback = makeSchedule(RETRO_MS, () => 0);
  assertSchedule(fallback, RETRO_MS);
  assert.equal(percentAt(fallback, 0), 0);
  assert.equal(percentAt(fallback, RETRO_MS), 100);
});

test("ease-out spins land left to right and the return flips through preceding letters", () => {
  const first = reelMotion(0, MOTION_FALLBACK, "spin");
  const last = reelMotion(5, MOTION_FALLBACK, "spin");
  assert.equal(first.end, 550);
  assert.equal(last.end, 800);
  assert.ok(last.end > first.end);
  const gaps = first.times.slice(1).map((time, index) => time - first.times[index]);
  assert.ok(gaps.every((gap, index) => index === 0 || gap > gaps[index - 1] + 1e-9));
  assert.equal(first.times[0], 0);
  assert.equal(first.times.at(-1), first.end);
  const back = reelMotion(5, MOTION_FALLBACK, "return");
  assert.equal(back.flips, 3);
  assert.equal(back.delay, 700);
  assert.equal(back.end, 1300);
  assert.deepEqual(restSequence("H"), ["F", "G", "H"]);
  assert.deepEqual(restSequence("L"), ["J", "K", "L"]);
  assert.deepEqual(restSequence("!"), ["Y", "Z", "!"]);
  assert.deepEqual(REST_WORD, ["H", "E", "L", "L", "O", "!"]);
  assert.equal(cycleDurationMs("retro", 30), RETRO_MS);
  assert.equal(cycleDurationMs("smooth", 30), 30000);
  assert.equal(cycleDurationMs("smooth", 2), 3000);
  assert.equal(cycleDurationMs("smooth", 40), 30000);
  assert.equal(clampCountdown(5.2), 5);
  assert.equal(clampCountdown(Number.NaN), 30);
  const early = idleDelayMs(() => 0);
  const late = idleDelayMs((span) => span - 1);
  assert.equal(early, 2500);
  assert.equal(late, 5000);
});

function installClock() {
  let time = 0;
  const queue = [];
  let nextId = 1;
  let scheduled = 0;
  const originalNow = performance.now.bind(performance);
  const originalRaf = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  performance.now = () => time;
  window.requestAnimationFrame = (callback) => {
    scheduled += 1;
    const id = nextId;
    nextId += 1;
    queue.push({ id, callback });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    const index = queue.findIndex((item) => item.id === id);
    if (index >= 0) queue.splice(index, 1);
  };
  return {
    set(ms) {
      time = ms;
    },
    pending() {
      return queue.length;
    },
    scheduled() {
      return scheduled;
    },
    async flush() {
      const batch = queue.splice(0, queue.length);
      await act(async () => {
        for (const item of batch) item.callback(time);
      });
    },
    restore() {
      performance.now = originalNow;
      window.requestAnimationFrame = originalRaf;
      window.cancelAnimationFrame = originalCancel;
    },
  };
}

function installRandom(digits, seed) {
  const script = [...digits];
  const rng = makeRng(seed);
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (buffer) => {
    if (buffer instanceof Uint8Array) buffer[0] = script.length ? script.shift() : 1;
    else buffer[0] = rng();
    return buffer;
  };
  return {
    restore() {
      crypto.getRandomValues = original;
    },
  };
}

async function mount(props = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(SlotCode, props));
  });
  return {
    host,
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function button() {
  return document.querySelector("button.slot-copy");
}

function fill() {
  return document.querySelector(".slot-copy-fill");
}

function live() {
  return document.querySelector("[aria-live='polite']");
}

function description() {
  return document.getElementById(button().getAttribute("aria-describedby"));
}

function status() {
  return document.querySelector("[role='status']");
}

function reelPose(index) {
  const reel = document.querySelectorAll(".slot-reel")[index];
  const flap = reel.querySelector(".slot-flap-current");
  const leaves = [...flap.querySelectorAll(".slot-leaf")];
  return {
    digit: flap.querySelector(".slot-half-top.slot-static span").textContent,
    flipping: leaves.some((leaf) => leaf.style.visibility === "visible"),
    transform: leaves.map((leaf) => leaf.style.transform).join(" "),
  };
}

function faceIcons() {
  return [...document.querySelectorAll(".slot-copy-face")].map((face) =>
    [...face.querySelectorAll("[data-icon]")].map((icon) => ({
      name: icon.getAttribute("data-icon"),
      on: icon.classList.contains("is-on"),
      opacity: icon.style.opacity,
      transform: icon.style.transform,
      filter: icon.style.filter,
    })),
  );
}

function assertIcons(name) {
  const faces = faceIcons();
  assert.equal(faces.length, 2);
  for (const icons of faces) {
    assert.deepEqual(
      icons.map((icon) => icon.name),
      ["create", "copy", "check"],
    );
    for (const icon of icons) {
      assert.equal(icon.opacity || "", "");
      assert.equal(icon.transform || "", "");
      assert.equal(icon.filter || "", "");
      assert.equal(icon.on, icon.name === name);
    }
  }
}

function settledGlyphs() {
  return [...document.querySelectorAll(".slot-reel")].map((_, index) => reelPose(index).digit);
}

function buttonSignature() {
  const control = button();
  const nodes = [control, ...control.querySelectorAll("*")];
  return {
    label: control.getAttribute("aria-label"),
    disabled: control.getAttribute("aria-disabled"),
    icons: faceIcons().map((icons) => icons.map((icon) => `${icon.name}:${icon.on ? "on" : "off"}`).join(",")),
    fillHidden: fill().hasAttribute("hidden") && fill().style.clipPath === FILL_EMPTY,
    clip: fill().style.clipPath,
    fillOpacity: fill().style.opacity,
    fillFilter: fill().style.filter,
    fillVisibility: fill().style.visibility,
    effects: nodes
      .filter((node) => node.style.opacity || node.style.filter || node.style.transform)
      .map((node) => `${node.style.opacity}|${node.style.filter}|${node.style.transform}`),
  };
}

async function createCode() {
  await act(async () => {
    button().click();
  });
}

test("create code lands left to right, retro fill completes at 3s, then the reels return to HELLO!", async () => {
  const clock = installClock();
  const random = installRandom([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2], 0x51c0de);
  const scheduleRng = makeRng(0x51c0de);
  const expected = makeSchedule(RETRO_MS, (span) => unbiasedBelow(span, scheduleRng));
  const firstLock = reelMotion(0, MOTION_FALLBACK, "spin").end;
  globalThis.__showcaseReducedMotion = false;
  const view = await mount({ fillStyle: "retro" });
  try {
    assert.deepEqual(settledGlyphs(), ["H", "E", "L", "L", "O", "!"]);
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.equal(document.querySelector(".slot-reels").getAttribute("aria-hidden"), "true");
    assert.equal(live().textContent, "");
    assert.equal(description().textContent, "");
    assert.equal(fill().hasAttribute("hidden"), true);
    assert.equal(fill().style.clipPath, FILL_EMPTY);

    await createCode();
    assert.equal(button().getAttribute("aria-disabled"), "true");
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.equal(description().textContent, "Generating a new code");
    assert.equal(description().getAttribute("aria-live"), null);

    clock.set(firstLock - 1);
    await clock.flush();
    assert.equal(reelPose(0).flipping, true);

    clock.set(firstLock);
    await clock.flush();
    assert.deepEqual(reelPose(0), { digit: "1", flipping: false, transform: " " });

    clock.set(SPIN_END - 1);
    await clock.flush();
    assert.equal(reelPose(5).flipping, true);

    clock.set(SPIN_END);
    await clock.flush();
    assert.deepEqual(settledGlyphs(), ["1", "2", "3", "4", "5", "6"]);
    assert.equal(settledGlyphs().every((_, index) => !reelPose(index).flipping), true);
    assert.equal(fill().style.clipPath, retroClip(0));
    assert.equal(fill().hasAttribute("hidden"), false);
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.equal(live().textContent, "New code: 1 2 3 4 5 6");
    assert.equal(description().textContent, "Code expires in 3 seconds");
    assert.equal(status().textContent, "");

    clock.set(SPIN_END + 150);
    await clock.flush();
    assert.notEqual(fill().style.clipPath, retroClip(0));
    assert.equal(percentAt(expected, 150) > 0, true);
    assert.equal(fill().style.clipPath, retroClip(percentAt(expected, 150)));

    clock.set(SPIN_END + 1000);
    await clock.flush();
    assert.equal(description().textContent, "Code expires in 2 seconds");
    assert.equal(live().textContent, "New code: 1 2 3 4 5 6");

    clock.set(SPIN_END + RETRO_MS);
    await clock.flush();
    assert.equal(fill().style.clipPath, retroClip(100));
    assert.equal(button().getAttribute("aria-disabled"), "false");

    clock.set(SPIN_END + RETRO_MS + RETRO_HOLD_MS - 1);
    await clock.flush();
    assert.equal(button().getAttribute("aria-label"), "Copy code");

    clock.set(SPIN_END + RETRO_MS + RETRO_HOLD_MS);
    await clock.flush();
    assert.equal(button().getAttribute("aria-disabled"), "true");
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.equal(fill().hasAttribute("hidden"), true);
    assert.equal(fill().style.clipPath, FILL_EMPTY);
    assert.equal(live().textContent, "New code: 1 2 3 4 5 6");

    clock.set(SPIN_END + RETRO_MS + RETRO_HOLD_MS + RETURN_END);
    await clock.flush();
    assert.deepEqual(settledGlyphs(), ["H", "E", "L", "L", "O", "!"]);
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.equal(live().textContent, "Code expired. Create code.");
  } finally {
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

test("smooth fill grows left to right and the long countdown hints once", async () => {
  const clock = installClock();
  const random = installRandom([4, 4, 4, 4, 4, 4], 2);
  globalThis.__showcaseReducedMotion = false;
  const view = await mount({ fillStyle: "smooth", countdownSeconds: 6 });
  try {
    await createCode();
    clock.set(SPIN_END);
    await clock.flush();
    assert.equal(fill().style.clipPath, smoothClip(0));
    assert.equal(fill().hasAttribute("hidden"), false);
    assert.equal(description().textContent, "Code expires in 6 seconds");
    assert.equal(status().textContent, "");

    clock.set(SPIN_END + 1000);
    await clock.flush();
    assert.equal(status().textContent, "Code expires in 5 seconds");
    assert.equal(description().textContent, "Code expires in 5 seconds");
    assert.equal(fill().style.clipPath, smoothClip(1000 / 6000));

    clock.set(SPIN_END + 3000);
    await clock.flush();
    assert.equal(fill().style.clipPath, smoothClip(0.5));
    assert.equal(description().textContent, "Code expires in 3 seconds");
    assert.equal(status().textContent, "Code expires in 5 seconds");
    assert.equal(live().textContent, "New code: 4 4 4 4 4 4");

    clock.set(SPIN_END + 6000);
    await clock.flush();
    assert.equal(button().getAttribute("aria-disabled"), "true");
    assert.equal(fill().hasAttribute("hidden"), true);
    assert.equal(fill().style.clipPath, FILL_EMPTY);
    assert.equal(live().textContent, "New code: 4 4 4 4 4 4");
  } finally {
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

test("the copy button keeps one width, never shows a count, and writes the code", async () => {
  const clock = installClock();
  const random = installRandom([1, 2, 3, 4, 5, 6], 3);
  const css = await readFile("src/components/slot-code/SlotCode.css", "utf8");
  const liveCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(css.includes("slot-copy-label"), false);
  assert.equal(css.includes("-apple-system-body"), false);
  assert.match(liveCss, /\.slot-copy-icons > svg \{[^}]*grid-area:\s*1 \/ 1;/);
  assert.match(liveCss, /\.slot-copy-icons > svg \{[^}]*opacity:\s*0;/);
  assert.match(liveCss, /\.slot-copy-icons > svg \{[^}]*transform:\s*scale\(0\.25\);/);
  assert.match(liveCss, /\.slot-copy-icons > svg \{[^}]*filter:\s*blur\(var\(--space-1\)\);/);
  assert.match(liveCss, /\.slot-copy-icons > svg \{[^}]*will-change:\s*opacity, transform, filter;/);
  assert.match(
    liveCss,
    /\.slot-copy-icons > svg \{[^}]*transition:\s*opacity var\(--duration-normal\) var\(--ease-enter\), transform var\(--duration-normal\) var\(--ease-enter\), filter var\(--duration-normal\) var\(--ease-enter\);/,
  );
  assert.match(
    liveCss,
    /\.slot-copy-icons > svg\.is-on \{[^}]*opacity:\s*1;[^}]*transform:\s*scale\(1\);[^}]*filter:\s*blur\(0px\);/,
  );
  assert.equal(
    /button\.slot-copy\[aria-disabled='true'\]\s*\{[^}]*(gap|font-weight|transform|padding|scale)/.test(liveCss),
    false,
  );
  assert.equal(css.includes("!important"), false);
  assert.match(liveCss, /\.slot-copy-fill\[hidden\]\s*\{[^}]*display:\s*none;/);
  assert.match(css, /\.slot-copy-fill \{[^}]*will-change:\s*clip-path, opacity;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*transition:\s*opacity var\(--duration-fast\) linear;/s);
  assert.match(css, /button\.slot-copy:focus \{[^}]*outline:\s*none;/);
  assert.match(css, /button\.slot-copy:focus-visible \{[^}]*outline:\s*var\(--border-focus\);/);
  assert.match(css, /\.slot-code \{[^}]*gap:\s*var\(--space-4\);/);
  assert.match(css, /button\.slot-copy \{[^}]*min-height:\s*var\(--size-control-sm\);/);
  assert.match(css, /\.slot-copy-visual \{[^}]*width:\s*var\(--size-control-sm\);[^}]*height:\s*var\(--size-control-sm\);/);
  assert.match(css, /\.slot-copy svg \{[^}]*width:\s*calc\(var\(--size-icon-sm\) - var\(--border-width-2\)\);/);
  assert.match(
    css,
    /@media \(pointer: coarse\) \{\s*button\.slot-copy::before \{[^}]*width:\s*calc\(var\(--size-control-md\) \+ var\(--space-1\)\);[^}]*height:\s*calc\(var\(--size-control-md\) \+ var\(--space-1\)\);/,
  );
  assert.match(css, /\.slot-copy-tip \{[^}]*position:\s*fixed;/);
  assert.match(css, /\.slot-copy-tip \{[^}]*z-index:\s*var\(--z-tooltip\);/);
  assert.match(css, /\.slot-copy-tip \{[^}]*background:\s*var\(--color-text-primary\);/);
  assert.match(css, /\.slot-copy-tip \{[^}]*color:\s*var\(--color-text-inverse\);/);
  assert.match(css, /\.slot-copy-tip \{[^}]*border-radius:\s*var\(--radius-md\);/);
  assert.match(css, /\.slot-copy-tip \{[^}]*box-shadow:\s*var\(--shadow-md\);/);
  assert.match(css, /\.slot-copy-tip \{[^}]*transition:\s*opacity var\(--duration-fast\) var\(--ease-standard\);/);
  const written = [];
  const originalClipboard = navigator.clipboard;
  navigator.clipboard = {
    writeText(text) {
      written.push(text);
      return Promise.resolve();
    },
  };
  globalThis.__showcaseReducedMotion = false;
  const view = await mount();
  try {
    const restingWidth = button().offsetWidth;
    const tip = document.querySelector(".slot-copy-tip");
    assert.equal(tip.getAttribute("role"), "tooltip");
    assert.equal(tip.getAttribute("aria-hidden"), "true");
    assert.equal(tip.parentElement, document.body);
    assert.equal(button().contains(tip), false);
    assert.equal(tip.textContent, "Create code");
    assert.equal(button().getAttribute("aria-describedby"), description().id);
    assertIcons("create");
    assert.equal(/\d|%|second/i.test(button().textContent), false);
    await createCode();
    assert.equal(button().offsetWidth, restingWidth);
    assertIcons("create");

    clock.set(SPIN_END);
    await clock.flush();
    assert.equal(fill().style.clipPath, smoothClip(0));
    assert.equal(button().offsetWidth, restingWidth);
    assertIcons("copy");
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.equal(tip.textContent, "Copy code");
    assert.equal(/\d|%/.test(button().textContent), false);

    await act(async () => {
      button().click();
    });
    assert.deepEqual(written, ["123456"]);
    assert.equal(button().getAttribute("aria-label"), "Code copied");
    assertIcons("check");
    assert.equal(tip.textContent, "Code copied");
    assert.equal(button().offsetWidth, restingWidth);
    assert.equal(live().textContent, "Copied");
    assert.equal(/\d|%/.test(button().textContent), false);

    clock.set(SPIN_END + 1200);
    await clock.flush();
    assertIcons("copy");
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.equal(tip.textContent, "Copy code");
    assert.equal(button().offsetWidth, restingWidth);
  } finally {
    navigator.clipboard = originalClipboard;
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function scanCss(css) {
  const rules = [];
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf("{", index);
    if (open === -1) break;
    const prelude = css.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth += 1;
      else if (css[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    const inner = css.slice(open + 1, cursor - 1);
    if (prelude.startsWith("@")) {
      for (const rule of scanCss(inner)) {
        rules.push({ ...rule, conditions: [prelude, ...rule.conditions] });
      }
    } else if (prelude) {
      rules.push({ prelude, body: inner, conditions: [] });
    }
    index = cursor;
  }
  return rules;
}

function selectorList(prelude) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (const char of prelude) {
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function compounds(selector) {
  return selector.split(/\s*>\s*|\s+/).filter(Boolean);
}

function conditionOn(condition, env) {
  if (condition.startsWith("@media")) {
    if (condition.includes("prefers-reduced-motion")) return env.reduced === true;
    if (condition.includes("pointer: coarse")) return env.coarse === true;
    if (condition.includes("hover: hover")) return env.fineHover === true;
    return false;
  }
  if (condition.startsWith("@supports")) return condition.includes("-apple-system-body") && env.safari === true;
  return false;
}

function visualSelector(selector, env) {
  const parts = compounds(selector);
  const subject = parts.at(-1) ?? "";
  if (!subject.includes(".slot-copy-visual")) return false;
  const ancestor = parts.slice(0, -1).join(" ");
  if (ancestor.includes("[data-theme='dark']") && env.dark !== true) return false;
  if (ancestor.includes(":hover") && env.hover !== true) return false;
  if (ancestor.includes(":active") && env.pressed !== true) return false;
  if (ancestor.includes(":focus")) return false;
  const requiresEnabled = ancestor.includes(":not([aria-disabled='true'])");
  if (requiresEnabled && env.disabled === true) return false;
  if (ancestor.includes("[aria-disabled='true']") && !requiresEnabled && env.disabled !== true) return false;
  return true;
}

function iconSelector(selector, env) {
  const parts = compounds(selector);
  const subject = parts.at(-1) ?? "";
  const ancestor = parts.slice(0, -1).join(" ");
  if (!subject.startsWith("svg")) return false;
  if (!ancestor.includes("slot-copy-icons")) return false;
  if (ancestor.includes("[data-theme='dark']") && env.dark !== true) return false;
  if (env.on === true) return true;
  return !subject.includes(".is-on");
}

function declarations(body) {
  const map = new Map();
  for (const part of body.split(";")) {
    const splitAt = part.indexOf(":");
    if (splitAt === -1) continue;
    const name = part.slice(0, splitAt).trim();
    const value = part.slice(splitAt + 1).trim().replace(/\s+/g, " ");
    if (name) map.set(name, value);
  }
  return map;
}

function applied(css, env, matchSelector) {
  const decls = new Map();
  for (const rule of scanCss(stripCssComments(css))) {
    if (!rule.conditions.every((condition) => conditionOn(condition, env))) continue;
    if (!selectorList(rule.prelude).some((selector) => matchSelector(selector, env))) continue;
    for (const [name, value] of declarations(rule.body)) decls.set(name, value);
  }
  return decls;
}

test("pressing the copy button scales the visual to 0.97 and the release returns it to 1", async () => {
  const css = await readFile("src/components/slot-code/SlotCode.css", "utf8");
  const source = await readFile("src/components/slot-code/SlotCode.jsx", "utf8");
  const live = stripCssComments(css);
  const rest = { pressed: false, disabled: false, reduced: false, safari: false, dark: false };
  const resting = applied(css, rest, visualSelector);
  const pressed = applied(css, { ...rest, pressed: true }, visualSelector);
  const released = applied(css, rest, visualSelector);
  const disabledPress = applied(css, { ...rest, pressed: true, disabled: true }, visualSelector);
  const reducedPress = applied(css, { ...rest, pressed: true, reduced: true }, visualSelector);
  const darkPress = applied(css, { ...rest, pressed: true, dark: true }, visualSelector);

  assert.equal(resting.get("transform"), "scale(1)");
  assert.equal(resting.get("transform-origin"), "center");
  assert.equal(resting.get("will-change"), "transform");
  assert.match(resting.get("transition"), /transform var\(--duration-normal\) var\(--ease-enter\)/);
  assert.equal(pressed.get("transform"), "scale(0.97)");
  assert.match(pressed.get("transition"), /transform var\(--duration-fast\) var\(--ease-standard\)/);
  assert.equal(released.get("transform"), "scale(1)");
  assert.equal(disabledPress.get("transform"), "scale(1)");
  assert.equal(reducedPress.get("transform"), "scale(1)");
  assert.equal(darkPress.get("transform"), "scale(0.97)");

  const scaled = scanCss(live).filter((rule) => rule.body.includes("scale(0.97)"));
  assert.equal(scaled.length, 1);
  assert.equal(/aria-label|data-label/.test(scaled[0].prelude), false);
  assert.equal(
    selectorList(scaled[0].prelude).every((selector) => (compounds(selector).at(-1) ?? "").includes(".slot-copy-visual")),
    true,
  );

  const hit = scanCss(live).find(
    (rule) => rule.prelude.includes("::before") && rule.conditions.some((condition) => condition.includes("pointer: coarse")),
  );
  assert.ok(hit);
  assert.equal(hit.body.includes("scale"), false);
  assert.match(hit.body, /transform:\s*translate\(-50%, -50%\)/);
  assert.match(hit.body, /width:\s*calc\(var\(--size-control-md\) \+ var\(--space-1\)\)/);
  assert.match(hit.body, /height:\s*calc\(var\(--size-control-md\) \+ var\(--space-1\)\)/);
  assert.match(live, /button\.slot-copy \{[^}]*touch-action:\s*manipulation;/);

  const activeIcon = applied(css, { safari: false, reduced: false, on: true }, iconSelector);
  const safariIcon = applied(css, { safari: true, reduced: false, on: true }, iconSelector);
  const inactiveIcon = applied(css, { safari: false, reduced: false, on: false }, iconSelector);
  const reducedActive = applied(css, { safari: false, reduced: true, on: true }, iconSelector);
  const reducedInactive = applied(css, { safari: true, reduced: true, on: false }, iconSelector);
  assert.equal(activeIcon.get("opacity"), "1");
  assert.equal(activeIcon.get("transform"), "scale(1)");
  assert.equal(activeIcon.get("filter"), "blur(0px)");
  assert.equal(activeIcon.get("will-change"), "opacity, transform, filter");
  assert.equal(
    activeIcon.get("transition"),
    "opacity var(--duration-normal) var(--ease-enter), transform var(--duration-normal) var(--ease-enter), filter var(--duration-normal) var(--ease-enter)",
  );
  assert.equal(safariIcon.get("transition"), activeIcon.get("transition"));
  assert.equal(safariIcon.get("transform"), "scale(1)");
  assert.equal(safariIcon.get("filter"), "blur(0px)");
  assert.equal(inactiveIcon.get("opacity"), "0");
  assert.equal(inactiveIcon.get("transform"), "scale(0.25)");
  assert.equal(inactiveIcon.get("filter"), "blur(var(--space-1))");
  assert.equal(reducedActive.get("opacity"), "1");
  assert.equal(reducedActive.get("transform"), "none");
  assert.equal(reducedActive.get("filter"), "none");
  assert.equal(reducedActive.get("transition"), "opacity var(--duration-fast) linear");
  assert.equal(reducedActive.get("will-change"), "opacity, transform, filter");
  assert.equal(reducedInactive.get("opacity"), "0");
  assert.equal(reducedInactive.get("transform"), "none");
  assert.equal(reducedInactive.get("filter"), "none");
  assert.match(live, /\.slot-copy-fill \{[^}]*clip-path:\s*inset\(0 100% 0 0\);[^}]*will-change:\s*clip-path, opacity;/);
  assert.match(source, /addEventListener\(\s*['"]touchstart['"],\s*\w+,\s*\{\s*passive:\s*true\s*\}\s*\)/);

  const clock = installClock();
  const random = installRandom([1, 2, 3, 4, 5, 6], 3);
  globalThis.__showcaseReducedMotion = false;
  const view = await mount();
  try {
    const control = button();
    assert.equal(control.classList.contains("slot-copy"), true);
    assert.equal(control.getAttribute("aria-label"), "Create code");
    assert.equal(control.getAttribute("aria-disabled"), "false");
    assert.equal((control._listeners.get("touchstart") ?? []).length, 1);
    control.dispatchEvent(new window.Event("touchstart"));

    await createCode();
    assert.equal(control.getAttribute("aria-label"), "Create code");
    assert.equal(control.getAttribute("aria-disabled"), "true");

    clock.set(SPIN_END);
    await clock.flush();
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(button().classList.contains("slot-copy"), true);
  } finally {
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

function crossfadeTargets() {
  return faceIcons().map((icons) => icons.map((icon) => `${icon.name}:${icon.on ? "on" : "off"}`).join(","));
}

test("Create code does not retarget the crossfade when only the disabled state changes", async () => {
  const clock = installClock();
  const random = installRandom([3, 3, 3, 3, 3, 3], 9);
  const originalClipboard = navigator.clipboard;
  navigator.clipboard = {
    writeText() {
      return Promise.resolve();
    },
  };
  globalThis.__showcaseReducedMotion = false;
  const view = await mount({ fillStyle: "smooth", countdownSeconds: 3 });
  try {
    const resting = crossfadeTargets();
    assert.deepEqual(resting, ["create:on,copy:off,check:off", "create:on,copy:off,check:off"]);

    await createCode();
    const spinning = crossfadeTargets();
    assert.equal(button().getAttribute("aria-disabled"), "true");
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.deepEqual(spinning, resting);

    clock.set(SPIN_END);
    await clock.flush();
    const copying = crossfadeTargets();
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.notDeepEqual(copying, resting);

    await act(async () => {
      button().click();
    });
    const copied = crossfadeTargets();
    assert.equal(button().getAttribute("aria-label"), "Code copied");
    assert.notDeepEqual(copied, copying);

    clock.set(SPIN_END + 1200);
    await clock.flush();
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.deepEqual(crossfadeTargets(), copying);

    clock.set(SPIN_END + 3000);
    await clock.flush();
    assert.equal(button().getAttribute("aria-disabled"), "true");
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.deepEqual(crossfadeTargets(), resting);

    clock.set(SPIN_END + 3000 + RETURN_END);
    await clock.flush();
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.deepEqual(crossfadeTargets(), resting);
    assert.deepEqual(crossfadeTargets(), spinning);
  } finally {
    navigator.clipboard = originalClipboard;
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

test("reduced motion crossfades the spin and the return, and does not breathe", async () => {
  const clock = installClock();
  const random = installRandom([9, 8, 7, 6, 5, 4], 4);
  globalThis.__showcaseReducedMotion = true;
  const view = await mount({ countdownSeconds: 3 });
  try {
    clock.set(20000);
    await clock.flush();
    assert.deepEqual(settledGlyphs(), ["H", "E", "L", "L", "O", "!"]);
    assert.equal(settledGlyphs().every((_, index) => !reelPose(index).flipping), true);
    assert.equal(button().getAttribute("aria-label"), "Create code");

    clock.set(20000);
    await createCode();
    clock.set(20100);
    await clock.flush();
    const transforms = [...document.querySelectorAll(".slot-leaf")].map((leaf) => leaf.style.transform);
    assert.equal(transforms.every((value) => !value.includes("rotate")), true);
    const incoming = document.querySelector(".slot-flap-next");
    assert.equal(Number(incoming.style.opacity) > 0, true);
    assert.equal(Number(incoming.style.opacity) < 1, true);

    clock.set(20200);
    await clock.flush();
    assert.equal(live().textContent, "New code: 9 8 7 6 5 4");
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.equal(
      [...document.querySelectorAll(".slot-leaf")].every((leaf) => !leaf.style.transform.includes("rotate")),
      true,
    );

    clock.set(20200 + 3000);
    await clock.flush();
    clock.set(20200 + 3000 + 100);
    await clock.flush();
    const returning = document.querySelector(".slot-flap-next");
    assert.equal(Number(returning.style.opacity) > 0, true);
    assert.equal(Number(returning.style.opacity) < 1, true);
    assert.equal(
      [...document.querySelectorAll(".slot-leaf")].every((leaf) => !leaf.style.transform.includes("rotate")),
      true,
    );

    clock.set(20200 + 3000 + 200);
    await clock.flush();
    assert.deepEqual(settledGlyphs(), ["H", "E", "L", "L", "O", "!"]);
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(live().textContent, "Code expired. Create code.");
  } finally {
    globalThis.__showcaseReducedMotion = false;
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

test("hiding the tab pauses the clock, and unmount cancels the frame", async () => {
  const clock = installClock();
  const random = installRandom([1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2], 5);
  globalThis.__showcaseReducedMotion = false;
  const view = await mount();
  try {
    await clock.flush();
    await createCode();
    clock.set(100);
    await clock.flush();
    assert.equal(live().textContent, "");
    assert.equal(button().getAttribute("aria-disabled"), "true");

    document.visibilityState = "hidden";
    document.dispatchEvent(new window.Event("visibilitychange"));
    assert.equal(clock.pending(), 0);
    clock.set(80000);
    await clock.flush();
    assert.equal(live().textContent, "");

    document.visibilityState = "visible";
    document.dispatchEvent(new window.Event("visibilitychange"));
    await clock.flush();
    assert.equal(live().textContent, "");
    assert.equal(button().getAttribute("aria-disabled"), "true");

    const scheduled = clock.scheduled();
    await view.unmount();
    assert.equal(clock.pending(), 0);
    clock.set(200000);
    await clock.flush();
    assert.equal(clock.scheduled(), scheduled);
    document.dispatchEvent(new window.Event("visibilitychange"));
    assert.equal(clock.pending(), 0);
  } finally {
    document.visibilityState = "visible";
    clock.restore();
    random.restore();
  }
});

function ruleBody(css, selector) {
  const match = css.match(new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, selector);
  return match[1];
}

function declared(body, property) {
  const match = body.match(new RegExp(`${property}:\\s*([^;]+);`));
  assert.ok(match, property);
  return match[1].trim();
}

function coveredWidth(borderBox, borderDecl, insetDecl) {
  const border = borderDecl === "var(--border-width-0)" ? 0 : Number.NaN;
  const inset = insetDecl === "0" ? 0 : Number.NaN;
  return borderBox - border * 2 - inset * 2;
}

test("a full fill covers the copy button border box", async () => {
  const css = await readFile("src/components/slot-code/SlotCode.css", "utf8");
  const visual = ruleBody(css, "\\.slot-copy-visual");
  const fillRule = ruleBody(css, "\\.slot-copy-fill");
  const border = declared(visual, "border-width");
  const inset = declared(fillRule, "inset");
  assert.equal(border, "var(--border-width-0)");
  assert.equal(inset, "0");
  assert.match(visual, /overflow:\s*hidden/);
  assert.match(visual, /border-radius:\s*inherit/);
  assert.match(visual, /box-shadow:\s*inset 0 0 0 var\(--border-width-1\)/);
  assert.equal(visual.includes("border-style"), false);
  const borderBox = 181.5;
  assert.equal(coveredWidth(borderBox, border, inset), borderBox);
  assert.equal(smoothClip(0), FILL_EMPTY);
  assert.equal(smoothClip(1), "inset(0 0% 0 0)");
  assert.equal(retroClip(0), FILL_EMPTY);
  assert.equal(retroClip(100), "inset(0 0% 0 0)");
  const smoothEdges = smoothClip(1).slice(6, -1).split(/\s+/);
  const retroEdges = retroClip(100).slice(6, -1).split(/\s+/);
  assert.equal(smoothEdges[1], "0%");
  assert.equal(retroEdges[1], "0%");
  assert.ok(smoothClip(0.25).includes("75.000%"));

  const clock = installClock();
  const random = installRandom([1, 2, 3, 4, 5, 6], 11);
  globalThis.__showcaseReducedMotion = false;
  const view = await mount({ fillStyle: "smooth" });
  try {
    await createCode();
    clock.set(SPIN_END + 1000);
    await clock.flush();
    assert.equal(fill().hasAttribute("hidden"), false);
    const buttonBox = button().getBoundingClientRect();
    const fillBox = fill().getBoundingClientRect();
    const visualBox = document.querySelector(".slot-copy-visual").getBoundingClientRect();
    assert.equal(fillBox.width, buttonBox.width);
    assert.equal(fillBox.right, buttonBox.right);
    assert.equal(visualBox.width, buttonBox.width);
    const faces = [...document.querySelectorAll(".slot-copy-face")];
    assert.equal(faces.length, 2);
    assert.equal(faces[0].parentElement, document.querySelector(".slot-copy-visual"));
    assert.equal(faces[1].parentElement, fill());
    assert.equal(fill().parentElement, document.querySelector(".slot-copy-visual"));
  } finally {
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

test("three create, copy, and expire cycles restore the exact first-load button", async () => {
  const clock = installClock();
  const digits = Array.from({ length: 400 }, (_, index) => (index % 9) + 1);
  const random = installRandom(digits, 0x0c0de);
  const originalClipboard = navigator.clipboard;
  navigator.clipboard = {
    writeText() {
      return Promise.resolve();
    },
  };
  globalThis.__showcaseReducedMotion = false;
  const view = await mount({ countdownSeconds: 3 });
  try {
    button().focus();
    assert.equal(document.activeElement, button());
    const first = buttonSignature();
    assert.equal(first.label, "Create code");
    assert.equal(first.disabled, "false");
    assert.deepEqual(first.icons, ["create:on,copy:off,check:off", "create:on,copy:off,check:off"]);
    assertIcons("create");
    assert.equal(first.fillHidden, true);
    assert.equal(first.clip, FILL_EMPTY);
    assert.deepEqual(first.effects, []);
    assert.deepEqual(settledGlyphs(), ["H", "E", "L", "L", "O", "!"]);
    let time = 0;
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await createCode();
      assert.equal(document.activeElement, button());
      assert.equal(button().getAttribute("aria-disabled"), "true");
      assert.equal(button().getAttribute("aria-label"), "Create code");
      assertIcons("create");
      time += SPIN_END;
      clock.set(time);
      await clock.flush();
      const landed = time;
      assert.equal(button().getAttribute("aria-label"), "Copy code");
      assert.equal(button().getAttribute("aria-disabled"), "false");
      assertIcons("copy");
      assert.equal(fill().hasAttribute("hidden"), false);

      await act(async () => {
        button().click();
      });
      assert.equal(button().getAttribute("aria-label"), "Code copied");
      assertIcons("check");
      assert.equal(live().textContent, "Copied");

      time = landed + 1200;
      clock.set(time);
      await clock.flush();
      assert.equal(button().getAttribute("aria-label"), "Copy code");
      assertIcons("copy");

      time = landed + 3000;
      clock.set(time);
      await clock.flush();
      assert.equal(fill().style.clipPath, FILL_EMPTY);
      assert.equal(fill().hasAttribute("hidden"), true);
      assert.equal(button().getAttribute("aria-disabled"), "true");
      assert.equal(button().getAttribute("aria-label"), "Create code");
      assertIcons("create");

      time = landed + 3000 + RETURN_END;
      clock.set(time);
      await clock.flush();
      assert.deepEqual(buttonSignature(), first);
      assert.deepEqual(settledGlyphs(), ["H", "E", "L", "L", "O", "!"]);
      assert.equal(live().textContent, "Code expired. Create code.");
      assert.equal(document.activeElement, button());
    }

    await createCode();
    time += SPIN_END;
    clock.set(time);
    await clock.flush();
    await act(async () => {
      button().click();
    });
    assert.equal(button().getAttribute("aria-label"), "Code copied");
    assertIcons("check");
    time += 3000;
    clock.set(time);
    await clock.flush();
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.equal(button().getAttribute("aria-disabled"), "true");
    assertIcons("create");
    assert.equal(fill().style.clipPath, FILL_EMPTY);
    assert.equal(fill().hasAttribute("hidden"), true);
  } finally {
    navigator.clipboard = originalClipboard;
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

test("a resting reel breathes once and lands on the same letter", async () => {
  const clock = installClock();
  const twin = makeRng(0xbeef);
  const delay = idleDelayMs((span) => unbiasedBelow(span, twin));
  const reel = unbiasedBelow(6, twin);
  const random = installRandom([], 0xbeef);
  globalThis.__showcaseReducedMotion = false;
  const view = await mount();
  try {
    await clock.flush();
    clock.set(delay - 1);
    await clock.flush();
    assert.equal(settledGlyphs().every((_, index) => !reelPose(index).flipping), true);
    clock.set(delay);
    await clock.flush();
    clock.set(delay + MOTION_FALLBACK.expressionSm / 2);
    await clock.flush();
    assert.equal(reelPose(reel).flipping, true);
    assert.equal(
      settledGlyphs().every((glyph, index) => (index === reel ? true : !reelPose(index).flipping)),
      true,
    );
    assert.equal(button().getAttribute("aria-label"), "Create code");
    assert.equal(live().textContent, "");
    clock.set(delay + MOTION_FALLBACK.expressionSm);
    await clock.flush();
    assert.deepEqual(settledGlyphs(), ["H", "E", "L", "L", "O", "!"]);
    assert.equal(reelPose(reel).flipping, false);
    assert.equal(button().getAttribute("aria-disabled"), "false");
  } finally {
    await view.unmount();
    clock.restore();
    random.restore();
  }
});
