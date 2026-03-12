import test from "node:test";
import assert from "node:assert/strict";
import { createTranslator } from "./i18n.ts";

test("theme preset hint no longer mentions Ghostty in Chinese", () => {
  const t = createTranslator("zh-CN");

  assert.equal(t("hint_theme_preset").includes("Ghostty"), false);
});

test("theme preset hint no longer mentions Ghostty in English", () => {
  const t = createTranslator("en-US");

  assert.equal(t("hint_theme_preset").includes("Ghostty"), false);
});
