# Theme Presets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a theme preset selector that keeps the current look as `default`, introduces an `everforest` preset based on the local Ghostty theme, and persists the selected preset in settings.

**Architecture:** Theme preset resolution stays in the frontend, because the UI already owns runtime palette composition. Rust only persists and normalizes the new `appearance.theme_preset` field so the settings file remains backward compatible.

**Tech Stack:** React, TypeScript, Tauri, Rust, node:test

---

### Task 1: Add frontend preset resolution logic

**Files:**
- Create: `src/lib/themePresets.ts`
- Test: `src/lib/themePresets.test.ts`

**Step 1: Write the failing test**

Add tests covering:
- invalid preset normalizes to `default`
- `default` resolves to passed custom palettes
- `everforest` resolves to built-in Everforest palettes
- Everforest light terminal colors match the local Ghostty reference values

**Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/themePresets.test.ts`

Expected: FAIL because the module does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- `ThemePreset`
- shared theme palette types
- default palette constants
- Everforest palette constants
- preset normalization and resolution helpers

**Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/themePresets.test.ts`

Expected: PASS

### Task 2: Persist preset in settings

**Files:**
- Modify: `src-tauri/src/models/app_settings.rs`
- Modify: `src-tauri/src/services/settings_service.rs`

**Step 1: Write the failing test**

Add Rust tests covering:
- missing `theme_preset` normalizes to `default`
- `everforest` remains `everforest` after normalization

**Step 2: Run test to verify it fails**

Run: `cargo test settings_service -- --nocapture`

Expected: FAIL because `theme_preset` is not modeled or normalized.

**Step 3: Write minimal implementation**

Implement:
- new `appearance.theme_preset` field
- default value `default`
- schema version bump
- normalization for allowed preset values

**Step 4: Run test to verify it passes**

Run: `cargo test settings_service -- --nocapture`

Expected: PASS

### Task 3: Wire preset into the React settings UI

**Files:**
- Modify: `src/pages/ProjectDashboard.tsx`
- Modify: `src/lib/i18n.ts`

**Step 1: Write the failing test**

Extend `src/lib/themePresets.test.ts` or add a focused pure test that proves the active palette changes when the preset changes.

**Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/themePresets.test.ts`

Expected: FAIL until the page uses the preset helper correctly.

**Step 3: Write minimal implementation**

Implement:
- `themePreset` state
- settings load/save support
- active palette derived from `themePreset + themeMode`
- settings dropdown for `Default` and `Everforest`
- updated appearance help text

**Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/themePresets.test.ts`

Expected: PASS

### Task 4: Verify end-to-end behavior

**Files:**
- No new files

**Step 1: Run frontend checks**

Run: `node --test --experimental-strip-types src/lib/themePresets.test.ts src/lib/claudeSessions.test.ts src/lib/claudeTerminalAutomation.test.ts src/lib/updateFlow.test.ts`

Expected: PASS

**Step 2: Run TypeScript checks**

Run: `corepack pnpm@10.29.2 -s tsc --noEmit`

Expected: PASS

**Step 3: Run Rust checks**

Run: `cargo test -- --nocapture`

Expected: PASS

**Step 4: Build the app**

Run: `corepack pnpm@10.29.2 run build:ui`

Expected: PASS

Plan complete and saved to `docs/plans/2026-03-12-theme-presets.md`. The user already asked to execute directly, so proceed in this session with TDD.
