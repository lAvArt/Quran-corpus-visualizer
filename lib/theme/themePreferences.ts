import {
  COLOR_THEME_PRESETS,
  DEFAULT_COLOR_THEME_ID,
  DEFAULT_CUSTOM_COLOR_THEME,
  isValidColorThemeId,
  isValidCustomColorTheme,
  resolveColorThemeCssVariables,
  type ColorThemeId,
  type CustomColorTheme,
} from "@/lib/theme/colorThemes";

export const THEME_COOKIE_NAME = "quran-corpus-theme";
export const THEME_LOCAL_STORAGE_KEY = "quran-corpus-viz-state";

export interface ThemePreferenceState {
  theme: "light" | "dark";
  colorThemeId: ColorThemeId;
  customColorTheme: CustomColorTheme;
}

export const DEFAULT_THEME_PREFERENCE_STATE: ThemePreferenceState = {
  theme: "dark",
  colorThemeId: DEFAULT_COLOR_THEME_ID,
  customColorTheme: DEFAULT_CUSTOM_COLOR_THEME,
};

function isValidTheme(value: unknown): value is ThemePreferenceState["theme"] {
  return value === "light" || value === "dark";
}

function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function normalizeThemePreferenceState(candidate: unknown): ThemePreferenceState {
  if (!candidate || typeof candidate !== "object") {
    return { ...DEFAULT_THEME_PREFERENCE_STATE };
  }

  const source = candidate as Partial<ThemePreferenceState>;

  return {
    theme: isValidTheme(source.theme) ? source.theme : DEFAULT_THEME_PREFERENCE_STATE.theme,
    colorThemeId: isValidColorThemeId(source.colorThemeId) ? source.colorThemeId : DEFAULT_THEME_PREFERENCE_STATE.colorThemeId,
    customColorTheme: isValidCustomColorTheme(source.customColorTheme)
      ? source.customColorTheme
      : DEFAULT_THEME_PREFERENCE_STATE.customColorTheme,
  };
}

export function parseThemePreferenceCookie(raw: string | undefined): ThemePreferenceState {
  if (!raw) return { ...DEFAULT_THEME_PREFERENCE_STATE };

  try {
    return normalizeThemePreferenceState(JSON.parse(decodeCookieValue(raw)));
  } catch {
    return { ...DEFAULT_THEME_PREFERENCE_STATE };
  }
}

export function serializeThemePreferenceCookie(state: ThemePreferenceState): string {
  return encodeURIComponent(JSON.stringify(normalizeThemePreferenceState(state)));
}

export function extractThemePreferenceState(candidate: unknown): ThemePreferenceState {
  return normalizeThemePreferenceState(candidate);
}

export function buildThemeDocumentState(state: ThemePreferenceState) {
  const normalized = normalizeThemePreferenceState(state);

  return {
    ...normalized,
    style: {
      colorScheme: normalized.theme,
      ...resolveColorThemeCssVariables(normalized.colorThemeId, normalized.theme, normalized.customColorTheme),
    },
  };
}

export function getThemeBootstrapScript(): string {
  const config = {
    storageKey: THEME_LOCAL_STORAGE_KEY,
    cookieName: THEME_COOKIE_NAME,
    presetIds: COLOR_THEME_PRESETS.map((preset) => preset.id),
    presets: COLOR_THEME_PRESETS.map((preset) => ({ id: preset.id, light: preset.light, dark: preset.dark })),
    defaultState: DEFAULT_THEME_PREFERENCE_STATE,
  };

  return `(function(){try{var config=${JSON.stringify(config)};var raw=window.localStorage.getItem(config.storageKey);if(!raw)return;var parsed=JSON.parse(raw);function isHex(value){return typeof value==="string"&&/^#[0-9a-fA-F]{6}$/.test(value.trim());}function isPaletteValid(palette){return !!(palette&&isHex(palette.accent)&&isHex(palette.accent2)&&isHex(palette.accent3)&&isHex(palette.bg0)&&isHex(palette.bg1)&&isHex(palette.bg2));}function normalize(candidate){return{theme:candidate&&candidate.theme==="light"?"light":"dark",colorThemeId:candidate&&typeof candidate.colorThemeId==="string"&&(config.presetIds.indexOf(candidate.colorThemeId)!==-1||candidate.colorThemeId==="custom")?candidate.colorThemeId:config.defaultState.colorThemeId,customColorTheme:candidate&&typeof candidate.customColorTheme==="object"&&isPaletteValid(candidate.customColorTheme.light)&&isPaletteValid(candidate.customColorTheme.dark)?candidate.customColorTheme:config.defaultState.customColorTheme};}function hexToRgba(hex,alpha){var normalized=String(hex).trim().replace(/^#/,"");var safe=/^[0-9a-fA-F]{6}$/.test(normalized)?normalized:"000000";var r=parseInt(safe.slice(0,2),16);var g=parseInt(safe.slice(2,4),16);var b=parseInt(safe.slice(4,6),16);return"rgba("+r+", "+g+", "+b+", "+alpha+")";}var state=normalize(parsed);var root=document.documentElement;root.setAttribute("data-theme",state.theme);root.setAttribute("data-color-theme",state.colorThemeId);root.style.setProperty("color-scheme",state.theme);var preset=null;for(var i=0;i<config.presets.length;i++){if(config.presets[i].id===state.colorThemeId){preset=config.presets[i];break;}}var palette=state.colorThemeId==="custom"?state.customColorTheme[state.theme]:null;var tokens=state.colorThemeId==="custom"?{accent:palette.accent,accent2:palette.accent2,accent3:palette.accent3,accentGlow:hexToRgba(palette.accent,state.theme==="dark"?0.52:0.42),accent2Glow:hexToRgba(palette.accent2,state.theme==="dark"?0.5:0.45)}:(state.theme==="dark"?preset.dark:preset.light);root.style.setProperty("--accent",tokens.accent);root.style.setProperty("--accent-2",tokens.accent2);root.style.setProperty("--accent-3",tokens.accent3);root.style.setProperty("--accent-glow",tokens.accentGlow);root.style.setProperty("--accent-2-glow",tokens.accent2Glow);if(state.colorThemeId==="custom"){root.style.setProperty("--bg-0",palette.bg0);root.style.setProperty("--bg-1",palette.bg1);root.style.setProperty("--bg-2",palette.bg2);}else{root.style.removeProperty("--bg-0");root.style.removeProperty("--bg-1");root.style.removeProperty("--bg-2");}document.cookie=config.cookieName+"="+encodeURIComponent(JSON.stringify(state))+"; path=/; max-age=31536000; samesite=lax";}catch(_error){}})();`;
}
