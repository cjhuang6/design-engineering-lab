const HEX_RADIUS = 3;
const HUES = ["ice", "blue", "green", "pink"];
const STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export function buildPalette() {
  const slots = [];
  for (let axialR = -HEX_RADIUS; axialR <= HEX_RADIUS; axialR += 1) {
    for (let q = -HEX_RADIUS; q <= HEX_RADIUS; q += 1) {
      if (Math.abs(q + axialR) > HEX_RADIUS) continue;
      const ring = Math.max(Math.abs(q), Math.abs(axialR), Math.abs(q + axialR));
      const ux = q + axialR / 2;
      const uy = (axialR * Math.sqrt(3)) / 2;
      const ang = (((Math.atan2(ux, -uy) * 180) / Math.PI) + 360 + 45) % 360;
      const wedge = Math.floor(ang / 90);
      slots.push({ q, axialR, ring, ang, wedge });
    }
  }

  HUES.forEach((hue, wedge) => {
    const members = slots
      .filter((slot) => slot.ring > 0 && slot.wedge === wedge)
      .sort((a, b) => a.ring - b.ring || a.ang - b.ang);
    members.forEach((slot, index) => {
      const step = STEPS[index];
      slot.hue = hue;
      slot.step = step;
      slot.token = `color.primitive.${hue}.${step}`;
      slot.cssVar = `--color-primitive-${hue}-${step}`;
      slot.label = `${hue.charAt(0).toUpperCase()}${hue.slice(1)} ${step}`;
    });
  });

  const center = slots.find((slot) => slot.ring === 0);
  center.hue = "white";
  center.step = 0;
  center.token = "color.base.white";
  center.cssVar = "--color-base-white";
  center.label = "White";

  if (slots.some((slot) => !slot.token)) {
    throw new Error("palette does not fill the hexagon");
  }

  slots.sort((a, b) => a.axialR - b.axialR || a.q - b.q);
  let row = -1;
  let lastAxial = null;
  let indexInRow = 0;
  for (const slot of slots) {
    if (slot.axialR !== lastAxial) {
      row += 1;
      lastAxial = slot.axialR;
      indexInRow = 0;
    }
    slot.row = row;
    slot.indexInRow = indexInRow;
    indexInRow += 1;
  }
  return slots;
}

export function layoutMetrics(width, gap) {
  const height = (width * 2) / Math.sqrt(3);
  const pitchX = width + gap;
  const pitchY = height * 0.75 + (gap * Math.sqrt(3)) / 2;
  return {
    width,
    height,
    gap,
    pitchX,
    pitchY,
    gridWidth: HEX_RADIUS * 2 * pitchX + width,
    gridHeight: HEX_RADIUS * 2 * pitchY + height,
  };
}

export function placeCells(cells, width, gap) {
  const metrics = layoutMetrics(width, gap);
  const originX = HEX_RADIUS * metrics.pitchX;
  const originY = HEX_RADIUS * metrics.pitchY;
  return cells.map((cell) => {
    const x = originX + (cell.q + cell.axialR / 2) * metrics.pitchX;
    const y = originY + cell.axialR * metrics.pitchY;
    return {
      ...cell,
      x,
      y,
      cx: x + metrics.width / 2,
      cy: y + metrics.height / 2,
    };
  });
}

function rowsOf(cells) {
  const rows = new Map();
  for (const cell of cells) {
    const row = rows.get(cell.row) ?? [];
    row.push(cell);
    rows.set(cell.row, row);
  }
  for (const row of rows.values()) row.sort((a, b) => a.indexInRow - b.indexInRow);
  return rows;
}

export function moveSelection(cells, token, key, memory, pitchX) {
  const column = memory ?? { colX: null, colId: null };
  const current = cells.find((cell) => cell.token === token);
  if (!current || current.cx == null || !(pitchX > 0)) return { token, memory: column };
  const rows = rowsOf(cells);
  const row = rows.get(current.row);
  if (!row) return { token, memory: column };

  if (key === "ArrowRight" || key === "ArrowLeft" || key === "Home" || key === "End") {
    const next =
      key === "ArrowRight"
        ? row[Math.min(current.indexInRow + 1, row.length - 1)]
        : key === "ArrowLeft"
          ? row[Math.max(current.indexInRow - 1, 0)]
          : key === "Home"
            ? row[0]
            : row[row.length - 1];
    return { token: next.token, memory: { colX: column.colX, colId: column.colId } };
  }

  if (key !== "ArrowDown" && key !== "ArrowUp") return { token, memory: column };

  const dir = key === "ArrowDown" ? 1 : -1;
  const adjacent = rows.get(current.row + dir);
  const colX = column.colId === current.token ? column.colX : current.cx;
  let next = current;
  if (adjacent) {
    let best = null;
    for (const candidate of adjacent) {
      if (Math.abs(candidate.cx - current.cx) > pitchX * 0.6) continue;
      if (!best || Math.abs(candidate.cx - colX) < Math.abs(best.cx - colX) - 0.5) best = candidate;
    }
    if (best) next = best;
  }
  return { token: next.token, memory: { colX, colId: next.token } };
}

export function cellAtPoint(cells, x, y, height) {
  let best = null;
  let bestDistance = Infinity;
  for (const cell of cells) {
    const distance = Math.hypot(x - cell.cx, y - cell.cy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cell;
    }
  }
  if (!best || bestDistance > height / 2) return null;
  return best;
}

export function smoothstep(amount) {
  const t = Math.min(1, Math.max(0, amount));
  return t * t * (3 - 2 * t);
}

export function proximityFalloff(distance, radius) {
  if (!(radius > 0) || distance >= radius) return 0;
  if (distance <= 0) return 1;
  return smoothstep(1 - distance / radius);
}

export function draggedSliderValue(start, dx, width, min, max, step) {
  if (!(width > 0) || !(max > min)) return start;
  const raw = start + (dx / width) * (max - min);
  if (!(step > 0)) return Math.min(max, Math.max(min, raw));
  const snapped = min + Math.round((raw - min) / step) * step;
  const tidy = Number(snapped.toFixed(6));
  return Math.min(max, Math.max(min, tidy));
}

export function proximityPaint(effect, maxScale, darken) {
  if (!effect) return { transform: "", filter: "" };
  return {
    transform: `scale(${(1 + (maxScale - 1) * effect).toFixed(4)})`,
    filter: darken ? `brightness(${(1 - darken * effect).toFixed(4)})` : "",
  };
}

export function parseColor(input) {
  const value = String(input).trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, (part) => part + part) : hex[1];
    const n = Number.parseInt(digits, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i.exec(value);
  if (!rgb) return null;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

function channelLuminance(value) {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color) {
  const channels = typeof color === "string" ? parseColor(color) : color;
  if (!channels) return null;
  const [r, g, b] = channels.map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function pickMarkColor(cellColor, whiteColor, darkColor) {
  const cell = relativeLuminance(cellColor);
  const white = relativeLuminance(whiteColor);
  const dark = relativeLuminance(darkColor);
  if (cell == null || white == null || dark == null) return "dark";
  return contrastRatio(cell, white) >= contrastRatio(cell, dark) ? "white" : "dark";
}

export function formatHex(color) {
  const channels = typeof color === "string" ? parseColor(color) : color;
  if (!channels) return "";
  return `#${channels.map((part) => Math.round(part).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function cssDurationMs(value) {
  const match = /^(-?(?:\d+|\d*\.\d+))(ms|s)?$/i.exec(String(value).trim());
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return 0;
  return match[2]?.toLowerCase() === "s" ? amount * 1000 : amount;
}

export function focusRingPoints(width, height, pad, outset) {
  const radius = height / 2 + outset / Math.cos(Math.PI / 6);
  const cx = width / 2 + pad;
  const cy = height / 2 + pad;
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 90);
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return points.join(" ");
}
