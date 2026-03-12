export type ThemeMode = "dark" | "light";
export type ThemePreset = "default" | "everforest";

export type ThemePalette = {
  app_bg: string;
  panel_bg: string;
  border_color: string;
  border_soft: string;
  text_main: string;
  text_sub: string;
  text_soft: string;
  hover_bg: string;
  selected_bg: string;
  selected_text: string;
  button_bg: string;
  button_hover: string;
  button_text: string;
  alert_bg: string;
  alert_border: string;
  alert_text: string;
  accent: string;
  terminal_background: string;
  terminal_foreground: string;
  terminal_cursor: string;
  terminal_selection: string;
  terminal_scrollbar: string;
  terminal_scrollbar_hover: string;
  terminal_font_family: string;
  terminal_scrollbar_width: number;
};

export type ThemePalettes = {
  dark: ThemePalette;
  light: ThemePalette;
};

export const DEFAULT_TERMINAL_FONT_FAMILY =
  '"JetBrains Mono", "SF Pro Text", "SF Mono", "SFMono-Regular", "Consolas", "Menlo", "Monaco", "Courier New", "DejaVu Sans Mono", "Liberation Mono", "Noto Sans Mono", "Noto Sans Mono CJK SC", "Noto Sans Mono CJK JP", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", "Noto Color Emoji", "Segoe UI", "Ubuntu Mono", monospace';

export const DEFAULT_TERMINAL_SCROLLBAR_WIDTH = 6;
export const DEFAULT_THEME_PRESET: ThemePreset = "default";

export const DEFAULT_THEME_PALETTES: ThemePalettes = {
  dark: {
    app_bg: "#002b36",
    panel_bg: "#073642",
    border_color: "rgba(147, 161, 161, 0.20)",
    border_soft: "rgba(147, 161, 161, 0.28)",
    text_main: "#93a1a1",
    text_sub: "#657b83",
    text_soft: "#839496",
    hover_bg: "rgba(147, 161, 161, 0.10)",
    selected_bg: "rgba(147, 161, 161, 0.08)",
    selected_text: "#93a1a1",
    button_bg: "rgba(147, 161, 161, 0.12)",
    button_hover: "rgba(147, 161, 161, 0.20)",
    button_text: "#93a1a1",
    alert_bg: "#7f1d1d",
    alert_border: "#b91c1c",
    alert_text: "#fecaca",
    accent: "#268bd2",
    terminal_background: "#002b36",
    terminal_foreground: "#839496",
    terminal_cursor: "#93a1a1",
    terminal_selection: "#073642",
    terminal_scrollbar: "rgba(88, 110, 117, 0.48)",
    terminal_scrollbar_hover: "rgba(88, 110, 117, 0.66)",
    terminal_font_family: DEFAULT_TERMINAL_FONT_FAMILY,
    terminal_scrollbar_width: DEFAULT_TERMINAL_SCROLLBAR_WIDTH,
  },
  light: {
    app_bg: "#f7f7f8",
    panel_bg: "#f3f3f5",
    border_color: "rgba(88, 96, 105, 0.14)",
    border_soft: "rgba(88, 96, 105, 0.20)",
    text_main: "#4d5560",
    text_sub: "#7a838f",
    text_soft: "#6d7580",
    hover_bg: "rgba(88, 96, 105, 0.08)",
    selected_bg: "rgba(88, 96, 105, 0.06)",
    selected_text: "#4d5560",
    button_bg: "rgba(88, 96, 105, 0.08)",
    button_hover: "rgba(88, 96, 105, 0.13)",
    button_text: "#6d7580",
    alert_bg: "#fee2e2",
    alert_border: "#fca5a5",
    alert_text: "#7f1d1d",
    accent: "#6b87d6",
    terminal_background: "#fafafb",
    terminal_foreground: "#4f5a63",
    terminal_cursor: "#4f5a63",
    terminal_selection: "#e9eaed",
    terminal_scrollbar: "rgba(88, 96, 105, 0.34)",
    terminal_scrollbar_hover: "rgba(88, 96, 105, 0.52)",
    terminal_font_family: DEFAULT_TERMINAL_FONT_FAMILY,
    terminal_scrollbar_width: DEFAULT_TERMINAL_SCROLLBAR_WIDTH,
  },
};

export const EVERFOREST_THEME_PALETTES: ThemePalettes = {
  dark: {
    app_bg: "#2d353b",
    panel_bg: "#394349",
    border_color: "rgba(211, 198, 170, 0.16)",
    border_soft: "rgba(211, 198, 170, 0.24)",
    text_main: "#d3c6aa",
    text_sub: "#9da9a0",
    text_soft: "#859289",
    hover_bg: "rgba(167, 192, 128, 0.08)",
    selected_bg: "rgba(131, 192, 175, 0.14)",
    selected_text: "#e6e1cf",
    button_bg: "rgba(131, 192, 175, 0.12)",
    button_hover: "rgba(131, 192, 175, 0.22)",
    button_text: "#d3c6aa",
    alert_bg: "#4a2f33",
    alert_border: "#e67e80",
    alert_text: "#f4d6d7",
    accent: "#7fbbb3",
    terminal_background: "#2d353b",
    terminal_foreground: "#d3c6aa",
    terminal_cursor: "#d3c6aa",
    terminal_selection: "#475258",
    terminal_scrollbar: "rgba(133, 146, 137, 0.42)",
    terminal_scrollbar_hover: "rgba(133, 146, 137, 0.60)",
    terminal_font_family: DEFAULT_TERMINAL_FONT_FAMILY,
    terminal_scrollbar_width: DEFAULT_TERMINAL_SCROLLBAR_WIDTH,
  },
  light: {
    app_bg: "#fefcf1",
    panel_bg: "#fdf9ec",
    border_color: "rgba(92, 106, 114, 0.16)",
    border_soft: "rgba(92, 106, 114, 0.24)",
    text_main: "#465662",
    text_sub: "#5c6a72",
    text_soft: "#829181",
    hover_bg: "rgba(92, 106, 114, 0.07)",
    selected_bg: "rgba(141, 161, 1, 0.11)",
    selected_text: "#465662",
    button_bg: "rgba(141, 161, 1, 0.10)",
    button_hover: "rgba(141, 161, 1, 0.18)",
    button_text: "#465662",
    alert_bg: "#fbe3df",
    alert_border: "#f85552",
    alert_text: "#8b3532",
    accent: "#8da101",
    terminal_background: "#fefcf1",
    terminal_foreground: "#465662",
    terminal_cursor: "#465662",
    terminal_selection: "#f0ede4",
    terminal_scrollbar: "rgba(92, 106, 114, 0.30)",
    terminal_scrollbar_hover: "rgba(92, 106, 114, 0.48)",
    terminal_font_family: "Menlo",
    terminal_scrollbar_width: DEFAULT_TERMINAL_SCROLLBAR_WIDTH,
  },
};

export const normalizeThemePreset = (value: unknown): ThemePreset => {
  if (typeof value !== "string") {
    return DEFAULT_THEME_PRESET;
  }

  return value.trim().toLowerCase() === "everforest" ? "everforest" : DEFAULT_THEME_PRESET;
};

export const resolveThemePalettes = (
  themePreset: ThemePreset,
  customThemePalettes: ThemePalettes
): ThemePalettes => {
  if (themePreset === "everforest") {
    return EVERFOREST_THEME_PALETTES;
  }

  return customThemePalettes;
};

export const resolveActiveThemePalette = (
  themePreset: ThemePreset,
  themeMode: ThemeMode,
  customThemePalettes: ThemePalettes
): ThemePalette => {
  const palettes = resolveThemePalettes(themePreset, customThemePalettes);
  return themeMode === "dark" ? palettes.dark : palettes.light;
};
