# Update Dialog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the updater confirm/alert flow with an in-app update dialog that shows release details and direct download actions.

**Architecture:** The backend continues to own GitHub querying and installer download/open, but now returns release metadata. The frontend owns dialog state, release notes parsing, and presentation.

**Tech Stack:** React, TypeScript, Tauri, Rust, node:test

---

### Task 1: Extend release metadata parsing in Rust

**Files:**
- Modify: `src-tauri/src/services/update_service.rs`
- Modify: `src-tauri/src/commands/update.rs`
- Modify: `src/hooks/useBackend.ts`

**Step 1: Write the failing test**

Add Rust tests asserting the resolved update result includes release URL, published date, and notes body.

**Step 2: Run test to verify it fails**

Run: `cargo test latest_release_ -- --nocapture`

Expected: FAIL because the metadata fields are not present yet.

**Step 3: Write minimal implementation**

Add the metadata fields to:
- GitHub release payload parsing
- `UpdateCheckResult`
- frontend TypeScript interface

**Step 4: Run test to verify it passes**

Run: `cargo test latest_release_ -- --nocapture`

Expected: PASS

### Task 2: Add release notes parsing helpers

**Files:**
- Create: `src/lib/updateReleaseNotes.ts`
- Create: `src/lib/updateReleaseNotes.test.ts`
- Modify: `src/lib/updateFlow.ts`
- Modify: `src/lib/updateFlow.test.ts`

**Step 1: Write the failing test**

Add tests for:
- extracting changelog rows from a markdown table
- separating the remaining release notes body
- preserving checked metadata in `up_to_date` and `available` states

**Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/updateReleaseNotes.test.ts src/lib/updateFlow.test.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

Implement parsing helpers and update state behavior.

**Step 4: Run test to verify it passes**

Run: `node --test --experimental-strip-types src/lib/updateReleaseNotes.test.ts src/lib/updateFlow.test.ts`

Expected: PASS

### Task 3: Add the update dialog UI

**Files:**
- Create: `src/components/UpdateDialog.tsx`
- Create: `src/components/UpdateDialog.css`
- Modify: `src/pages/ProjectDashboard.tsx`
- Modify: `src/lib/i18n.ts`

**Step 1: Write the failing test**

Extend pure tests if needed for dialog-derived content decisions, then use typecheck/build as the verification gate for the UI layer.

**Step 2: Run test to verify it fails**

Run: `corepack pnpm@10.29.2 -s tsc --noEmit`

Expected: FAIL until the dialog props and new strings are wired correctly.

**Step 3: Write minimal implementation**

Implement:
- modal open/close state
- menu-triggered update check in the modal
- buttons for download/open GitHub/later
- notes rendering and changelog table display
- completed and error states

**Step 4: Run test to verify it passes**

Run: `corepack pnpm@10.29.2 -s tsc --noEmit`

Expected: PASS

### Task 4: Verify end-to-end

**Files:**
- No new files

**Step 1: Run frontend tests**

Run: `node --test --experimental-strip-types src/lib/updateReleaseNotes.test.ts src/lib/updateFlow.test.ts src/lib/i18n.test.ts src/lib/themePresets.test.ts src/lib/claudeSessions.test.ts src/lib/claudeTerminalAutomation.test.ts`

Expected: PASS

**Step 2: Run Rust tests**

Run: `cargo test -- --nocapture`

Expected: PASS

**Step 3: Run build**

Run: `corepack pnpm@10.29.2 run build:ui`

Expected: PASS

Plan complete and saved to `docs/plans/2026-03-12-update-dialog.md`. The user asked not to wait, so execute directly in this session with TDD.
