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
  RETRO_HOLD_MS,
  RETRO_MS,
  clampCountdown,
  cycleDurationMs,
  flapPlan,
  makeSchedule,
  mod10,
  percentAt,
  reelLockMs,
  retroClip,
  smoothClip,
  unbiasedBelow,
} from "../../src/components/slot-code/model.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const LAST_LOCK = reelLockMs(5);

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

test("each reel's flips vary around 72ms and still lock on its deadline", () => {
  const period = Math.max(55, 1150 / 16);
  assert.ok(Math.abs(period - 71.875) < 1e-9);
  for (let reel = 0; reel < 6; reel += 1) {
    const lock = reelLockMs(reel);
    assert.equal(lock, 1400 + reel * 150);
    for (let from = 0; from < 10; from += 1) {
      for (let to = 0; to < 10; to += 1) {
        const plan = flapPlan(from, to, lock);
        assert.ok(Math.abs(plan.delay + plan.n * plan.per - lock) < 1e-6, `${from}->${to} reel ${reel}`);
        assert.equal(mod10(plan.n), mod10(to - from));
        assert.ok(plan.per <= period * 1.25 + 1e-9);
        assert.ok(plan.per > 0);
        assert.equal(plan.phase === undefined || plan.phase <= 1, true);
      }
    }
  }
  assert.equal(cycleDurationMs("retro", 30), RETRO_MS);
  assert.equal(cycleDurationMs("smooth", 5), 5000);
  assert.equal(cycleDurationMs("smooth", 2), 3000);
  assert.equal(cycleDurationMs("smooth", 40), 30000);
  assert.equal(clampCountdown(5.2), 5);
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
    const shown = [...face.querySelectorAll(".slot-copy-label span")].find((node) => !node.hidden);
    return shown.textContent;
  });
}

test("reels lock on time, retro fill completes at 3s, and the live region speaks once", async () => {
  const clock = installClock();
  const random = installRandom([1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2], 0x51c0de);
  const scheduleRng = makeRng(0x51c0de);
  const expected = makeSchedule(RETRO_MS, (span) => unbiasedBelow(span, scheduleRng));
  globalThis.__showcaseReducedMotion = false;
  const view = await mount({ fillStyle: "retro" });
  try {
    await clock.flush();
    assert.equal(button().getAttribute("aria-disabled"), "true");
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.equal(document.querySelector(".slot-reels").getAttribute("aria-hidden"), "true");
    assert.equal(live().textContent, "");
    assert.equal(description().getAttribute("aria-live"), null);
    assert.equal(description().textContent, "Generating a new code");

    clock.set(1399);
    await clock.flush();
    assert.equal(reelPose(0).flipping, true);

    clock.set(1400);
    await clock.flush();
    assert.deepEqual(reelPose(0), { digit: "1", flipping: false, transform: " " });

    clock.set(LAST_LOCK - 1);
    await clock.flush();
    assert.equal(reelPose(5).flipping, true);

    clock.set(LAST_LOCK);
    await clock.flush();
    assert.deepEqual(
      [...document.querySelectorAll(".slot-reel")].map((_, index) => reelPose(index).digit),
      ["1", "2", "3", "4", "5", "6"],
    );
    assert.equal([...document.querySelectorAll(".slot-reel")].every((_, index) => !reelPose(index).flipping), true);
    assert.equal(fill().style.clipPath, retroClip(0));
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(document.querySelector(".slot-reels").hasAttribute("aria-hidden"), false);
    assert.equal(live().textContent, "New code: 1 2 3 4 5 6");
    assert.equal(description().textContent, "Code expires in 3 seconds");
    assert.equal(status().textContent, "");

    clock.set(LAST_LOCK + 150);
    await clock.flush();
    assert.notEqual(fill().style.clipPath, retroClip(0));
    assert.equal(percentAt(expected, 150) > 0, true);
    assert.equal(fill().style.clipPath, retroClip(percentAt(expected, 150)));

    clock.set(LAST_LOCK + 500);
    await clock.flush();
    assert.equal(description().textContent, "Code expires in 3 seconds");
    clock.set(LAST_LOCK + 1000);
    await clock.flush();
    assert.equal(description().textContent, "Code expires in 2 seconds");
    assert.equal(live().textContent, "New code: 1 2 3 4 5 6");

    clock.set(LAST_LOCK + RETRO_MS);
    await clock.flush();
    assert.equal(fill().style.clipPath, retroClip(100));
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(live().textContent, "New code: 1 2 3 4 5 6");

    clock.set(LAST_LOCK + RETRO_MS + RETRO_HOLD_MS - 1);
    await clock.flush();
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(live().textContent, "New code: 1 2 3 4 5 6");

    clock.set(LAST_LOCK + RETRO_MS + RETRO_HOLD_MS);
    await clock.flush();
    assert.equal(button().getAttribute("aria-disabled"), "true");
    assert.equal(live().textContent, "New code: 1 2 3 4 5 6");
    assert.equal(document.querySelector(".slot-reels").getAttribute("aria-hidden"), "true");

    clock.set(LAST_LOCK + RETRO_MS + RETRO_HOLD_MS + LAST_LOCK);
    await clock.flush();
    assert.equal(live().textContent, "New code: 7 8 9 0 1 2");
  } finally {
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

test("smooth fill drains in a straight line and the long countdown hints once", async () => {
  const clock = installClock();
  const random = installRandom([4, 4, 4, 4, 4, 4], 2);
  globalThis.__showcaseReducedMotion = false;
  const view = await mount({ fillStyle: "smooth", countdownSeconds: 6 });
  try {
    await clock.flush();
    clock.set(LAST_LOCK);
    await clock.flush();
    assert.equal(fill().style.clipPath, smoothClip(1));
    assert.equal(description().textContent, "Code expires in 6 seconds");
    assert.equal(status().textContent, "");

    clock.set(LAST_LOCK + 1000);
    await clock.flush();
    assert.equal(status().textContent, "Code expires in 5 seconds");
    assert.equal(description().textContent, "Code expires in 5 seconds");
    assert.equal(fill().style.clipPath, smoothClip(5000 / 6000));

    clock.set(LAST_LOCK + 3000);
    await clock.flush();
    assert.equal(fill().style.clipPath, smoothClip(0.5));
    assert.equal(description().textContent, "Code expires in 3 seconds");
    assert.equal(status().textContent, "Code expires in 5 seconds");
    assert.equal(live().textContent, "New code: 4 4 4 4 4 4");

    clock.set(LAST_LOCK + 6000);
    await clock.flush();
    assert.equal(button().getAttribute("aria-disabled"), "true");
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
  assert.match(css, /\.slot-copy-label > span\[hidden\] \{[^}]*display:\s*block;[^}]*visibility:\s*hidden;/);
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
    await clock.flush();
    const spinningWidth = button().offsetWidth;
    assert.deepEqual(visibleLabels(), ["Copy code", "Copy code"]);
    assert.equal(/\d|%|second/i.test(button().textContent), false);

    clock.set(LAST_LOCK);
    await clock.flush();
    assert.equal(fill().style.clipPath, smoothClip(1));
    assert.equal(button().offsetWidth, spinningWidth);
    assert.deepEqual(visibleLabels(), ["Copy code", "Copy code"]);
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.equal(/\d|%/.test(button().textContent), false);

    await act(async () => {
      button().click();
    });
    assert.deepEqual(written, ["123456"]);
    assert.equal(button().getAttribute("aria-label"), "Copy code");
    assert.deepEqual(visibleLabels(), ["Copied", "Copied"]);
    assert.equal(button().offsetWidth, spinningWidth);
    assert.equal(status().textContent, "Copied");
    assert.equal(/\d|%/.test(button().textContent), false);

    clock.set(LAST_LOCK + 1200);
    await clock.flush();
    assert.deepEqual(visibleLabels(), ["Copy code", "Copy code"]);
    assert.equal(button().offsetWidth, spinningWidth);
  } finally {
    navigator.clipboard = originalClipboard;
    await view.unmount();
    clock.restore();
    random.restore();
  }
});

test("reduced motion crossfades with opacity and does not rotate the flaps", async () => {
  const clock = installClock();
  const random = installRandom([9, 8, 7, 6, 5, 4], 4);
  globalThis.__showcaseReducedMotion = true;
  const view = await mount();
  try {
    await clock.flush();
    clock.set(100);
    await clock.flush();
    const transforms = [...document.querySelectorAll(".slot-leaf")].map((leaf) => leaf.style.transform);
    assert.equal(transforms.every((value) => !value.includes("rotate")), true);
    const incoming = document.querySelector(".slot-flap-next");
    assert.equal(Number(incoming.style.opacity) > 0, true);
    assert.equal(Number(incoming.style.opacity) < 1, true);

    clock.set(200);
    await clock.flush();
    assert.equal(live().textContent, "New code: 9 8 7 6 5 4");
    assert.equal(button().getAttribute("aria-disabled"), "false");
    assert.equal(
      [...document.querySelectorAll(".slot-leaf")].every((leaf) => !leaf.style.transform.includes("rotate")),
      true,
    );
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
    clock.set(1000);
    await clock.flush();
    assert.equal(live().textContent, "");

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
