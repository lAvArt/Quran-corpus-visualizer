export type ColorThemeId = "teal-amber" | "ember-cyan" | "royal-gold" | "forest-rose" | "mono-azure";

interface ColorThemeTokens {
  accent: string;
  accent2: string;
  accent3: string;
  accentGlow: string;
  accent2Glow: string;
}

export interface ColorThemePreset {
  id: ColorThemeId;
  labelKey: "tealAmber" | "emberCyan" | "royalGold" | "forestRose" | "monoAzure";
  preview: readonly [string, string, string];
  light: ColorThemeTokens;
  dark: ColorThemeTokens;
}

export const DEFAULT_COLOR_THEME_ID: ColorThemeId = "teal-amber";

export const COLOR_THEME_PRESETS: readonly ColorThemePreset[] = [
  {
    id: "teal-amber",
    labelKey: "tealAmber",
    preview: ["#0f766e", "#f59e0b", "#1d4ed8"],
    light: {
      accent: "#0f766e",
      accent2: "#f59e0b",
      accent3: "#1d4ed8",
      accentGlow: "rgba(15, 118, 110, 0.4)",
      accent2Glow: "rgba(245, 158, 11, 0.45)",
    },
    dark: {
      accent: "#f97316",
      accent2: "#22d3ee",
      accent3: "#38bdf8",
      accentGlow: "rgba(249, 115, 22, 0.5)",
      accent2Glow: "rgba(34, 211, 238, 0.5)",
    },
  },
  {
    id: "ember-cyan",
    labelKey: "emberCyan",
    preview: ["#dc2626", "#0891b2", "#f97316"],
    light: {
      accent: "#dc2626",
      accent2: "#0891b2",
      accent3: "#f97316",
      accentGlow: "rgba(220, 38, 38, 0.38)",
      accent2Glow: "rgba(8, 145, 178, 0.4)",
    },
    dark: {
      accent: "#fb7185",
      accent2: "#67e8f9",
      accent3: "#fbbf24",
      accentGlow: "rgba(251, 113, 133, 0.5)",
      accent2Glow: "rgba(103, 232, 249, 0.45)",
    },
  },
  {
    id: "royal-gold",
    labelKey: "royalGold",
    preview: ["#4f46e5", "#ca8a04", "#0f766e"],
    light: {
      accent: "#4f46e5",
      accent2: "#ca8a04",
      accent3: "#0f766e",
      accentGlow: "rgba(79, 70, 229, 0.4)",
      accent2Glow: "rgba(202, 138, 4, 0.42)",
    },
    dark: {
      accent: "#a78bfa",
      accent2: "#facc15",
      accent3: "#5eead4",
      accentGlow: "rgba(167, 139, 250, 0.52)",
      accent2Glow: "rgba(250, 204, 21, 0.46)",
    },
  },
  {
    id: "forest-rose",
    labelKey: "forestRose",
    preview: ["#15803d", "#e11d48", "#0ea5e9"],
    light: {
      accent: "#15803d",
      accent2: "#e11d48",
      accent3: "#0ea5e9",
      accentGlow: "rgba(21, 128, 61, 0.36)",
      accent2Glow: "rgba(225, 29, 72, 0.38)",
    },
    dark: {
      accent: "#4ade80",
      accent2: "#fb7185",
      accent3: "#38bdf8",
      accentGlow: "rgba(74, 222, 128, 0.44)",
      accent2Glow: "rgba(251, 113, 133, 0.46)",
    },
  },
  {
    id: "mono-azure",
    labelKey: "monoAzure",
    preview: ["#1d4ed8", "#0ea5e9", "#38bdf8"],
    light: {
      accent: "#1d4ed8",
      accent2: "#0ea5e9",
      accent3: "#38bdf8",
      accentGlow: "rgba(29, 78, 216, 0.4)",
      accent2Glow: "rgba(14, 165, 233, 0.42)",
    },
    dark: {
      accent: "#60a5fa",
      accent2: "#22d3ee",
      accent3: "#a5b4fc",
      accentGlow: "rgba(96, 165, 250, 0.48)",
      accent2Glow: "rgba(34, 211, 238, 0.48)",
    },
  },
];

export function isValidColorThemeId(value: unknown): value is ColorThemeId {
  return typeof value === "string" && COLOR_THEME_PRESETS.some((preset) => preset.id === value);
}

export function getColorThemePreset(id: ColorThemeId): ColorThemePreset {
  const preset = COLOR_THEME_PRESETS.find((entry) => entry.id === id);
  if (preset) return preset;
  return COLOR_THEME_PRESETS[0];
}

export function applyColorTheme(id: ColorThemeId, appearance: "light" | "dark"): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const preset = getColorThemePreset(id);
  const tokens = appearance === "dark" ? preset.dark : preset.light;

  root.setAttribute("data-color-theme", id);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-2", tokens.accent2);
  root.style.setProperty("--accent-3", tokens.accent3);
  root.style.setProperty("--accent-glow", tokens.accentGlow);
  root.style.setProperty("--accent-2-glow", tokens.accent2Glow);
}
