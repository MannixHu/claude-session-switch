# Update Dialog Design

## Goal

Replace the current confirm/alert updater interaction with a dedicated in-app update dialog that shows version details, release content, and direct actions for downloading the installer or opening the GitHub release page.

## Current State

- `Check for Updates…` triggers a menu event handled in `ProjectDashboard.tsx`.
- The frontend uses `window.confirm()` and `window.alert()` after `check_for_updates`.
- The backend only returns installer metadata required for downloading, not release body or publish metadata.
- The app already has a lightweight update state machine in `src/lib/updateFlow.ts`.

## Design

### Dialog Behavior

Add an update dialog with five visible states:

- `checking`
- `up_to_date`
- `available`
- `downloading`
- `error`

The dialog opens immediately when the menu action is triggered. It stays open through the update flow and replaces native `confirm/alert` usage.

### Content

When an update is available, the dialog shows:

- current version
- latest version
- published date
- a structured changelog table extracted from the GitHub release body
- the remaining GitHub release notes content

When no update is available, the dialog shows a clear “up to date” state using the checked versions.

When download succeeds, the dialog stays open and shows install guidance plus shortcuts to re-open the downloaded installer path if needed in the future.

### Backend Data

Extend `UpdateCheckResult` with release metadata from GitHub:

- `release_url`
- `published_at`
- `release_notes`

These fields come from the latest release API payload and are returned alongside installer metadata.

### Release Notes Parsing

Frontend parsing is sufficient:

- if the release body contains a `## Changelog` markdown table, parse it into rows for a native HTML table
- render the rest of the body as pre-wrapped release notes text
- if the changelog table is absent, show the body as plain notes only

### UX Actions

Dialog actions:

- `Download & Open Installer`
- `View on GitHub`
- `Later` / `Close`

While downloading:

- disable duplicate actions
- show progress state text even though exact byte progress is not available yet

### Styling

Reuse the existing settings modal visual language so the update dialog feels native to the app, but keep it separate enough to emphasize release information:

- larger width
- scrollable notes region
- table styling for changelog rows

## Testing

### Frontend

- add tests for release notes parsing
- update `updateFlow` tests so checked metadata is preserved for dialog rendering

### Backend

- extend `update_service` tests to verify release metadata fields are parsed and returned

## Non-Goals

- byte-level download progress
- automatic in-place app replacement
- a separate Tauri window for updates
