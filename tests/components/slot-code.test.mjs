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

function visibleLabels() {
  return [...document.querySelectorAll(".slot-copy-face")].map((face) => {
    const shown = [...face.querySelectorAll("[data-label]")].find((node) => node.classList.contains("is-on"));
    return shown.textContent;
  });
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
    labels: visibleLabels(),
    icons: [...control.querySelectorAll("svg")]
      .filter((icon) => icon.classList.contains("is-on"))
      .map((icon) => icon.getAttribute("data-icon")),
    fillHidden: fill().hasAttribute("hidden"),
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
  assert.match(css, /\.slot-copy-label > span \{[^}]*grid-area:\s*1 \/ 1;/);
  assert.match(css, /\.slot-copy-icons > svg,/);
  assert.equal(css.includes("!important"), false);
  assert.match(css, /\.slot-copy-fill\[hidden\] \{[^}]*display:\s*none;/);
  assert.match(css, /filter:\s*blur\(var\(--space-1\)\);/);
  assert.match(css, /opacity var\(--duration-normal\) var\(--ease-enter\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*transition:\s*opacity var\(--duration-fast\) linear;/s);
  assert.match(css, /button\.slot-copy:focus \{[^}]*outline:\s*none;/);
  assert.match(css, /button\.slot-copy:focus-visible \{[^}]*outline:\s*var\(--border-focus\);/);
  assert.match(css, /\.slot-code \{[^}]*gap:\s*var\(--space-4\);/);
  assert.match(css, /button\.slot-copy \{[^}]*min-height:\s*var\(--size-control-sm\);[^}]*font:\s*var\(--label-sm\);/);
  assert.match(css, /\.slot-copy-visual \{[^}]*min-height:\s*var\(--size-control-sm\);/);
  assert.match(css, /\.slot-copy svg \{[^}]*width:\s*calc\(var\(--size-icon-sm\) - var\(--border-width-2\)\);/);
  assert.match(
    css,
    /@media \(pointer: coarse\) \{\s*button\.slot-copy::before \{[^}]*height:\s*calc\(var\(--size-control-md\) \+ var\(--space-1\)\);/,
  );
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
    assert.deepEqual(visibleLabels(), ["Create code", "Create code"]);
    assert.equal(/\d|%|second/i.test(button().textContent), false);
    await createCode();
    assert.equal(button().offsetWidth, restingWidth);
    assert.deepEqual(visibleLabels(), ["Create code", "Create code"]);

    clock.set(SPIN_END);
    await clock.flush();
    assert.equal(fill().style.clipPath, smoothClip(0));
    assert.equal(button().offsetWidth, restingWidth);
    assert.deepEqual(visibleLabels(), ["Copy code", "Copy code"]);
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.equal(/\d|%/.test(button().textContent), false);

    await act(async () => {
      button().click();
    });
    assert.deepEqual(written, ["123456"]);
    assert.equal(button().getAttribute("aria-label"), "Copied");
    assert.deepEqual(visibleLabels(), ["Copied", "Copied"]);
    assert.equal(button().offsetWidth, restingWidth);
    assert.equal(live().textContent, "Copied");
    assert.equal(/\d|%/.test(button().textContent), false);

    clock.set(SPIN_END + 1200);
    await clock.flush();
    assert.deepEqual(visibleLabels(), ["Copy code", "Copy code"]);
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.equal(button().offsetWidth, restingWidth);
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

test("three create-expire cycles restore the exact first-load button", async () => {
  const clock = installClock();
  const digits = Array.from({ length: 80 }, (_, index) => (index % 9) + 1);
  const random = installRandom(digits, 0x0c0de);
  globalThis.__showcaseReducedMotion = false;
  const view = await mount({ countdownSeconds: 3 });
  try {
    button().focus();
    assert.equal(document.activeElement, button());
    const first = buttonSignature();
    assert.equal(first.label, "Create code");
    assert.equal(first.disabled, "false");
    assert.deepEqual(first.labels, ["Create code", "Create code"]);
    assert.deepEqual(first.icons, ["create", "create"]);
    assert.equal(first.fillHidden, true);
    assert.equal(first.clip, FILL_EMPTY);
    assert.deepEqual(first.effects, []);
    assert.deepEqual(settledGlyphs(), ["H", "E", "L", "L", "O", "!"]);
    let time = 0;
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await createCode();
      assert.equal(document.activeElement, button());
      time += SPIN_END;
      clock.set(time);
      await clock.flush();
      assert.equal(button().getAttribute("aria-label"), "Copy code");
      assert.equal(fill().hasAttribute("hidden"), false);
      time += 3000;
      clock.set(time);
      await clock.flush();
      time += RETURN_END;
      clock.set(time);
      await clock.flush();
      assert.deepEqual(buttonSignature(), first);
      assert.deepEqual(settledGlyphs(), ["H", "E", "L", "L", "O", "!"]);
      assert.equal(live().textContent, "Code expired. Create code.");
      assert.equal(document.activeElement, button());
    }
  } finally {
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
