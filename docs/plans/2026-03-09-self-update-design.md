# Self-Update Design

## Goal

Add a macOS app-menu action that checks GitHub Releases for a newer version, downloads the matching DMG for the current machine, verifies it, opens the installer, and guides the user to replace the app in `Applications`.

## Confirmed Product Decisions

- Entry point lives in the macOS application menu, alongside the existing settings/config items.
- Update behavior follows the "guided install" path:
  - check for the latest GitHub Release
  - download the correct DMG for the current architecture
  - verify the download
  - open the DMG automatically
  - show a final instruction telling the user to drag the app into `Applications`
- No in-place binary replacement in this iteration.
- No Tauri updater manifest/signing migration in this iteration.

## Current Context

The app is a Tauri v2 desktop application. macOS app-menu items are manually inserted in `src-tauri/src/main.rs`. The release pipeline publishes GitHub Releases with these assets:

- `ClaudeSessionSwitch_<version>_arm64.dmg`
- `ClaudeSessionSwitch_<version>_x64.dmg`
- `SHA256SUMS`

The app does not currently have an updater plugin or a release metadata endpoint beyond GitHub Releases.

## User Experience

### Menu Entry

Add a new menu item labeled `Check for Updates…` in the app submenu on macOS.

### Check Flow

When the user clicks the menu item:

1. Bring the main window to the foreground.
2. Emit a frontend event to begin the update check.
3. Show one of these outcomes:
   - `Already up to date`
   - `New version available`
   - `Unable to check for updates`

### Install Flow

If a new version is found and the user confirms:

1. Download the matching DMG for the current architecture.
2. Verify it against the checksum from `SHA256SUMS`.
3. Open the downloaded DMG with the default macOS handler.
4. Show a follow-up message telling the user to drag the new app into `Applications` to finish the upgrade.

## Architecture

The update feature is split into three layers:

### 1. Native Menu Layer

`src-tauri/src/main.rs`

- Add a new menu item ID for update checks.
- Reuse the existing event-emission pattern to wake the main window and signal the frontend.
- Keep menu behavior macOS-only for now, matching the DMG distribution path.

### 2. Frontend Orchestration Layer

`src/pages/ProjectDashboard.tsx`
`src/lib/i18n.ts`

- Listen for the new menu event.
- Coordinate user-facing states:
  - idle
  - checking
  - update available
  - downloading
  - success / open-installer guidance
  - failure
- Prevent duplicate update jobs from being started while one is already active.
- Use simple browser confirmation/alert flows to stay consistent with the app’s current confirmation style.

### 3. Rust Update Service Layer

New command and service modules in `src-tauri/src/commands/` and `src-tauri/src/services/`

- `check_for_updates`
  - determine current app version
  - fetch and parse the latest GitHub Release
  - compare versions
  - choose the correct DMG asset for the current CPU architecture
  - identify the expected checksum from `SHA256SUMS`
  - return structured update metadata to the frontend
- `download_and_open_update`
  - download the DMG into a temporary update directory
  - verify the checksum
  - open the DMG via `open`
  - return success metadata or a precise error

## Release Integration

The feature is intentionally coupled to the current GitHub Release naming convention. Asset selection will rely on:

- current release tag, normalized from `vX.Y.Z` to `X.Y.Z` for comparisons
- CPU architecture:
  - Apple Silicon -> `arm64`
  - Intel -> `x64`
- fixed DMG naming already produced by the release workflow

This keeps implementation aligned with the existing release pipeline instead of introducing a second update channel.

## Data Model

The backend should return a compact update payload, conceptually shaped like:

- current version
- latest version
- whether an update is available
- target architecture
- DMG download URL
- expected checksum

The download command should return:

- downloaded file path
- opened file path
- target version

## Error Handling

Errors should be explicit and user-facing:

- network/request failure while checking releases
- malformed or incomplete GitHub Release payload
- no DMG for the current architecture
- missing `SHA256SUMS`
- checksum mismatch
- filesystem write failure
- failure to open the downloaded DMG

The backend should fail closed: if release metadata is incomplete or checksum verification fails, do not open the installer.

## Temporary Files

Downloaded installers should go into a dedicated temporary update directory under the OS temp area, not the app data directory. Old downloaded DMGs from previous attempts can be overwritten or removed before writing a fresh file.

## Out of Scope

- in-place replacement of the running `.app`
- Windows or Linux updater UX
- background auto-update checks
- scheduled update polling
- notarization/updater-signature infrastructure
- delta updates

## Testing Strategy

### Rust Tests

- parse latest-release JSON
- normalize/compare versions
- choose correct architecture asset
- parse `SHA256SUMS`
- reject incomplete release payloads
- reject checksum mismatches

### Frontend Tests

- ignore duplicate update triggers while a check/download is in progress
- map backend results into the correct UI prompts
- surface failure messages cleanly

### Manual Verification

On macOS:

1. Trigger the menu item.
2. Confirm the app finds a newer GitHub Release.
3. Confirm the correct DMG is downloaded for the host architecture.
4. Confirm checksum verification passes.
5. Confirm the DMG opens automatically.
6. Confirm the user sees install guidance.

## Recommended Implementation Order

1. Add backend parsing/matching/checksum tests.
2. Implement the Rust update service and commands.
3. Wire the new menu event in `main.rs`.
4. Add frontend orchestration and user prompts.
5. Run local verification.
6. Build and tag a release to exercise the end-to-end update path.
