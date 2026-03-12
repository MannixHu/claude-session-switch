import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_THEME_PALETTES,
  EVERFOREST_THEME_PALETTES,
  normalizeThemePreset,
  resolveActiveThemePalette,
  resolveThemePalettes,
} from "./themePresets.ts";

test("normalizeThemePreset falls back to default for invalid values", () => {
  assert.equal(normalizeThemePreset(""), "default");
  assert.equal(normalizeThemePreset("solarized"), "default");
  assert.equal(normalizeThemePreset(undefined), "default");
});

test("resolveThemePalettes keeps custom palettes for default preset", () => {
  const custom = {
    dark: {
      ...DEFAULT_THEME_PALETTES.dark,
      accent: "#ff0000",
    },
    light: {
      ...DEFAULT_THEME_PALETTES.light,
      accent: "#00ff00",
    },
  };

  const resolved = resolveThemePalettes("default", custom);

  assert.deepEqual(resolved, custom);
});

test("resolveThemePalettes returns built-in everforest palettes", () => {
  const custom = {
    dark: {
      ...DEFAULT_THEME_PALETTES.dark,
      accent: "#ff0000",
    },
    light: {
      ...DEFAULT_THEME_PALETTES.light,
      accent: "#00ff00",
    },
  };

  const resolved = resolveThemePalettes("everforest", custom);

  assert.deepEqual(resolved, EVERFOREST_THEME_PALETTES);
  assert.notDeepEqual(resolved, custom);
});

test("everforest light palette matches the local Ghostty reference colors", () => {
  assert.equal(EVERFOREST_THEME_PALETTES.light.app_bg, "#fefcf1");
  assert.equal(EVERFOREST_THEME_PALETTES.light.panel_bg, "#fdf9ec");
  assert.equal(EVERFOREST_THEME_PALETTES.light.terminal_background, "#fefcf1");
  assert.equal(EVERFOREST_THEME_PALETTES.light.terminal_foreground, "#465662");
  assert.equal(EVERFOREST_THEME_PALETTES.light.terminal_cursor, "#465662");
  assert.equal(EVERFOREST_THEME_PALETTES.light.terminal_selection, "#f0ede4");
});

test("everforest dark palette provides a dedicated dark mode companion", () => {
  assert.equal(EVERFOREST_THEME_PALETTES.dark.app_bg, "#2d353b");
  assert.equal(EVERFOREST_THEME_PALETTES.dark.panel_bg, "#394349");
  assert.equal(EVERFOREST_THEME_PALETTES.dark.terminal_background, "#2d353b");
  assert.equal(EVERFOREST_THEME_PALETTES.dark.text_main, "#d3c6aa");
});

test("resolveActiveThemePalette picks the active mode from the selected preset", () => {
  const custom = {
    dark: {
      ...DEFAULT_THEME_PALETTES.dark,
      accent: "#111111",
    },
    light: {
      ...DEFAULT_THEME_PALETTES.light,
      accent: "#222222",
    },
  };

  assert.equal(
    resolveActiveThemePalette("default", "dark", custom).accent,
    "#111111"
  );
  assert.equal(
    resolveActiveThemePalette("everforest", "light", custom).app_bg,
    EVERFOREST_THEME_PALETTES.light.app_bg
  );
});
