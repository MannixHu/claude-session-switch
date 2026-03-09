# Self-Update Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a macOS app-menu action that checks GitHub Releases, downloads the matching DMG for the current architecture, verifies it, opens it, and guides the user through installing the update.

**Architecture:** Keep menu wiring in `src-tauri/src/main.rs`, keep user interaction in React, and centralize release parsing/downloading/checksum verification in a new Rust update service. Reuse the existing GitHub Release asset naming convention instead of introducing the Tauri updater plugin.

**Tech Stack:** Tauri v2, Rust command/service modules, React 18, TypeScript, GitHub Releases API, `reqwest` blocking client, `sha2`, `semver`

---

### Task 1: Build the Rust release-metadata parser behind failing tests

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/services/mod.rs`
- Create: `src-tauri/src/services/update_service.rs`
- Test: `src-tauri/src/services/update_service.rs`

**Step 1: Write the failing tests**

Add tests in `src-tauri/src/services/update_service.rs` covering:

```rust
#[test]
fn latest_release_selects_arm64_asset_and_checksum() {
    let release_json = r#"{
      "tag_name": "v0.1.17",
      "assets": [
        { "name": "ClaudeSessionSwitch_0.1.17_arm64.dmg", "browser_download_url": "https://example.com/arm64.dmg" },
        { "name": "ClaudeSessionSwitch_0.1.17_x64.dmg", "browser_download_url": "https://example.com/x64.dmg" },
        { "name": "SHA256SUMS", "browser_download_url": "https://example.com/SHA256SUMS" }
      ]
    }"#;

    let checksums = "abc123  ClaudeSessionSwitch_0.1.17_arm64.dmg\nfff999  ClaudeSessionSwitch_0.1.17_x64.dmg\n";

    let result = UpdateService::resolve_release(
        "0.1.16",
        "aarch64",
        release_json,
        checksums,
    ).unwrap();

    assert!(result.update_available);
    assert_eq!(result.latest_version, "0.1.17");
    assert_eq!(result.asset_name, "ClaudeSessionSwitch_0.1.17_arm64.dmg");
    assert_eq!(result.expected_sha256, "abc123");
}

#[test]
fn latest_release_returns_up_to_date_when_versions_match() {
    let release_json = r#"{
      "tag_name": "v0.1.16",
      "assets": []
    }"#;

    let result = UpdateService::resolve_release("0.1.16", "aarch64", release_json, "").unwrap();

    assert!(!result.update_available);
    assert_eq!(result.latest_version, "0.1.16");
}
```

Add one more failing test for the missing-asset case:

```rust
#[test]
fn latest_release_rejects_missing_arch_asset() {
    let release_json = r#"{
      "tag_name": "v0.1.17",
      "assets": [
        { "name": "ClaudeSessionSwitch_0.1.17_x64.dmg", "browser_download_url": "https://example.com/x64.dmg" },
        { "name": "SHA256SUMS", "browser_download_url": "https://example.com/SHA256SUMS" }
      ]
    }"#;

    let error = UpdateService::resolve_release("0.1.16", "aarch64", release_json, "fff999  ClaudeSessionSwitch_0.1.17_x64.dmg\n")
        .unwrap_err();

    assert!(error.contains("arm64"));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test latest_release_selects_arm64_asset_and_checksum -- --nocapture`

Expected: FAIL because `update_service.rs` and `UpdateService::resolve_release` do not exist yet.

**Step 3: Write minimal implementation**

Add dependencies in `src-tauri/Cargo.toml`:

```toml
reqwest = { version = "0.12", default-features = false, features = ["blocking", "json", "rustls-tls"] }
sha2 = "0.10"
semver = "1.0"
```

Create `src-tauri/src/services/update_service.rs` with:

- `ReleaseAsset`, `GithubRelease`, `UpdateCheckResult`
- `UpdateService::resolve_release(current_version, arch, release_json, checksums)`
- helpers to:
  - normalize `v0.1.17` -> `0.1.17`
  - map `aarch64` -> `arm64`, `x86_64` -> `x64`
  - select the correct DMG asset by exact filename suffix
  - parse `SHA256SUMS`
  - compare versions with `semver`

**Step 4: Run tests to verify they pass**

Run: `cargo test latest_release_ -- --nocapture`

Expected: PASS for the new update-service parsing tests.

**Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/services/mod.rs src-tauri/src/services/update_service.rs
git commit -m "feat: add update release metadata parsing"
```

### Task 2: Add download/open commands in Rust with checksum verification

**Files:**
- Create: `src-tauri/src/commands/update.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/services/update_service.rs`
- Test: `src-tauri/src/services/update_service.rs`

**Step 1: Write the failing tests**

Add tests for checksum verification and temp-path naming:

```rust
#[test]
fn verify_downloaded_file_accepts_matching_sha256() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("ClaudeSessionSwitch_0.1.17_arm64.dmg");
    std::fs::write(&file_path, b"hello world").unwrap();

    let digest = "b94d27b9934d3e08a52e52d7da7dabfade4f...";
    UpdateService::verify_sha256(&file_path, digest).unwrap();
}

#[test]
fn verify_downloaded_file_rejects_mismatched_sha256() {
    let temp_dir = tempfile::tempdir().unwrap();
    let file_path = temp_dir.path().join("ClaudeSessionSwitch_0.1.17_arm64.dmg");
    std::fs::write(&file_path, b"hello world").unwrap();

    let error = UpdateService::verify_sha256(&file_path, "deadbeef").unwrap_err();
    assert!(error.contains("checksum"));
}
```

**Step 2: Run test to verify it fails**

Run: `cargo test verify_downloaded_file_ -- --nocapture`

Expected: FAIL because `verify_sha256` and the new command layer do not exist yet.

**Step 3: Write minimal implementation**

In `src-tauri/src/services/update_service.rs` add:

- `fetch_latest_release()`
- `download_update(asset_url, asset_name, expected_sha256)`
- `verify_sha256(path, expected_sha256)`
- `open_downloaded_installer(path)`

Implementation notes:

- use `reqwest::blocking::Client` with a `User-Agent`
- download into `std::env::temp_dir()/claude-session-switch-updates/`
- overwrite any existing file with the same name
- verify SHA256 before calling `open`
- use `Command::new("open").arg(path)` on macOS

Add `src-tauri/src/commands/update.rs` with two commands:

- `check_for_updates() -> Result<UpdateCheckResult, String>`
- `download_and_open_update(download_url: String, asset_name: String, expected_sha256: String, version: String) -> Result<DownloadedUpdateResult, String>`

Register the command module in:

- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/main.rs`

**Step 4: Run tests to verify they pass**

Run: `cargo test verify_downloaded_file_ -- --nocapture`

Expected: PASS for the checksum tests.

Then run:

Run: `cargo test -- --nocapture`
Expected: PASS, 0 failures.

**Step 5: Commit**

```bash
git add src-tauri/src/commands/update.rs src-tauri/src/commands/mod.rs src-tauri/src/main.rs src-tauri/src/services/update_service.rs
git commit -m "feat: add update download commands"
```

### Task 3: Wire the macOS menu event and frontend update flow

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src/hooks/useBackend.ts`
- Modify: `src/pages/ProjectDashboard.tsx`
- Modify: `src/lib/i18n.ts`
- Test: `src/lib/updateFlow.test.ts`
- Create: `src/lib/updateFlow.ts`

**Step 1: Write the failing frontend tests**

Create `src/lib/updateFlow.test.ts` with pure-function tests for the small state helpers:

```ts
test("beginUpdateCheck ignores duplicate triggers while busy", () => {
  const state = { phase: "checking" as const, error: "" };
  const next = beginUpdateCheck(state);
  assert.equal(next, state);
});

test("applyUpdateCheckResult returns available phase when newer version exists", () => {
  const next = applyUpdateCheckResult(
    { phase: "checking" as const, error: "" },
    { update_available: true, latest_version: "0.1.17", current_version: "0.1.16" }
  );

  assert.equal(next.phase, "available");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --experimental-strip-types src/lib/updateFlow.test.ts`

Expected: FAIL because `updateFlow.ts` does not exist yet.

**Step 3: Write minimal implementation**

Create `src/lib/updateFlow.ts` with:

- `UpdatePhase` union
- `beginUpdateCheck(state)`
- `applyUpdateCheckResult(state, result)`
- `applyUpdateError(state, error)`

Update `src/hooks/useBackend.ts` to expose:

- `checkForUpdates()`
- `downloadAndOpenUpdate(input)`

Add new menu constants/events in `src-tauri/src/main.rs`:

- menu item ID: `check_for_updates`
- event: `check-for-updates`

Update `src/pages/ProjectDashboard.tsx` to:

- listen for `check-for-updates`
- hold update state (`idle`, `checking`, `downloading`)
- call `backend.checkForUpdates()`
- use `window.confirm(...)` for the "download now?" decision
- use `window.alert(...)` or `setStatusMessage(...)` for:
  - already up to date
  - download complete / installer opened
  - failure messages
- prevent duplicate update starts while a check/download is active

Add i18n keys in `src/lib/i18n.ts` for:

- menu label
- checking text
- up-to-date text
- update available prompt
- download/open success text
- update failure text

**Step 4: Run tests to verify they pass**

Run: `node --test --experimental-strip-types src/lib/updateFlow.test.ts`

Expected: PASS

Then run:

Run: `pnpm -s tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/main.rs src/hooks/useBackend.ts src/pages/ProjectDashboard.tsx src/lib/i18n.ts src/lib/updateFlow.ts src/lib/updateFlow.test.ts
git commit -m "feat: add frontend self-update flow"
```

### Task 4: Verify end-to-end behavior, bump release version, and produce a release tag

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Write the failing release expectation**

Document the release target for this feature as `0.1.17` and confirm the current version is still `0.1.16`.

Run:

```bash
node -p "require('./package.json').version"
python3 - <<'PY'
import json
print(json.load(open('src-tauri/tauri.conf.json'))['version'])
PY
```

Expected: both print `0.1.16`, which is not the intended release tag for this feature.

**Step 2: Bump versions**

Update:

- `package.json` -> `0.1.17`
- `src-tauri/Cargo.toml` -> `0.1.17`
- `src-tauri/Cargo.lock` -> root package entry `0.1.17`
- `src-tauri/tauri.conf.json` -> `0.1.17`

**Step 3: Run the full verification suite**

Run:

```bash
corepack pnpm@10.29.2 install --frozen-lockfile
node --test --experimental-strip-types src/lib/claudeSessions.test.ts src/lib/claudeTerminalAutomation.test.ts src/lib/updateFlow.test.ts
pnpm -s tsc --noEmit
cargo fmt --check
cargo clippy -- -D warnings
cargo test -- --nocapture
pnpm run build
```

Expected:

- all tests pass
- typecheck passes
- clippy emits no warnings
- build produces the `.app` and `.dmg`

**Step 4: Commit and release**

```bash
git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -m "release: v0.1.17"
git push origin codex/self-update
```

After code review and branch completion, merge back to `main`, push `main`, create and push:

```bash
git tag -a v0.1.17 -m "v0.1.17"
git push origin v0.1.17
```

**Step 5: Confirm the remote release workflow**

Run:

```bash
gh run list --limit 10
gh run watch <release-run-id> --exit-status
gh release view v0.1.17 --json url,assets
```

Expected: CI green, release green, DMG assets published.
