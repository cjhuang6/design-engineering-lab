const ROOT_SELECTOR = ":root";
const DARK_SELECTOR = '[data-theme="dark"]';

const SECTIONS = [
  {
    id: "color",
    title: "Color",
    test: (name) => name.startsWith("--color-") || name.startsWith("--feedback-"),
  },
  {
    id: "typography",
    title: "Typography",
    test: (name) =>
      name.startsWith("--font-") ||
      name.startsWith("--tracking-") ||
      /^--(display|heading|body|label|code)-/.test(name),
  },
  {
    id: "spacing",
    title: "Spacing",
    test: (name) =>
      name.startsWith("--space-") ||
      name.startsWith("--layout-") ||
      name.startsWith("--control-"),
  },
  { id: "radius", title: "Radius", test: (name) => name.startsWith("--radius-") },
  { id: "border", title: "Border", test: (name) => name.startsWith("--border-") },
  { id: "shadow", title: "Shadow", test: (name) => name.startsWith("--shadow-") },
  { id: "opacity", title: "Opacity", test: (name) => name.startsWith("--opacity-") },
  { id: "blur", title: "Blur", test: (name) => name.startsWith("--blur-") },
  { id: "frost", title: "Frost", test: (name) => name.startsWith("--frost-") },
  {
    id: "motion",
    title: "Motion",
    test: (name) => name.startsWith("--duration-") || name.startsWith("--ease-"),
  },
  {
    id: "breakpoint",
    title: "Breakpoints",
    test: (name) => name.startsWith("--breakpoint-"),
  },
  { id: "sizing", title: "Sizing", test: (name) => name.startsWith("--size-") },
  { id: "z", title: "Z-index", test: (name) => name.startsWith("--z-") },
  {
    id: "expression",
    title: "Expression",
    test: (name) => name.startsWith("--expression-"),
  },
];

const FROST_SUFFIXES = ["backdrop-filter", "background", "border"];

function titleCase(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parts(name) {
  return name.slice(2).split("-");
}

function sectionFor(name) {
  return SECTIONS.find((section) => section.test(name)) ?? { id: "other", title: "Other" };
}

function subgroupFor(name) {
  const nameParts = parts(name);
  if (name.startsWith("--color-primitive-")) {
    return nameParts[2] === "alpha" ? "Alpha" : titleCase(nameParts[2]);
  }
  if (name.startsWith("--color-base-")) return "Base";
  if (name.startsWith("--feedback-")) return "Feedback";
  if (name.startsWith("--color-")) return titleCase(nameParts[1]);
  if (name.startsWith("--font-")) return titleCase(nameParts[1]);
  if (name.startsWith("--tracking-")) return "Tracking";
  if (/^--(display|heading|body|label|code)-/.test(name)) return titleCase(nameParts[0]);
  if (name.startsWith("--space-")) return "Scale";
  if (name.startsWith("--layout-")) return "Layout";
  if (name.startsWith("--control-")) return "Control padding";
  if (name.startsWith("--border-width-")) return "Width";
  if (name.startsWith("--border-style-")) return "Style";
  if (name.startsWith("--border-")) return "Composite";
  if (name.startsWith("--duration-")) return "Duration";
  if (name.startsWith("--ease-")) return "Easing";
  if (name.startsWith("--size-")) return titleCase(nameParts[1]);
  if (name.startsWith("--frost-")) {
    const body = name.slice("--frost-".length);
    const suffix = FROST_SUFFIXES.find((item) => body.endsWith(`-${item}`));
    const material = suffix ? body.slice(0, -(suffix.length + 1)) : body;
    return titleCase(material);
  }
  return "All";
}

function groupTokens(tokens) {
  const bySection = new Map();
  for (const token of tokens) {
    const id = token.section.id;
    if (!bySection.has(id)) bySection.set(id, []);
    bySection.get(id).push(token);
  }
  const ordered = SECTIONS.filter((section) => bySection.has(section.id));
  if (bySection.has("other")) ordered.push({ id: "other", title: "Other" });
  return ordered.map((section) => {
    const subgroups = [];
    for (const token of bySection.get(section.id)) {
      let subgroup = subgroups.find((item) => item.title === token.subgroup);
      if (!subgroup) {
        subgroup = {
          id: `${section.id}-${token.subgroup.toLowerCase().replaceAll(/\s+/g, "-")}`,
          title: token.subgroup,
          tokens: [],
        };
        subgroups.push(subgroup);
      }
      subgroup.tokens.push(token);
    }
    return { id: section.id, title: section.title, subgroups };
  });
}

export function parseTokenCss(css) {
  const stripped = css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
  const blocks = new Map();
  for (const match of stripped.matchAll(/([^{]+)\{([^}]*)\}/g)) {
    const selector = match[1].trim();
    const declarations = [];
    for (const decl of match[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      declarations.push({ name: decl[1], value: decl[2].trim() });
    }
    blocks.set(selector, declarations);
  }
  return {
    light: blocks.get(ROOT_SELECTOR) ?? [],
    dark: blocks.get(DARK_SELECTOR) ?? [],
  };
}

export function catalogFromCss(css) {
  const { light, dark } = parseTokenCss(css);
  const darkByName = new Map(dark.map((token) => [token.name, token.value]));
  const seen = new Set();
  const tokens = [];
  for (const token of light) {
    seen.add(token.name);
    tokens.push({
      name: token.name,
      lightValue: token.value,
      darkValue: darkByName.get(token.name) ?? null,
      section: sectionFor(token.name),
      subgroup: subgroupFor(token.name),
    });
  }
  for (const token of dark) {
    if (seen.has(token.name)) continue;
    tokens.push({
      name: token.name,
      lightValue: null,
      darkValue: token.value,
      section: sectionFor(token.name),
      subgroup: subgroupFor(token.name),
    });
  }
  return groupTokens(tokens);
}

export function previewKind(name) {
  if (name.startsWith("--color-") || name.startsWith("--feedback-")) return "color";
  if (name.startsWith("--radius-")) return "radius";
  if (name.startsWith("--shadow-")) return "shadow";
  if (name.startsWith("--opacity-")) return "opacity";
  if (name.startsWith("--expression-")) return "expression";
  if (name.startsWith("--frost-")) return "frost";
  if (name.startsWith("--border-width-") || name.startsWith("--border-style-")) return "text";
  if (name.startsWith("--border-")) return "border";
  if (
    name.startsWith("--space-") ||
    name.startsWith("--layout-") ||
    name.startsWith("--control-") ||
    name.startsWith("--size-") ||
    name.startsWith("--breakpoint-") ||
    name.startsWith("--blur-")
  ) {
    return "length";
  }
  if (name.startsWith("--font-family-")) return "family";
  if (name.startsWith("--font-weight-")) return "weight";
  if (name.startsWith("--tracking-") || name.endsWith("-letter-spacing")) return "tracking";
  if (/^--(display|heading|body|label|code)-/.test(name)) return "type";
  return "text";
}

export function frostProperties(tokens) {
  const props = {};
  for (const token of tokens) {
    const body = token.name.slice("--frost-".length);
    const suffix = FROST_SUFFIXES.find((item) => body.endsWith(`-${item}`));
    if (suffix) props[suffix] = token.name;
  }
  return props;
}
